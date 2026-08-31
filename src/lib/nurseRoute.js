export const ROUTE_TIMEZONE = 'America/Los_Angeles';
export const ARRIVAL_BUFFER_MINUTES = 15;
export const DEFAULT_SERVICE_DURATION_MINUTES = 60;

export const ROUTE_OMISSION_REASONS = Object.freeze([
  { value: 'timing_conflict', label: 'Timing conflict' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'duplicate_cancelled', label: 'Duplicate or cancelled' },
  { value: 'admin_review', label: 'Needs admin review' },
  { value: 'other', label: 'Other' },
]);

const EARTH_RADIUS_METERS = 6371000;

function radians(value) {
  return Number(value || 0) * Math.PI / 180;
}

export function haversineMeters(from, to) {
  const lat1 = radians(from?.latitude);
  const lat2 = radians(to?.latitude);
  const dLat = lat2 - lat1;
  const dLng = radians(Number(to?.longitude || 0) - Number(from?.longitude || 0));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function estimateBayAreaDriveSeconds(from, to) {
  const distance = haversineMeters(from, to);
  // A conservative local fallback: surface streets + freeway/bridge drag.
  const averageMetersPerSecond = distance < 12000 ? 7.2 : 12.2;
  return Math.max(8 * 60, Math.round(distance / averageMetersPerSecond + 6 * 60));
}

export function routeEligibility(appointment = {}) {
  const status = String(appointment.status || '').toLowerCase();
  const gfe = String(appointment.gfeStatus || appointment.gfe_status || '').toLowerCase();
  const payment = String(appointment.paymentStatus || appointment.payment_status || '').toLowerCase();
  if (/cancel|archiv/.test(status)) return { eligible: false, blocker: 'Cancelled' };
  if (/blocked/.test(status)) return { eligible: false, blocker: 'Clinical hold' };
  if (/denied|expired/.test(gfe)) return { eligible: false, blocker: 'Clearance required' };
  if (/failed|refunded|disputed/.test(payment)) return { eligible: false, blocker: 'Payment review' };
  return { eligible: true, blocker: '' };
}

export function routeFeasibility(bufferMinutes) {
  if (!Number.isFinite(bufferMinutes)) return 'unavailable';
  if (bufferMinutes < 0) return 'late';
  if (bufferMinutes < ARRIVAL_BUFFER_MINUTES) return 'tight';
  return 'on_schedule';
}

function iso(value) {
  return new Date(value).toISOString();
}

function lineGeometry(from, to) {
  if (!from || !to) return null;
  return {
    type: 'LineString',
    coordinates: [
      [Number(from.longitude), Number(from.latitude)],
      [Number(to.longitude), Number(to.latitude)],
    ],
  };
}

function titleCase(value = '') {
  return String(value).replace(/\b\w/g, (character) => character.toUpperCase());
}

export function maneuverInstruction(step = {}, index = 0) {
  if (step.instruction) return step.instruction;
  const maneuver = step.maneuver || {};
  const type = String(maneuver.type || 'continue').replace(/_/g, ' ');
  const modifier = String(maneuver.modifier || '').replace(/_/g, ' ');
  const road = String(step.name || '').trim();
  if (type === 'arrive') return 'Arrive at the appointment';
  if (type === 'depart') return `Head ${modifier || 'forward'}${road ? ` on ${road}` : ''}`;
  if (type.includes('roundabout') || type === 'rotary') return `Enter the roundabout${road ? ` toward ${road}` : ''}`;
  if (type === 'merge') return `Merge ${modifier}${road ? ` onto ${road}` : ''}`.replace(/\s+/g, ' ').trim();
  if (type === 'on ramp') return `Take the ramp ${modifier}${road ? ` toward ${road}` : ''}`.replace(/\s+/g, ' ').trim();
  if (type === 'off ramp') return `Take the exit ${modifier}${road ? ` toward ${road}` : ''}`.replace(/\s+/g, ' ').trim();
  if (type === 'fork') return `Keep ${modifier || 'straight'}${road ? ` toward ${road}` : ''}`;
  if (type === 'end of road') return `At the end of the road, turn ${modifier || 'ahead'}${road ? ` onto ${road}` : ''}`;
  if (type === 'turn') return `Turn ${modifier || 'ahead'}${road ? ` onto ${road}` : ''}`;
  if (type === 'new name' || type === 'continue') return `Continue ${modifier || 'straight'}${road ? ` on ${road}` : ''}`;
  return `${index === 0 ? 'Start' : titleCase(type)}${modifier ? ` ${modifier}` : ''}${road ? ` on ${road}` : ''}`;
}

function normalizeRoadStep(step, index) {
  const location = step?.maneuver?.location;
  const longitude = Number(location?.[0]);
  const latitude = Number(location?.[1]);
  return {
    instruction: maneuverInstruction(step, index),
    distanceMeters: Number(step?.distance || 0),
    durationSeconds: Number(step?.duration || 0),
    streetName: String(step?.name || ''),
    maneuverType: String(step?.maneuver?.type || 'continue'),
    maneuverModifier: String(step?.maneuver?.modifier || ''),
    coordinate: Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined,
  };
}

/** Keyless road geometry + maneuver fallback for the synthetic local preview.
 * Production traffic routing remains Mapbox-only. */
export async function previewRoadLeg({ from, to } = {}) {
  if (![from?.latitude, from?.longitude, to?.latitude, to?.longitude].every((value) => Number.isFinite(Number(value)))) return null;
  const coordinates = `${Number(from.longitude)},${Number(from.latitude)};${Number(to.longitude)},${Number(to.latitude)}`;
  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${coordinates}`);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'true');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const body = await response.json();
    const route = body?.routes?.[0];
    if (!route) return null;
    return {
      durationSeconds: Number(route.duration),
      typicalDurationSeconds: Number(route.duration),
      trafficDelaySeconds: 0,
      trafficLevel: 'unavailable',
      distanceMeters: Number(route.distance),
      geometry: route.geometry,
      steps: (route.legs?.[0]?.steps || []).map(normalizeRoadStep),
      provider: 'osrm',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Pure fixed-order route planner. `routeLeg` may call a traffic provider; when
 * omitted the deterministic Bay Area estimate keeps demo/tests functional.
 */
export async function buildFixedAppointmentRoute({
  routeDate,
  origin,
  stops = [],
  now = new Date(),
  routeLeg,
} = {}) {
  const selected = [...stops]
    .filter((stop) => stop.selected !== false && stop.eligible !== false)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const legs = [];
  let from = origin;
  let earliestDeparture = new Date(now);

  for (let index = 0; index < selected.length; index += 1) {
    const stop = selected[index];
    const targetArrival = new Date(new Date(stop.scheduledAt).getTime() - ARRIVAL_BUFFER_MINUTES * 60000);
    let providerResult = null;
    if (routeLeg) {
      providerResult = await routeLeg({ from, to: stop.coordinate, arriveBy: targetArrival, departAt: earliestDeparture });
    }
    const durationSeconds = Number(providerResult?.durationSeconds) || estimateBayAreaDriveSeconds(from, stop.coordinate);
    const requiredDeparture = new Date(targetArrival.getTime() - durationSeconds * 1000);
    const actualDeparture = new Date(Math.max(earliestDeparture.getTime(), requiredDeparture.getTime()));
    const projectedArrival = new Date(actualDeparture.getTime() + durationSeconds * 1000);
    const bufferMinutes = Math.floor((new Date(stop.scheduledAt).getTime() - projectedArrival.getTime()) / 60000);
    legs.push({
      fromId: index === 0 ? (origin.id || origin.kind || 'origin') : selected[index - 1].appointmentId,
      toAppointmentId: stop.appointmentId,
      distanceMeters: Number(providerResult?.distanceMeters) || haversineMeters(from, stop.coordinate),
      trafficDurationSeconds: durationSeconds,
      typicalDurationSeconds: Number(providerResult?.typicalDurationSeconds) || durationSeconds,
      trafficDelaySeconds: Number(providerResult?.trafficDelaySeconds) || 0,
      trafficLevel: providerResult?.trafficLevel || 'unavailable',
      requiredDepartureAt: requiredDeparture.toISOString(),
      projectedArrivalAt: projectedArrival.toISOString(),
      bufferMinutes,
      feasibility: routeFeasibility(bufferMinutes),
      geometry: providerResult?.geometry || lineGeometry(from, stop.coordinate),
      steps: Array.isArray(providerResult?.steps) ? providerResult.steps : [],
      provider: providerResult?.provider || 'estimate',
    });
    earliestDeparture = new Date(new Date(stop.scheduledAt).getTime() + Number(stop.durationMinutes || DEFAULT_SERVICE_DURATION_MINUTES) * 60000);
    from = stop.coordinate;
  }

  const trafficLive = legs.length > 0 && legs.every((leg) => leg.provider === 'mapbox');
  return {
    routeDate,
    timezone: ROUTE_TIMEZONE,
    generatedAt: iso(now),
    trafficAsOf: iso(now),
    trafficState: trafficLive ? 'live' : 'estimated',
    origin,
    activeStopId: selected.find((stop) => !/completed/i.test(stop.status || ''))?.appointmentId || selected[0]?.appointmentId,
    stops: selected.map((stop, index) => ({ ...stop, order: index + 1 })),
    legs,
  };
}

export function formatMinutesUntil(isoValue, now = new Date()) {
  if (!isoValue) return 0;
  return Math.max(0, Math.ceil((new Date(isoValue).getTime() - new Date(now).getTime()) / 60000));
}
