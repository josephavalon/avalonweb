import crypto from 'crypto';
import { requestError } from './nurse-workflow.js';

const OPAQUE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const DEFAULT_TIMEOUT_MS = 8000;
let cachedGoogleToken = null;

function enabled(value) {
  return ['true', '1', 'yes'].includes(String(value || '').trim().toLowerCase());
}

export function routeProviderConfiguration() {
  const provider = String(process.env.NURSE_ROUTE_PROVIDER || 'disabled').trim().toLowerCase();
  if (!enabled(process.env.NURSE_ROUTE_PLANNING_ENABLED)) {
    return { ready: false, provider, reason: 'route_planning_disabled' };
  }
  if (enabled(process.env.NURSE_ROUTE_PROVIDER_KILL_SWITCH ?? 'true')) {
    return { ready: false, provider, reason: 'route_provider_kill_switch_active' };
  }
  if (provider !== 'google') return { ready: false, provider, reason: 'route_provider_disabled' };
  const auth = googleAuthConfiguration();
  if (!auth.ready) return { ...auth, provider };
  if (!String(process.env.GOOGLE_ROUTE_OPTIMIZATION_LOCATION || '').trim()) {
    return { ready: false, provider, reason: 'route_provider_location_missing' };
  }
  const dailyQuota = Number(process.env.NURSE_ROUTE_PROVIDER_DAILY_QUOTA || 0);
  const perMinuteLimit = Number(process.env.NURSE_ROUTE_PROVIDER_MAX_REQUESTS_PER_MINUTE || 0);
  return !Number.isInteger(dailyQuota) || dailyQuota <= 0
    ? { ready: false, provider, reason: 'route_provider_quota_disabled' }
    : !Number.isInteger(perMinuteLimit) || perMinuteLimit <= 0
      ? { ready: false, provider, reason: 'route_provider_rate_limit_disabled' }
    : { ready: true, provider };
}

function googleAuthConfiguration() {
  const required = [
    'GOOGLE_ROUTE_OPTIMIZATION_PROJECT_ID',
    'GOOGLE_WORKLOAD_IDENTITY_PROVIDER',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'VERCEL_OIDC_TOKEN',
  ];
  const missing = required.filter((key) => !String(process.env[key] || '').trim());
  return missing.length
    ? { ready: false, reason: 'route_provider_credentials_missing', missing }
    : { ready: true };
}

function finiteCoordinate(value, min, max, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw requestError(`${field} is invalid.`, 'invalid_route_coordinate');
  }
  return number;
}

function opaqueId(value, field) {
  const normalized = String(value || '').trim();
  if (!OPAQUE_ID_RE.test(normalized)) {
    throw requestError(`${field} must be an opaque identifier.`, 'invalid_route_stop_id');
  }
  return normalized;
}

function iso(value, field) {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) throw requestError(`${field} is invalid.`, 'invalid_route_time_window');
  return new Date(timestamp).toISOString();
}

function boundedInteger(value, field, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw requestError(`${field} is invalid.`, 'route_constraints_invalid');
  }
  return number;
}

function durationSeconds(value) {
  const match = String(value || '').match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  return match ? Number(match[1]) : 0;
}

