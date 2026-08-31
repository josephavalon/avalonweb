import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/073_vendor_accounts_payable.sql');
const helper = read('api/_lib/vendor-ap.js');
const routeSources = [
  'api/admin/vendor-bills.js',
  'api/admin/vendor-bills/[id]/lines.js',
  'api/admin/vendor-bills/[id]/match.js',
  'api/admin/vendor-bills/[id]/approve.js',
  'api/admin/vendor-bills/[id]/payment.js',
  'api/admin/vendor-bills/[id]/hold.js',
  'api/admin/vendor-bills/[id]/cancel.js',
].map((path) => [path, read(path)]);
const routes = routeSources.map(([, source]) => source).join('\n');
const matchRoute = read('api/admin/vendor-bills/[id]/match.js');
const approveRoute = read('api/admin/vendor-bills/[id]/approve.js');
const paymentRoute = read('api/admin/vendor-bills/[id]/payment.js');
const vendorPage = read('app-modules/pages/admin/VendorPayments.jsx');
const vendorPageWrapper = read('src/pages/admin/VendorPayments.jsx');

const compact = (value) => value.replace(/\s+/g, ' ').trim();
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function definition(name) {
  const match = migration.match(new RegExp(
    `create or replace function\\s+${escape(name)}\\s*\\([\\s\\S]*?\\n\\$\\$;`,
    'i',
  ));
  assert.ok(match, `${name} must be defined`);
  return match[0];
}

function includesAll(source, values, label) {
  for (const value of values) assert.ok(source.includes(value), `${label} must include ${value}`);
}

function serviceOnly(name, signature) {
  const fn = definition(name);
  assert.match(fn, /security definer/i, `${name} must be SECURITY DEFINER`);
  assert.match(fn, /set search_path = public, pg_temp/i, `${name} must pin search_path`);
  const sql = migration.replace(/\s+/g, '');
  const rpc = signature.replace(/\s+/g, '');
  assert.ok(sql.includes(`revokeallonfunction${rpc}frompublic,anon,authenticated;`), `${name} must deny browser roles`);
  assert.ok(sql.includes(`grantexecuteonfunction${rpc}toservice_role;`), `${name} must be service-role only`);
  return fn;
}

for (const table of [
  'vendor_finance_profiles', 'vendor_bills', 'vendor_bill_lines',
  'vendor_bill_match_evidence', 'vendor_bill_approvals', 'vendor_payments',
  'vendor_payment_evidence', 'vendor_ap_events',
]) {
  assert.match(migration, new RegExp(`create table if not exists\\s+public\\.${table}\\s*\\(`, 'i'), `${table} is required`);
  assert.ok(migration.includes(`'${table}'`), `${table} must be in the fail-closed RLS list`);
}
includesAll(migration, [
  'alter table public.%I enable row level security',
  'revoke all on public.%I from public, anon, authenticated, service_role',
  'grant select on public.%I to service_role',
], 'fail-closed finance tables');

includesAll(migration, [
  'add column if not exists normalized_direction text generated always as',
  "case when amount_cents < 0 then 'DEBIT' else 'CREDIT' end",
  'bank_statement_items_normalized_direction_check',
  "normalized_direction in ('DEBIT', 'CREDIT')",
  'alter column normalized_direction set not null',
], 'canonical bank debit/credit direction');

includesAll(migration, [
  'references public.os_inventory_vendors(tenant_id, id)',
  'references public.legal_entities(tenant_id, id)',
  'destination_masked_label',
  'Raw TIN and bank data are prohibited',
], 'vendor identity and safe destination profile');
assert.doesNotMatch(migration, /\b(?:tin_value|routing_number|account_number)\b/i, 'raw TIN/bank fields are forbidden');

includesAll(migration, [
  "'vendor_bill_lines', 'vendor_bill_match_evidence', 'vendor_bill_approvals'",
  "'vendor_payment_evidence', 'vendor_ap_events'",
  'prevent_vendor_ap_append_only_mutation',
], 'immutable evidence controls');

