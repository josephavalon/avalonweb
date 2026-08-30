import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

const migration = read('../supabase/migrations/062_nurse_guided_shift.sql');
const workflow = read('../api/_lib/nurse-workflow.js');
const shiftsApi = read('../api/me/shifts.js');
const runsApi = read('../api/me/shift-runs.js');
const businessApi = read('../api/me/business-profile.js');
const availabilityApi = read('../api/me/availability.js');
const servicesApi = read('../api/me/service-preferences.js');
const serviceAreaApi = read('../api/me/service-area.js');
const engagementApi = read('../api/me/engagement-status.js');
const offlineOutbox = read('../src/lib/nurseOfflineOutbox.js');
const queuePage = read('../app-modules/pages/provider/NurseSchedule.jsx');
const guidePage = read('../app-modules/pages/provider/NurseGuidedShift.jsx');
const settingsPage = read('../app-modules/pages/provider/NurseWorkSettings.jsx');
const payPage = read('../app-modules/pages/provider/NurseInvoices.jsx');
const routes = read('../src/App.jsx');

const nurseApis = [
  ['api/me/shifts.js', shiftsApi],
  ['api/me/shift-runs.js', runsApi],
  ['api/me/business-profile.js', businessApi],
  ['api/me/availability.js', availabilityApi],
  ['api/me/service-preferences.js', servicesApi],
  ['api/me/service-area.js', serviceAreaApi],
  ['api/me/engagement-status.js', engagementApi],
];
const activeNurseUi = [
  ['app-modules/pages/provider/NurseSchedule.jsx', queuePage],
  ['app-modules/pages/provider/NurseGuidedShift.jsx', guidePage],
  ['app-modules/pages/provider/NurseWorkSettings.jsx', settingsPage],
];

// ── Persistence: tenant-safe, server-only, append-only operational evidence ──