function sanitizeRouteConstraints(raw, { stops, shiftStart, shiftEnd }) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw requestError('Approved route constraints are required.', 'route_constraints_required', 409);
  }
  const requiredBreaks = Array.isArray(raw.requiredBreaks) ? raw.requiredBreaks.map((entry, index) => {
    const windowStart = iso(entry?.windowStart, `Break ${index + 1} window start`);
    const windowEnd = iso(entry?.windowEnd, `Break ${index + 1} window end`);
    const durationMinutes = boundedInteger(entry?.durationMinutes, `Break ${index + 1} duration`, 1, 480);
    if (Date.parse(windowEnd) <= Date.parse(windowStart)
        || Date.parse(windowStart) < Date.parse(shiftStart)
        || Date.parse(windowEnd) > Date.parse(shiftEnd)) {
      throw requestError(`Break ${index + 1} window is invalid.`, 'route_constraints_invalid');
    }
    return { windowStart, windowEnd, durationMinutes };
  }) : null;
  if (!requiredBreaks) throw requestError('Approved break constraints are required.', 'route_constraints_required', 409);
  const tollPolicy = String(raw.tollPolicy || '').trim().toLowerCase();
  if (!['avoid', 'allow'].includes(tollPolicy)) {
    throw requestError('Approved toll policy is required.', 'route_constraints_required', 409);
  }
  let depotHours = null;
  if (stops.some((stop) => stop.kind === 'pickup')) {
    const start = iso(raw.depotHours?.start, 'Depot opening time');
    const end = iso(raw.depotHours?.end, 'Depot closing time');
    if (Date.parse(end) <= Date.parse(start)) {
      throw requestError('Approved depot hours are invalid.', 'route_constraints_invalid');
    }
    depotHours = { start, end };
  }
  const constraints = {
    maxStops: boundedInteger(raw.maxStops, 'Maximum stops', 1, 100),
    maxWorkMinutes: boundedInteger(raw.maxWorkMinutes, 'Maximum work minutes', 1, 1440),
    maxTravelMinutes: boundedInteger(raw.maxTravelMinutes, 'Maximum travel minutes', 1, 1440),
    requiredBreaks,
    parkingBufferMinutes: boundedInteger(raw.parkingBufferMinutes, 'Parking buffer', 0, 240),
    serviceBufferMinutes: boundedInteger(raw.serviceBufferMinutes, 'Service buffer', 0, 240),
    observationBufferMinutes: boundedInteger(raw.observationBufferMinutes, 'Observation buffer', 0, 480),
    coldChainMaxElapsedMinutes: boundedInteger(raw.coldChainMaxElapsedMinutes, 'Cold-chain elapsed limit', 1, 1440),
    tollPolicy,
    depotHours,
  };
  if (stops.length > constraints.maxStops) {
    throw requestError('The route exceeds the approved stop limit.', 'route_max_stops_exceeded', 409);
  }
  return constraints;
}

