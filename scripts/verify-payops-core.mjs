import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const core = read('supabase/migrations/067_payops_finance_core.sql');
const transitions = read('supabase/migrations/068_payops_finance_transitions.sql');
const ledger = read('supabase/migrations/069_payops_controls_and_ledger.sql');
const payouts = read('supabase/migrations/070_payops_contractor_payout_controls.sql');
const flags = read('api/_lib/payops-core.js');
const summary = read('api/admin/finance/summary.js');
const financePage = read('app-modules/pages/admin/FinanceControl.jsx');
const invoiceApi = read('api/admin/nurse-invoices.js');
const invoicePage = read('app-modules/pages/admin/NurseInvoices.jsx');
const payablesApi = read('api/admin/payables.js');
const env = read('.env.example');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compact = (value) => value.replace(/\s+/g, ' ').trim();

function functionDefinition(source, qualifiedName) {
  const match = source.match(new RegExp(
    `create or replace function\\s+${escapeRegex(qualifiedName)}\\s*\\([\\s\\S]*?\\n\\$\\$;`,
    'i',
  ));
  assert.ok(match, `${qualifiedName} must be defined`);
  return match[0];
}

function loopArray(source, variableName) {
  const match = source.match(new RegExp(
    `foreach\\s+${escapeRegex(variableName)}\\s+in\\s+array\\s+array\\[([\\s\\S]*?)\\]\\s+loop`,
    'i',
  ));
  assert.ok(match, `${variableName} control list must be defined`);
  return match[1];
}

function assertContainsAll(source, expected, label) {
  for (const value of expected) {
    assert.ok(source.includes(value), `${label} must include ${value}`);
  }
}

function assertServiceOnlyRpc(source, qualifiedName, signature) {
  const definition = functionDefinition(source, qualifiedName);
  assert.match(definition, /security definer/i, `${qualifiedName} must be SECURITY DEFINER`);
  assert.match(
    definition,
    /set search_path = public, pg_temp/i,
    `${qualifiedName} must pin its search path`,
  );

  const normalized = compact(source);
  assert.ok(
    normalized.includes(`revoke all on function ${signature} from public, anon, authenticated;`),
    `${qualifiedName} must be revoked from browser roles`,
  );
  assert.ok(
    normalized.includes(`grant execute on function ${signature} to service_role;`),
    `${qualifiedName} must be executable only by service_role`,
  );
  return definition;
}

function assertPrivateFunctionRevoked(source, signature) {
  assert.ok(
    compact(source).includes(
      `revoke all on function ${signature} from public, anon, authenticated, service_role;`,
    ),
    `${signature} must remain private to its defining RPCs and triggers`,
  );
}

for (const table of [
  'finance_role_assignments',
  'engagement_decisions',
  'payee_profiles',
  'tax_profiles',
  'earning_events',
  'earning_routings',
  'earning_disputes',
  'earning_dispute_events',
  'payables',
  'payable_lines',
  'payable_approvals',
  'payable_hold_events',
  'payout_batches',
  'payout_items',
  'payout_approvals',
  'payout_attempts',
  'payout_events',
  'finance_integration_commands',
  'finance_integration_events',
  'ledger_chart_versions',
  'ledger_accounts',
  'ledger_journals',
  'ledger_entries',
  'ledger_journal_events',
]) {
  assert.match(
    core,
    new RegExp(`create table if not exists\\s+public\\.${table}\\s*\\(`, 'i'),
    `${table} is required`,
  );
}

const serverOnlyTables = loopArray(core, 'finance_table');
assertContainsAll(serverOnlyTables, [
  "'finance_role_assignments'",
  "'engagement_decisions'",
  "'payee_profiles'",
  "'tax_profiles'",
  "'earning_events'",
  "'payables'",
  "'payable_approvals'",
  "'payable_hold_events'",
  "'payout_batches'",
  "'payout_items'",
  "'payout_approvals'",
  "'finance_integration_commands'",
  "'ledger_journals'",
  "'ledger_entries'",
], 'server-only finance table list');
assert.match(
  core,
  /alter table public\.%I enable row level security[\s\S]*?revoke all on public\.%I from public, anon, authenticated/,
  'finance tables must enable RLS and deny direct browser access',
);

