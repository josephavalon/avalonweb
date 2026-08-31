import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const coreMigration = read('supabase/migrations/067_payops_finance_core.sql');
const migration = read('supabase/migrations/074_employee_management_payroll_controls.sql');
const helper = read('api/_lib/payroll-controls.js');
const route = read('api/admin/payroll/index.js');
const page = read('app-modules/pages/admin/Payroll.jsx');
const wrapper = read('src/pages/admin/Payroll.jsx');
const packageJson = JSON.parse(read('package.json'));

const compact = (value) => value.replace(/\s+/g, ' ').trim();
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function includesAll(source, values, label) {
  for (const value of values) assert.ok(source.includes(value), `${label} must include ${value}`);
}

function definition(name) {
  const match = migration.match(new RegExp(
    `create or replace function\\s+${escape(name)}\\s*\\([\\s\\S]*?\\n\\$\\$;`,
    'i',
  ));
  assert.ok(match, `${name} must be defined`);
  return match[0];
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

includesAll(coreMigration, [
  "execute format('revoke all on public.%I from public, anon, authenticated, service_role', finance_table)",
  'public.payroll_profiles, public.payroll_calendars, public.payroll_inputs, public.payroll_runs',
  'public.payroll_items, public.payroll_statements, public.payroll_events, public.payroll_liabilities',
  'public.finance_integration_commands',
  'public.finance_integration_events',
  'public.bank_statement_items',
  'public.reconciliation_matches',
  'to service_role;',
], 'core finance service-role SELECT-only boundary');
assert.doesNotMatch(coreMigration, /grant\s+(?:insert|update|delete|all)\s+on\s+public\.(?:payroll_|finance_integration_|bank_statement_items|reconciliation_matches)[^;]*service_role/i, 'core finance writes must remain RPC-only');

includesAll(migration, [
  "worker_category in ('employee', 'management')",
  'request_idempotency_key',
  'request_hash',
  'app_private.lock_payops_idempotency',
  'app_private.lock_payops_aggregate',
  'payroll_control_record_delete_forbidden',
  'payroll_runs_active_calendar_provider_key',
  "where status <> 'CANCELLED'",
  'payroll_runs_paid_evidence_check check',
  'payroll_runs_cancel_control_check check',
  ') not valid;',
  'payroll_paid_statement_evidence',
  'payroll_events_provider_reconciliation_once_uidx',
  'reconciliation_matches_payroll_approved_uidx',
  'finance_integration_events_payroll_guard',
  'payroll_provider_event_identity_immutable',
  'payroll_provider_event_transition_invalid',
  'payroll_provider_event_terminal_state_immutable',
  'approved_payroll_reconciliation_immutable',
  'matched_payroll_bank_evidence_immutable',
  'paid_payroll_item_immutable',
  "'funding_account_id'",
  "alter table public.payroll_paid_statement_evidence enable row level security",
  'revoke all on public.payroll_paid_statement_evidence from public, anon, authenticated, service_role',
  'grant select on public.payroll_paid_statement_evidence to service_role',
  "'finance_integration_commands', 'finance_integration_events'",
  "'bank_statement_items', 'reconciliation_matches'",
  "'payroll_paid_statement_evidence'",
  "'revoke all on public.%I from public, anon, authenticated, service_role'",
  "execute format('grant select on public.%I to service_role', payroll_table)",
], 'payroll identity and concurrency controls');
assert.match(migration, /add constraint payroll_runs_paid_evidence_check check \([\s\S]*?\) not valid;/i, 'legacy PAID rows must not abort the control migration');
assert.match(migration, /add constraint payroll_runs_cancel_control_check check \([\s\S]*?\) not valid;/i, 'legacy CANCELLED rows must not abort the control migration');
assert.match(migration, /payroll_runs_paid_evidence_check[\s\S]*paid_provider_payload_checksum is not null[\s\S]*paid_provider_payload_checksum ~/i, 'PAID evidence checksum must fail closed on SQL NULL');
assert.match(migration, /payroll_runs_hold_control_check[\s\S]*hold_code is not null[\s\S]*hold_code ~/i, 'HELD reason code must fail closed on SQL NULL');
assert.match(migration, /payroll_runs_cancel_control_check[\s\S]*cancel_reason_code is not null[\s\S]*cancel_reason_code ~/i, 'CANCELLED reason code must fail closed on SQL NULL');
assert.match(migration, /payroll_profiles_readiness_evidence_check[\s\S]*readiness_evidence_ref is not null[\s\S]*readiness_evidence_checksum is not null/i, 'payroll readiness evidence pairs must fail closed on SQL NULL');
assert.match(migration, /payroll_events_control_request_check[\s\S]*idempotency_key is not null[\s\S]*request_hash is not null/i, 'payroll control request pairs must fail closed on SQL NULL');
assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete|all)\s+on\s+public\.(?:payroll_|finance_integration_|bank_statement_items|reconciliation_matches)[^;]*service_role/i, '074 must not restore direct service-role finance DML');