export function sanitizeRouteOptimizationInput(input = {}) {
  const origin = input.origin || {};
  const sanitizedStops = (Array.isArray(input.stops) ? input.stops : []).map((stop, index) => {
    const start = iso(stop.windowStart, `Stop ${index + 1} window start`);
    const end = iso(stop.windowEnd, `Stop ${index + 1} window end`);
    if (Date.parse(end) <= Date.parse(start)) {
      throw requestError(`Stop ${index + 1} time window is invalid.`, 'invalid_route_time_window');
    }
    const durationMinutes = Number(stop.durationMinutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 0 || durationMinutes > 1440) {
      throw requestError(`Stop ${index + 1} duration is invalid.`, 'invalid_route_duration');
    }
    const load = Number(stop.load || 0);
    if (!Number.isFinite(load) || load < 0 || load > 100000) {
      throw requestError(`Stop ${index + 1} load is invalid.`, 'invalid_route_load');
    }
    const rawPredecessors = Array.isArray(stop.pickupPredecessorIds)
      ? stop.pickupPredecessorIds
      : stop.pickupPredecessorId ? [stop.pickupPredecessorId] : [];
    if (rawPredecessors.length > 50) {
      throw requestError(`Stop ${index + 1} has too many pickup dependencies.`, 'invalid_pickup_precedence');
    }
    const pickupPredecessorIds = rawPredecessors.map((value) => (
      opaqueId(value, `Stop ${index + 1} predecessor`)
    ));
    if (new Set(pickupPredecessorIds).size !== pickupPredecessorIds.length) {
      throw requestError(`Stop ${index + 1} repeats a pickup dependency.`, 'invalid_pickup_precedence');
    }
    return {
      id: opaqueId(stop.id, `Stop ${index + 1} id`),
      kind: ['appointment', 'pickup'].includes(stop.kind) ? stop.kind : 'appointment',
      latitude: finiteCoordinate(stop.latitude, -90, 90, `Stop ${index + 1} latitude`),
      longitude: finiteCoordinate(stop.longitude, -180, 180, `Stop ${index + 1} longitude`),
      windowStart: start,
      windowEnd: end,
      durationMinutes: Math.round(durationMinutes),
      load: Math.round(load),
      pickupPredecessorIds,
      pickupPredecessorId: pickupPredecessorIds[0] || null,
    };
  });
  const shiftStart = iso(input.shiftStart, 'Route shift start');
  const shiftEnd = iso(input.shiftEnd, 'Route shift end');
  if (sanitizedStops.some((stop) => Date.parse(stop.windowStart) <= Date.parse(shiftStart)
      || Date.parse(stop.windowEnd) >= Date.parse(shiftEnd))) {
    throw requestError(
      'Approved route-day bounds must surround every stop window.',
      'route_day_bounds_invalid',
      409,
    );
  }
  const constraints = sanitizeRouteConstraints(input.constraints, {
    stops: sanitizedStops, shiftStart, shiftEnd,
  });
  for (const stop of sanitizedStops) {
    stop.durationMinutes += constraints.parkingBufferMinutes + constraints.serviceBufferMinutes
      + (stop.kind === 'appointment' ? constraints.observationBufferMinutes : 0);
    if (stop.kind === 'pickup' && constraints.depotHours) {
      stop.windowStart = new Date(Math.max(Date.parse(stop.windowStart), Date.parse(constraints.depotHours.start))).toISOString();
      stop.windowEnd = new Date(Math.min(Date.parse(stop.windowEnd), Date.parse(constraints.depotHours.end))).toISOString();
      if (Date.parse(stop.windowEnd) <= Date.parse(stop.windowStart)) {
        throw requestError('A pickup window falls outside approved depot hours.', 'route_depot_hours_conflict', 409);
      }
    }
  }
  const constraintsHash = String(input.constraintsHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(constraintsHash)) {
    throw requestError('Approved route-constraint hash is required.', 'route_constraints_required', 409);
  }
  const sanitized = {
    routeDayId: opaqueId(input.routeDayId, 'Route day id'),
    routePolicyId: opaqueId(input.routePolicyId, 'Route policy id'),
    constraintsHash,
    origin: {
      latitude: finiteCoordinate(origin.latitude, -90, 90, 'Origin latitude'),
      longitude: finiteCoordinate(origin.longitude, -180, 180, 'Origin longitude'),
    },
    stops: sanitizedStops,
    capacity: Math.round(Number(input.capacity || 0)),
    shiftStart,
    shiftEnd,
    constraints,
  };
  if (!sanitized.stops.length) throw requestError('At least one route stop is required.', 'route_stops_required');
  if (new Set(sanitized.stops.map((stop) => stop.id)).size !== sanitized.stops.length) {
    throw requestError('Route stop identifiers must be unique.', 'duplicate_route_stop_id');
  }
  if (!Number.isFinite(sanitized.capacity) || sanitized.capacity < 0 || sanitized.capacity > 100000) {
    throw requestError('Route capacity is invalid.', 'invalid_route_capacity');
  }
  if (Date.parse(sanitized.shiftEnd) <= Date.parse(sanitized.shiftStart)) {
    throw requestError('Route shift bounds are invalid.', 'invalid_route_shift_bounds');
  }
  return sanitized;
}

