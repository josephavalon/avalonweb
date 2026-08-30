import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const operational = readFileSync(
  new URL('../supabase/migrations/050_operational_backoffice.sql', import.meta.url),
  'utf8',
);
const routes = readFileSync(
  new URL('../supabase/migrations/051_nurse_route_builder.sql', import.meta.url),
  'utf8',
);
const forward = readFileSync(
  new URL('../supabase/migrations/052_admin_data_forward_hardening.sql', import.meta.url),
  'utf8',
);

function assertSqlStructure(sql, label) {
  const open = [];
  let state = 'normal';
  let dollarTag = '';
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (state === 'line_comment') {
      if (char === '\n') state = 'normal';
      continue;
    }
    if (state === 'block_comment') {
      if (char === '*' && next === '/') { state = 'normal'; index += 1; }
      continue;
    }
    if (state === 'single_quote') {
      if (char === "'" && next === "'") { index += 1; continue; }
      if (char === "'") state = 'normal';
      continue;
    }
    if (state === 'double_quote') {
      if (char === '"' && next === '"') { index += 1; continue; }
      if (char === '"') state = 'normal';
      continue;
    }
    if (state === 'dollar_quote') {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1;
        state = 'normal';
      }
      continue;
    }
    if (char === '-' && next === '-') { state = 'line_comment'; index += 1; continue; }
    if (char === '/' && next === '*') { state = 'block_comment'; index += 1; continue; }
    if (char === "'") { state = 'single_quote'; continue; }
    if (char === '"') { state = 'double_quote'; continue; }
    if (char === '$') {
      const match = sql.slice(index).match(/^\$(?:[a-z_][a-z0-9_]*)?\$/i);
      if (match) {
        dollarTag = match[0];
        state = 'dollar_quote';
        index += dollarTag.length - 1;
        continue;
      }
    }
    if (char === '(') open.push(index);
    if (char === ')') {
      assert.ok(open.length, `${label}: unmatched closing parenthesis at byte ${index}`);
      open.pop();
    }
  }
  assert.equal(state, 'normal', `${label}: unterminated SQL ${state}`);
  assert.equal(open.length, 0, `${label}: unclosed parentheses`);
}

function assertUniqueFunctionParameters(sql, label) {
  const functions = sql.matchAll(
    /create or replace function\s+([a-z0-9_.]+)\s*\(([\s\S]*?)\)\s*returns/gi,
  );
  for (const match of functions) {
    const names = match[2]
      .split(',')
      .map((parameter) => parameter.trim().match(/^([a-z_][a-z0-9_]*)\s+/i)?.[1])
      .filter(Boolean);
    assert.equal(
      new Set(names).size,
      names.length,
      `${label}: ${match[1]} has duplicate parameter names`,
    );
  }
}

for (const [label, sql] of [
  ['050 operational backoffice', operational],
  ['051 nurse route builder', routes],
  ['052 forward hardening', forward],
]) {
  assertSqlStructure(sql, label);
  assertUniqueFunctionParameters(sql, label);
  const topLevelSql = sql.replace(
    /create or replace function[\s\S]*?\bas\s+\$\$[\s\S]*?\$\$;/gi,
    '',
  );
  assert.doesNotMatch(
    topLevelSql,
    /insert\s+into\s+public\./i,
    `${label}: migrations must not seed draft, test, sample, or live operational records`,
  );
}

const operationalTables = [...operational.matchAll(
  /create table if not exists public\.([a-z0-9_]+)/g,
)].map((match) => match[1]);
assert.deepEqual(operationalTables, [
  'operational_shifts',
  'operational_shift_assignments',
  'client_payments',
  'client_payment_refunds',
  'payment_webhook_events',
  'payment_reconciliation_history',
]);
assert.doesNotMatch(
  operational,
  /create table if not exists public\.(?:nurse_invoices|nurse_invoice_lines|os_finance_ledger)/,
  '050 must preserve canonical Finance 047 and the existing 043 ledger',
);
for (const dependency of [
  'migration_046_required', 'migration_047_required', 'migration_048_required',
  'migration_049_required', 'migration_043_required',
]) {
  assert.ok(operational.includes(dependency), `050 missing dependency gate ${dependency}`);
}
assert.match(operational, /provider_profile_id uuid not null/);
assert.match(
  operational,
  /foreign key \(tenant_id, provider_profile_id\) references public\.provider_profiles\(tenant_id, id\)/,
  'assignments must use tenant-safe provider source-of-truth identity',
);
assert.doesNotMatch(
  operational,
  /nursys_status\s+in\s*\([^)]*placeholder/i,
  'placeholder Nursys status must never be scheduling-eligible',
);
assert.match(operational, /pp\.nursys_status = 'clear'/);
assert.match(operational, /pp\.credential_status = 'clear'/);
assert.doesNotMatch(
  operational,
  /p\.role in \([^)]*'staff'/,
  'generic staff must not receive SECURITY DEFINER scheduling mutations',
);
assert.match(operational, /grant select on public\.operational_shifts,[\s\S]*public\.operational_shift_assignments to service_role/);
assert.doesNotMatch(operational, /create policy/i, '050 tables are server-only and need no browser RLS policies');
assert.match(operational, /revoke all on public\.%I from public, anon, authenticated, service_role/);
assert.match(operational, /payment_reconciliation_history_immutable/);
assert.match(operational, /grant select, insert on public\.os_finance_ledger to service_role/);