const rpcs = [
  ['public.prepare_employee_payroll_profile', 'public.prepare_employee_payroll_profile(uuid, uuid, uuid, uuid, text, text[], text[], text, text, text, text, text, text)', "array['hr_legal']::text[]"],
  ['public.prepare_payroll_calendar', 'public.prepare_payroll_calendar(uuid, uuid, uuid, date, date, timestamptz, date, date, text, text, text, text)', "array['finance_maker']::text[]"],
  ['public.prepare_payroll_input', 'public.prepare_payroll_input(uuid, uuid, uuid, uuid, uuid, integer, boolean, boolean, text, text)', "array['finance_maker']::text[]"],
  ['public.prepare_payroll_run', 'public.prepare_payroll_run(uuid, uuid, uuid, integer, text)', "array['finance_maker']::text[]"],
  ['public.approve_payroll_run', 'public.approve_payroll_run(uuid, uuid, uuid, integer, text, text)', "array['payroll_approver']::text[]"],
  ['public.queue_payroll_run_command', 'public.queue_payroll_run_command(uuid, uuid, uuid, integer, text, text)', "array['finance_executor']::text[]"],
  ['public.hold_payroll_run', 'public.hold_payroll_run(uuid, uuid, uuid, integer, text, uuid, text)', "array['payroll_approver','accountant_controller']::text[]"],
  ['public.cancel_payroll_run', 'public.cancel_payroll_run(uuid, uuid, uuid, integer, text, text)', "array['payroll_approver','accountant_controller']::text[]"],
  ['public.reconcile_payroll_run', 'public.reconcile_payroll_run(uuid, uuid, uuid, integer, text, uuid, uuid, uuid[], text, text)', "array['accountant_controller']::text[]"],
];
for (const [name, signature, role] of rpcs) {
  const fn = serviceOnly(name, signature);
  assert.ok(compact(fn).includes(role), `${name} must require ${role}`);
  assert.match(fn, /p_idempotency_key/i, `${name} must require idempotency`);
}

const paidValidator = serviceOnly(
  'public.payroll_run_paid_evidence_valid',
  'public.payroll_run_paid_evidence_valid(uuid, uuid)',
);
includesAll(paidValidator, [
  "event.status='PROCESSED'",
  "event.event_type='PAYROLL_PAID'",
  'app_private.payroll_control_hash(event.provider_payload)=event.payload_checksum',
  "bank.normalized_direction='DEBIT'",
  'bank.amount_cents=-run.employer_cost_cents',
  "reconciliation.match_status='APPROVED'",
  'public.payroll_paid_statement_evidence',
  'run.approved_by is not null',
  "statement.statement_status<>'AVAILABLE'",
], 'live canonical paid validation');

