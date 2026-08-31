import {
  assertFinanceSafe,
  cleanExpectedVersion,
  cleanIdempotencyKey,
  cleanReasonCode,
  cleanUuid,
  normalizePayOpsDbError,
  PayOpsError,
  payOpsFlags,
  requireFinanceActor,
  sendPayOpsError,
} from './payops-core.js';

export const PAYROLL_VIEW_ROLES = Object.freeze([
  'finance_maker',
  'finance_executor',
  'payroll_approver',
  'hr_legal',
  'accountant_controller',
  'security_auditor',
]);

export const PAYROLL_ACTION_ROLES = Object.freeze({
  prepare_profile: ['hr_legal'],
  prepare_calendar: ['finance_maker'],
  prepare_input: ['finance_maker'],
  prepare_run: ['finance_maker'],
  approve_run: ['payroll_approver'],
  queue_run: ['finance_executor'],
  hold_run: ['payroll_approver', 'accountant_controller'],
  cancel_run: ['payroll_approver', 'accountant_controller'],
  reconcile_run: ['accountant_controller'],
});

const PAYROLL_DB_ERRORS = Object.freeze({
  payroll_profile_request_invalid: ['Payroll profile details are invalid.', 400],
  payroll_profile_provider_evidence_invalid: ['Payroll onboarding evidence is invalid.', 400],
  payroll_profile_already_exists: ['A payroll profile already exists for this worker and entity.', 409],
  effective_w2_decision_required: ['An effective HR/Legal W-2 decision is required.', 409],
  payroll_calendar_request_invalid: ['Payroll calendar details are invalid.', 400],
  payroll_input_request_invalid: ['Payroll input details are invalid.', 400],
  payroll_profile_not_ready: ['The employee payroll profile is not ready.', 409],
  payroll_calendar_not_open: ['The payroll calendar is not open.', 409],
  payroll_earning_not_eligible: ['The earning is not approved and routed to W-2 payroll.', 409],
  payroll_run_prepare_request_invalid: ['Payroll run details are invalid.', 400],
  payroll_calendar_version_or_state_conflict: ['The payroll calendar changed. Refresh and try again.', 409],
  payroll_run_inputs_not_ready: ['Validated payroll inputs and provider-ready employee profiles are required.', 409],
  payroll_approval_request_invalid: ['Payroll approval details are invalid.', 400],
  payroll_run_not_found: ['Payroll run not found.', 404],
  payroll_run_not_ready_for_approval: ['A verified provider preview is required before human approval.', 409],
  payroll_maker_approver_required: ['The payroll preparer cannot approve the same run.', 403],
  payroll_preview_items_do_not_reconcile: ['Provider preview items do not reconcile to the run totals.', 409],
  payroll_command_request_invalid: ['Payroll command details are invalid.', 400],
  payroll_run_not_queueable: ['The payroll run changed or cannot be queued.', 409],
  payroll_executor_separation_required: ['The executor must be different from the preparer and approver.', 403],
  payroll_hold_request_invalid: ['Payroll hold details are invalid.', 400],
  payroll_run_not_holdable: ['The payroll run can no longer be held.', 409],
  payroll_dispatch_started_hold_requires_recovery: ['Provider dispatch started; use controlled recovery instead of a local hold.', 409],
  payroll_cancel_request_invalid: ['Payroll cancellation details are invalid.', 400],
  payroll_run_not_cancellable: ['The payroll run can no longer be cancelled locally.', 409],
  payroll_dispatch_started_cancel_requires_recovery: ['Provider dispatch started; use controlled recovery instead of local cancellation.', 409],
  payroll_reconciliation_request_invalid: ['Payroll reconciliation evidence is invalid.', 400],
  payroll_run_version_conflict: ['The payroll run changed. Refresh and try again.', 409],
  verified_gusto_event_required: ['A processed, signature-valid Gusto event is required.', 409],
  gusto_event_type_mismatch: ['The provider event does not match this payroll transition.', 409],
  payroll_reconciliation_transition_invalid: ['That payroll evidence cannot advance the current state.', 409],
  payroll_preview_evidence_invalid: ['The provider preview evidence is incomplete.', 409],
  payroll_preview_totals_invalid: ['Provider preview totals do not balance.', 409],
  payroll_paid_evidence_incomplete: ['Matched provider, funding, payment, item, and statement evidence is required for paid status.', 409],
  payroll_provider_payload_binding_invalid: ['The signed provider event is not bound to this payroll run.', 409],
  payroll_provider_payload_invalid: ['The signed provider event is incomplete.', 409],
  payroll_terminal_state_requires_settlement_evidence: ['Paid, statement-available, and matched states require settlement evidence.', 409],
  payroll_bank_evidence_mismatch: ['The posted payroll funding debit does not match the signed provider event.', 409],
  payroll_statement_evidence_mismatch: ['Every payroll item needs one matching available statement.', 409],
  payroll_controller_separation_required: ['The controller must be different from the maker, approver, and executor.', 403],
  payroll_run_input_lock_conflict: ['Payroll inputs changed while the run was being prepared. Refresh and try again.', 409],
});

