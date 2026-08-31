import { buildFixedAppointmentRoute, DEFAULT_SERVICE_DURATION_MINUTES, maneuverInstruction, routeEligibility } from '../../src/lib/nurseRoute.js';

export const ROUTE_ROLES = ['nurse', 'rn', 'np', 'admin'];
export const OMIT_REASONS = new Set(['timing_conflict', 'unavailable', 'duplicate_cancelled', 'admin_review', 'other']);

export function routeFeatureEnabled() {
  return /^(1|true|yes)$/i.test(String(process.env.NURSE_ROUTE_ENABLED || ''));
}

export function requireRouteApproval(res) {
  if (routeFeatureEnabled()) return true;
  res.status(503).json({ error: 'Nurse routing is awaiting privacy and security approval.', code: 'route_feature_disabled' });
  return false;
}

export async function getProviderForAuth(authed) {
  const query = authed.db.from('provider_profiles')
    .select('id, tenant_id, profile_id, provider_role, credential_status, nursys_status, scope_tags, active')
    .eq('profile_id', authed.user.id)
    .eq('tenant_id', authed.tenantId)
    .maybeSingle();
  const { data, error } = await query;
  if (error) throw error;
  if (!data) return null;

  // provider_profiles.profile_id references auth.users, not public.profiles.
  // PostgREST therefore cannot infer the embedded `profiles:profile_id(...)`
  // relationship; load the display name explicitly instead.
  const { data: profile, error: profileError } = await authed.db.from('profiles')
    .select('full_name')
    .eq('id', authed.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  return { ...data, profiles: profile || null };
}

export function dateRange(dateValue) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || '')) ? String(dateValue) : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  // SF is UTC-8 in winter and UTC-7 in summer; noon avoids the DST boundary.
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(noonUtc).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
  const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offsetMs = represented - noonUtc.getTime();
  const start = new Date(Date.parse(`${date}T00:00:00Z`) - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { date, start: start.toISOString(), end: end.toISOString() };
}

function durationFor(row) {
  const payload = row.external_payload || {};
  const value = Number(payload.appointment?.durationMinutes || payload.durationMinutes || payload.primaryServiceDurationMinutes || row.duration_minutes);
  return Number.isFinite(value) && value > 0 ? { minutes: value, assumed: false } : { minutes: DEFAULT_SERVICE_DURATION_MINUTES, assumed: true };
}

export function shapeAssignedAppointment(row, savedStop) {
  const payload = row.external_payload || {};
  const appointment = payload.appointment || {};
  const contact = payload.contact || {};
  const duration = durationFor(row);
  const readiness = routeEligibility(row);
  const address = String(appointment.address || payload.address || '').trim();
  const name = String(contact.firstName || contact.name || 'Client').trim().split(/\s+/)[0];
  const coordinateSource = appointment.coordinate || appointment.coordinates || payload.coordinate || payload.coordinates || {};
  const latitude = Number(coordinateSource.latitude ?? coordinateSource.lat ?? appointment.latitude ?? appointment.lat);
  const longitude = Number(coordinateSource.longitude ?? coordinateSource.lng ?? coordinateSource.lon ?? appointment.longitude ?? appointment.lng ?? appointment.lon);
  return {
    appointmentId: row.id,
    clientDisplayName: name || 'Client',
    service: payload.primaryService || row.protocol_key || 'Avalon Visit',
    neighborhood: appointment.neighborhood || appointment.city || address.split(',')[0] || 'Bay Area',
    address,
    scheduledAt: row.starts_at,
    durationMinutes: duration.minutes,
    durationAssumed: duration.assumed,
    status: row.status || 'assigned',
    eligible: readiness.eligible && Boolean(address),
    blocker: address ? readiness.blocker : 'Address required',
    selected: savedStop ? savedStop.selected : readiness.eligible && Boolean(address),
    omissionReason: savedStop?.omission_reason || '',
    omissionNote: savedStop?.omission_note || '',
    coordinate: Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined,
  };
}

export async function loadAssignedAppointments({ db, tenantId, providerId, date }) {
  const range = dateRange(date);
  const { data, error } = await db.from('appointments')
    .select('id, tenant_id, provider_profile_id, status, starts_at, updated_at, protocol_key, payment_status, gfe_status, external_payload')
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerId)
    .gte('starts_at', range.start)
    .lt('starts_at', range.end)
    .neq('status', 'archived')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return { ...range, rows: data || [] };
}