const providerEventGuard = definition('app_private.guard_payroll_provider_event');
includesAll(providerEventGuard, [
  "old.provider = 'gusto_embedded'",
  "new.provider = 'gusto_embedded'",
  'old.provider_event_id is distinct from new.provider_event_id',
  'old.event_type is distinct from new.event_type',
  'old.aggregate_id is distinct from new.aggregate_id',
  'old.payload_checksum is distinct from new.payload_checksum',
  'old.signature_valid is distinct from new.signature_valid',
  'old.provider_payload is distinct from new.provider_payload',
  "old.status = 'RECEIVED' and new.status in ('PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER', 'REJECTED')",
  "old.status = 'PROCESSING' and new.status in ('PROCESSED', 'FAILED', 'DEAD_LETTER', 'REJECTED')",
  "old.status in ('PROCESSED', 'FAILED', 'DEAD_LETTER', 'REJECTED')",
  'to_jsonb(old) is distinct from to_jsonb(new)',
], 'immutable finite-state payroll provider events');

const prepareRun = definition('public.prepare_payroll_run');
includesAll(prepareRun, [
  'for update of input, profile',
  'for share of earning',
  'for share of routing, decision',
  'v_input_count <> v_validated_input_count',
  "earning.approval_status = 'ROUTED'",
  "routing.rail = 'W2_PAYROLL_INPUT'",
  "decision.decision_status = 'W2_EMPLOYEE'",
  'newer.decided_at > decision.decided_at',
  'earning.gross_amount_cents + earning.reimbursement_amount_cents = input.amount_cents',
  "profile.readiness_evidence_checksum ~ '^[0-9a-f]{64}$'",
  "'earning_version', earning.version - 1",
  'input.source_hash = app_private.payroll_control_hash',
  'jsonb_array_elements(v_snapshot)',
  'v_locked_input_count <> v_input_count',
  'payroll_run_input_lock_conflict',
], 'exact payroll input readiness and locking');

const prepareInput = definition('public.prepare_payroll_input');
includesAll(prepareInput, [
  "set approval_status = 'ROUTED', version = version + 1",
  'payroll_earning_version_conflict',
], 'payroll input source version lock');

const approval = definition('public.approve_payroll_run');
includesAll(approval, [
  "v_run.status <> 'PREVIEWED'",
  'v_run.prepared_by = p_actor_profile_id',
  'payroll_preview_items_do_not_reconcile',
  "'PAYROLL_HUMAN_APPROVED'",
], 'human approval and maker-checker separation');

const queue = definition('public.queue_payroll_run_command');
includesAll(queue, [
  "v_run.status not in ('DRAFT', 'HUMAN_APPROVED')",
  'v_run.prepared_by = p_actor_profile_id or v_run.approved_by = p_actor_profile_id',
  "'CREATE_PAYROLL_PREVIEW'",
  "'SUBMIT_APPROVED_PAYROLL'",
  'insert into public.finance_integration_commands',
  "'gusto_embedded'",
  "'PENDING'",
  "'provider_network_called', false",
], 'Gusto outbox and executor separation');
assert.doesNotMatch(queue, /\b(?:fetch|axios|https?:\/\/|gusto\.com)\b/i, 'queue RPC must not contact Gusto');

const payrollCommandGuard = definition('app_private.guard_payroll_finance_command');
includesAll(payrollCommandGuard, [
  'old.safe_payload is distinct from new.safe_payload',
  "new.status='CLAIMED'",
  "app_private.lock_payops_aggregate(new.tenant_id,'payroll_run',new.aggregate_id)",
  'for update',
  'for share of input, profile',
  'for share of decision',
  "new.aggregate_type<>'payroll_run'",
  "new.provider<>'gusto_embedded'",
  "new.command_type not in ('CREATE_PAYROLL_PREVIEW','SUBMIT_APPROVED_PAYROLL')",
  'new.request_checksum<>app_private.payroll_control_hash(new.safe_payload)',
  "run.status='PREVIEW_QUEUED'",
  "run.status='SUBMISSION_QUEUED'",
  "run.hold_code is null",
  "executor_assignment.finance_role='finance_executor'",
  "maker_assignment.finance_role='finance_maker'",
  "approver_assignment.finance_role='payroll_approver'",
  "input.status='LOCKED_TO_PAY_PERIOD'",
  "profile.onboarding_status='READY'",
  'profile.readiness_evidence_checksum',
  "decision.decision_status='W2_EMPLOYEE'",
  'newer.decided_at>decision.decided_at',
  "preview_event.event_type='PAYROLL_PREVIEW_READY'",
  "preview_event.status='PROCESSED'",
  'app_private.payroll_control_hash(preview_event.provider_payload)=preview_event.payload_checksum',
  "approval_event.event_type='PAYROLL_HUMAN_APPROVED'",
  'payroll_command_worker_revalidation_failed',
], 'Gusto payroll command claim revalidation');
includesAll(migration, [
  "old.aggregate_type not in ('vendor_payment','payroll_run')",
  'execute function app_private.guard_payout_aggregate()',
  'finance_integration_commands_payroll_guard_update',
  'finance_integration_commands_payroll_guard_delete',
  'execute function app_private.guard_payroll_finance_command()',
], 'payout, vendor, and payroll command trigger split');
assert.doesNotMatch(migration, /drop trigger if exists finance_integration_commands_vendor_guard_/i, '074 must preserve the 073 vendor command gate');