export function parsePayrollBody(req) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    assertFinanceSafe(body);
    return body;
  } catch (error) {
    if (error instanceof PayOpsError) throw error;
    throw new PayOpsError('The request body must be valid JSON.', 'invalid_json', 400);
  }
}

export function normalizePayrollDbError(error) {
  const normalized = normalizePayOpsDbError(error);
  if (normalized instanceof PayOpsError) return normalized;
  const raw = String(error?.message || error?.details || error?.hint || '').toLowerCase();
  const code = Object.keys(PAYROLL_DB_ERRORS).find((candidate) => raw.includes(candidate));
  if (!code) return normalized;
  const [message, status] = PAYROLL_DB_ERRORS[code];
  return new PayOpsError(message, code, status);
}

export function sendPayrollError(res, error, fallback = 'Payroll controls are unavailable.') {
  return sendPayOpsError(res, normalizePayrollDbError(error), fallback);
}

export async function requirePayrollView(req, res) {
  return requireFinanceActor(req, res, { allowedFinanceRoles: PAYROLL_VIEW_ROLES });
}

export async function requirePayrollAction(req, res, action) {
  const roles = PAYROLL_ACTION_ROLES[action];
  if (!roles) {
    throw new PayOpsError('Payroll action is invalid.', 'payroll_action_invalid', 400);
  }
  return requireFinanceActor(req, res, { allowedFinanceRoles: roles, requireAal2: true });
}

export function payrollCapabilities(authed, env = process.env) {
  const flags = payOpsFlags(env);
  const has = (role) => authed.financeRoles.includes(role);
  return {
    enabled: flags.payOps,
    gustoOutboxEnabled: flags.payOps && flags.gustoW2 && flags.employeePayrollProvider === 'gusto_embedded',
    prepareProfile: flags.payOps && has('hr_legal'),
    prepareCalendar: flags.payOps && has('finance_maker'),
    prepareInput: flags.payOps && has('finance_maker'),
    prepareRun: flags.payOps && has('finance_maker'),
    approveRun: flags.payOps && has('payroll_approver'),
    queueRun: flags.payOps && flags.gustoW2 && flags.employeePayrollProvider === 'gusto_embedded' && has('finance_executor'),
    holdRun: flags.payOps && (has('payroll_approver') || has('accountant_controller')),
    cancelRun: flags.payOps && (has('payroll_approver') || has('accountant_controller')),
    reconcileRun: flags.payOps && has('accountant_controller'),
    providerNetworkCall: false,
    markPaid: false,
    actorProfileId: authed.user.id,
    roles: authed.financeRoles,
  };
}

export function requirePayrollEnabled(env = process.env) {
  if (!payOpsFlags(env).payOps) {
    throw new PayOpsError('Avalon PayOps is disabled pending production gates.', 'avalon_payops_disabled', 503);
  }
}

export function requireGustoOutboxEnabled(env = process.env) {
  const flags = payOpsFlags(env);
  if (!flags.gustoW2 || flags.employeePayrollProvider !== 'gusto_embedded') {
    throw new PayOpsError('The Gusto payroll outbox is disabled.', 'gusto_payroll_outbox_disabled', 503);
  }
}

export function cleanSafeReference(value, field, { required = true, max = 200 } = {}) {
  const text = String(value || '').trim();
  if (!text && !required) return null;
  const pattern = new RegExp(`^[A-Za-z0-9][A-Za-z0-9._:/-]{2,${Math.max(2, max - 1)}}$`);
  if (!pattern.test(text)) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  return text;
}

export function cleanSha256(value, field = 'checksum', { required = true } = {}) {
  const text = String(value || '').trim().toLowerCase();
  if (!text && !required) return null;
  if (!/^[0-9a-f]{64}$/.test(text)) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  return text;
}

export function cleanDate(value, field, { required = true } = {}) {
  const text = String(value || '').trim();
  if (!text && !required) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  }
  return text;
}