const match = serviceOnly(
  'public.match_vendor_bill',
  'public.match_vendor_bill(uuid, uuid, uuid, integer, text, text, text)',
);
includesAll(match, [
  "array['finance_maker']::text[]", 'public.os_purchase_order_lines',
  'public.os_stock_transactions', "transaction_type = 'receive'",
  'v_policy_tolerance_cents constant bigint := 0', "v_po.status <> 'received'",
  "line.line_type <> 'INVENTORY'", 'line.quantity = po_line.quantity_ordered',
  'line.quantity <= po_line.quantity_received', 'vendor_bill_requires_complete_purchase_order_lines',
  'vendor_bill_receipt_allocation_insufficient', 'line_receipt_allocations',
  'fully_received', 'evidence_checksum', 'inventory_bill_requires_three_way_match',
], 'PO/receipt/bill matching');
assert.doesNotMatch(match, /p_tolerance_cents/i, 'match tolerance must not be caller-controlled');
assert.doesNotMatch(matchRoute, /toleranceCents|p_tolerance_cents/i, 'match API must not accept a caller tolerance');
includesAll(migration, [
  'vendor_bills_one_active_bill_per_po_uidx',
  "where purchase_order_id is not null and status <> 'CANCELLED'",
  'vendor_bill_lines_po_line_once_uidx',
  'vendor_purchase_order_bill_already_exists',
], 'anti-double-bill controls');

const maker = serviceOnly(
  'public.maker_approve_vendor_bill',
  'public.maker_approve_vendor_bill(uuid, uuid, uuid, integer, text, text, text, text)',
);
const checker = serviceOnly(
  'public.checker_approve_vendor_payment',
  'public.checker_approve_vendor_payment(uuid, uuid, uuid, uuid, integer, text, text)',
);
const queue = serviceOnly(
  'public.queue_vendor_payment_command',
  'public.queue_vendor_payment_command(uuid, uuid, uuid, uuid, integer, text, text)',
);
includesAll(maker, ["array['finance_maker']::text[]", 'vendor_payment_proposal_hash', "'MAKER', 'APPROVED'"], 'maker gate');
includesAll(checker, ["array['finance_checker']::text[]", 'v_payment.maker_prepared_by = p_actor_profile_id', "'CHECKER', 'APPROVED'"], 'checker gate');
includesAll(checker, ['p_vendor_bill_id uuid', 'payment.vendor_bill_id = p_vendor_bill_id'], 'checker bill scope');
includesAll(queue, [
  "array['finance_executor']::text[]", 'p_actor_profile_id in (v_payment.maker_prepared_by, v_payment.checker_approved_by)',
  'insert into public.finance_integration_commands', "'CREATE_VENDOR_PAYMENT'", "'PENDING'",
  "'EXECUTOR', 'SEND_AUTHORIZED'", 'finance_command_checksum',
], 'executor outbox gate');
includesAll(queue, ['p_vendor_bill_id uuid', "v_command.safe_payload->>'vendor_bill_id' <> p_vendor_bill_id::text", 'payment.vendor_bill_id = p_vendor_bill_id'], 'executor bill scope');
assert.doesNotMatch(queue, /\b(?:fetch|axios|https?:\/\/|mercury\.com)\b/i, 'queue RPC must never contact a provider');

const claim = definition('public.claim_vendor_payment_command');
assert.match(claim, /security definer/i, 'vendor claim RPC must be SECURITY DEFINER');
assert.match(claim, /set search_path = public, pg_temp/i, 'vendor claim RPC must pin search_path');
includesAll(claim, [
  "provider = 'mercury'",
  "aggregate_type = 'vendor_payment'",
  "lock_payops_aggregate(\n    p_tenant_id, 'vendor_payment'",
  'for update',
  'v_command.request_checksum <> p_expected_request_checksum',
  "v_command.status <> 'PENDING'",
  'v_command.next_attempt_at > clock_timestamp()',
  "set status = 'CLAIMED'",
  'claimed_by = p_claimed_by',
  'claimed_at = clock_timestamp()',
  'attempt_count = attempt_count + 1',
  "and status = 'PENDING'",
  'and request_checksum = p_expected_request_checksum',
  'and next_attempt_at <= clock_timestamp()',
], 'atomic vendor command claim');
assert.match(
  compact(migration),
  /revoke all on function public\.claim_vendor_payment_command\(uuid, uuid, text, text\) from public, anon, authenticated, service_role; grant execute on function public\.claim_vendor_payment_command\(uuid, uuid, text, text\) to service_role;/i,
  'vendor claim RPC must be service-role-only',
);
assert.doesNotMatch(claim, /provider_payload|finance_integration_events|status\s*=\s*'SUCCEEDED'|status\s*=\s*'SENT'/i, 'vendor claim RPC must not ingest evidence, complete a command, or claim settlement');
includesAll(migration, [
  'finance_integration_commands_vendor_guard_update',
  'execute function app_private.guard_vendor_finance_command()',
], 'vendor claim trigger authorization');