const payrollClaim = definition('public.claim_payroll_run_command');
assert.match(payrollClaim, /security definer/i, 'payroll claim RPC must be SECURITY DEFINER');
assert.match(payrollClaim, /set search_path = public, pg_temp/i, 'payroll claim RPC must pin search_path');
includesAll(payrollClaim, [
  "provider = 'gusto_embedded'",
  "aggregate_type = 'payroll_run'",
  'perform app_private.lock_payops_aggregate',
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
], 'atomic payroll command claim');
assert.match(
  compact(migration),
  /revoke all on function public\.claim_payroll_run_command\(uuid, uuid, text, text\) from public, anon, authenticated, service_role; grant execute on function public\.claim_payroll_run_command\(uuid, uuid, text, text\) to service_role;/i,
  'payroll claim RPC must be service-role-only',
);
assert.doesNotMatch(payrollClaim, /provider_payload|finance_integration_events|status\s*=\s*'SUCCEEDED'|status\s*=\s*'SENT'/i, 'claim RPC must not ingest provider evidence, complete a command, or claim settlement');
assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete|all)[^;]*payroll_paid_statement_evidence/i, 'payroll evidence writes must remain RPC-only');

const reconcile = definition('public.reconcile_payroll_run');
includesAll(reconcile, [
  'event.signature_valid',
  "event.status='PROCESSED'",
  'event.id=p_finance_integration_event_id',
  'app_private.payroll_control_hash(v_payload) <> v_provider_event.payload_checksum',
  "when 'PAID' then 'PAYROLL_PAID'",
  'payroll_controller_separation_required',
  'v_run.prepared_by = p_actor_profile_id',
  'v_run.approved_by = p_actor_profile_id',
  'command.created_by = p_actor_profile_id',
  'v_run.approved_by is null',
  "v_funding_status<>'FUNDED'",
  "v_employee_payment_status<>'PAID'",
  "v_statement_status<>'AVAILABLE'",
  "v_reconciliation_state<>'MATCHED'",
  "v_tax_filing_status not in ('SCHEDULED','FILED','ACCEPTED')",
  "bank.provider_account_id=v_payload->>'funding_account_id'",
  "bank.provider_transaction_id=v_payload->>'funding_transaction_id'",
  "bank.payload_checksum=v_payload->>'bank_statement_payload_checksum'",
  "bank.normalized_direction='DEBIT'",
  'bank.amount_cents=-v_funding_amount',
  "reconciliation_matches",
  "'APPROVED'",
  'payroll_paid_statement_evidence',
  "statement.statement_status='AVAILABLE'",
  'statement.available_at is not null',
  'statement.id=any(v_statement_ids)',
  'for update',
  'payroll_paid_evidence_incomplete',
], 'provider reconciliation and no-false-paid gate');
assert.doesNotMatch(`${migration}\n${route}`, /p_safe_evidence|safeEvidence|p_provider_event_id|p_provider_payload_checksum/, 'clients must not author provider evidence fields');
assert.doesNotMatch(reconcile, /abs\s*\(\s*bank\.amount_cents\s*\)/i, 'payroll bank match must use explicit debit direction and signed amount');

