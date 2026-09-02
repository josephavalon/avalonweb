import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const requireAll = (source, values, label) => values.forEach((value) => {
  assert.ok(source.includes(value), `${label} is missing ${JSON.stringify(value)}`);
});

const migrationPaths = [
  'supabase/migrations/077_nurse_marketplace_core.sql',
  'supabase/migrations/078_nurse_marketplace_inventory.sql',
  'supabase/migrations/079_nurse_marketplace_routes.sql',
  'supabase/migrations/080_nurse_marketplace_runtime.sql',
  'supabase/migrations/081_nurse_marketplace_origin_geocoding.sql',
  'supabase/migrations/082_nurse_route_map_preview.sql',
];
const migrations = migrationPaths.map(read);
migrations.forEach((sql, index) => {
  assert.match(sql, /^--[^\n]*\n(?:--[^\n]*\n)*\s*begin;/i, `${migrationPaths[index]} must be transactional`);
  assert.match(sql, /commit;\s*$/i, `${migrationPaths[index]} must commit explicitly`);
  assert.doesNotMatch(sql, /\boffer_id\s+uuid\s+not\s+null,\s*\boffer_id\s+uuid\s+not\s+null,/i,
    `${migrationPaths[index]} contains a duplicate offer_id declaration`);
});

const schema = migrations.join('\n');
requireAll(schema, [
  'nurse_appointment_source_events',
  'nurse_shift_offers',
  'nurse_offer_deliveries',
  'nurse_inventory_reservations',
  'nurse_pickup_tasks',
  'nurse_appointment_route_locations',
  'nurse_route_plan_requests',
  'nurse_route_plan_versions',
  'nurse_route_plan_stops',
  'nurse_route_plan_legs',
  'nurse_route_origin_consents',
  'nurse_marketplace_jobs',
  'nurse_marketplace_dead_letters',
  'claim_nurse_shift_offer_v1',
  'act_on_nurse_shift_offer_v1',
  'prepare_nurse_route_plan_v1',
  'persist_nurse_route_plan_v1',
  'transition_nurse_route_day_v1',
  'admin_release_nurse_route_v1',
  'admin_recover_nurse_route_v1',
  'resolve_nurse_pickup_task_v1',
  'recheck_nurse_inventory_v1',
  'transition_nurse_guide_version_v1',
  'assign_w2_nurse_shift_v1',
  'get_nurse_typed_origin_geocode_v1',
  'reserve_nurse_typed_origin_geocode_v1',
  'complete_nurse_typed_origin_geocode_v1',
  'fail_nurse_typed_origin_geocode_v1',
  'store_nurse_route_plan_polyline_v1',
  'supabase_realtime',
], 'marketplace schema');
for (const [pattern, label] of [
  [/insert\s+into\s+public\.nurse_work_source_links/i, 'appointment reconciliation must persist a source link'],
  [/insert\s+into\s+public\.nurse_shift_supply_requirements/i, 'reconciliation must pin an approved supply manifest'],
  [/insert\s+into\s+public\.nurse_offer_terms/i, 'an approved workflow must persist canonical offer terms'],
  [/insert\s+into\s+public\.nurse_inventory_reservations/i, 'offer preparation must create source-of-record inventory reservations'],
  [/insert\s+into\s+public\.provider_route_days/i, 'accepted work must create or join a route day'],
  [/insert\s+into\s+public\.provider_route_day_stops/i, 'accepted work must create a selected route stop'],
  [/insert\s+into\s+public\.nurse_pickup_tasks/i, 'non-kit reservations must create pickup work'],
]) assert.match(schema, pattern, label);
for (const table of [
  'nurse_shift_offers', 'nurse_inventory_reservations', 'nurse_route_plan_versions',
  'nurse_marketplace_jobs', 'nurse_marketplace_dead_letters',
]) {
  const tableNamedInRlsLoop = schema.includes(`'${table}'`)
    && /execute format\('alter table public\.%I enable row level security'/i.test(schema);
  assert.ok(new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(schema) || tableNamedInRlsLoop,
    `${table} must enable RLS`);
  const tableNamedInRevokeLoop = schema.includes(`'${table}'`)
    && /execute format\('revoke all on table public\.%I from public, anon, authenticated'/i.test(schema);
  assert.ok(new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'i').test(schema) || tableNamedInRevokeLoop,
    `${table} must fail closed for browser writes`);
}
assert.match(schema, /evaluation_stage\s+in\s*\(\s*'offer',\s*'claim',\s*'route_release',\s*'run_start'\s*\)/i);
assert.match(schema, /origin_kind\s+in\s*\(\s*'current',\s*'manual',\s*'office'\s*\)/i);
const routeSchema = read('supabase/migrations/079_nurse_marketplace_routes.sql');
const consentTable = routeSchema.match(/create table if not exists public\.nurse_route_origin_consents\s*\(([\s\S]*?)\n\);/i)?.[1] || '';
assert.ok(consentTable, 'origin consent table must exist');
assert.doesNotMatch(consentTable.replace(/--.*$/gm, ''), /\b(?:latitude|longitude|address)\b/i,
  'origin consent receipts must not contain location fields');

for (const rpc of [
  'set_nurse_route_origin_v1', 'prepare_nurse_route_plan_v1',
  'get_nurse_route_plan_request_v1', 'persist_nurse_route_plan_v1',
  'transition_nurse_route_day_v1', 'transition_nurse_guide_version_v1',
  'assign_w2_nurse_shift_v1',
]) {
  assert.match(schema, new RegExp(`revoke all on function public\\.${rpc}\\(`, 'i'),
    `${rpc} must explicitly revoke PostgreSQL's default PUBLIC execute privilege`);
}
for (const match of schema.matchAll(/create or replace function\s+(public|app_private)\.([a-z0-9_]+)\s*\([\s\S]*?security definer/gi)) {
  const [, namespace, functionName] = match;
  assert.match(schema, new RegExp(`revoke all on function ${namespace}\\.${functionName}\\(`, 'i'),
    `${namespace}.${functionName} is SECURITY DEFINER and must explicitly revoke PUBLIC execute`);
}

const env = read('.env.example');
for (const assignment of [
  'NURSE_AUTO_SHIFT_CREATION_ENABLED=false',
  'NURSE_SHIFT_OFFERS_ENABLED=false',
  'NURSE_REALTIME_OFFER_ALERTS_ENABLED=false',
  'NURSE_WEB_PUSH_ENABLED=false',
  'NURSE_ROUTE_PLANNING_ENABLED=false',
  'NURSE_INVENTORY_RESERVATIONS_ENABLED=false',
  'NURSE_PICKUP_ROUTING_ENABLED=false',
  'NURSE_ROUTE_AUTO_RELEASE_ENABLED=false',
  'NURSE_ROUTE_PROVIDER=disabled',
  'NURSE_ROUTE_PROVIDER_KILL_SWITCH=true',
  'NURSE_ROUTE_PROVIDER_DAILY_QUOTA=0',
  'NURSE_ROUTE_PROVIDER_MAX_REQUESTS_PER_MINUTE=0',
  'NURSE_GEOCODING_DAILY_QUOTA=0',
  'NURSE_ROUTE_REQUEST_HASH_SECRET=',
  'VITE_MAPBOX_ACCESS_TOKEN=',
]) assert.ok(env.includes(assignment), `.env.example missing fail-closed ${assignment}`);

const vercel = JSON.parse(read('vercel.json'));
assert.ok(vercel.crons?.some((cron) => cron.path === '/api/cron/nurse-marketplace' && cron.schedule === '* * * * *'),
  'Vercel cron must schedule the durable marketplace worker');
const headerText = JSON.stringify(vercel.headers || []);
assert.match(headerText, /beta|provider|Permissions-Policy/i);
assert.match(headerText, /geolocation=\(\)/);
assert.match(headerText, /geolocation=\(self\)/);
assert.match(headerText, /api\.mapbox\.com/);
assert.match(headerText, /worker-src[^;]*blob:/);

const provider = read('api/_lib/nurse-route-provider.js');
requireAll(provider, [
  'VERCEL_OIDC_TOKEN',
  'routeoptimization.googleapis.com',
  'NURSE_ROUTE_PROVIDER_KILL_SWITCH',
  'NURSE_ROUTE_PROVIDER_DAILY_QUOTA',
  'NURSE_GEOCODING_DAILY_QUOTA',
  'route_provider_skipped_stops',
  'populatePolylines: true',
], 'route provider');
assert.doesNotMatch(provider, /patientName|patient_name|treatment|location_address/,
  'route provider must not accept patient or address metadata');

const routeDays = read('api/_lib/nurse-route-days.js');
assert.match(routeDays, /p_origin_latitude:\s*originKind === 'current' \? null/);
assert.match(routeDays, /nurse_appointment_route_locations|prepare_nurse_route_plan_v1/);
assert.doesNotMatch(routeDays, /geocode[^\n]*(?:appointment|patient)/i);

const routeMap = read('src/components/provider/NurseRouteMap.jsx');
requireAll(routeMap, [
  'VITE_MAPBOX_ACCESS_TOKEN',
  'PUBLIC_MAPBOX_TOKEN_RE',
  "import('mapbox-gl')",
  'decodeRoutePolyline',
  'Route map unavailable',
], 'Mapbox route preview');
assert.doesNotMatch(routeMap, /patientName|patient_name|treatment|service_name/i,
  'Mapbox route preview must not send care metadata');

const { decodeRoutePolyline } = await import('../src/lib/routePolyline.js');
assert.deepEqual(
  decodeRoutePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'),
  [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]],
  'Google encoded route geometry must decode locally for Mapbox',
);

const cron = read('api/cron/nurse-marketplace.js');
assert.match(cron, /CRON_SECRET/);
assert.match(cron, /timingSafeEqual/);

const serviceWorker = read('public/sw.js');
assert.match(serviceWorker, /unregister\(\)/);
assert.doesNotMatch(serviceWorker, /pushsubscriptionchange|showNotification/i,
  'Web Push must remain disabled until separately approved');

const runbook = read('docs/NURSE_MARKETPLACE_ROUTE_V1.md');
requireAll(runbook, [
  'beta.avalonvitality.co',
  'Do not link this worktree to `avalonweb`',
  'Main production promotion is a separate, future change',
], 'beta-only runbook');

console.log('Nurse marketplace release verification passed: schema/RPC coverage, fail-closed flags, beta boundary, privacy, cron, and Web Push exclusion.');
