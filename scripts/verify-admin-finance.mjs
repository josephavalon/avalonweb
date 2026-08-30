import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/047_finance_nurse_invoices.sql', import.meta.url), 'utf8');
const endpoint = readFileSync(new URL('../api/admin/nurse-invoices.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app-modules/pages/admin/NurseInvoices.jsx', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

for (const table of [
  'nurse_invoices',
  'nurse_invoice_lines',
  'nurse_invoice_receipts',
  'nurse_invoice_status_events',
]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`), `missing ${table}`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} must use RLS`);
}

assert.match(migration, /'nurse-invoice-receipts', 'nurse-invoice-receipts', false/, 'receipt bucket must be private');
assert.match(migration, /revoke all on public\.nurse_invoices, public\.nurse_invoice_lines, public\.nurse_invoice_receipts from anon, authenticated/);
assert.match(migration, /revoke all on public\.nurse_invoice_status_events from anon, authenticated/);
assert.match(migration, /create or replace function public\.create_nurse_invoice\(/);
assert.match(migration, /unique \(tenant_id, submission_id\)/, 'invoice submission must be idempotent per tenant');
assert.match(
  migration,
  /constraint nurse_invoices_tenant_id_id_key unique \(tenant_id, id\)/,
  'invoice parents must expose a tenant-scoped composite identity',
);
assert.match(
  migration,
  /where conrelid = 'public\.nurse_invoices'::regclass\s+and conname = 'nurse_invoices_tenant_id_id_key'/,
  'the composite parent identity upgrade must be table-scoped and rerunnable',
);
for (const [table, constraint] of [
  ['nurse_invoice_lines', 'nurse_invoice_lines_invoice_tenant_fk'],
  ['nurse_invoice_receipts', 'nurse_invoice_receipts_invoice_tenant_fk'],
  ['nurse_invoice_status_events', 'nurse_invoice_status_events_invoice_tenant_fk'],
]) {
  assert.match(
    migration,
    new RegExp(`constraint ${constraint}\\s+foreign key \\(tenant_id, invoice_id\\)\\s+references public\\.nurse_invoices\\(tenant_id, id\\) on delete cascade`),
    `${table} must enforce same-tenant invoice ownership and preserve cascading deletion`,
  );
  assert.match(
    migration,
    new RegExp(`where conrelid = 'public\\.${table}'::regclass\\s+and conname = '${constraint}'`),
    `${constraint} upgrade must be guarded on its owning table`,
  );
  assert.match(
    migration,
    new RegExp(`validate constraint ${constraint}`),
    `${constraint} must fail closed on cross-tenant historical rows`,
  );
}
assert.doesNotMatch(
  migration,
  /invoice_id uuid not null references public\.nurse_invoices\(id\)/,
  'invoice children must not rely only on the globally unique invoice id',
);
assert.match(migration, /raise exception 'submission_id_reused'/);
assert.match(migration, /create trigger nurse_invoices_financial_immutable/);
assert.match(migration, /create trigger nurse_invoice_lines_immutable/);
assert.match(migration, /create trigger nurse_invoice_receipts_immutable/);
assert.match(migration, /create trigger nurse_invoice_status_events_immutable/);
assert.match(migration, /create or replace function public\.claim_nurse_invoice_notification\(/);
assert.match(migration, /for update skip locked/, 'notification worker must claim rows atomically');
assert.match(migration, /delivery_attempt_count < p_max_attempts/, 'notification retries must be bounded');
assert.match(migration, /create or replace function public\.nurse_invoice_metrics\(/);
for (const signature of [
  'create_nurse_invoice(jsonb, jsonb)',
  'claim_nurse_invoice_notification(uuid, uuid, integer, integer)',
  'nurse_invoice_metrics(uuid)',
]) {
  assert.match(migration, new RegExp(`revoke all on function public\\.${signature.replace(/[()]/g, '\\$&')}`));
  assert.match(migration, new RegExp(`grant execute on function public\\.${signature.replace(/[()]/g, '\\$&')}[\\s\\S]*?to service_role`));
}

assert.match(endpoint, /requireAdmin\(req, res\)/, 'Finance API must use the Admin authorization gate');
assert.match(endpoint, /Cache-Control', 'no-store'/, 'Finance responses must never be cached');
for (const table of ['nurse_invoices', 'nurse_invoice_lines', 'nurse_invoice_receipts', 'nurse_invoice_status_events']) {
  assert.ok(endpoint.includes(`'${table}'`), `Finance API must read ${table}`);
}
assert.match(endpoint, /\.eq\('tenant_id', authed\.tenantId\)/, 'Finance reads and writes must be tenant scoped');
assert.match(endpoint, /rpc\('nurse_invoice_metrics'/);
assert.match(endpoint, /receiptsWithSignedUrls/);
assert.match(endpoint, /expectedVersion/);
assert.match(endpoint, /invoice_version_conflict/);
assert.match(endpoint, /payment_reference_required/);
assert.match(endpoint, /writeAuditEvent[\s\S]*admin_nurse_invoices_read/);
assert.match(endpoint, /action: `nurse_invoice_\$\{nextStatus\}`/);

assert.match(page, /\/api\/admin\/nurse-invoices/);
assert.match(page, /Nurse invoice source unavailable/);
assert.match(page, /No zeroed or sample finance metrics are shown/);
assert.match(page, /disabled=\{busy !== '' \|\| !receiptEvidenceReady\}/, 'receipt-bearing approval and payment must fail closed');
for (const action of ['Verify identity', 'Approve', 'Request correction', 'Reject', 'Mark paid']) {
  assert.ok(page.includes(action), `missing Finance review action: ${action}`);
}
assert.match(page, /Private receipt evidence · quarantined until an approved scanner clears it/);
assert.match(page, /No Nurse Portal invoices have been stored yet/);
assert.match(routes, /path="\/admin\/nurse-invoices"/);

console.log('Admin Finance QA passed: durable invoices, private receipts, review controls, and audit gates.');
