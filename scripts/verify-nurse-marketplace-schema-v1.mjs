import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const files = [
  '077_nurse_marketplace_core.sql',
  '078_nurse_marketplace_inventory.sql',
  '079_nurse_marketplace_routes.sql',
  '080_nurse_marketplace_runtime.sql',
  '081_nurse_marketplace_origin_geocoding.sql',
  '082_nurse_route_map_preview.sql',
];
const migrations = files.map(read);
const sql = migrations.join('\n');

for (const [index, migration] of migrations.entries()) {
  assert.match(migration, /\nbegin;[\s\S]*\ncommit;\s*$/, `${files[index]} must be one forward-only transaction`);
  assert.equal((migration.match(/\$\$/g) || []).length % 2, 0, `${files[index]} must balance dollar quotes`);
  assert.doesNotMatch(migration, /drop table|truncate table|delete from public\./i, `${files[index]} must not delete source truth`);
}

for (const table of [
  'nurse_appointment_source_events', 'nurse_work_source_links',
  'nurse_marketplace_policies', 'nurse_shift_offers', 'nurse_offer_deliveries',
  'nurse_offer_action_idempotency', 'nurse_shift_amendments',
  'nurse_supply_manifests', 'nurse_supply_manifest_versions',
  'nurse_supply_manifest_requirements', 'nurse_shift_supply_requirements',
  'nurse_inventory_reservations', 'nurse_pickup_tasks',
  'nurse_appointment_route_locations', 'nurse_inventory_location_route_locations',
  'nurse_route_origin_consents', 'nurse_route_plan_versions',
  'nurse_route_plan_requests', 'nurse_route_plan_stops', 'nurse_route_plan_legs',
  'nurse_route_plan_stop_dependencies',
  'nurse_route_release_history', 'nurse_route_provider_daily_usage',
  'nurse_marketplace_jobs', 'nurse_marketplace_dead_letters',
  'nurse_typed_origin_geocode_requests',
]) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`), `${table} must be forward-created`);
  assert.match(sql, new RegExp(`alter table public\\.%I enable row level security|alter table public\\.${table} enable row level security`), `${table} must be RLS protected`);
}

for (const rpc of [
  'claim_nurse_shift_offer_v1', 'act_on_nurse_shift_offer_v1', 'assign_w2_nurse_shift_v1',
  'lease_nurse_marketplace_jobs_v1', 'consume_nurse_route_provider_quota_v1',
  'set_nurse_route_origin_v1', 'prepare_nurse_route_plan_v1',
  'get_nurse_route_plan_request_v1', 'reserve_nurse_route_plan_request_v1',
  'fail_nurse_route_plan_request_v1', 'persist_nurse_route_plan_v1',
  'transition_nurse_route_day_v1', 'complete_nurse_route_stop_v1',
  'reconcile_nurse_route_stop_v1', 'admin_release_nurse_route_v1',
  'admin_recover_nurse_route_v1', 'resolve_nurse_pickup_task_v1',
  'recheck_nurse_inventory_v1', 'transition_nurse_guide_version_v1',
  'reconcile_nurse_appointment_event_v1', 'evaluate_nurse_marketplace_readiness_v1',
  'distribute_nurse_shift_offers_v1', 'deliver_nurse_in_app_offer_v1',
  'run_nurse_marketplace_daily_sweep_v1',
  'prepare_nurse_offer_candidate_v1', 'complete_nurse_pickup_task_v1',
  'report_nurse_pickup_mismatch_v1',
  'get_nurse_typed_origin_geocode_v1', 'reserve_nurse_typed_origin_geocode_v1',
  'complete_nurse_typed_origin_geocode_v1', 'fail_nurse_typed_origin_geocode_v1',
  'purge_nurse_typed_origin_retention_v1',
  'store_nurse_route_plan_polyline_v1',
]) {
  assert.match(sql, new RegExp(`create or replace function public\\.${rpc}\\(`), `${rpc} must exist`);
  assert.match(sql, new RegExp(`revoke all on function public\\.${rpc}\\(`), `${rpc} must revoke default execute`);
  assert.match(sql, new RegExp(`grant execute on function public\\.${rpc}\\(`), `${rpc} must be service callable`);
}

assert.match(sql, /evaluation_stage in \('offer', 'claim', 'route_release', 'run_start'\)/, 'readiness must be stage-aware');
assert.match(sql, /evaluation_stage = 'claim'/, 'claim must require claim-stage readiness');
assert.match(sql, /evaluation_stage='route_release'|evaluation_stage = 'route_release'/, 'release must require release-stage readiness');
assert.match(sql, /evaluation_stage = ''run_start''/, 'run start must require run-start readiness');
assert.match(sql, /nurse_offer_terms_hash/, 'terms must have a database canonical hash');
assert.match(sql, /offered_terms_material_fields_immutable/, 'offered terms must be immutable');
assert.match(sql, /prepared', 'reserved'/, 'stock contention must count prepared and reserved allocations');
assert.match(sql, /for update skip locked/i, 'job leases must use skip locked');
assert.match(sql, /minute_ordinal[\s\S]*daily_limit/, 'provider quota must cover minute and daily limits');
assert.match(sql, /provider\.profile_id = auth\.uid\(\)/, 'realtime offer policy must bind to the authenticated nurse');
assert.match(sql, /alter publication supabase_realtime add table public\.nurse_shift_offers/, 'offer realtime publication is required');
assert.match(sql, /engagement_model<>'approved_contractor'/, 'marketplace offers must be contractor-only');
assert.match(sql, /assignment_request_id/, 'W-2 inventory must use a non-offer reservation source');
assert.match(sql, /pickupPredecessorIds/, 'route input must preserve every pickup predecessor');
assert.match(sql, /nurse_route_plan_stop_dependencies/, 'persisted route plans must normalize every precedence edge');
assert.match(sql, /dayStartLocalTime[\s\S]*dayEndLocalTime/, 'vehicle bounds must come from approved day policy');
assert.match(sql, /workMinutes',''\)::numeric[\s\S]*travelMinutes',''\)::numeric/, 'decimal route evidence must compare as numeric');
assert.match(sql, /complete_nurse_pickup_task_v1[\s\S]*pickup_exact_count_mismatch/, 'pickup completion must match exact reservation truth');
assert.match(sql, /report_nurse_pickup_mismatch_v1[\s\S]*pickup_exception_recovery/, 'pickup mismatches must create durable recovery work');
assert.match(sql, /'count_mismatch','lot_mismatch','temperature_out_of_range',[\s\S]*'package_damaged','other_operational_mismatch'/, 'pickup mismatch enum must be explicit and stable');
assert.match(sql, /purge_nurse_typed_origin_retention_v1[\s\S]*resolved_formatted_address=null/, 'typed origin retention must purge resolved location data');
assert.match(sql, /overview_polyline/, 'route preview geometry must be persisted separately from route feasibility');
assert.doesNotMatch(read('081_nurse_marketplace_origin_geocoding.sql'), /set\s+origin_kind='current'/i, 'origin retention must preserve consent provenance');

const consentTable = read('079_nurse_marketplace_routes.sql').match(
  /create table if not exists public\.nurse_route_origin_consents \([\s\S]*?\n\);/,
)?.[0] || '';
assert.doesNotMatch(consentTable, /latitude|longitude|address/, 'consent receipt must not persist current location');
assert.match(sql, /current_origin_persistence_prohibited/, 'current coordinates must be rejected by the persistence RPC');
assert.match(sql, /origin_latitude = case when p_origin_kind = 'current' then null/, 'current route origins must persist null coordinates');
assert.doesNotMatch(read('081_nurse_marketplace_origin_geocoding.sql'), /raw_address|submitted_address/, 'typed-origin reservation must not store the raw input address');

console.log('Nurse marketplace schema QA passed: forward-only tenant contracts, atomic claims, inventory and route evidence, strict RPC grants, and location minimization.');
