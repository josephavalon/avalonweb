import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../supabase/migrations/063_nurse_guided_shift_acl_reconciliation.sql');
const guidedShiftMigration = read('../supabase/migrations/062_nurse_guided_shift.sql');
const packageJson = JSON.parse(read('../package.json'));

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

const firstExecutableStatement = migration.split('\n')
  .map((line) => line.trim())
  .find((line) => line && !line.startsWith('--'));
assert.equal(firstExecutableStatement, 'begin;', '063 must start one explicit transaction');
assert.match(migration, /\ncommit;\s*$/, '063 must commit only after every Nurse ACL is reconciled');

const declaredTables = [...migration.matchAll(/'([a-z][a-z0-9_]*)'/g)]
  .map((match) => match[1])
  .filter((name) => tables.includes(name));
assert.deepEqual(declaredTables, tables, '063 must target exactly the 11 guided-shift tables once');

for (const role of ['anon', 'authenticated', 'service_role']) {
  assert.ok(migration.includes(`to_regrole('${role}')`), `063 must preflight ${role}`);
}
assert.match(migration, /foreach v_table in array v_tables loop[\s\S]*?to_regclass\(format\('public\.%I', v_table\)\)[\s\S]*?end loop;[\s\S]*?foreach v_table in array v_tables loop/, '063 must preflight every table before its mutation loop');
assert.match(migration, /alter table public\.%I enable row level security/);
assert.match(
  migration,
  /revoke all on table public\.%I from public, anon, authenticated, service_role/,
  '063 must clear default and direct privileges from every API role, including service_role',
);
assert.match(
  migration,
  /grant select, insert, update, delete on table public\.%I to service_role/,
  '063 must restore only CRUD to service_role',
);
assert.equal((migration.match(/execute format\([\s\S]*?'grant select, insert, update, delete/g) || []).length, 1, '063 must contain one exact grant template');

const freshRlsBlock = guidedShiftMigration.slice(
  guidedShiftMigration.indexOf('foreach v_table in array array['),
  guidedShiftMigration.indexOf('create or replace function app_private.prevent_nurse_event_mutation'),
);
assert.match(
  freshRlsBlock,
  /revoke all on public\.%I from public, anon, authenticated, service_role/,
  '062 fresh installs must revoke service_role defaults before granting CRUD',
);
assert.match(freshRlsBlock, /grant select, insert, update, delete on public\.%I to service_role/);

for (const forbidden of [
  /create table/i,
  /create or replace function/i,
  /create policy|drop policy|alter policy/i,
  /insert\s+into/i,
  /update\s+public\./i,
  /delete\s+from/i,
  /truncate\s+table/i,
  /os_finance_ledger|finance|nurse_invoices?/i,
  /bd_companies|robbot3k/i,
  /client_payments|public client|cognito/i,
]) assert.doesNotMatch(migration, forbidden, `063 contains forbidden scope ${forbidden}`);

assert.equal(
  packageJson.scripts['verify:nurse-guided-shift-acl'],
  'node scripts/verify-nurse-guided-shift-acl.mjs',
);
const nurseRelease = packageJson.scripts['verify:nurse-release'];
assert.match(
  nurseRelease,
  /verify:nurse-guided-shift && npm run verify:nurse-guided-shift-acl/,
  'Nurse release must verify 063 immediately after the guided-shift gate',
);
for (const retainedGate of [
  'verify:nurse-operational-bootstrap',
  'verify:nurse-route-reconciliation',
  'verify:no-live-operational-fixtures',
  'verify:operational-scheduling',
  'verify:operational-platform-migrations',
]) assert.ok(nurseRelease.includes(retainedGate), `Nurse release must retain ${retainedGate}`);

console.log('Nurse guided-shift ACL QA passed: all 11 tables are RLS-enabled and service_role is CRUD-only.');
