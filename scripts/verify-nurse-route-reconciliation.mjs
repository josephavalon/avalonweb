import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../supabase/migrations/061_nurse_route_reconciliation.sql');
const packageJson = JSON.parse(read('../package.json'));

const firstExecutableStatement = migration.split('\n')
  .map((line) => line.trim())
  .find((line) => line && !line.startsWith('--'));
assert.equal(firstExecutableStatement, 'begin;', '061 must start one explicit transaction');
assert.match(migration, /\ncommit;\s*$/, '061 must commit only after constraints and server-only access are reconciled');

const preflightEnd = migration.indexOf('-- Add a missing unique identity');
assert.ok(preflightEnd > 0, '061 must expose a pre-mutation preflight boundary');
const preflight = migration.slice(0, preflightEnd);
for (const prerequisite of [
  "to_regclass('public.provider_route_days')",
  "to_regclass('public.provider_route_day_stops')",
  "to_regclass('public.provider_profiles')",
  "to_regclass('public.appointments')",
  "to_regprocedure('public.touch_updated_at()')",
  "to_regrole('anon')",
  "to_regrole('authenticated')",
  "to_regrole('service_role')",
]) assert.ok(preflight.includes(prerequisite), `061 preflight missing ${prerequisite}`);

for (const [table, column, type, notNull] of [
  ['provider_route_days', 'id', 'uuid', true],
  ['provider_route_days', 'tenant_id', 'uuid', true],
  ['provider_route_days', 'provider_profile_id', 'uuid', true],
  ['provider_route_days', 'route_date', 'date', true],
  ['provider_route_days', 'assignment_revision', 'timestamptz', true],
  ['provider_route_days', 'acknowledged_revision', 'timestamptz', false],
  ['provider_route_days', 'updated_at', 'timestamptz', true],
  ['provider_route_day_stops', 'id', 'uuid', true],
  ['provider_route_day_stops', 'tenant_id', 'uuid', true],
  ['provider_route_day_stops', 'route_day_id', 'uuid', true],
  ['provider_route_day_stops', 'appointment_id', 'uuid', true],
  ['provider_route_day_stops', 'assigned_provider_profile_id', 'uuid', true],
  ['provider_route_day_stops', 'selected', 'boolean', true],
  ['provider_route_day_stops', 'assignment_snapshot_at', 'timestamptz', true],
  ['provider_route_day_stops', 'updated_at', 'timestamptz', true],
  ['provider_profiles', 'id', 'uuid', true],
  ['provider_profiles', 'tenant_id', 'uuid', true],
  ['appointments', 'id', 'uuid', true],
  ['appointments', 'tenant_id', 'uuid', true],
]) {
  assert.ok(
    preflight.includes(`('${table}', '${column}', '${type}'::regtype, ${notNull})`),
    `061 must preflight ${table}.${column} type and nullability`,
  );
}
assert.match(preflight, /column_definition\.atttypid <> required\.type_oid::oid/);
assert.match(preflight, /column_definition\.attnotnull is distinct from required\.is_not_null/);
assert.match(preflight, /nurse_route_column_contract_mismatch/);

for (const parentConstraint of [
  'operational_provider_profiles_tenant_id_id_key',
  'operational_appointments_tenant_id_id_key',
]) {
  assert.ok(preflight.includes(`conname = '${parentConstraint}'`), `061 must require ${parentConstraint}`);
}
assert.match(preflight, /constraint_definition\.contype = 'u'/);
assert.match(preflight, /constraint_definition\.convalidated/);
assert.match(preflight, /array\['tenant_id', 'id'\]::text\[\]/);
assert.match(preflight, /nurse_route_parent_identity_mismatch/);
assert.doesNotMatch(preflight, /\balter table\b|\brevoke\b|\bgrant\b|\bdrop (?:policy|trigger)\b|\bcreate trigger\b/i, '061 must not mutate before preflight succeeds');