const tables = [
  'provider_work_preferences',
  'nurse_shift_domain_evidence',
  'nurse_shift_readiness_snapshots',
  'nurse_offer_counters',
  'nurse_offer_terms',
  'shift_guide_templates',
  'shift_guide_versions',
  'mobile_shift_runs',
  'mobile_shift_time_events',
  'mobile_shift_step_events',
  'shift_exceptions',
];
for (const table of tables) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}\\s*\\(`), `062 must create ${table}`);
}
const firstExecutableStatement = migration.split('\n')
  .map((line) => line.trim())
  .find((line) => line && !line.startsWith('--'));
assert.equal(firstExecutableStatement, 'begin;', '062 must begin with an explicit transaction for SQL Editor application');
assert.match(migration, /\ncommit;\s*$/, '062 must commit only after every schema, trigger, function, ACL, and comment statement');
assert.match(migration, /nurse_operational_bootstrap_required/);
assert.doesNotMatch(migration, /migration_050_required/);
assert.match(migration, /migration_051_required/);
const prerequisiteBlock = migration.slice(0, migration.indexOf('-- Offer decisions'));
assert.match(
  prerequisiteBlock,
  /to_regclass\('public\.provider_route_days'\)[\s\S]*?to_regclass\('public\.provider_route_day_stops'\)/,
  '062 must require both route tables before schema changes',
);
for (const constraint of [
  'provider_route_days_tenant_id_id_key',
  'provider_route_days_tenant_id_id_provider_key',
  'provider_route_day_stops_tenant_id_id_key',
  'provider_route_days_provider_tenant_fk',
  'provider_route_day_stops_route_provider_tenant_fk',
  'provider_route_day_stops_appointment_tenant_fk',
]) {
  assert.ok(prerequisiteBlock.includes(`conname = '${constraint}'`), `062 must preflight ${constraint}`);
}
assert.match(prerequisiteBlock, /constraint_definition\.convalidated/);
assert.match(prerequisiteBlock, /array\['tenant_id', 'route_day_id', 'assigned_provider_profile_id'\]::text\[\]/);
assert.match(prerequisiteBlock, /array\['tenant_id', 'id', 'provider_profile_id'\]::text\[\]/);
assert.doesNotMatch(migration, /^\s*[a-z_][a-z0-9_]*:\s*do\s+\$\$/im, '061 contains an invalid labelled DO statement');

const rlsBlock = migration.slice(
  migration.indexOf("foreach v_table in array array["),
  migration.indexOf('create or replace function app_private.prevent_nurse_event_mutation'),
);
for (const table of tables) {
  assert.ok(rlsBlock.includes(`'${table}'`), `${table} must be included in the 062 RLS/server-only loop`);
}
assert.match(rlsBlock, /alter table public\.%I enable row level security/);
assert.match(rlsBlock, /revoke all on public\.%I from public, anon, authenticated, service_role/);
assert.match(rlsBlock, /grant select, insert, update, delete on public\.%I to service_role/);

for (const child of [
  'provider_work_preferences',
  'nurse_shift_domain_evidence',
  'nurse_shift_readiness_snapshots',
  'nurse_offer_counters',
  'nurse_offer_terms',
  'shift_guide_versions',
  'mobile_shift_runs',
  'mobile_shift_time_events',
  'mobile_shift_step_events',
  'shift_exceptions',
]) {
  assert.match(
    migration,
    new RegExp(`alter table public\\.${child} add constraint[\\s\\S]{0,240}?foreign key \\(tenant_id,`),
    `${child} must use a tenant-scoped composite foreign key`,
  );
}
assert.match(migration, /shift_guide_templates[\s\S]*?tenant_id uuid not null references public\.tenants\(id\)/, 'guide templates must be tenant-owned');
assert.match(migration, /shift_guide_templates_key unique \(tenant_id, template_key\)/, 'guide template keys must be tenant-scoped');

assert.match(migration, /before update or delete on public\.mobile_shift_time_events[\s\S]*?prevent_nurse_event_mutation/);
assert.match(migration, /before update or delete on public\.mobile_shift_step_events[\s\S]*?prevent_nurse_event_mutation/);
assert.match(migration, /nurse_event_records_are_append_only/);
assert.match(migration, /before update or delete on public\.nurse_shift_readiness_snapshots[\s\S]*?protect_nurse_readiness_snapshot/);
assert.match(migration, /readiness_snapshots_are_append_only/);
assert.match(migration, /readiness_snapshot_is_immutable/);
assert.match(migration, /invalidated_at = clock_timestamp\(\)[\s\S]*?invalidation_reason = 'source_changed'/, 'source changes must invalidate, not rewrite, readiness evidence');
assert.match(migration, /occurred_at timestamptz not null default clock_timestamp\(\)/, 'actual time must use a server timestamp');
assert.match(migration, /mobile_shift_time_events_idempotency_key unique \(shift_run_id, idempotency_key\)/);
assert.match(migration, /mobile_shift_step_events_idempotency_key unique \(shift_run_id, idempotency_key\)/);
assert.match(migration, /shift_exceptions_idempotency_key unique \(shift_run_id, idempotency_key\)/);
assert.match(migration, /nurse_offer_counters_request_key unique \(provider_profile_id, request_key\)/);
assert.match(migration, /nurse_offer_terms_version_key unique \(shift_id, provider_profile_id, terms_version\)/);
assert.match(migration, /shift_guide_versions_template_version_key unique \(template_id, version\)/);
assert.match(migration, /where provider_profile_id = p_provider_profile_id and request_key = p_request_key;[\s\S]{0,320}?if found then[\s\S]{0,220}?return v_counter;/, 'counter-offer retries must return the original request');
assert.match(migration, /insert into public\.mobile_shift_runs[\s\S]{0,700}?on conflict \(shift_id, provider_profile_id\) do nothing[\s\S]{0,500}?select \* into v_run from public\.mobile_shift_runs/, 'run creation retries must return the one persisted nurse run');
assert.ok(
  (migration.match(/where shift_run_id = p_run_id and idempotency_key = p_idempotency_key;[\s\S]{0,180}?if found then return/g) || []).length >= 3,
  'time, step, and exception retries must return the prior persisted result',
);
assert.match(migration, /accepted_offer_terms_are_immutable/, 'accepted nurse offer terms must be immutable');
assert.match(migration, /approved_guide_version_is_immutable/, 'approved nurse guide versions must be immutable');

for (const name of [
  'decline_operational_shift',
  'counter_operational_shift_offer',
  'claim_operational_shift',
  'start_nurse_shift_run',
  'record_nurse_time_event',
  'record_nurse_step_event',
  'open_nurse_shift_exception',
  'close_nurse_shift_run',
]) {
  assert.match(migration, new RegExp(`create or replace function public\\.${name}\\(`), `061 is missing ${name}`);
  assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\([^;]+\\) from public, anon, authenticated;`), `${name} must revoke browser roles`);
  assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\([^;]+\\) to service_role;`), `${name} must be service-role only`);
}
assert.match(migration, /append_operational_audit/, 'guided-shift mutations must append audit evidence transactionally');
assert.match(migration, /engagement_status text not null default 'w2_default'/, 'W-2 must remain the safe default');
assert.match(migration, /contractor_approved/);
assert.match(migration, /engagement_approved_by is not null[\s\S]*engagement_approved_at is not null[\s\S]*engagement_effective_at is not null/);

// No migration may create production work or clinical data. Remove function
// bodies first because their transactional INSERT statements are the product.
const topLevelSql = migration.replace(
  /create or replace function[\s\S]*?\bas\s+\$\$[\s\S]*?\$\$;/gi,
  '',
);
assert.doesNotMatch(topLevelSql, /insert\s+into\s+public\./i, '062 must not seed nurse, work, guide, readiness, time, or exception rows');

// ── Authorization and ownership ────────────────────────────────────────────

assert.deepEqual(
  [...workflow.matchAll(/export const NURSE_ROLES = Object\.freeze\(\[([^\]]+)\]\)/g)]
    .flatMap((match) => [...match[1].matchAll(/'([^']+)'/g)].map((role) => role[1])),
  ['nurse', 'rn', 'np', 'admin'],
  'the server nurse role contract must remain explicit',
);
assert.match(workflow, /\.eq\('tenant_id', authed\.tenantId\)[\s\S]*?\.eq\('profile_id', authed\.user\.id\)/, 'provider identity must derive from the authenticated profile and tenant');
assert.match(workflow, /pp\.profile_id = p_actor_profile_id|profile_id', authed\.user\.id/);
assert.match(migration, /pp\.profile_id = p_actor_profile_id/);
assert.match(migration, /provider_self_action_required/);

for (const [path, source] of nurseApis) {
  assert.match(source, /requireRole\(req, res, NURSE_ROLES\)/, `${path} must use the canonical nurse role gate`);
  assert.match(source, /resolveNurseProvider\(authed\)/, `${path} must derive the provider from auth`);
  assert.match(source, /Cache-Control', 'no-store'/, `${path} must never be cached`);
  assert.doesNotMatch(source, /(?:body|req\.body)\.(?:providerProfileId|provider_profile_id)/, `${path} must not accept provider identity from the browser`);
}
assert.doesNotMatch(engagementApi, /req\.method === 'PUT'|req\.method === 'POST'|\.update\(|\.upsert\(/, 'a nurse must not self-select an employment classification');
assert.match(workflow, /requested === 'contractor_approved'/, 'contractor mode must require the human-approved persisted state');

// ── Readiness: every domain present, fresh, and server-derived ──────────────

const readinessDomains = [
  'identity', 'license', 'schedule', 'kit', 'client', 'gfe',
  'patient_payment', 'route', 'safety',
];
for (const domain of readinessDomains) {
  assert.match(workflow, new RegExp(`['\"]${domain}['\"]`), `readiness is missing ${domain}`);
  assert.match(migration, new RegExp(`['\"]${domain}['\"]`), `061 evidence domain is missing ${domain}`);
}
for (const field of ['status', 'reason_code', 'source', 'checked_at', 'expires_at', 'owner_role', 'remediation']) {
  assert.match(workflow, new RegExp(`\\b${field}\\b`), `readiness output is missing ${field}`);
}
assert.match(workflow, /READINESS_DOMAINS\.every\(\(key\) => READY_STATES\.has\(domains\[key\]\?\.status\)\)/, 'readiness must require every domain');
assert.match(workflow, /status: ready \? 'ready' : 'blocked'/);
assert.match(workflow, /claim_allowed: claimAllowed/);
assert.match(workflow, /Date\.parse\(expiry\) <= Date\.parse\(nowIso\)[\s\S]*readiness_evidence_stale/, 'expired evidence must fail closed');
for (const reason of [
  'kit_readiness_evidence_missing',
  'appointment_readiness_missing',
  'route_readiness_evidence_missing',
  'patient_safety_identity_missing',
  'credential_verification_not_clear',
]) {
  assert.ok(workflow.includes(reason), `missing fail-closed readiness reason ${reason}`);
}
assert.match(shiftsApi, /evaluateShiftReadiness/);
assert.match(shiftsApi, /const READINESS_SOURCE = Symbol\('nurseReadinessSource'\)/, 'raw readiness inputs must use a non-serializable server-only key');
assert.match(shiftsApi, /\[READINESS_SOURCE\]: \{ \.\.\.shift, assignment \}/, 'the server must retain the raw shift solely for readiness evaluation');
assert.match(shiftsApi, /const sourceShift = shift\[READINESS_SOURCE\] \|\| shift;[\s\S]{0,180}?const \{ \[READINESS_SOURCE\]: ignoredSource, \.\.\.publicShift \} = shift;/, 'raw readiness inputs must be removed before the API response is built');
assert.match(shiftsApi, /evaluateShiftReadiness\(\{ db, authed, provider, shift: sourceShift, preferences \}\)/, 'readiness must evaluate the raw server record, not the redacted public offer');
assert.match(shiftsApi, /readiness\.claim_allowed|readiness\?\.claim_allowed/, 'claim must honor only server-derived readiness');
assert.doesNotMatch(shiftsApi, /(?:body|req\.body)\.(?:readiness|claimAllowed|claim_allowed)/, 'claim must not trust browser readiness');
assert.match(migration, /from public\.nurse_shift_readiness_snapshots[\s\S]{0,700}?overall_status = 'ready'[\s\S]{0,220}?claim_allowed[\s\S]{0,220}?invalidated_at is null[\s\S]{0,220}?expires_at > clock_timestamp\(\)/, 'claiming or starting a run must require a current, non-invalidated ready snapshot');
assert.match(migration, /fresh_readiness_required/);
assert.match(migration, /offer_terms_id uuid not null/, 'each guided run must bind the accepted offer terms');
assert.match(migration, /alter table public\.mobile_shift_runs add constraint mobile_shift_runs_offer_terms_tenant_fk[\s\S]{0,240}?foreign key \(tenant_id, offer_terms_id\) references public\.nurse_offer_terms\(tenant_id, id\)/, 'run offer terms must be tenant-scoped');
const startRunFunction = migration.slice(
  migration.indexOf('create or replace function public.start_nurse_shift_run('),
  migration.indexOf('create or replace function public.record_nurse_time_event('),
);
assert.match(startRunFunction, /from public\.nurse_offer_terms[\s\S]*?status = 'accepted'/, 'run start must require accepted offer terms');
assert.match(startRunFunction, /insert into public\.mobile_shift_runs[\s\S]*?readiness_snapshot_id, offer_terms_id, guide_version_id, guide_version/, 'run start must persist readiness, accepted-offer, and guide evidence');
assert.match(startRunFunction, /v_readiness\.id, v_offer\.id, v_guide_id, v_guide_label/, 'the new run must bind the exact readiness, accepted offer, and guide resolved by the server');
assert.match(runsApi, /const offerTermsPromise = run\?\.offer_terms_id[\s\S]{0,180}?loadOfferTermsById\([^\n]+run\.offer_terms_id\)/, 'active runs must display their bound historical offer rather than mutable latest terms');
assert.match(workflow, /NURSYS_EVIDENCE_MAX_AGE_MS = 24 \* 60 \* 60 \* 1000/, 'license readiness must require fresh Nursys evidence');
assert.match(workflow, /shift_license_scope_evidence_missing/, 'a shift-specific jurisdiction and scope decision must fail closed when absent');
assert.match(migration, /license\.nursys_checked_at >= clock_timestamp\(\) - interval '24 hours'/, 'transactional work gates must recheck fresh Nursys evidence');
assert.match(migration, /evidence\.domain = 'license'[\s\S]{0,260}?evidence\.expires_at > clock_timestamp\(\)/, 'transactional work gates must require unexpired shift-specific license scope evidence');
assert.match(workflow, /day\.acknowledged_revision[\s\S]{0,180}?Date\.parse\(day\.acknowledged_revision\) >= Date\.parse\(day\.assignment_revision\)/, 'readiness must reject unacknowledged route revisions');
assert.match(migration, /route_day\.acknowledged_revision >= route_day\.assignment_revision/, 'claim, start, and clock-in gates must reject unacknowledged route revisions');
for (const capacityField of ['max_daily_hours', 'max_daily_stops', 'minimum_turnaround_minutes']) {
  assert.ok(workflow.includes(capacityField), `server readiness must enforce ${capacityField}`);
  assert.ok(settingsPage.includes(capacityField), `nurse settings must expose ${capacityField}`);
  assert.ok(migration.includes(capacityField), `transactional claims must enforce ${capacityField}`);
}
assert.match(workflow, /break_start[\s\S]{0,400}?break_end/, 'availability must honor protected break blocks');
assert.match(settingsPage, /Break start[\s\S]{0,500}?Break end/, 'nurses must be able to set protected break blocks');
assert.match(migration, /assert_nurse_offer_engagement[\s\S]*?engagement_model_not_approved/, 'accepted terms must match the human-approved engagement model');
assert.match(migration, /protocol_key text check/, 'approved guide templates must be scoped to a service protocol');
assert.match(startRunFunction, /lower\(trim\(gt\.protocol_key\)\) = lower\(trim\(v_protocol_key\)\)/, 'mobile work must bind the approved guide for the appointment protocol');

// ── Actual time, exception review, and closeout safety ─────────────────────

assert.match(runsApi, /record_nurse_time_event/);
assert.match(runsApi, /record_nurse_step_event/);
assert.match(runsApi, /open_nurse_shift_exception/);
assert.match(runsApi, /close_nurse_shift_run/);
assert.match(runsApi, /clock_out/);
assert.match(runsApi, /action === 'request_time_correction'[\s\S]{0,900}?p_event_type: 'correction_request'/, 'nurses must be able to request structured time corrections');
assert.match(runsApi, /CORRECTION_REASON_CODES/, 'time corrections must use explicit reason codes');
assert.match(migration, /p_event_type = 'correction_request'[\s\S]{0,700}?kind, severity[\s\S]{0,400}?'time', 'operational'/, 'time corrections must open an owned payroll review exception');
assert.match(runsApi, /action === 'break_start' && body\.handoffConfirmed !== true/, 'breaks must require an explicit safe-handoff confirmation');
assert.match(migration, /p_event_type = 'break_start'[\s\S]{0,500}?p_metadata ->> 'handoff_confirmed'/, 'the transactional break gate must verify the handoff attestation');
assert.match(guidePage, /No patient or time-critical therapy is unattended/, 'the Nurse UI must show the break safety attestation');
assert.match(migration, /p_event_type = 'clock_out'[\s\S]*insert into public\.mobile_shift_time_events/, 'clock-out must always record actual time');
assert.match(migration, /clocked_out_at = v_event\.occurred_at[\s\S]*when v_open_exceptions then 'exception_review' else 'clocked_out'/, 'open exceptions must never erase or prevent clock-out');
assert.match(migration, /v_run\.clocked_out_at is null[\s\S]*clock_out_required/);
assert.match(migration, /v_open_exceptions or cardinality\(v_missing\) > 0 then 'exception_review'[\s\S]*else 'time_submitted'/, 'unresolved closeout must enter review after time is preserved');
assert.match(migration, /if p_resolution in \('blocked_by_safety', 'blocked_by_system'\) then[\s\S]{0,240}?insert into public\.shift_exceptions[\s\S]{0,900}?status = 'exception_review'/, 'a blocked guide step must create an owned exception and enter review');
assert.match(migration, /where event\.tenant_id = p_tenant_id and event\.shift_run_id = p_run_id[\s\S]{0,180}?and event\.step_key = v_required[\s\S]{0,180}?order by event\.occurred_at desc, event\.created_at desc[\s\S]{0,80}?limit 1/, 'closeout must use the latest resolution for each required step');
assert.match(workflow, /clock_out_available: true/);

for (const [path, source] of [
  ['app-modules/pages/provider/NurseSchedule.jsx', queuePage],
  ['app-modules/pages/provider/NurseGuidedShift.jsx', guidePage],
  ['app-modules/pages/provider/NurseInvoices.jsx', payPage],
]) {
  const terminalSet = source.match(/const TERMINAL_RUN_STATUSES = new Set\(\[([^\]]+)\]\)/)?.[1] || '';
  assert.ok(terminalSet, `${path} must define terminal run states explicitly`);
  assert.doesNotMatch(terminalSet, /['"]clocked_out['"]/, `${path} must keep a clocked-out run active until closeout/time submission`);
}
assert.doesNotMatch(workflow, /\['time_submitted', 'closed', 'clocked_out'\]/, 'server next-action logic must not treat clock-out as completed closeout');
assert.match(workflow, /if \(clockedOut\) return \{ action: 'closeout'/, 'clocked-out work must advance to closeout');

// ── Offline continuity: sanitized, session-bound, ordered, and fail-closed ──

assert.match(offlineOutbox, /globalThis\.indexedDB\.open\(DB_NAME, DB_VERSION\)/, 'offline nurse state must use IndexedDB');
for (const store of ['META_STORE', 'CACHE_STORE', 'OUTBOX_STORE']) {
  assert.match(offlineOutbox, new RegExp(`createObjectStore\\(${store},`), `IndexedDB must create ${store}`);
}
assert.doesNotMatch(offlineOutbox, /(?:localStorage|sessionStorage)/, 'offline operational state must never use local or session storage');
assert.doesNotMatch(offlineOutbox, /@\/fixtures|\/fixtures\/|commandMockData|localOs|QuickPatientAdd|readLastBooking/, 'offline state must never depend on fixture or browser-only operational sources');

const cacheSanitizers = offlineOutbox.slice(
  offlineOutbox.indexOf('function sanitizeAssignment('),
  offlineOutbox.indexOf('function cacheKey('),
);
assert.match(cacheSanitizers, /export function sanitizeNurseShiftPayload\(payload\)[\s\S]*?shift,[\s\S]*?readiness: sanitizeReadiness[\s\S]*?run: sanitizeRun[\s\S]*?guide,[\s\S]*?timeEvents:[\s\S]*?stepEvents:[\s\S]*?exceptions:[\s\S]*?nextAction:[\s\S]*?route: null/, 'the offline cache must be built from explicit operational allowlists');
assert.doesNotMatch(cacheSanitizers, /\.\.\.(?:payload|value)/, 'the offline cache must not spread unreviewed server records');
assert.doesNotMatch(cacheSanitizers, /\b(?:notes?|free_text|clinical_text|metadata|navigation|address|location_name|patient_name|client_name|title)\s*:/i, 'the offline cache must not retain patient free text, names, addresses, navigation, or unreviewed metadata');
assert.match(offlineOutbox, /function sanitizeGuide\(value\)[\s\S]{0,700}?instructions: text\(step\?\.instructions, 1200\)/, 'the exact approved or retired static guide must remain available during a short outage');
assert.match(offlineOutbox, /approvedStep\?\.instructions \|\| null/, 'offline next-action instructions must come only from the locked approved guide, never patient payload text');
assert.match(offlineOutbox, /const sanitized = sanitizeNurseShiftPayload\(payload\)[\s\S]{0,500}?payload: sanitized/, 'only the sanitized payload may be persisted');
assert.match(offlineOutbox, /if \(action === 'request_time_correction'\)[\s\S]{0,900}?reasonCode,[\s\S]{0,300}?requestedClockInAt[\s\S]{0,300}?requestedClockOutAt/, 'offline time corrections must use only structured codes and requested timestamps');

assert.match(offlineOutbox, /const IDENTITY_FIELDS = \['authSessionBinding', 'userBinding', 'tenantBinding', 'providerBinding'\]/, 'offline records must bind the authenticated session, user, tenant, and provider');
assert.match(offlineOutbox, /supabase\.auth\.getSession\(\)/, 'offline identity must derive from the authenticated session');
assert.match(offlineOutbox, /crypto\.subtle\.digest\('SHA-256', bytes\)/, 'offline identity bindings must be cryptographic hashes');
assert.match(offlineOutbox, /function sameIdentity\(left, right\)[\s\S]{0,180}?IDENTITY_FIELDS\.every/, 'every cached or queued record must be checked against the full identity scope');
assert.match(offlineOutbox, /\.filter\(\(item\) => item\?\.shiftId === shift && sameIdentity\(item, identity\)\)/, 'outbox reads must exclude records from other sessions or providers');

const offlineActionValues = [...(offlineOutbox.match(/export const NURSE_OFFLINE_ACTIONS = new Set\(\[([\s\S]*?)\]\)/)?.[1] || '').matchAll(/'([^']+)'/g)]
  .map((match) => match[1]);
for (const action of ['clock_in', 'break_start', 'break_end', 'clock_out', 'resolve_step', 'open_exception', 'closeout', 'request_time_correction']) {
  assert.ok(offlineActionValues.includes(action), `offline queue must explicitly allow ${action}`);
}
assert.ok(!offlineActionValues.includes('start') && !offlineActionValues.includes('claim'), 'claim and run start must never be queued offline');
assert.match(offlineOutbox, /function randomUuid\(\)[\s\S]*?cryptoApi\.randomUUID\(\)/, 'offline device and event identifiers must use secure UUIDs');
assert.match(offlineOutbox, /deviceId: identity\.deviceId,[\s\S]{0,180}?deviceOccurredAt: occurredAt,[\s\S]{0,180}?idempotencyKey: requestId/, 'queued actions must preserve device identity, device time, and a stable idempotency key');
assert.match(offlineOutbox, /export function readinessAllowsOfflineClockIn\(payload, now = Date\.now\(\)\)[\s\S]{0,500}?READY_STATUSES\.has[\s\S]{0,180}?start_allowed === true[\s\S]{0,180}?!readiness\?\.invalidated_at[\s\S]{0,180}?Number\.isFinite\(expiry\)[\s\S]{0,120}?expiry > now/, 'offline clock-in must fail closed for missing, stale, invalidated, or non-startable readiness');
assert.match(offlineOutbox, /normalizedAction === 'clock_in' && !readinessAllowsOfflineClockIn\(currentPayload\)/, 'queueing clock-in must recheck the cached readiness snapshot');
assert.match(offlineOutbox, /if \(!currentPayload\?\.run\?\.id\)[\s\S]{0,180}?Start preflight online/, 'offline actions must require a run that was started online');
assert.match(offlineOutbox, /normalizedAction === 'resolve_step'[\s\S]{0,500}?!readinessAllowsOfflineClockIn\(currentPayload\)[\s\S]{0,500}?offline_current_readiness_blocks_care_step/, 'expired offline readiness must block ordinary care steps while preserving safety and closeout actions');
assert.match(offlineOutbox, /if \(action === 'break_start'\)[\s\S]{0,500}?handoffConfirmed: true/, 'offline break replay must preserve only the structured handoff attestation');
assert.match(offlineOutbox, /const latestStepByKey = new Map\(\)[\s\S]{0,300}?RESOLVED_STEP_STATES\.has/, 'offline guide progression must use the latest resolution and never treat a blocked step as completed');
assert.ok(
  (guidePage.match(/idempotencyKeys\.current\.delete\(keyName\)/g) || []).length >= 2,
  'a persisted offline action must release its UI retry key so a later same-type event receives a new UUID',
);

const syncOutboxFunction = offlineOutbox.slice(
  offlineOutbox.indexOf('export async function syncNurseOutbox('),
  offlineOutbox.indexOf('function eventType('),
);
assert.match(syncOutboxFunction, /for \(const item of queue\) \{[\s\S]*?await apiPost\('\/api\/me\/shift-runs', request\)/, 'offline events must replay sequentially, not concurrently');
assert.doesNotMatch(syncOutboxFunction, /Promise\.all/, 'offline replay must never reorder dependent events');
assert.match(offlineOutbox, /\.sort\(\(left, right\) => Date\.parse\(left\.createdAt\) - Date\.parse\(right\.createdAt\)\)/, 'offline events must replay oldest first');
assert.match(syncOutboxFunction, /idempotencyKey: item\.idempotencyKey,[\s\S]{0,280}?deviceOccurredAt: item\.deviceOccurredAt/, 'replay must preserve the original idempotency key and device timestamp');
assert.match(syncOutboxFunction, /if \(item\.action === 'closeout'\)[\s\S]{0,500}?await apiGet\(`[\s\S]{0,300}?version = positiveInteger\(current\?\.run\?\.version\)/, 'offline closeout must load the latest persisted run version before submission');
assert.match(syncOutboxFunction, /const result = validateReplayResponse\(await apiPost[\s\S]{0,180}?await deleteRecord\(OUTBOX_STORE, item\.id\)/, 'queued evidence may be deleted only after a valid server response');
assert.match(syncOutboxFunction, /if \(error\?\.status === 409\)[\s\S]{0,360}?status: 'conflict'[\s\S]{0,400}?stoppedReason = 'conflict'/, 'a server conflict must remain stored for nurse review');
assert.match(offlineOutbox, /NURSE_OFFLINE_ACTIONS[\s\S]*?'clock_out'/, 'clock-out must remain queueable during an outage');

const nurseOperationalSource = [workflow, shiftsApi, runsApi, queuePage, guidePage, settingsPage].join('\n');
const nurseGuidedShiftServerSource = [workflow, shiftsApi, runsApi].join('\n');
assert.doesNotMatch(nurseGuidedShiftServerSource, /invoiceHours\s*\(|subtotalCents|create_(?:nurse_)?invoice|generate_(?:nurse_)?invoice/i, 'guided-shift code must not generate invoices from scheduled time');
assert.doesNotMatch(nurseGuidedShiftServerSource, /(?:from|into)\(['"](?:nurse_)?invoices?['"]\)[\s\S]{0,320}?\.(?:insert|upsert|update)\(/i, 'guided-shift code must not write invoice records');
assert.doesNotMatch(nurseOperationalSource, /INVOICE_DRAFT_KEY|sessionStorage\.(?:getItem|setItem)/, 'guided-shift operational or pay state must not live in browser session storage');
assert.match(payPage, /No scheduled duration is substituted\./, 'Time & Pay must fail closed instead of substituting scheduled duration');
assert.doesNotMatch(payPage, /Date\.parse\([^)]*(?:starts_at|ends_at)[^)]*\)/, 'Time & Pay duration must come only from actual clock records');

// ── Mobile nurse UI and route boundary ─────────────────────────────────────

for (const [path, source] of activeNurseUi) {
  assert.match(source, /assertApiResponse/, `${path} must reject malformed 2xx responses`);
  assert.match(source, /OperationalSourceUnavailable/, `${path} must render a truthful unavailable state`);
  assert.doesNotMatch(source, /@\/fixtures|\/fixtures\/|commandMockData|localOs|QuickPatientAdd|readLastBooking/, `${path} must not use fixture or local operational data`);
  assert.doesNotMatch(source, /(?:localStorage|sessionStorage)\./, `${path} must not store operational state in the browser`);
}
assert.match(queuePage, /\/api\/me\/shifts/);
assert.match(queuePage, /readiness\?\.claim_allowed|readiness\.claim_allowed/);
assert.match(queuePage, /Work queue unavailable/);
assert.match(guidePage, /\/api\/me\/shift-runs/);
assert.match(guidePage, /Clock out/);
assert.match(guidePage, /Report an issue/);
for (const [label, pattern] of [
  ['Emergency', /Emergency/],
  ['Safety', /Safety(?: concern)?/],
  ['Clinical escalation', /Clinical escalation/],
  ['Adverse event', /Adverse event/],
  ['System/outage', /System\s*\/\s*outage/],
]) {
  assert.match(guidePage, pattern, `guided shift is missing issue control ${label}`);
}
assert.match(guidePage, /Guided shift unavailable/);
for (const endpoint of [
  '/api/me/business-profile',
  '/api/me/availability',
  '/api/me/service-preferences',
  '/api/me/service-area',
  '/api/me/engagement-status',
]) {
  assert.ok(settingsPage.includes(endpoint), `nurse work settings is missing ${endpoint}`);
}

assert.match(routes, /const NurseGuidedShift = lazyRoute/);
assert.match(routes, /const NurseWorkSettings = lazyRoute/);
for (const path of ['/provider/shifts/:shiftId', '/provider/shifts/:shiftId/run', '/provider/settings']) {
  assert.ok(routes.includes(`path="${path}"`), `missing active nurse route ${path}`);
}
assert.doesNotMatch(routes, /const NurseShift =|const NurseDashboard =|const ProviderReports =/, 'old fixture nurse screens must remain unrouted');

console.log('Nurse guided-shift verification passed: tenant-safe persistence, auth-derived ownership, fail-closed readiness, preserved actual time, truthful mobile UI, and no fixture state.');
