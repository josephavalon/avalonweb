import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildFixedAppointmentRoute, routeEligibility } from '../src/lib/nurseRoute.js';

const origin = { id: 'home', kind: 'home', label: 'Home', address: 'SF', latitude: 37.7562, longitude: -122.4768, persisted: true };
const coordinates = [
  [37.7925, -122.4382],
  [37.8124, -122.2683],
  [37.563, -122.3255],
  [37.4443, -122.1608],
];
const hours = [9, 11, 13, 15.5];
const stops = coordinates.map(([latitude, longitude], index) => ({
  appointmentId: `bay-${index + 1}`,
  clientDisplayName: `Client ${index + 1}`,
  service: 'IV',
  neighborhood: ['San Francisco', 'Oakland', 'San Mateo', 'Palo Alto'][index],
  address: 'Server-loaded address',
  scheduledAt: `2026-08-18T${String(Math.floor(hours[index]) + 7).padStart(2, '0')}:${hours[index] % 1 ? '30' : '00'}:00.000Z`,
  durationMinutes: index === 1 ? 45 : 60,
  status: 'assigned', eligible: true, selected: true,
  coordinate: { latitude, longitude },
}));

const mapboxCalls = [];
const plan = await buildFixedAppointmentRoute({
  routeDate: '2026-08-18', origin, stops: [...stops].reverse(), now: new Date('2026-08-18T14:00:00.000Z'),
  routeLeg: async ({ from, to, arriveBy }) => {
    mapboxCalls.push({ from, to, arriveBy });
    return { durationSeconds: 1800, distanceMeters: 20000, provider: 'mapbox', geometry: { type: 'LineString', coordinates: [[from.longitude, from.latitude], [to.longitude, to.latitude]] } };
  },
});

assert.deepEqual(plan.stops.map((stop) => stop.appointmentId), ['bay-1', 'bay-2', 'bay-3', 'bay-4'], 'fixed appointment order must win over selection order');
assert.equal(mapboxCalls.length, 4, 'traffic provider must be called for every leg');
assert.equal(plan.trafficState, 'live');
assert.equal(plan.legs[0].bufferMinutes, 15, 'the first visit should preserve the 15-minute arrival target');
assert.equal(plan.legs[1].fromId, 'bay-1', 'later legs must start at the previous appointment');

const latePlan = await buildFixedAppointmentRoute({
  routeDate: '2026-08-18', origin, stops: [stops[0]], now: new Date('2026-08-18T16:00:00.000Z'),
  routeLeg: async () => ({ durationSeconds: 3600, distanceMeters: 1, provider: 'mapbox', geometry: null }),
});
assert.equal(latePlan.legs[0].feasibility, 'late', 'negative slack must be explicit');
assert.equal(routeEligibility({ status: 'cancelled' }).eligible, false);
assert.equal(routeEligibility({ status: 'confirmed', payment_status: 'failed' }).blocker, 'Payment review');

const migration = fs.readFileSync(new URL('../supabase/migrations/045_nurse_route_builder.sql', import.meta.url), 'utf8');
assert.doesNotMatch(migration, /gps_ping|position_history|location_sample/i, 'GPS pings must not have persistence schema');
assert.match(migration, /owner_profile_id = auth\.uid\(\)/, 'home origins must be owner-isolated by RLS');
assert.match(migration, /grant select, insert, update, delete[^;]+authenticated, service_role;/s, 'route tables must grant server API access to service_role');
const buildApi = fs.readFileSync(new URL('../api/provider/route/build.js', import.meta.url), 'utf8');
assert.match(buildApi, /loadAssignedAppointments/, 'build API must server-load assigned appointments');
assert.match(buildApi, /not assigned to this nurse/, 'build API must reject injected appointments');
const routeLib = fs.readFileSync(new URL('../api/_lib/nurse-route.js', import.meta.url), 'utf8');
assert.doesNotMatch(routeLib, /\.select\([^\n]*profiles:profile_id/, 'provider lookup must not embed a relationship whose FK points to auth.users');

console.log('Nurse route QA passed: fixed order, traffic legs, feasibility, RLS and PHI-safe GPS contracts verified.');