for (const fn of [definition('public.hold_payroll_run'), definition('public.cancel_payroll_run')]) {
  includesAll(fn, ["command.status not in ('PENDING','CANCELLED')", "set status='CANCELLED'"], 'pre-dispatch stop control');
}

includesAll(helper, [
  'assertFinanceSafe(body)',
  'requireAal2: true',
  'flags.gustoW2',
  "employeePayrollProvider === 'gusto_embedded'",
  'gustoOutboxEnabled',
  'providerNetworkCall: false',
  'markPaid: false',
  'cleanUuidList',
  'paidEvidenceValid',
  "sourceStatusRequiresRecovery ? 'RECONCILIATION_REQUIRED' : row.status",
  "employeePaymentStatus: sourceStatusRequiresRecovery ? 'RECONCILIATION_REQUIRED'",
  "statementStatus: sourceStatusRequiresRecovery ? 'RECONCILIATION_REQUIRED'",
], 'server payroll safety helper');
includesAll(route, [
  "rpcName = 'prepare_employee_payroll_profile'",
  "rpcName = 'prepare_payroll_calendar'",
  "rpcName = 'prepare_payroll_input'",
  "rpcName = 'prepare_payroll_run'",
  "rpcName = 'approve_payroll_run'",
  "rpcName = 'queue_payroll_run_command'",
  "rpcName = 'hold_payroll_run'",
  "rpcName = 'cancel_payroll_run'",
  "rpcName = 'reconcile_payroll_run'",
  "p_finance_integration_event_id: cleanUuid(body.financeIntegrationEventId",
  'p_bank_statement_item_id: bankStatementItemId',
  'p_payroll_statement_ids: payrollStatementIds',
  "authed.db.rpc('payroll_run_paid_evidence_valid'",
  'canonicalPaidLiveRevalidated: true',
  'forbiddenProviderFields',
  'if (!canonicalPaidEvidenceAccepted)',
  'requireGustoOutboxEnabled()',
  'providerNetworkCallMade: false',
  'directPaidMutation: false',
], 'bounded payroll API actions');
assert.doesNotMatch(`${helper}\n${route}`, /\b(?:fetch\s*\(|axios|GUSTO_API_(?:KEY|TOKEN)|https?:\/\/[^'"\s]*gusto)\b/i, 'server routes must not contain a Gusto network adapter');
assert.doesNotMatch(route, /(?:^|[,'])provider_payload(?:[,']|$)/m, 'status responses must not expose signed provider payloads');
assert.doesNotMatch(route, /\.from\(['"](?:payroll_|finance_integration_commands)[^)]*\)\s*\.insert/i, 'API writes must use controlled RPCs');

includesAll(page, [
  "apiGet('/api/admin/payroll')",
  "authedFetch('/api/admin/payroll'",
  "act('prepare_profile'",
  "act('prepare_calendar'",
  "act('prepare_input'",
  "act('prepare_run'",
  "act('approve_run'",
  "act('queue_run'",
  "act('hold_run'",
  "act('cancel_run'",
  "act('reconcile_run'",
  'Signed finance event UUID',
  'Posted bank statement item UUID',
  'Payroll statement UUIDs (comma separated)',
  'exact Gusto funding account and debit',
  'does not call Gusto or move money',
  'cannot call Gusto, move money, file tax, or mark anyone paid',
  'does not contact Gusto, submit payroll, or move money',
], 'employee and management payroll UI');
assert.doesNotMatch(page, />\s*Mark paid\s*</i, 'UI must not offer a direct paid transition');
assert.doesNotMatch(page, />\s*Send payroll\s*</i, 'UI must not claim to submit payroll');
assert.match(wrapper, /app-modules\/pages\/admin\/Payroll\.jsx/, 'source wrapper must export the payroll page');
assert.equal(packageJson.scripts['verify:employee-payroll'], 'node scripts/verify-employee-payroll-controls.mjs');

console.log('Employee payroll controls QA passed: employee/management setup, MFA roles, human approval, Gusto outbox, holds, cancellation, reconciliation, and evidence-only paid status are present.');