export function cleanTimestamp(value, field) {
  const text = String(value || '').trim();
  if (!text || !Number.isFinite(Date.parse(text))) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  return new Date(text).toISOString();
}

export function cleanJurisdictions(value, field) {
  const rows = (Array.isArray(value) ? value : String(value || '').split(','))
    .map((entry) => String(entry).trim().toUpperCase())
    .filter(Boolean);
  const unique = [...new Set(rows)];
  if (!unique.length || unique.length > 20 || unique.some((entry) => !/^[A-Z0-9_-]{2,40}$/.test(entry))) {
    throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  }
  return unique;
}

export function cleanUuidList(value, field, { required = false, max = 1000 } = {}) {
  const rows = (Array.isArray(value) ? value : String(value || '').split(','))
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .map((entry) => cleanUuid(entry, field));
  const unique = [...new Set(rows)].sort();
  if (rows.length !== unique.length || unique.length > max || (required && unique.length === 0)) {
    throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  }
  return unique;
}

export function exactCents(value, field = 'amount') {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) {
    throw new PayOpsError(`${field} could not be represented exactly.`, 'pay_amount_precision_unavailable', 503);
  }
  const raw = typeof value === 'bigint' ? value.toString() : String(value ?? '');
  if (!/^\d+$/.test(raw)) throw new PayOpsError(`${field} could not be represented exactly.`, 'pay_amount_precision_unavailable', 503);
  return BigInt(raw).toString();
}

export function runView(row, command = null, paidEvidenceValid = false) {
  const canonicalPaid = Boolean(
    row.status === 'PAID'
      && row.funding_status === 'FUNDED'
      && row.employee_payment_status === 'PAID'
      && row.statement_status === 'AVAILABLE'
      && row.reconciliation_state === 'MATCHED'
      && row.provider_observed_at
      && row.last_provider_success_at
      && row.last_reconciliation_event_id
      && row.last_bank_statement_item_id
      && row.last_reconciliation_match_id
      && row.paid_provider_payload_checksum
      && row.paid_controller_profile_id
      && row.paid_evidence_recorded_at
      && paidEvidenceValid,
  );
  const sourceStatusRequiresRecovery = row.status === 'PAID' && !canonicalPaid;
  const safeStatus = sourceStatusRequiresRecovery ? 'RECONCILIATION_REQUIRED' : row.status;
  return {
    id: row.id,
    payrollCalendarId: row.payroll_calendar_id,
    status: safeStatus,
    persistedStatus: safeStatus,
    canonicalPaid,
    sourceStatusRequiresRecovery,
    grossCents: exactCents(row.gross_cents, 'Gross'),
    netCents: exactCents(row.net_cents, 'Net'),
    employeeTaxCents: exactCents(row.employee_tax_cents, 'Employee tax'),
    employerTaxCents: exactCents(row.employer_tax_cents, 'Employer tax'),
    deductionCents: exactCents(row.deduction_cents, 'Deductions'),
    reimbursementCents: exactCents(row.reimbursement_cents, 'Reimbursement'),
    employerCostCents: exactCents(row.employer_cost_cents, 'Employer cost'),
    fundingStatus: sourceStatusRequiresRecovery ? 'RECONCILIATION_REQUIRED' : row.funding_status,
    employeePaymentStatus: sourceStatusRequiresRecovery ? 'RECONCILIATION_REQUIRED' : row.employee_payment_status,
    taxFilingStatus: sourceStatusRequiresRecovery ? 'RECONCILIATION_REQUIRED' : row.tax_filing_status,
    statementStatus: sourceStatusRequiresRecovery ? 'RECONCILIATION_REQUIRED' : row.statement_status,
    reconciliationState: sourceStatusRequiresRecovery ? 'EXCEPTION' : row.reconciliation_state,
    previewVersion: row.preview_version,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    financeIntegrationEventId: row.last_reconciliation_event_id,
    bankStatementItemId: row.last_bank_statement_item_id,
    reconciliationMatchId: row.last_reconciliation_match_id,
    paidEvidenceRecordedAt: row.paid_evidence_recorded_at,
    holdCode: row.hold_code,
    holdOwnerProfileId: row.hold_owner_profile_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    command: command ? {
      id: command.id,
      commandType: command.command_type,
      status: command.status,
      attemptCount: command.attempt_count,
      lastSafeErrorCode: command.last_safe_error_code,
      createdAt: command.created_at,
      updatedAt: command.updated_at,
    } : null,
  };
}

export {
  cleanExpectedVersion,
  cleanIdempotencyKey,
  cleanReasonCode,
  cleanUuid,
  PayOpsError,
};