export async function geocodeAddress(address) {
  if (!address) return null;
  // Geocoding stays outside Mapbox so the navigation provider receives only
  // coordinates and traffic parameters. The feature gate covers this lookup.
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', address);
  url.searchParams.set('countrycodes', 'us');
  url.searchParams.set('limit', '1');
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'AvalonVitalityRoute/1.0' } });
  if (!response.ok) return null;
  const body = await response.json();
  const match = Array.isArray(body) ? body[0] : null;
  const latitude = Number(match?.lat);
  const longitude = Number(match?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { longitude, latitude };
}

export async function mapboxTrafficLeg({ from, to, arriveBy }) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token || !from || !to) return null;
  const coordinates = `${Number(from.longitude)},${Number(from.latitude)};${Number(to.longitude)},${Number(to.latitude)}`;
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('banner_instructions', 'true');
  url.searchParams.set('voice_instructions', 'false');
  url.searchParams.set('roundabout_exits', 'true');
  url.searchParams.set('language', 'en');
  url.searchParams.set('annotations', 'congestion_numeric,duration,distance');
  url.searchParams.set('arrive_by', new Date(arriveBy).toISOString().replace(/\.\d{3}Z$/, 'Z'));
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) return null;
  const body = await response.json();
  const route = body?.routes?.[0];
  if (!route) return null;
  const trafficDuration = Number(route.duration);
  const typicalDuration = Number(route.duration_typical) || trafficDuration;
  const trafficDelay = Math.max(0, trafficDuration - typicalDuration);
  const delayRatio = typicalDuration > 0 ? trafficDelay / typicalDuration : 0;
  const congestion = (route.legs?.[0]?.annotation?.congestion_numeric || []).filter(Number.isFinite);
  const maxCongestion = congestion.length ? Math.max(...congestion) : 0;
  const trafficLevel = delayRatio >= 0.25 || maxCongestion >= 80 ? 'heavy' : delayRatio >= 0.1 || maxCongestion >= 50 ? 'moderate' : 'light';
  const steps = (route.legs?.[0]?.steps || []).map((step, index) => {
    const location = step?.maneuver?.location;
    const longitude = Number(location?.[0]);
    const latitude = Number(location?.[1]);
    return {
      instruction: maneuverInstruction({ ...step, instruction: step?.maneuver?.instruction }, index),
      distanceMeters: Number(step?.distance || 0),
      durationSeconds: Number(step?.duration || 0),
      streetName: String(step?.name || ''),
      maneuverType: String(step?.maneuver?.type || 'continue'),
      maneuverModifier: String(step?.maneuver?.modifier || ''),
      coordinate: Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined,
    };
  });
  return { durationSeconds: trafficDuration, typicalDurationSeconds: typicalDuration, trafficDelaySeconds: trafficDelay, trafficLevel, distanceMeters: route.distance, geometry: route.geometry, steps, provider: 'mapbox' };
}

export async function resolveCoordinates(stops) {
  return Promise.all(stops.map(async (stop) => ({ ...stop, coordinate: stop.coordinate || await geocodeAddress(stop.address) })));
}

export async function createRoutePlan({ date, origin, stops, now = new Date() }) {
  return buildFixedAppointmentRoute({
    routeDate: date,
    origin,
    stops: await resolveCoordinates(stops),
    now,
    routeLeg: mapboxTrafficLeg,
  });
}

export function latestRevision(rows = []) {
  return rows.reduce((latest, row) => row.updated_at && row.updated_at > latest ? row.updated_at : latest, '1970-01-01T00:00:00.000Z');
}

export function assignmentChange(rows, routeDay, stops) {
  const assigned = new Set(rows.map((row) => row.id));
  const snapshot = new Set((stops || []).map((stop) => stop.appointment_id));
  const addedAppointmentIds = [...assigned].filter((id) => !snapshot.has(id));
  const removedAppointmentIds = [...snapshot].filter((id) => !assigned.has(id));
  const revision = latestRevision(rows);
  const changed = addedAppointmentIds.length > 0 || removedAppointmentIds.length > 0 || (routeDay?.assignment_revision && revision > routeDay.assignment_revision);
  return {
    needsAcknowledgement: Boolean(routeDay && changed && routeDay.acknowledged_revision !== revision),
    revision,
    addedAppointmentIds,
    removedAppointmentIds,
    activeStopRemoved: Boolean(routeDay?.active_appointment_id && removedAppointmentIds.includes(routeDay.active_appointment_id)),
  };
}