export function routeRequestHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function buildGoogleRouteRequest(input) {
  const waypoint = (latitude, longitude) => ({ location: { latLng: { latitude, longitude } } });
  const indexById = new Map(input.stops.map((stop, index) => [stop.id, index]));
  const shipments = input.stops.map((stop) => {
    const visit = {
      arrivalWaypoint: waypoint(stop.latitude, stop.longitude),
      timeWindows: [{ startTime: stop.windowStart, endTime: stop.windowEnd }],
      duration: `${stop.durationMinutes * 60}s`,
    };
    return {
      label: stop.id,
      ...(stop.kind === 'pickup' ? { pickups: [visit] } : { deliveries: [visit] }),
      loadDemands: stop.load ? { kit_units: { amount: String(stop.load) } } : undefined,
    };
  });
  const precedenceRules = input.stops.flatMap((stop) => stop.pickupPredecessorIds.map((predecessorId) => {
    const firstIndex = indexById.get(predecessorId);
    const secondIndex = indexById.get(stop.id);
    if (firstIndex == null || input.stops[firstIndex]?.kind !== 'pickup') {
      throw requestError('Pickup precedence references an unavailable pickup stop.', 'invalid_pickup_precedence');
    }
    if (input.stops[secondIndex]?.kind !== 'appointment') {
      throw requestError('Only appointment stops can depend on a pickup.', 'invalid_pickup_precedence');
    }
    return {
      firstIndex,
      firstIsDelivery: false,
      secondIndex,
      secondIsDelivery: true,
      offsetDuration: '0s',
    };
  }));
  return {
    model: {
      globalStartTime: input.shiftStart,
      globalEndTime: input.shiftEnd,
      shipments,
      precedenceRules,
      vehicles: [{
        label: input.routeDayId,
        startWaypoint: waypoint(input.origin.latitude, input.origin.longitude),
        startTimeWindows: [{ startTime: input.shiftStart, endTime: input.shiftStart }],
        endTimeWindows: [{ startTime: input.shiftEnd, endTime: input.shiftEnd }],
        loadLimits: input.capacity ? { kit_units: { maxLoad: String(input.capacity) } } : undefined,
        routeModifiers: { avoidTolls: input.constraints.tollPolicy === 'avoid' },
        routeDurationLimit: { maxDuration: `${input.constraints.maxWorkMinutes * 60}s` },
        travelDurationLimit: { maxDuration: `${input.constraints.maxTravelMinutes * 60}s` },
        breakRule: input.constraints.requiredBreaks.length ? {
          breakRequests: input.constraints.requiredBreaks.map((entry) => ({
            earliestStartTime: entry.windowStart,
            latestStartTime: entry.windowEnd,
            minDuration: `${entry.durationMinutes * 60}s`,
          })),
        } : undefined,
      }],
    },
    // Persist the provider's encoded road geometry separately from the
    // feasibility evidence. The Nurse map is presentation-only; order and
    // timing remain authoritative in visits/transitions.
    populatePolylines: true,
    considerRoadTraffic: true,
  };
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error('Route provider request failed.');
      error.code = response.status === 429 ? 'route_provider_quota' : 'route_provider_error';
      error.status = 503;
      error.providerStatus = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw Object.assign(new Error('Route provider timed out.'), { code: 'route_provider_timeout', status: 503 });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function googleAccessToken(timeoutMs) {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60000) return cachedGoogleToken.value;
  const subjectToken = String(process.env.VERCEL_OIDC_TOKEN || '');
  const audience = String(process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER || '');
  const sts = await fetchJson('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      audience,
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      subject_token: subjectToken,
    }),
  }, timeoutMs);
  const serviceAccount = encodeURIComponent(String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ''));
  const impersonated = await fetchJson(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${sts.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/cloud-platform'], lifetime: '1800s' }),
    },
    timeoutMs,
  );
  if (!impersonated.accessToken) throw Object.assign(new Error('Google access token unavailable.'), { code: 'route_provider_auth_failed', status: 503 });
  cachedGoogleToken = {
    value: impersonated.accessToken,
    expiresAt: Math.min(Date.parse(impersonated.expireTime || '') || Date.now() + 25 * 60 * 1000, Date.now() + 25 * 60 * 1000),
  };
  return cachedGoogleToken.value;
}

