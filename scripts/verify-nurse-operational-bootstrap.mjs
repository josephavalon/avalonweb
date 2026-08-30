import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/060_nurse_operational_bootstrap.sql', import.meta.url),
  'utf8',
);

const firstExecutableStatement = migration.split('\n')
  .map((line) => line.trim())
  .find((line) => line && !line.startsWith('--'));
assert.equal(firstExecutableStatement, 'begin;', '060 must start one explicit transaction');
assert.match(migration, /\ncommit;\s*$/, '060 must commit only after all bootstrap objects and ACLs');

const tables = [...migration.matchAll(/create table if not exists public\.([a-z0-9_]+)/g)]
  .map((match) => match[1]);
assert.deepEqual(tables, ['operational_shifts', 'operational_shift_assignments']);

for (const prerequisite of [
  'public.tenants',
  'public.profiles',
  'public.provider_profiles',
  'public.appointments',
  'public.audit_events',
  'public.provider_license_jurisdictions',
  'public.do_not_treat_flags',
  'public.touch_updated_at()',
]) assert.ok(migration.includes(prerequisite), `060 missing core prerequisite ${prerequisite}`);

for (const column of ['protocol_key', 'gfe_status', 'payment_status', 'patient_person_id']) {
  assert.ok(migration.includes(`('appointments', '${column}')`), `060 must require appointments.${column}`);
}

for (const constraint of [
  'operational_profiles_tenant_id_id_key',
  'operational_appointments_tenant_id_id_key',
  'operational_provider_profiles_tenant_id_id_key',
  'operational_shifts_tenant_id_id_key',
  'operational_shift_assignments_tenant_id_id_key',
  'operational_shift_assignments_shift_provider_key',
  'operational_shifts_appointment_tenant_fk',
  'operational_shifts_created_by_tenant_fk',
  'operational_shift_assignments_shift_tenant_fk',
  'operational_shift_assignments_provider_tenant_fk',
  'operational_shift_assignments_created_by_tenant_fk',
]) assert.ok(migration.includes(constraint), `060 missing tenant-safe constraint ${constraint}`);

const reconciliationBlock = migration.slice(
  migration.indexOf("message = 'nurse_operational_bootstrap_partial_schema'"),
  migration.indexOf("conname = 'operational_shifts_appointment_tenant_fk'"),
);
for (const [constraint, columns] of [
  ['operational_shifts_tenant_id_id_key', "array['tenant_id', 'id']::text[]"],
  ['operational_shift_assignments_tenant_id_id_key', "array['tenant_id', 'id']::text[]"],
  ['operational_shift_assignments_shift_provider_key', "array['shift_id', 'provider_profile_id']::text[]"],
]) {
  assert.match(
    reconciliationBlock,
    new RegExp(`conname = '${constraint}'[\\s\\S]*?add constraint ${constraint}`),
    `060 must individually reconcile ${constraint}`,
  );
  assert.ok(reconciliationBlock.includes(columns), `${constraint} must verify its exact ordered columns`);
}
for (const constraint of ['operational_shifts_status_check', 'operational_shift_assignments_status_check']) {
  assert.match(
    reconciliationBlock,
    new RegExp(`conname = '${constraint}'[\\s\\S]*?add constraint ${constraint}[\\s\\S]*?convalidated`),
    `060 must reconcile and validate ${constraint}`,
  );
}
assert.match(reconciliationBlock, /raise exception[\s\S]*constraint_invalid/);

assert.doesNotMatch(
  migration,
  /foreign key \(tenant_id, event_container_id\)/i,
  'Nurse-only bootstrap must not depend on the event container schema',
);
assert.match(migration, /create index if not exists operational_shifts_window_idx/);
assert.match(migration, /create index if not exists operational_shift_assignment_provider_idx/);
assert.match(migration, /alter table public\.operational_shifts enable row level security/);
assert.match(migration, /alter table public\.operational_shift_assignments enable row level security/);
assert.match(
  migration,
  /revoke all on public\.operational_shifts,\s*public\.operational_shift_assignments\s*from public, anon, authenticated, service_role;/,
);
assert.match(
  migration,
  /grant select on public\.operational_shifts,\s*public\.operational_shift_assignments to service_role;/,
);
assert.doesNotMatch(
  migration,
  /grant\s+[^;]*(?:insert|update|delete)[^;]*operational_shift/is,
  '060 may grant service_role SELECT only on operational tables',
);
assert.doesNotMatch(migration, /create policy/i, '060 keeps operational tables server-only');
assert.match(migration, /create trigger trg_operational_shifts_updated_at/);
assert.match(migration, /create trigger trg_operational_shift_assignments_updated_at/);

for (const helper of [
  'operational_provider_is_eligible',
  'assert_operational_provider',
  'append_operational_audit',
]) {
  assert.match(
    migration,
    new RegExp(`create or replace function app_private\\.${helper}\\(`),
    `060 missing private helper ${helper}`,
  );
  assert.match(
    migration,
    new RegExp(`revoke all on function app_private\\.${helper}\\([\\s\\S]*?from public, anon, authenticated, service_role;`),
    `060 must revoke direct execution of ${helper}`,
  );
}
assert.match(migration, /pp\.credential_status = 'clear'/);
assert.match(migration, /pp\.nursys_status = 'clear'/);
assert.match(migration, /phi_touched, payload_hash, payload[\s\S]*?false, encode\(digest/);

for (const forbidden of [
  /os_finance_ledger/i,
  /client_payments/i,
  /payment_webhook_events/i,
  /payment_reconciliation_history/i,
  /nurse_invoices?/i,
  /robbot3k/i,
  /bd_companies/i,
  /event_services/i,
  /assert_operational_operator/i,
  /create_operational_shift_series/i,
  /update_operational_shift/i,
  /assign_operational_shift/i,
  /offer_operational_shift/i,
  /transition_operational_shift/i,
  /complete_operational_shift_assignment/i,
  /create or replace function public\.claim_operational_shift/i,
]) assert.doesNotMatch(migration, forbidden, `060 includes forbidden dependency or RPC ${forbidden}`);

assert.doesNotMatch(
  migration,
  /insert into public\.operational_(?:shifts|shift_assignments)/i,
  '060 must not seed operational work',
);

console.log('Nurse operational bootstrap QA passed: isolated schema, tenant FKs, RLS, ACLs, and private helpers.');