const appendOnlyTables = loopArray(core, 'immutable_table');
assertContainsAll(appendOnlyTables, [
  "'engagement_decisions'",
  "'earning_routings'",
  "'payable_lines'",
  "'payable_approvals'",
  "'payable_hold_events'",
  "'payout_approvals'",
  "'payout_attempts'",
  "'payout_events'",
  "'ledger_entries'",
  "'ledger_journal_events'",
], 'append-only finance table list');
const payableMoneyGuard = functionDefinition(core, 'app_private.prevent_locked_payable_money_mutation');
assertContainsAll(payableMoneyGuard, [
  "old.status <> 'OPEN'",
  'old.gross_cents is distinct from new.gross_cents',
  'old.net_cents is distinct from new.net_cents',
  'old.calculation_hash is distinct from new.calculation_hash',
  'old.engagement_snapshot is distinct from new.engagement_snapshot',
  'approved_payable_money_immutable',
], 'approved payable immutability guard');

const idempotencyLock = functionDefinition(transitions, 'app_private.lock_payops_idempotency');
const aggregateLock = functionDefinition(transitions, 'app_private.lock_payops_aggregate');
assert.match(idempotencyLock, /pg_advisory_xact_lock/, 'idempotency must be transaction-serialized');
assert.match(aggregateLock, /pg_advisory_xact_lock/, 'aggregate mutations must be transaction-serialized');
assertPrivateFunctionRevoked(
  transitions,
  'app_private.assert_payops_actor_role(uuid, uuid, text[])',
);
assertPrivateFunctionRevoked(
  transitions,
  'app_private.lock_payops_idempotency(uuid, text, text)',
);
assertPrivateFunctionRevoked(
  transitions,
  'app_private.lock_payops_aggregate(uuid, text, uuid)',
);

const createPayable = assertServiceOnlyRpc(
  transitions,
  'public.create_contractor_payable_from_invoice',
  'public.create_contractor_payable_from_invoice(uuid, uuid, integer, uuid, text, date)',
);
assertContainsAll(createPayable, [
  "array['finance_maker']::text[]",
  'app_private.lock_payops_idempotency',
  'app_private.lock_payops_aggregate',
  "v_invoice.status <> 'approved'",
  "decision.decision_status = 'CONTRACTOR_APPROVED'",
  'decision.effective_from <= v_invoice.period_start',
  'newer.decided_at > decision.decided_at',
  'DESTINATION_CHANGE_REVIEW_REQUIRED',
], 'contractor payable creation');

const approvePayable = assertServiceOnlyRpc(
  transitions,
  'public.approve_contractor_payable',
  'public.approve_contractor_payable(uuid, uuid, integer, uuid, text, text)',
);
assertContainsAll(approvePayable, [
  "array['finance_maker']::text[]",
  'app_private.lock_payops_idempotency',
  'app_private.lock_payops_aggregate',
  "v_payable.status <> 'OPEN'",
  'v_payable.hold_code is not null',
  "v_tax.w9_status <> 'verified'",
  "v_tax.backup_withholding_status not in ('not_required', 'released')",
  'v_payee.destination_change_reviewed_at < v_payee.destination_changed_at',
  'payable_totals_do_not_reconcile',
], 'contractor payable approval');

const holdPayable = assertServiceOnlyRpc(
  transitions,
  'public.set_contractor_payable_hold',
  'public.set_contractor_payable_hold(uuid, uuid, integer, uuid, text, text, uuid)',
);
assertContainsAll(holdPayable, [
  "array['finance_maker', 'finance_checker']::text[]",
  'app_private.lock_payops_idempotency',
  'app_private.lock_payops_aggregate',
  "command.status not in ('PENDING', 'CANCELLED')",
  'payout_dispatch_started_hold_requires_recovery',
  'update public.finance_integration_commands',
  "set status = 'CANCELLED'",
  "last_safe_error_code = 'PAYABLE_HELD_BEFORE_DISPATCH'",
  "and status = 'PENDING'",
  'update public.payout_items',
  "status in ('DRAFT', 'APPROVAL_PENDING', 'READY', 'PROVIDER_PENDING')",
  'update public.payout_batches',
  "status in ('DRAFT', 'APPROVAL_PENDING', 'READY', 'PROCESSING')",
  "set status = 'HELD'",
], 'late payable hold control');