for (const [name, signature] of [
  ['create_operational_shift_series', 'uuid, uuid, jsonb, jsonb, uuid\\[\\]'],
  ['update_operational_shift', 'uuid, uuid, uuid, integer, jsonb'],
  ['assign_operational_shift', 'uuid, uuid, uuid, uuid, integer'],
  ['offer_operational_shift', 'uuid, uuid, uuid, uuid\\[\\], integer'],
  ['transition_operational_shift', 'uuid, uuid, uuid, text, integer'],
  ['claim_operational_shift', 'uuid, uuid, uuid, uuid, integer'],
  ['complete_operational_shift_assignment', 'uuid, uuid, uuid, uuid, integer'],
]) {
  assert.match(operational, new RegExp(`create or replace function public\\.${name}\\(`));
  assert.match(
    operational,
    new RegExp(`revoke all on function public\\.${name}\\(${signature}\\)[\\s\\S]*?grant execute on function public\\.${name}\\(${signature}\\)[\\s\\S]*?to service_role`),
    `${name} must be callable only by service-role APIs`,
  );
}
assert.ok((operational.match(/for update;/g) || []).length >= 6, 'existing-shift RPCs must lock rows');
assert.ok((operational.match(/shift_version_conflict/g) || []).length >= 6, 'existing-shift RPCs must enforce versions');
assert.ok((operational.match(/append_operational_audit\(/g) || []).length >= 8, 'each mutation must append audit data atomically');
assert.ok((operational.match(/clock_timestamp\(\) < v_shift\.starts_at/g) || []).length >= 2, 'admin and provider completion must reject pre-start completion');
assert.match(operational, /v_occurrence ->> 'occurrenceDate'/);
assert.match(operational, /v_occurrence ->> 'startsAt'/);
assert.match(operational, /v_occurrence ->> 'endsAt'/);

const routeTables = [...routes.matchAll(
  /create table if not exists public\.([a-z0-9_]+)/g,
)].map((match) => match[1]);
assert.deepEqual(routeTables, [
  'provider_route_origins', 'provider_route_days', 'provider_route_day_stops',
]);
assert.match(routes, /migration_050_required/);
assert.match(routes, /migration_050_provider_identity_required/);
assert.match(routes, /provider_route_days_current_not_persisted_check/);
assert.match(routes, /origin_id is null and origin_address is null[\s\S]*origin_latitude is null and origin_longitude is null/);
assert.match(
  routes,
  /foreign key \(tenant_id, route_day_id, assigned_provider_profile_id\)[\s\S]*references public\.provider_route_days\(tenant_id, id, provider_profile_id\)/,
  'route stops must belong to the same tenant and provider as their route day',
);
assert.match(routes, /foreign key \(tenant_id, appointment_id\) references public\.appointments\(tenant_id, id\)/);
assert.match(routes, /revoke all on public\.%I from public, anon, authenticated, service_role/);
assert.doesNotMatch(routes, /create policy/i, 'route tables are service-only');
assert.doesNotMatch(routes, /grant[\s\S]{0,120}authenticated/i, 'route tables must not grant direct session writes');
assert.doesNotMatch(
  routes,
  /create table[^;]*(?:gps_sample|location_history|location_sample)/i,
  'route migration must never create persisted foreground tracking tables',
);

for (const [table, constraint] of [
  ['nurse_invoice_lines', 'nurse_invoice_lines_invoice_tenant_fk'],
  ['nurse_invoice_receipts', 'nurse_invoice_receipts_invoice_tenant_fk'],
  ['nurse_invoice_status_events', 'nurse_invoice_status_events_invoice_tenant_fk'],
  ['bd_companies', 'bd_companies_created_agent_fk'],
  ['bd_companies', 'bd_companies_updated_agent_fk'],
  ['robbot3k_prospects', 'robbot3k_prospects_bd_company_fk'],
  ['robbot3k_prospects', 'robbot3k_prospects_bd_person_fk'],
  ['robbot3k_prospects', 'robbot3k_prospects_bd_opportunity_fk'],
]) {
  assert.match(
    forward,
    new RegExp(`conrelid = 'public\\.${table}'::regclass and conname = '${constraint}'`),
    `052 must table-scope the ${constraint} guard`,
  );
  assert.match(forward, new RegExp(`validate constraint ${constraint}`));
}
assert.match(forward, /migration_051_required/);
assert.match(forward, /preexisting_receipt_scans_require_security_review/);
assert.match(forward, /current_setting\('avalon\.receipt_scanner_receipt_id', true\) = old\.id::text/);
assert.match(forward, /new\.scan_status <> 'quarantined'/);
assert.match(forward, /before insert or update or delete on public\.nurse_invoice_receipts/);
assert.match(forward, /old\.scan_status <> 'quarantined'/);
assert.match(forward, /new\.scan_status not in \('cleared', 'blocked'\)/);
assert.match(forward, /revoke all on public\.nurse_invoice_receipts[\s\S]*from public, anon, authenticated, service_role/);
assert.match(forward, /grant select, insert on public\.nurse_invoice_receipts to service_role/);
assert.match(forward, /create or replace function public\.record_nurse_invoice_receipt_scan\(/);
assert.match(forward, /v_receipt\.checksum_sha256 <> p_expected_checksum_sha256/);
assert.match(forward, /for update;/);
assert.match(
  forward,
  /revoke all on function public\.record_nurse_invoice_receipt_scan\(uuid, uuid, text, text, text, text\)[\s\S]*to service_role/,
);

console.log('Operational platform migration QA passed: tenant-safe scheduling, routes, forward hardening, and scanner gate.');
