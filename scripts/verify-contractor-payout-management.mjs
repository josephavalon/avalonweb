import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const payoutApi = read('api/admin/payouts.js');
const approveApi = read('api/admin/payouts/[id]/approve.js');
const queueApi = read('api/admin/payouts/[id]/queue.js');
const settleApi = read('api/admin/payouts/[id]/settle.js');
const payablesPage = read('app-modules/pages/admin/Payables.jsx');
const bankDirectionMigration = read('supabase/migrations/073_vendor_accounts_payable.sql');
const payoutControlsMigration = read('supabase/migrations/070_payops_contractor_payout_controls.sql');
const payrollControlsMigration = read('supabase/migrations/074_employee_management_payroll_controls.sql');
const settlementMigration = read('supabase/migrations/075_contractor_payout_settlement_reconciliation.sql');

function assertContainsAll(source, expected, label) {
  for (const value of expected) assert.ok(source.includes(value), `${label} must include ${value}`);
}

function settlementRpc() {
  const match = settlementMigration.match(/create or replace function public\.reconcile_contractor_payout_settlement\([\s\S]*?\n\$\$;/i);
  assert.ok(match, 'settlement RPC must be defined');
  return match[0];
}

function claimRpc() {
  const match = settlementMigration.match(/create or replace function public\.claim_contractor_payout_command\([\s\S]*?\n\$\$;/i);
  assert.ok(match, 'contractor payout claim RPC must be defined');
  return match[0];
}

assertContainsAll(payoutApi, [
  "allowedFinanceRoles: ['finance_maker']",
  'requireAal2: true',
  "authed.db.rpc('prepare_contractor_payout'",
  'p_expected_payable_version: expectedPayableVersion',
  'p_idempotency_key: idempotencyKey',
  "flags.mercurySendMode !== 'approval_queue'",
  'providerNetworkCallMade: false',
  'settlementRecorded: false',
  "markSettled: false",
], 'maker payout preparation API');

assertContainsAll(approveApi, [
  "allowedFinanceRoles: ['finance_checker']",
  'requireAal2: true',
  "authed.db.rpc('approve_contractor_payout'",
  'p_expected_version: expectedVersion',
  'p_reason_code: reasonCode',
  'p_idempotency_key: idempotencyKey',
  'providerNetworkCallMade: false',
  'settlementRecorded: false',
], 'checker payout approval API');

assertContainsAll(queueApi, [
  "allowedFinanceRoles: ['finance_executor']",
  'requireAal2: true',
  "authed.db.rpc('queue_contractor_payout_command'",
  'p_expected_version: expectedVersion',
  'p_reason_code: reasonCode',
  'p_idempotency_key: idempotencyKey',
  "flags.mercurySendMode !== 'approval_queue'",
  'providerNetworkCallMade: false',
  'providerAccepted: false',
  'settlementRecorded: false',
], 'executor command-queue API');

assertContainsAll(settleApi, [
  "allowedFinanceRoles: ['accountant_controller']",
  'requireAal2: true',
  "flags.mercurySendMode !== 'approval_queue'",
  "'status' in body",
  "'targetStatus' in body",
  "authed.db.rpc('reconcile_contractor_payout_settlement'",
  'p_expected_version: expectedVersion',
  'p_finance_integration_event_id: financeIntegrationEventId',
  'p_bank_statement_item_id: bankStatementItemId',
  'p_idempotency_key: idempotencyKey',
  'providerNetworkCallMade: false',
  'providerEvidenceCreated: false',
  'bankEvidenceCreated: false',
  'directStatusAccepted: false',
], 'independent settlement reconciliation API');

for (const [source, label] of [
  [payoutApi, 'payout API'],
  [approveApi, 'approval API'],
  [queueApi, 'queue API'],
  [settleApi, 'settlement API'],
]) {
  assert.doesNotMatch(source, /\bfetch\s*\(/, `${label} must not make a network request`);
  assert.doesNotMatch(source, /axios|MERCURY_API_TOKEN|MERCURY_API_KEY/i, `${label} must not contain a Mercury network adapter`);
  assert.doesNotMatch(source, /status\s*:\s*['"]SETTLED['"]|status\s*=\s*['"]SETTLED['"]/i, `${label} must not write a settled status`);
}

assert.doesNotMatch(settleApi, /\.from\(['"](?:finance_integration_events|bank_statement_items)['"]\)\s*\.insert/i, 'settlement API must not create evidence');

assertContainsAll(settlementMigration, [
  'contractor_payout_settlement_evidence',
  'provider_transaction_id',
  'settlement_amount_cents',
  'settlement_currency',
  'reconciliation_matches_bank_approved_uidx',
  'reconciliation_matches_payout_approved_uidx',
  'terminal_mercury_event_immutable',
  'matched_bank_evidence_immutable',
  'approved_payout_reconciliation_immutable',
  'canonical_payout_settlement_evidence_required',
  'canonical_payable_settlement_evidence_required',
  'payout_batches_mercury_account_ref_check',
  'Exact Mercury provider_account_id used by the approved outbox command',
], 'immutable and one-use settlement evidence schema');
assertContainsAll(bankDirectionMigration, [
  'add column if not exists normalized_direction text generated always as',
  "case when amount_cents < 0 then 'DEBIT' else 'CREDIT' end",
  'bank_statement_items_normalized_direction_check',
  "normalized_direction in ('DEBIT', 'CREDIT')",
  'alter column normalized_direction set not null',
], 'canonical bank debit/credit direction');

const claim = claimRpc();
assertContainsAll(claim, [
  'security definer',
  'set search_path = public, pg_temp',
  "provider = 'mercury'",
  "aggregate_type = 'payout_item'",
  'select item.payable_id into v_payable_id',
  "lock_payops_aggregate(\n    p_tenant_id, 'payable'",
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
], 'atomic contractor payout command claim');
assertContainsAll(settlementMigration.replace(/\s+/g, ''), [
  'revokeallonfunctionpublic.claim_contractor_payout_command(uuid,uuid,text,text)frompublic,anon,authenticated,service_role;',
  'grantexecuteonfunctionpublic.claim_contractor_payout_command(uuid,uuid,text,text)toservice_role;',
], 'service-role-only contractor claim RPC');
assert.doesNotMatch(claim, /provider_payload|finance_integration_events|status\s*=\s*'SUCCEEDED'|status\s*=\s*'SENT'/i, 'contractor claim RPC must not ingest evidence, complete a command, or claim settlement');
assertContainsAll(payoutControlsMigration, [
  'app_private.guard_payout_aggregate()',
  "new.status = 'CLAIMED'",
  "new.aggregate_type <> 'payout_item'",
  'finance_command_worker_revalidation_failed',
], 'contractor claim domain guard');
assertContainsAll(payrollControlsMigration, [
  "old.aggregate_type not in ('vendor_payment','payroll_run')",
  'execute function app_private.guard_payout_aggregate()',
], 'final contractor command trigger routing');

const settlement = settlementRpc();
assertContainsAll(settlement, [
  "array['accountant_controller']::text[]",
  "lock_payops_idempotency(",
  "lock_payops_aggregate(p_tenant_id, 'payable'",
  'for update',
  "v_command.status is distinct from 'SUCCEEDED'",
  "event.provider = 'mercury'",
  "event.event_type = 'PAYOUT_SETTLED'",
  "event.aggregate_type = 'payout_item'",
  'event.aggregate_id = v_item.id',
  'event.correlation_id = v_command.correlation_id',
  'event.signature_valid',
  "event.status = 'PROCESSED'",
  'event.safe_error_code is null',
  'event.settlement_amount_cents = v_item.amount_cents',
  'event.settlement_currency = v_item.currency',
  'for update',
  'bank.provider_account_id = v_batch.funding_account_ref',
  'bank.provider_transaction_id = v_provider_event.provider_transaction_id',
  "bank.normalized_direction = 'DEBIT'",
  'abs(bank.amount_cents) = v_item.amount_cents',
  'bank.currency = v_item.currency',
  "lower(bank.provider_status) in ('posted', 'settled', 'completed')",
  'bank.posted_at is not null',
  "match_status = 'APPROVED'",
  "'contractor_payout_v1_exact'",
  "set status = 'SETTLED'",
  "reconciliation_state = 'MATCHED'",
  "'bank_provider_account_id', v_bank.provider_account_id",
  "'bank_normalized_direction', v_bank.normalized_direction",
  'contractor_payout_settlement_reconciled',
], 'exact provider and bank reconciliation RPC');
assertContainsAll(settlementMigration.replace(/\s+/g, ''), [
  'revokeallonfunctionpublic.reconcile_contractor_payout_settlement(uuid,uuid,uuid,integer,uuid,uuid,text,text)frompublic,anon,authenticated;',
  'grantexecuteonfunctionpublic.reconcile_contractor_payout_settlement(uuid,uuid,uuid,integer,uuid,uuid,text,text)toservice_role;',
], 'service-role-only settlement RPC');
assert.doesNotMatch(settlement, /insert\s+into\s+public\.(?:finance_integration_events|bank_statement_items)/i, 'settlement RPC must only reference existing evidence');
assert.doesNotMatch(settlement, /\b(?:fetch|axios|https?:\/\/|mercury\.com)\b/i, 'settlement RPC must not contact Mercury');

assertContainsAll(payoutApi, [
  "row.status === 'SETTLED'",
  '&& settlementEvidence',
  "row.reconciliation_state === 'MATCHED'",
  'row.provider_observed_at',
  'row.last_provider_success_at',
  "payable.status === 'SETTLED'",
  "payable.reconciliation_state === 'MATCHED'",
  'payable.settled_at',
  'settlementEvidence.payable_id === row.payable_id',
  'settlementEvidence.provider_transaction_id === row.provider_transaction_id',
  "settlementClaimed ? 'RECONCILIATION_REQUIRED'",
  "from('contractor_payout_settlement_evidence')",
], 'canonical settlement status projection');
assert.doesNotMatch(payoutApi, /safe_payload/, 'status responses must not select or return provider payloads');
assert.doesNotMatch(payoutApi, /\.select\([^)]*funding_account_ref/i, 'status responses must not select raw funding account references');

assertContainsAll(payablesPage, [
  "apiGet('/api/admin/payouts')",
  "'/api/admin/payouts'",
  '/approve`',
  '/queue`',
  '/settle`',
  'Prepare payout',
  'Checker approve',
  'Queue provider approval',
  'does not contact Mercury or move money',
  'Reconcile existing settlement evidence',
  'cannot create evidence, contact Mercury, or accept a manual paid status',
  'exact approved Mercury provider account ID',
  'Mercury provider account ID',
  "payout.status === 'RECONCILIATION_REQUIRED'",
  "payout.canonicalSettled ? 'Complete and matched' : 'Not established'",
], 'Payables payout queue UI');
assert.doesNotMatch(payablesPage, />\s*Mark paid\s*</i, 'the UI must not offer a direct paid transition');
assert.doesNotMatch(payablesPage, />\s*Send payment\s*</i, 'the UI must not claim to send money');

console.log('Contractor payout management QA passed: maker/checker/executor/controller APIs use exact RPCs and versions, UI exposes controlled queue and evidence reconciliation, no route calls Mercury or creates evidence, and settlement requires immutable terminal provider plus posted bank proof.');
