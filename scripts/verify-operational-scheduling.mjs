import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cleanShiftInput,
  expandShiftOccurrences,
  zonedLocalToIso,
} from '../api/_lib/operational-workflows.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../supabase/migrations/050_operational_backoffice.sql');
const adminApi = read('../api/admin/scheduling.js');
const providerApi = read('../api/me/shifts.js');
const nurseWorkflow = read('../api/_lib/nurse-workflow.js');
const invoicesApi = read('../api/me/nurse-invoices.js');
const adminPage = read('../app-modules/pages/admin/SchedulingControl.jsx');
const providerPage = read('../app-modules/pages/provider/NurseSchedule.jsx');
const guidedPage = read('../app-modules/pages/provider/NurseGuidedShift.jsx');
const settingsPage = read('../app-modules/pages/provider/NurseWorkSettings.jsx');
const invoicePage = read('../app-modules/pages/provider/NurseInvoices.jsx');
const routes = read('../src/App.jsx');
const adminShell = read('../src/components/admin/AdminShell.jsx');
const adminAccess = read('../src/lib/adminAccess.js');

const validShift = {
  title: 'Monday mobile coverage',
  startDate: '2026-03-02',
  startTime: '09:00',
  endTime: '17:00',
  timezone: 'America/Los_Angeles',
  roleRequired: 'RN',
  slotsRequired: 2,
  status: 'open',
};

assert.equal(zonedLocalToIso('2026-03-02', '09:00', 'America/Los_Angeles'), '2026-03-02T17:00:00.000Z');
const weekly = expandShiftOccurrences({
  ...validShift,
  recurrence: { mode: 'weekly', weekdays: [1], untilDate: '2026-03-16' },
});
assert.equal(weekly.length, 3);
assert.equal(weekly[0].startsAt, '2026-03-02T17:00:00.000Z');
assert.equal(weekly[1].startsAt, '2026-03-09T16:00:00.000Z', 'wall-clock time must survive DST');
assert.equal(
  expandShiftOccurrences({ ...validShift, startTime: '22:00', endTime: '06:00' })[0].endsAt,
  '2026-03-03T14:00:00.000Z',
  'overnight shifts must end on the next local day',
);
assert.throws(
  () => expandShiftOccurrences({ ...validShift, startDate: '2026-03-08', startTime: '02:30', endTime: '03:30' }),
  (error) => error.code === 'invalid_shift_range',
  'nonexistent local DST time must fail closed',
);
assert.equal(cleanShiftInput(validShift).role_required, 'RN');
assert.throws(
  () => cleanShiftInput({ ...validShift, instructions: 'Call patient Jane about her medication.' }),
  (error) => error.code === 'phi_in_scheduling_text' && error.status === 422,
  'scheduling free text must reject client and clinical detail',
);

assert.match(migration, /create table if not exists public\.operational_shifts/);
assert.match(migration, /create table if not exists public\.operational_shift_assignments/);
assert.match(migration, /provider_profile_id uuid not null/);
assert.match(migration, /references public\.provider_profiles\(tenant_id, id\)/);
assert.match(migration, /pp\.credential_status = 'clear'/);
assert.match(migration, /pp\.nursys_status = 'clear'/);
assert.match(migration, /pp\.provider_role in \('rn', 'np'\)/);
assert.match(migration, /pp\.profile_id = p_actor_profile_id/, 'self-service RPCs must bind provider id to auth profile id');
assert.match(migration, /for update/, 'claim, assignment, and transition RPCs must lock their shift');
assert.match(migration, /append_operational_audit/, 'operational writes must audit inside the transaction');
assert.match(migration, /phi_touched[\s\S]*false/, 'scheduling audit records must remain PHI-free');
assert.equal((migration.match(/message = 'shift_not_started'/g) || []).length, 2, 'admin and provider completion must reject future shifts');
assert.match(migration, /clock_timestamp\(\) < v_shift\.starts_at/);

for (const name of [
  'create_operational_shift_series',
  'update_operational_shift',
  'assign_operational_shift',
  'offer_operational_shift',
  'transition_operational_shift',
  'claim_operational_shift',
  'complete_operational_shift_assignment',
]) {
  assert.match(migration, new RegExp(`create or replace function public\\.${name}\\(`), `missing transactional RPC ${name}`);
  assert.match(migration, new RegExp(`grant execute on function public\\.${name}[\\s\\S]*?to service_role`), `${name} must be service-role only`);
}