assert.match(
  ledger,
  /finance_role in \([\s\S]*?'finance_maker'[\s\S]*?'finance_checker'[\s\S]*?'finance_executor'/,
  'finance_executor must be a supported finance role',
);
const roleGuard = functionDefinition(ledger, 'app_private.guard_finance_role_assignment');
assertContainsAll(roleGuard, [
  'pg_advisory_xact_lock',
  "existing.finance_role in ('finance_maker', 'finance_checker', 'finance_executor')",
  "new.finance_role in ('finance_maker', 'finance_checker', 'finance_executor')",
  'finance_role_period_conflict',
], 'concurrency-safe finance role exclusion');
assertPrivateFunctionRevoked(ledger, 'app_private.guard_finance_role_assignment()');

const ledgerEntryGuard = functionDefinition(ledger, 'app_private.guard_ledger_entry_write');
assert.match(
  ledgerEntryGuard,
  /where journal\.tenant_id = new\.tenant_id and journal\.id = new\.journal_id\s+for share;/,
  'ledger entry insert must share-lock its parent journal',
);
assert.match(
  ledgerEntryGuard,
  /where account\.tenant_id = new\.tenant_id and account\.id = new\.account_id\s+for share;/,
  'ledger entry insert must share-lock its account',
);
assertContainsAll(ledgerEntryGuard, [
  "v_journal.status <> 'DRAFT'",
  'not v_account.active',
  'v_account.effective_from > v_journal.posting_date',
  'v_account.effective_through < v_journal.posting_date',
], 'ledger entry context guard');
assertPrivateFunctionRevoked(ledger, 'app_private.guard_ledger_entry_write()');

const prepareJournal = assertServiceOnlyRpc(
  ledger,
  'public.prepare_ledger_journal',
  'public.prepare_ledger_journal(uuid, uuid, uuid, uuid, text, uuid, integer, text, date, text, jsonb, text)',
);
assertContainsAll(prepareJournal, [
  "array['finance_maker']::text[]",
  'app_private.lock_payops_idempotency',
  "chart.status = 'APPROVED'",
  'account.effective_from <= p_posting_date',
  'account.effective_through >= p_posting_date',
  'ledger_journal_unbalanced',
], 'ledger journal preparation');

const postJournal = assertServiceOnlyRpc(
  ledger,
  'public.post_ledger_journal',
  'public.post_ledger_journal(uuid, uuid, uuid, integer, text, text)',
);
assertContainsAll(postJournal, [
  "array['accountant_controller']::text[]",
  'app_private.lock_payops_idempotency',
  'v_journal.prepared_by = p_actor_profile_id',
  'ledger_maker_checker_required',
  'for share of account',
  'v_total_count',
  'v_count <> v_total_count',
  'account.effective_from <= v_journal.posting_date',
  'account.effective_through >= v_journal.posting_date',
], 'ledger posting revalidation');

const prepareReversal = assertServiceOnlyRpc(
  ledger,
  'public.prepare_ledger_reversal',
  'public.prepare_ledger_reversal(uuid, uuid, uuid, date, text, text)',
);
assertContainsAll(prepareReversal, [
  'app_private.lock_payops_idempotency',
  "v_original.status <> 'POSTED'",
  'reversal_of_journal_id',
  'ledger_reversal_prepared',
], 'ledger reversal preparation');

for (const [name, signature] of [
  ['public.assign_finance_role', 'public.assign_finance_role(uuid, uuid, uuid, text, text, text, timestamptz, timestamptz)'],
  ['public.revoke_finance_role', 'public.revoke_finance_role(uuid, uuid, uuid, integer, text, text)'],
  ['public.open_earning_dispute', 'public.open_earning_dispute(uuid, uuid, uuid, integer, text, text)'],
]) {
  const definition = assertServiceOnlyRpc(ledger, name, signature);
  assert.match(definition, /app_private\.lock_payops_idempotency/, `${name} must serialize idempotency`);
}

const proposalHash = functionDefinition(payouts, 'app_private.contractor_payout_proposal_hash');
assertContainsAll(proposalHash, [
  "'legal_entity_id', p_legal_entity_id",
  "'amount_cents', p_amount_cents",
  "'currency', p_currency",
  "'mercury_recipient_id', p_mercury_recipient_id",
  "'destination_snapshot_hash', p_destination_snapshot_hash",
  "'funding_account_ref', p_funding_account_ref",
  "'send_mode', p_send_mode",
], 'canonical payout proposal hash');
assertPrivateFunctionRevoked(
  payouts,
  'app_private.contractor_payout_proposal_hash( uuid, uuid, integer, uuid, integer, uuid, integer, uuid, integer, uuid, bigint, text, text, text, text, text, text, text )',
);
const commandChecksum = functionDefinition(payouts, 'app_private.finance_command_checksum');
assert.match(
  commandChecksum,
  /digest\(p_safe_payload::text, 'sha256'\)/,
  'provider command checksum must bind the exact safe payload',
);
assertPrivateFunctionRevoked(payouts, 'app_private.finance_command_checksum(jsonb)');

function assertPayoutAuthorityRevalidation(definition, label) {
  assertContainsAll(definition, [
    "decision_status = 'CONTRACTOR_APPROVED'",
    'effective_from <= current_date',
    'effective_through',
    'newer.decided_at',
    'payment_readiness',
    'tax_readiness',
    'mercury_recipient_id',
    'destination_change_reviewed_at',
    'w9_status',
    'tin_match_status',
    'backup_withholding_status',
    'contractor_payout_proposal_hash',
  ], label);
}

const preparePayout = assertServiceOnlyRpc(
  payouts,
  'public.prepare_contractor_payout',
  'public.prepare_contractor_payout(uuid, uuid, uuid, integer, text, text, text)',
);
assertContainsAll(preparePayout, [
  "array['finance_maker']::text[]",
  'app_private.lock_payops_idempotency',
  'app_private.lock_payops_aggregate',
  "v_payable.status <> 'APPROVED'",
  "v_batch.send_mode <> 'approval_queue'",
], 'contractor payout preparation');
assertPayoutAuthorityRevalidation(preparePayout, 'contractor payout preparation authority');

const approvePayout = assertServiceOnlyRpc(
  payouts,
  'public.approve_contractor_payout',
  'public.approve_contractor_payout(uuid, uuid, uuid, integer, text, text)',
);
assertContainsAll(approvePayout, [
  "array['finance_checker']::text[]",
  "p_tenant_id, 'payout_approval', p_idempotency_key",
  'app_private.lock_payops_aggregate',
  'v_item.maker_prepared_by = p_actor_profile_id',
  'payout_maker_checker_required',
  'v_proposal_hash <> v_item.request_hash',
  'v_proposal_hash <> v_batch.request_hash',
], 'contractor payout approval');
assertPayoutAuthorityRevalidation(approvePayout, 'contractor payout approval authority');

const queuePayout = assertServiceOnlyRpc(
  payouts,
  'public.queue_contractor_payout_command',
  'public.queue_contractor_payout_command(uuid, uuid, uuid, integer, text, text)',
);
assertContainsAll(queuePayout, [
  "array['finance_executor']::text[]",
  "p_tenant_id, 'payout_approval', p_idempotency_key",
  'app_private.lock_payops_aggregate',
  'v_item.checker_approved_by = p_actor_profile_id',
  'v_item.maker_prepared_by = p_actor_profile_id',
  'v_proposal_hash <> v_item.request_hash',
  'v_proposal_hash <> v_batch.request_hash',
  "'amount_cents', v_item.amount_cents",
  "'currency', v_item.currency",
  "'payee_profile_id', v_payee.id",
  "'legal_entity_id', v_engagement.legal_entity_id",
  "'mercury_recipient_id', v_payee.mercury_recipient_id",
  "'destination_snapshot_hash', v_destination_hash",
  "'funding_account_ref', v_batch.funding_account_ref",
  'app_private.finance_command_checksum(v_safe_payload)',
  "'SEND_AUTHORIZED', 'finance_executor'",
  "'PENDING', p_actor_profile_id",
], 'provider command authorization');
assertPayoutAuthorityRevalidation(queuePayout, 'provider command authorization authority');

const payoutGuard = functionDefinition(payouts, 'app_private.guard_payout_aggregate');
assertContainsAll(payoutGuard, [
  'old.safe_payload is distinct from new.safe_payload',
  "new.status = 'CLAIMED'",
  "old.status <> 'PENDING'",
  'app_private.finance_command_checksum(new.safe_payload)',
  "assignment.finance_role = 'finance_executor'",
  "checker_assignment.finance_role = 'finance_checker'",
  "send_approval.approval_role = 'finance_executor'",
  "payable.hold_code is null",
  "engagement.decision_status = 'CONTRACTOR_APPROVED'",
  'engagement.effective_from <= current_date',
  "tax.w9_status = 'verified'",
  "tax.backup_withholding_status in ('not_required', 'released')",
  "new.safe_payload->>'amount_cents' = item.amount_cents::text",
  "new.safe_payload->>'currency' = item.currency",
  "new.safe_payload->>'payee_profile_id' = payee.id::text",
  "new.safe_payload->>'legal_entity_id' = engagement.legal_entity_id::text",
  "new.safe_payload->>'mercury_recipient_id' = payee.mercury_recipient_id",
  "new.safe_payload->>'destination_snapshot_hash' = item.destination_snapshot_hash",
  "new.safe_payload->>'funding_account_ref' = batch.funding_account_ref",
  'finance_command_worker_revalidation_failed',
], 'database-side provider worker gate');
assertPrivateFunctionRevoked(payouts, 'app_private.guard_payout_aggregate()');
assert.doesNotMatch(
  payouts,
  /\b(?:fetch|http_get|http_post|net\.http_get|net\.http_post)\s*\(/i,
  'payout controls must queue commands rather than contact a provider',
);

for (const key of [
  'AVALON_PAYOPS_ENABLED',
  'AVALON_LEDGER_ENABLED',
  'MERCURY_LIVE_ENABLED',
  'NURSYS_LIVE_ENABLED',
  'GUSTO_W2_ENABLED',
]) {
  assert.match(env, new RegExp(`${key}=false`), `${key} must default false`);
  assert.match(flags, new RegExp(key), `${key} must be enforced server-side`);
}
assert.match(env, /MERCURY_SEND_MODE=approval_queue/);
assert.match(env, /CONTRACTOR_TAX_MODE=manual/);
assert.match(env, /EMPLOYEE_PAYROLL_PROVIDER=gusto_embedded/);

assert.match(summary, /clientRevenue[\s\S]*nursePayOps[\s\S]*inventoryCosts/, 'Finance must keep three independent domains');
assert.match(financePage, /Three finance domains/, 'Finance UI must label the separated domains');
assert.match(invoiceApi, /provider_settlement_required/, 'invoice review must reject direct settlement');
assert.doesNotMatch(invoiceApi, /payment_reference_required/, 'typed references must not prove payment');
assert.doesNotMatch(invoicePage, />Mark paid</, 'one operator must not mark an invoice paid');
assert.match(payablesApi, /requireFinanceActor/, 'payable amounts require Finance authorization');

console.log('PayOps core QA passed: canonical schema, server-only RPCs, serialized roles and idempotency, locked ledger posting, three-party payout authorization, exact command binding, late-hold cancellation, fail-closed flags, and no direct paid transition.');