const uniqueBlock = migration.slice(
  migration.indexOf('-- Add a missing unique identity'),
  migration.indexOf('-- Foreign keys are installed NOT VALID'),
);
for (const [table, constraint, columns, orderedColumns] of [
  ['provider_route_days', 'provider_route_days_tenant_id_id_key', 'tenant_id, id', "array['tenant_id', 'id']::text[]"],
  ['provider_route_days', 'provider_route_days_tenant_id_id_provider_key', 'tenant_id, id, provider_profile_id', "array['tenant_id', 'id', 'provider_profile_id']::text[]"],
  ['provider_route_day_stops', 'provider_route_day_stops_tenant_id_id_key', 'tenant_id, id', "array['tenant_id', 'id']::text[]"],
]) {
  const start = uniqueBlock.indexOf(`conname = '${constraint}'`);
  assert.ok(start >= 0, `061 must individually guard ${constraint}`);
  const section = uniqueBlock.slice(start, uniqueBlock.indexOf('end if;', start) + 'end if;'.length);
  assert.match(section, /constraint_definition\.contype = 'u'/, `${constraint} must be unique`);
  assert.match(section, /constraint_definition\.convalidated/, `${constraint} must be validated`);
  assert.ok(section.includes(orderedColumns), `${constraint} must verify exact ordered columns`);
  assert.match(
    uniqueBlock,
    new RegExp(`alter table public\\.${table}[\\s\\S]*?add constraint ${constraint}[\\s\\S]*?unique \\(${columns}\\)`),
    `${constraint} must be added without silently accepting duplicate data`,
  );
}
assert.ok((uniqueBlock.match(/_mismatch'/g) || []).length >= 3, '061 unique reconciliation must fail on same-name mismatches');

const foreignKeyBlock = migration.slice(
  migration.indexOf('-- Foreign keys are installed NOT VALID'),
  migration.indexOf('alter table public.provider_route_days\n  validate constraint'),
);
for (const definition of [
  {
    table: 'provider_route_days',
    name: 'provider_route_days_provider_tenant_fk',
    local: 'tenant_id, provider_profile_id',
    orderedLocal: "array['tenant_id', 'provider_profile_id']::text[]",
    parent: 'provider_profiles',
    remote: 'tenant_id, id',
    orderedRemote: "array['tenant_id', 'id']::text[]",
  },
  {
    table: 'provider_route_day_stops',
    name: 'provider_route_day_stops_route_provider_tenant_fk',
    local: 'tenant_id, route_day_id, assigned_provider_profile_id',
    orderedLocal: "array['tenant_id', 'route_day_id', 'assigned_provider_profile_id']::text[]",
    parent: 'provider_route_days',
    remote: 'tenant_id, id, provider_profile_id',
    orderedRemote: "array['tenant_id', 'id', 'provider_profile_id']::text[]",
  },
  {
    table: 'provider_route_day_stops',
    name: 'provider_route_day_stops_appointment_tenant_fk',
    local: 'tenant_id, appointment_id',
    orderedLocal: "array['tenant_id', 'appointment_id']::text[]",
    parent: 'appointments',
    remote: 'tenant_id, id',
    orderedRemote: "array['tenant_id', 'id']::text[]",
  },
]) {
  const start = foreignKeyBlock.indexOf(`conname = '${definition.name}'`);
  assert.ok(start >= 0, `061 must individually guard ${definition.name}`);
  const next = foreignKeyBlock.indexOf("if exists (", start + 1);
  const section = foreignKeyBlock.slice(start, next < 0 ? foreignKeyBlock.length : next);
  assert.match(section, /constraint_definition\.contype = 'f'/, `${definition.name} must be a foreign key`);
  assert.match(section, /constraint_definition\.convalidated/, `${definition.name} must reject an existing unvalidated constraint`);
  assert.match(section, /constraint_definition\.confdeltype = 'c'/, `${definition.name} must verify ON DELETE CASCADE`);
  assert.ok(section.includes(`constraint_definition.confrelid = 'public.${definition.parent}'::regclass`), `${definition.name} must verify its parent relation`);
  assert.ok(section.includes(definition.orderedLocal), `${definition.name} must verify exact ordered local columns`);
  assert.ok(section.includes(definition.orderedRemote), `${definition.name} must verify exact ordered parent columns`);
  assert.match(
    foreignKeyBlock,
    new RegExp(`alter table public\\.${definition.table}[\\s\\S]*?add constraint ${definition.name}[\\s\\S]*?foreign key \\(${definition.local}\\)[\\s\\S]*?references public\\.${definition.parent}\\(${definition.remote}\\)[\\s\\S]*?on delete cascade not valid;`),
    `${definition.name} must be added NOT VALID with ON DELETE CASCADE`,
  );
  assert.match(
    migration,
    new RegExp(`validate constraint ${definition.name};`),
    `${definition.name} must validate before commit`,
  );
}
assert.ok((foreignKeyBlock.match(/_fk_mismatch'/g) || []).length >= 3, '061 foreign-key reconciliation must fail on same-name mismatches');

for (const table of ['provider_route_days', 'provider_route_day_stops']) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  assert.match(migration, new RegExp(`drop trigger if exists trg_${table}_updated_at on public\\.${table};`));
  assert.match(migration, new RegExp(`create trigger trg_${table}_updated_at[\\s\\S]*?execute function public\\.touch_updated_at\\(\\);`));
  assert.match(migration, new RegExp(`alter table public\\.${table} enable trigger trg_${table}_updated_at;`));
}
assert.match(
  migration,
  /revoke all on table public\.provider_route_days,\s*public\.provider_route_day_stops from public, anon, authenticated, service_role;/,
);
assert.match(
  migration,
  /grant select, insert, update, delete on table public\.provider_route_days,\s*public\.provider_route_day_stops to service_role;/,
);
assert.equal((migration.match(/^grant\s/igm) || []).length, 1, '061 must make only the exact service-role table grant');
for (const policy of [
  'route days tenant operator access',
  'providers manage own route days',
  'route stops tenant operator access',
  'providers manage own route stops',
]) assert.ok(migration.includes(`drop policy if exists "${policy}"`), `061 must retire legacy policy ${policy}`);

for (const forbidden of [
  /provider_route_origins/i,
  /create table/i,
  /create or replace function/i,
  /insert into/i,
  /os_finance_ledger/i,
  /nurse_invoices?/i,
  /robbot3k/i,
  /bd_companies/i,
  /client_payments/i,
  /event_services/i,
  /cognito/i,
]) assert.doesNotMatch(migration, forbidden, `061 contains forbidden scope ${forbidden}`);

assert.equal(
  packageJson.scripts['verify:nurse-route-reconciliation'],
  'node scripts/verify-nurse-route-reconciliation.mjs',
);
const nurseRelease = packageJson.scripts['verify:nurse-release'];
assert.match(
  nurseRelease,
  /^npm run verify:nurse-operational-bootstrap && npm run verify:nurse-route-reconciliation && npm run verify:nurse-guided-shift/,
  'Nurse release must reconcile routes after 060 and before 062 checks',
);
for (const retainedGate of [
  'verify:no-live-operational-fixtures',
  'verify:operational-scheduling',
  'verify:operational-platform-migrations',
]) assert.ok(nurseRelease.includes(retainedGate), `Nurse release must retain ${retainedGate}`);

console.log('Nurse route reconciliation QA passed: preflight, exact constraints, RLS, ACLs, and triggers are fail-closed.');