const hold = serviceOnly(
  'public.set_vendor_bill_hold',
  'public.set_vendor_bill_hold(uuid, uuid, uuid, integer, boolean, text, text)',
);
const cancel = serviceOnly(
  'public.cancel_vendor_bill',
  'public.cancel_vendor_bill(uuid, uuid, uuid, integer, text, text)',
);
includesAll(hold, ["v_command.status = 'PENDING'", "set status = 'CANCELLED'", 'dispatch_started_hold_requires_recovery'], 'hold control');
includesAll(cancel, ["v_command.status = 'PENDING'", "set status = 'CANCELLED'", 'dispatch_started_cancel_requires_recovery'], 'cancel control');

const settle = serviceOnly(
  'public.settle_vendor_payment',
  'public.settle_vendor_payment(uuid, uuid, uuid, uuid, integer, text, uuid, uuid, text, text, text, text)',
);
includesAll(settle, [
  "array['accountant_controller']::text[]", "'PROVIDER_CONFIRMED', 'CONTROLLED_MANUAL'",
  'v_payment.maker_prepared_by, v_payment.checker_approved_by, v_payment.executor_authorized_by',
  "v_command.status <> 'SUCCEEDED'", 'event.signature_valid', "event.event_type = 'VENDOR_PAYMENT_SETTLED'",
  "event.status = 'PROCESSED'", 'event.safe_error_code is null',
  'event.correlation_id = v_command.correlation_id',
  'event.provider_transaction_id = p_provider_transaction_id',
  'event.settlement_amount_cents = v_payment.amount_cents',
  'event.settlement_currency = v_payment.currency',
  'public.bank_statement_items', 'bank.provider_account_id = v_payment.funding_account_ref',
  "bank.normalized_direction = 'DEBIT'", 'abs(bank.amount_cents) = v_payment.amount_cents',
  "lower(bank.provider_status) in ('posted', 'settled', 'completed')", 'bank.posted_at is not null',
  "allocated.match_status = 'APPROVED'", 'for update',
  "'command_request_checksum', v_command.request_checksum", "'bank_payload_checksum', v_bank.payload_checksum",
  "'bank_provider_account_id', v_bank.provider_account_id", "'bank_normalized_direction', v_bank.normalized_direction",
  "v_integration_event.payload_checksum", 'v_evidence_checksum := encode(digest',
  'insert into public.reconciliation_matches', "'APPROVED'", "'vendor_ap_v1_exact'",
  'insert into public.vendor_payment_evidence', "set status = 'SETTLED'",
], 'controlled settlement and reconciliation');
assert.doesNotMatch(settle, /p_evidence_checksum/i, 'settlement evidence checksum must be server-generated');
assert.doesNotMatch(paymentRoute, /p_evidence_checksum|checksum\(body\.evidenceChecksum/i, 'payment API must not accept a client evidence checksum');
includesAll(settle, ['p_vendor_bill_id uuid', 'payment.vendor_bill_id = p_vendor_bill_id'], 'settlement bill scope');
includesAll(migration, [
  'reconciliation_matches_bank_approved_uidx',
  "where match_status = 'APPROVED'",
], 'one approved reconciliation per bank item');
includesAll(migration, [
  'guard_vendor_settlement_allocation',
  "tg_table_name = 'bank_statement_items'",
  'matched.vendor_payment_id is not null',
  "matched.match_status = 'APPROVED'",
  'matched_vendor_bank_evidence_immutable',
  "tg_table_name = 'reconciliation_matches'",
  'old.vendor_payment_id is not null',
  "old.match_status = 'APPROVED'",
  'approved_vendor_reconciliation_immutable',
  "if tg_op = 'DELETE' then return old; end if;",
  'vendor_bank_items_after_approved_match_immutable',
  'vendor_approved_reconciliation_match_immutable',
], 'immutable approved vendor bank allocation');

for (const [name, signature] of [
  ['public.create_vendor_finance_profile', 'public.create_vendor_finance_profile(uuid, uuid, uuid, uuid, text, text, text, text, text, text)'],
  ['public.review_vendor_finance_profile', 'public.review_vendor_finance_profile(uuid, uuid, uuid, integer, text, text, text, text, text, text)'],
  ['public.create_vendor_bill', 'public.create_vendor_bill(uuid, uuid, uuid, uuid, text, date, date, text, bigint, bigint, text, text, text)'],
  ['public.add_vendor_bill_line', 'public.add_vendor_bill_line(uuid, uuid, uuid, integer, uuid, uuid, text, text, numeric, bigint, bigint, text)'],
]) serviceOnly(name, signature);

includesAll(routes, ['requireVendorActor', 'requireVendorApEnabled', 'parseVendorBody', 'idempotencyKey'], 'Vendor AP routes');
includesAll(approveRoute, ['p_vendor_bill_id: billId', 'result.data.vendor_bill_id !== billId'], 'approval route bill scope');
includesAll(paymentRoute, ['p_vendor_bill_id: billId', "result.data.safe_payload?.vendor_bill_id !== billId", 'result.data.vendor_bill_id !== billId'], 'payment route bill scope');
includesAll(helper, ['assertFinanceSafe(body)', 'requireAal2: aal2', 'cleanIdempotencyKey', 'PayOpsError'], 'API safety helper');
includesAll(helper, ['export function mercuryProviderAccountId', "safeRef(value, 'fundingAccountRef')"], 'Mercury provider account validator');
includesAll(approveRoute, ['mercuryProviderAccountId', 'p_funding_account_ref: mercuryProviderAccountId(body.fundingAccountRef)'], 'maker funding-account namespace');
assert.doesNotMatch(`${helper}\n${routes}`, /\b(?:fetch|axios|https?:\/\/|mercury\.com)\b/i, 'Vendor AP API must have no live provider call');
assert.doesNotMatch(routes, /\.from\(['"](?:vendor_|finance_integration_commands)[^)]*\)\s*\.insert/i, 'API mutations must use controlled RPCs');
assert.match(migration, /phi_touched, payload_hash, payload[\s\S]*?false,/i, 'audits must explicitly deny PHI');

includesAll(helper, [
  "db.from('os_inventory_vendors')", "db.from('legal_entities')",
  "db.from('os_purchase_orders')", "db.from('os_purchase_order_lines')",
  'paymentEvidence:', 'reconciliation:', 'command:',
], 'safe Vendor AP catalogs and evidence response');
includesAll(helper, [
  'loadCanonicalVendorSettlements', 'isCanonicalVendorSettlement',
  "db.from('vendor_payment_evidence')", "db.from('reconciliation_matches')",
  "db.from('bank_statement_items')",
  "evidence.evidence_source === payment.settlement_evidence_status",
  'evidence.provider_transaction_id === payment.provider_transaction_id',
  "reconciliation.match_status === 'APPROVED'",
  "reconciliation.policy_version === 'vendor_ap_v1_exact'",
  'exactMoneyEqual(reconciliation.matched_amount_cents, payment.amount_cents)',
  'exactMoneyEqual(reconciliation.variance_cents, 0)',
  "bank.provider_account_id === payment.funding_account_ref",
  "bank.provider_transaction_id === payment.provider_transaction_id",
  "bank.normalized_direction === 'DEBIT'",
  'exactMoneyEqual(bank.amount_cents, -BigInt(String(payment.amount_cents)))',
  "bank.currency === payment.currency",
  "['posted', 'settled', 'completed'].includes",
  'bank.posted_at', 'bank.last_success_at',
  "settlementClaimed && !canonicalSettled ? 'RECONCILIATION_REQUIRED' : row.status",
], 'live canonical vendor settlement projection');
includesAll(vendorPage, [
  '/api/admin/vendor-bills', '/lines', '/match', '/approve', '/payment', '/hold', '/cancel',
  "action: 'create_profile'", "action: 'review_profile'", "action: 'create_bill'",
  "stage: 'maker'", "stage: 'checker'", "action: 'queue'", "action: 'settle'",
  "selectedPayment?.canonicalSettled === true",
  "payments.filter((payment) => payment.canonicalSettled === true)",
  'server-owned exact-total policy',
  'Never enter patient information, raw TINs, routing numbers, or bank account numbers',
  'Mercury provider account ID',
], 'Vendor Payments admin workflow');
assert.doesNotMatch(vendorPage, /canonicalSettlement\s*=\s*Boolean\(/, 'UI must consume the server canonical settlement result');
assert.match(vendorPage, /Queueing records authorization only[\s\S]*?does not contact Mercury, move money, or prove settlement/i, 'UI must state the queue boundary');
assert.doesNotMatch(vendorPage, /canonicalSettlement\s*=\s*Boolean\([\s\S]*?status === 'COMMAND_QUEUED'[\s\S]*?\)/i, 'queued commands must never become canonical settlement');
assert.match(vendorPageWrapper, /export \{ default \} from '\.\.\/\.\.\/\.\.\/app-modules\/pages\/admin\/VendorPayments\.jsx';/, 'src Vendor Payments wrapper is required');

console.log('Vendor AP verification passed: vendor/supplies workflow, exact receipt matching, scoped approvals, outbox, settlement, RLS, UI truth, idempotency, and PHI controls are present.');