assert.match(adminApi, /requireAdmin\(req, res\)/, 'scheduling control must be admin-only');
assert.match(adminApi, /provider_profiles/);
assert.match(adminApi, /\.eq\('credential_status', 'clear'\)/);
assert.match(adminApi, /\.eq\('nursys_status', 'clear'\)/);
assert.match(adminApi, /provider_profile_id/);
assert.match(adminApi, /scheduling_migration_required/, 'missing RPC/table contract must fail closed');
for (const name of [
  'create_operational_shift_series', 'update_operational_shift', 'assign_operational_shift',
  'offer_operational_shift', 'transition_operational_shift',
]) assert.ok(adminApi.includes(`'${name}'`), `admin API must call ${name}`);
assert.doesNotMatch(adminApi, /\.(?:insert|update|upsert|delete)\(/, 'admin scheduling writes must be RPC-only');
assert.doesNotMatch(adminApi, /sendEmail|writeAuditEvent|nurse_profile_id/, 'admin scheduling must not preserve stale side effects or profile identity');

assert.match(providerApi, /resolveNurseProvider\(authed\)/, 'provider API must use the canonical authenticated nurse resolver');
assert.match(nurseWorkflow, /\.eq\('profile_id', authed\.user\.id\)/, 'auth profile id must resolve a provider_profiles id');
assert.match(nurseWorkflow, /provider\.credential_status === 'clear'/);
assert.match(nurseWorkflow, /provider\.nursys_status === 'clear'/);
assert.match(providerApi, /provider_profile_id/);
assert.match(providerApi, /claim_operational_shift/);
assert.match(providerApi, /p_expected_version: version/);
assert.match(providerApi, /location_name: hasOperationalAccess \? shift\.location_name : null/);
assert.match(providerApi, /location_address: hasOperationalAccess \? shift\.location_address : null/);
assert.match(providerApi, /instructions: hasOperationalAccess \? shift\.instructions : null/);
assert.match(providerApi, /event: hasOperationalAccess && event \? event : null/, 'pre-claim shifts must withhold the entire linked event record');
assert.doesNotMatch(providerApi, /event:\s*\{[\s\S]{0,240}venue:/, 'pre-claim responses must not reconstruct event venue data');
assert.doesNotMatch(providerApi, /\.(?:insert|update|upsert|delete)\(/, 'provider scheduling writes must be RPC-only');
assert.doesNotMatch(providerApi, /nurse_profile_id/, 'provider_profiles.id is the operational assignment identity');

assert.match(invoicesApi, /\.eq\('nurse_profile_id', authed\.user\.id\)/, '047 invoices remain linked to the auth/profile id');
assert.match(invoicesApi, /resolveNurseProvider\(authed\)/, 'own-invoice access must use the canonical authenticated provider resolver');
assert.match(invoicesApi, /\.eq\('provider_profile_id', provider\.id\)/, 'actual-time history must be scoped to the authenticated provider');
assert.doesNotMatch(invoicesApi, /\.eq\('(?:credential_status|nursys_status)', 'clear'\)/, 'historical time and pay must remain visible when current readiness changes');
assert.doesNotMatch(invoicesApi, /\.ilike\('nurse_email'|select\('\*'\)/, 'own invoice reads must not use self-asserted email or wildcard columns');
assert.match(invoicesApi, /finance_migration_required/);
assert.match(invoicePage, /noindex, nofollow, noarchive/);

assert.match(adminPage, /version: shift\.version/);
assert.match(adminPage, /provider_profile_id/);
assert.match(adminPage, /Assign credential-cleared nurse/);
assert.match(adminPage, /disabled=\{saving \|\| !state\.available\}/, 'failed setup check must disable schedule writes');
assert.match(providerPage, /version: shift\.version/);
assert.match(providerPage, /\/provider\/shifts\/\$\{encodeURIComponent\(shift\.id\)\}/, 'accepted work must open the persisted guided shift route');
assert.match(guidedPage, /\/api\/me\/shift-runs/, 'guided shift must use the persisted shift-run API');
assert.match(settingsPage, /\/api\/me\/business-profile/, 'nurse settings must use the persisted business-profile API');

for (const path of [
  '/provider/shifts',
  '/provider/shifts/:shiftId',
  '/provider/shifts/:shiftId/run',
  '/provider/settings',
  '/provider/invoices',
  '/admin/scheduling',
]) {
  assert.ok(routes.includes(`path="${path}"`), `missing route ${path}`);
}
for (const legacyPath of ['/provider/today', '/provider/dashboard', '/provider/dispatch', '/provider/field', '/provider/shift']) {
  assert.match(routes, new RegExp(`path="${legacyPath.replaceAll('/', '\\/')}"[\\s\\S]{0,220}<Navigate to="\\/provider\\/shifts"`), `${legacyPath} must redirect to live shifts`);
}
assert.match(routes, /path="\/provider\/reports"[\s\S]{0,220}<Navigate to="\/provider\/invoices"/, 'legacy invented reports must redirect to live invoices');
assert.doesNotMatch(routes, /const NurseShift =|const NurseDashboard =|const ProviderReports =/, 'fixture provider screens must not be bundled as routes');
assert.match(routes, /path="\/admin\/scheduling" element=\{<RequireAuth allowedRoles=\{\['admin'\]\}/);
for (const preserved of ['/admin/login', '/admin/bd/*', '/admin/robbot3k']) {
  assert.ok(routes.includes(`path="${preserved}"`), `preserve existing route ${preserved}`);
}
assert.match(routes, /classList\.toggle\('av-admin-cream', adminCream\)/, 'Admin cream theme must remain enabled');
assert.match(adminShell, /label: 'Scheduling', to: '\/admin\/scheduling'/);
assert.match(adminShell, /label: 'BD'/);
assert.match(adminShell, /label: 'Finance'/);
assert.match(adminAccess, /LIVE_ADMIN_ROUTES[\s\S]*'\/admin\/scheduling'/);
const staffRoutes = adminAccess.match(/STAFF_ROUTES = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || '';
assert.doesNotMatch(staffRoutes, /\/admin\/scheduling/, 'generic staff must not receive scheduling control');
for (const source of [adminApi, providerApi, invoicesApi, adminPage, providerPage, guidedPage, settingsPage, invoicePage]) {
  assert.doesNotMatch(source, /mock|demo|sample|preview data/i, 'live scheduling and nurse self-service must not fall back to test data');
}

console.log('Operational scheduling QA passed: provider identity, PHI-free queue, transactional RPCs, version gates, and canonical own-invoice reads.');