export async function geocodeTypedNurseOrigin(db, {
  tenantId,
  actorProfileId,
  routeDayId,
  address,
  idempotencyKey,
}) {
  if (!enabled(process.env.NURSE_TYPED_ORIGIN_GEOCODING_ENABLED)) {
    throw Object.assign(new Error('Typed-origin geocoding is disabled.'), {
      code: 'typed_origin_geocoding_disabled', status: 503, expose: true,
    });
  }
  const configuration = googleAuthConfiguration();
  if (!configuration.ready) {
    throw Object.assign(new Error('Typed-origin geocoding is unavailable.'), {
      code: configuration.reason, status: 503, expose: true,
    });
  }
  const normalizedAddress = String(address || '').trim().replace(/\s+/g, ' ').slice(0, 300);
  if (normalizedAddress.length < 5) throw requestError('Typed origin is invalid.', 'invalid_typed_origin');
  const hashSecret = String(process.env.NURSE_ROUTE_REQUEST_HASH_SECRET || '');
  if (hashSecret.length < 32) {
    throw Object.assign(new Error('Typed-origin request hashing is not configured.'), {
      code: 'route_request_hash_secret_missing', status: 503, expose: true,
    });
  }
  const geocodeRequestHash = crypto.createHmac('sha256', hashSecret).update(JSON.stringify({
    routeDayId, idempotencyKey, address: normalizedAddress,
  })).digest('hex');
  const dailyQuota = Number(process.env.NURSE_GEOCODING_DAILY_QUOTA || 0);
  const perMinuteLimit = Number(process.env.NURSE_ROUTE_PROVIDER_MAX_REQUESTS_PER_MINUTE || 0);
  if (!Number.isInteger(dailyQuota) || dailyQuota <= 0) {
    throw Object.assign(new Error('Typed-origin geocoding quota is disabled.'), {
      code: 'typed_origin_geocoding_quota_disabled', status: 503, expose: true,
    });
  }
  if (!Number.isInteger(perMinuteLimit) || perMinuteLimit <= 0) {
    throw Object.assign(new Error('Typed-origin geocoding rate limit is disabled.'), {
      code: 'typed_origin_geocoding_rate_limit_disabled', status: 503, expose: true,
    });
  }
  const quota = await db.rpc('consume_nurse_route_provider_quota_v1', {
    p_tenant_id: tenantId,
    p_actor_profile_id: actorProfileId,
    p_route_day_id: routeDayId,
    p_provider: 'google_geocoding',
    p_request_idempotency_key: idempotencyKey,
    p_request_hash: geocodeRequestHash,
    p_daily_limit: dailyQuota,
    p_per_minute_limit: perMinuteLimit,
  });
  if (quota.error) throw quota.error;
  const quotaRow = Array.isArray(quota.data) ? quota.data[0] : quota.data;
  if (quotaRow?.allowed === false) {
    throw Object.assign(new Error('Typed-origin geocoding quota is exhausted.'), {
      code: 'typed_origin_geocoding_quota_exhausted', status: 429, expose: true,
    });
  }
  const timeoutMs = Math.max(1000, Math.min(30000, Number(process.env.NURSE_ROUTE_PROVIDER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS));
  const token = await googleAccessToken(timeoutMs);
  const projectId = String(process.env.GOOGLE_ROUTE_OPTIMIZATION_PROJECT_ID || '');
  const response = await fetchJson(
    `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(normalizedAddress)}?regionCode=US&languageCode=en-US`,
    { headers: { Authorization: `Bearer ${token}`, 'X-Goog-User-Project': projectId } },
    timeoutMs,
  );
  const first = Array.isArray(response.results) ? response.results[0] : null;
  const latitude = Number(first?.location?.latitude);
  const longitude = Number(first?.location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw Object.assign(new Error('Typed origin could not be resolved.'), {
      code: 'typed_origin_not_resolved', status: 422, expose: true,
    });
  }
  return {
    latitude: finiteCoordinate(latitude, -90, 90, 'Origin latitude'),
    longitude: finiteCoordinate(longitude, -180, 180, 'Origin longitude'),
    formattedAddress: String(first?.formattedAddress || normalizedAddress).trim().slice(0, 300),
    provider: 'google',
  };
}

export async function optimizeNurseRoute(rawInput) {
  const configuration = routeProviderConfiguration();
  if (!configuration.ready) {
    throw Object.assign(new Error('Route planning is unavailable.'), {
      code: configuration.reason,
      status: 503,
      expose: true,
    });
  }
  const input = sanitizeRouteOptimizationInput(rawInput);
  const request = buildGoogleRouteRequest(input);
  const timeoutMs = Math.max(1000, Math.min(30000, Number(process.env.NURSE_ROUTE_PROVIDER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS));
  const token = await googleAccessToken(timeoutMs);
  const projectId = encodeURIComponent(String(process.env.GOOGLE_ROUTE_OPTIMIZATION_PROJECT_ID || ''));
  const location = encodeURIComponent(String(process.env.GOOGLE_ROUTE_OPTIMIZATION_LOCATION || 'global'));
  const response = await fetchJson(
    `https://routeoptimization.googleapis.com/v1/projects/${projectId}/locations/${location}:optimizeTours`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
    timeoutMs,
  );
  const skipped = Array.isArray(response.skippedShipments) ? response.skippedShipments : [];
  const validationErrors = Array.isArray(response.validationErrors) ? response.validationErrors : [];
  if (skipped.length || validationErrors.length || !Array.isArray(response.routes) || response.routes.length !== 1) {
    throw Object.assign(new Error('The route provider could not include every required stop.'), {
      code: skipped.length ? 'route_provider_skipped_stops' : 'route_provider_infeasible',
      status: 422,
      expose: true,
    });
  }
  const route = response.routes[0];
  const overviewPolyline = String(route.routePolyline?.points || '').trim();
  const visits = Array.isArray(route.visits) ? route.visits : [];
  const orderedIds = visits.map((visit) => input.stops[visit.shipmentIndex]?.id).filter(Boolean);
  if (orderedIds.length !== input.stops.length || new Set(orderedIds).size !== input.stops.length) {
    throw Object.assign(new Error('The route provider omitted a required stop.'), {
      code: 'route_provider_skipped_stops', status: 422, expose: true,
    });
  }
  const orderedIndex = new Map(orderedIds.map((id, index) => [id, index]));
  const precedenceViolated = input.stops.some((stop) => stop.pickupPredecessorIds.some((predecessorId) => (
    orderedIndex.get(predecessorId) == null
    || orderedIndex.get(stop.id) == null
    || orderedIndex.get(predecessorId) >= orderedIndex.get(stop.id)
  )));
  if (precedenceViolated) {
    throw Object.assign(new Error('The route provider violated a required pickup sequence.'), {
      code: 'route_provider_precedence_violation', status: 422, expose: true,
    });
  }
  const travelSeconds = (Array.isArray(route.transitions) ? route.transitions : [])
    .reduce((total, transition) => total + durationSeconds(transition.travelDuration), 0);
  const routeStartMs = Date.parse(route.vehicleStartTime || visits[0]?.startTime || '');
  const routeEndMs = Date.parse(route.vehicleEndTime || visits.at(-1)?.startTime || '');
  const workMinutes = Number.isFinite(routeStartMs) && Number.isFinite(routeEndMs)
    ? Math.max(0, routeEndMs - routeStartMs) / 60000 : Number.POSITIVE_INFINITY;
  if (travelSeconds > input.constraints.maxTravelMinutes * 60
      || workMinutes > input.constraints.maxWorkMinutes) {
    throw Object.assign(new Error('The route exceeds approved work or travel limits.'), {
      code: 'route_provider_constraint_violation', status: 422, expose: true,
    });
  }
  const routeBreaks = Array.isArray(route.breaks) ? route.breaks : [];
  const breakViolation = input.constraints.requiredBreaks.some((required, index) => {
    const actual = routeBreaks[index];
    const start = Date.parse(actual?.startTime || '');
    return !Number.isFinite(start)
      || start < Date.parse(required.windowStart)
      || start > Date.parse(required.windowEnd)
      || durationSeconds(actual?.duration) < required.durationMinutes * 60;
  });
  if (breakViolation) {
    throw Object.assign(new Error('The route provider omitted a required break.'), {
      code: 'route_provider_break_violation', status: 422, expose: true,
    });
  }
  const visitByStopId = new Map(visits.map((visit, index) => [orderedIds[index], visit]));
  const coldChainEvidence = [];
  for (const stop of input.stops.filter((candidate) => candidate.kind === 'appointment')) {
    for (const predecessorId of stop.pickupPredecessorIds) {
      const pickupStop = input.stops.find((candidate) => candidate.id === predecessorId);
      const pickupVisit = visitByStopId.get(predecessorId);
      const appointmentVisit = visitByStopId.get(stop.id);
      const elapsedMinutes = (Date.parse(appointmentVisit?.startTime || '')
        - (Date.parse(pickupVisit?.startTime || '') + Number(pickupStop?.durationMinutes || 0) * 60000)) / 60000;
      if (!Number.isFinite(elapsedMinutes) || elapsedMinutes < 0
          || elapsedMinutes > input.constraints.coldChainMaxElapsedMinutes) {
        throw Object.assign(new Error('The route violates the approved cold-chain elapsed limit.'), {
          code: 'route_provider_cold_chain_violation', status: 422, expose: true,
        });
      }
      coldChainEvidence.push({ pickupStopId: predecessorId, appointmentStopId: stop.id, elapsedMinutes });
    }
  }
  const constraintEvidence = {
    routePolicyId: input.routePolicyId,
    constraintsHash: input.constraintsHash,
    stopCount: orderedIds.length,
    workMinutes: Math.ceil(workMinutes),
    travelMinutes: Math.ceil(travelSeconds / 60),
    requiredBreakCount: input.constraints.requiredBreaks.length,
    completedBreakCount: routeBreaks.length,
    tollPolicy: input.constraints.tollPolicy,
    precedenceEdgeCount: input.stops.reduce((total, stop) => total + stop.pickupPredecessorIds.length, 0),
    coldChain: coldChainEvidence,
  };
  return {
    provider: 'google',
    requestHash: routeRequestHash(input),
    responseHash: routeRequestHash({
      orderedIds,
      startTime: route.vehicleStartTime,
      endTime: route.vehicleEndTime,
      overviewPolyline,
    }),
    overviewPolyline: overviewPolyline || null,
    orderedStopIds: orderedIds,
    constraintEvidence,
    visits: visits.map((visit, index) => ({
      stopId: orderedIds[index],
      startTime: visit.startTime || null,
      detour: visit.detour || null,
    })),
    transitions: Array.isArray(route.transitions) ? route.transitions.map((transition) => ({
      travelDuration: transition.travelDuration || null,
      travelDistanceMeters: transition.travelDistanceMeters ?? null,
      waitDuration: transition.waitDuration || null,
      breakDuration: transition.breakDuration || null,
    })) : [],
    metrics: response.metrics || null,
  };
}

export async function consumeRouteProviderQuota(db, {
  tenantId,
  actorProfileId,
  routeDayId,
  idempotencyKey,
  requestHash,
}) {
  const dailyQuota = Number(process.env.NURSE_ROUTE_PROVIDER_DAILY_QUOTA || 0);
  const perMinuteLimit = Number(process.env.NURSE_ROUTE_PROVIDER_MAX_REQUESTS_PER_MINUTE || 0);
  if (!Number.isInteger(dailyQuota) || dailyQuota <= 0
    || !Number.isInteger(perMinuteLimit) || perMinuteLimit <= 0) {
    throw Object.assign(new Error('Route provider quota is disabled.'), {
      code: 'route_provider_quota_disabled', status: 503, expose: true,
    });
  }
  const result = await db.rpc('consume_nurse_route_provider_quota_v1', {
    p_tenant_id: tenantId,
    p_actor_profile_id: actorProfileId,
    p_route_day_id: routeDayId,
    p_provider: 'google_route_optimization',
    p_request_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_daily_limit: dailyQuota,
    p_per_minute_limit: perMinuteLimit,
  });
  if (result.error) throw result.error;
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (row?.allowed === false) {
    throw Object.assign(new Error('Route provider quota is exhausted.'), {
      code: 'route_provider_quota_exhausted', status: 429, expose: true,
    });
  }
  return row;
}
