import {
  cleanDate,
  cleanExpectedVersion,
  cleanIdempotencyKey,
  cleanJurisdictions,
  cleanReasonCode,
  cleanSafeReference,
  cleanSha256,
  cleanTimestamp,
  cleanUuid,
  cleanUuidList,
  normalizePayrollDbError,
  parsePayrollBody,
  payrollCapabilities,
  PayOpsError,
  requireGustoOutboxEnabled,
  requirePayrollAction,
  requirePayrollEnabled,
  requirePayrollView,
  runView,
  sendPayrollError,
} from '../../_lib/payroll-controls.js';

const READ_LIMIT = 200;
const WORKER_CATEGORIES = new Set(['employee', 'management']);
const RUN_TYPES = new Set(['REGULAR', 'OFF_CYCLE', 'FINAL_PAY']);
const RECONCILIATION_TARGETS = new Set([
  'PREVIEWED', 'PROCESSING', 'EMPLOYER_FUNDED', 'EMPLOYEE_PAYMENT_PENDING', 'PAID',
  'ACTION_REQUIRED', 'FUNDING_FAILED', 'EMPLOYEE_PAYMENT_FAILED',
  'TAX_OR_FILING_FAILED', 'RECONCILIATION_REQUIRED',
]);

function optionalReference(value, field) {
  return value == null || String(value).trim() === ''
    ? null
    : cleanSafeReference(value, field, { required: false });
}

function optionalChecksum(value, field) {
  return value == null || String(value).trim() === ''
    ? null
    : cleanSha256(value, field, { required: false });
}

function commandView(row) {
  return {
    id: row.id,
    aggregateId: row.aggregate_id,
    commandType: row.command_type,
    status: row.status,
    attemptCount: row.attempt_count,
    lastSafeErrorCode: row.last_safe_error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getPayroll(req, res) {
  const authed = await requirePayrollView(req, res);
  if (!authed) return;
  const [profileResult, calendarResult, inputResult, runResult, commandResult] = await Promise.all([
    authed.db.from('payroll_profiles')
      .select('id,worker_profile_id,legal_entity_id,worker_category,work_jurisdictions,tax_jurisdictions,onboarding_status,coverage_status,payment_method_status,statement_status,pay_schedule_ref,readiness_evidence_ref,version,created_at,updated_at')
      .eq('tenant_id', authed.tenantId).order('created_at', { ascending: false }).limit(READ_LIMIT),
    authed.db.from('payroll_calendars')
      .select('id,legal_entity_id,period_start,period_end,cutoff_at,pay_date,funding_date,timezone,run_type,jurisdiction_policy_version,status,version,created_at,updated_at')
      .eq('tenant_id', authed.tenantId).order('period_start', { ascending: false }).limit(READ_LIMIT),
    authed.db.from('payroll_inputs')
      .select('id,payroll_profile_id,payroll_calendar_id,earning_event_id,category,quantity,unit,amount_cents,taxable,regular_rate_component,status,version,created_at,updated_at')
      .eq('tenant_id', authed.tenantId).order('created_at', { ascending: false }).limit(READ_LIMIT),
    authed.db.from('payroll_runs')
      .select('id,payroll_calendar_id,status,gross_cents,net_cents,employee_tax_cents,employer_tax_cents,deduction_cents,reimbursement_cents,employer_cost_cents,funding_status,employee_payment_status,tax_filing_status,statement_status,reconciliation_state,preview_version,approved_by,approved_at,provider_observed_at,last_provider_success_at,last_reconciliation_event_id,last_bank_statement_item_id,last_reconciliation_match_id,paid_provider_payload_checksum,paid_controller_profile_id,paid_evidence_recorded_at,hold_code,hold_owner_profile_id,version,created_at,updated_at')
      .eq('tenant_id', authed.tenantId).order('created_at', { ascending: false }).limit(READ_LIMIT),
    authed.db.from('finance_integration_commands')
      .select('id,aggregate_id,command_type,status,attempt_count,last_safe_error_code,created_at,updated_at')
      .eq('tenant_id', authed.tenantId).eq('provider', 'gusto_embedded')
      .eq('aggregate_type', 'payroll_run').order('created_at', { ascending: false }).limit(READ_LIMIT),
  ]);
  for (const result of [profileResult, calendarResult, inputResult, runResult, commandResult]) {
    if (result.error) throw result.error;
  }
  const workerIds = [...new Set((profileResult.data || []).map((row) => row.worker_profile_id))];
  const workerResult = workerIds.length
    ? await authed.db.from('profiles').select('id,full_name').eq('tenant_id', authed.tenantId).in('id', workerIds)
    : { data: [], error: null };
  if (workerResult.error) throw workerResult.error;
  const workers = new Map((workerResult.data || []).map((row) => [row.id, row.full_name || 'Employee']));
  const commands = new Map();
  for (const command of commandResult.data || []) {
    if (!commands.has(command.aggregate_id)) commands.set(command.aggregate_id, command);
  }
  const paidEvidenceResults = await Promise.all((runResult.data || [])
    .filter((row) => row.status === 'PAID')
    .map(async (row) => {
      const result = await authed.db.rpc('payroll_run_paid_evidence_valid', {
        p_tenant_id: authed.tenantId,
        p_payroll_run_id: row.id,
      });
      if (result.error) throw result.error;
      return [row.id, result.data === true];
    }));
  const paidEvidence = new Map(paidEvidenceResults);
  const profiles = (profileResult.data || []).map((row) => ({
    id: row.id,
    workerProfileId: row.worker_profile_id,
    workerName: workers.get(row.worker_profile_id) || 'Employee',
    legalEntityId: row.legal_entity_id,
    workerCategory: row.worker_category,
    workJurisdictions: row.work_jurisdictions,
    taxJurisdictions: row.tax_jurisdictions,
    onboardingStatus: row.onboarding_status,
    coverageStatus: row.coverage_status,
    paymentMethodStatus: row.payment_method_status,
    statementStatus: row.statement_status,
    payScheduleConfigured: Boolean(row.pay_schedule_ref),
    readinessEvidenceRecorded: Boolean(row.readiness_evidence_ref),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  const calendars = (calendarResult.data || []).map((row) => ({
    id: row.id,
    legalEntityId: row.legal_entity_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    cutoffAt: row.cutoff_at,
    payDate: row.pay_date,
    fundingDate: row.funding_date,
    timezone: row.timezone,
    runType: row.run_type,
    policyVersion: row.jurisdiction_policy_version,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  const inputs = (inputResult.data || []).map((row) => ({
    id: row.id,
    payrollProfileId: row.payroll_profile_id,
    payrollCalendarId: row.payroll_calendar_id,
    earningEventId: row.earning_event_id,
    category: row.category,
    quantity: String(row.quantity),
    unit: row.unit,
    amountCents: String(row.amount_cents),
    taxable: row.taxable,
    regularRateComponent: row.regular_rate_component,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  const runs = (runResult.data || []).map((row) => runView(row, commands.get(row.id), paidEvidence.get(row.id) === true));
  return res.status(200).json({
    profiles,
    calendars,
    inputs,
    runs,
    commands: (commandResult.data || []).map(commandView),
    capabilities: payrollCapabilities(authed),
    boundaries: {
      providerNetworkCall: false,
      providerOutboxOnly: true,
      directPaidMutation: false,
      paidRequiresProcessedSignedProviderEvent: true,
      paidRequiresPostedBankAllocation: true,
      paidRequiresAvailableStatements: true,
      canonicalPaidLiveRevalidated: true,
    },
  });
}

async function postPayroll(req, res) {
  const body = parsePayrollBody(req);
  const action = String(body.action || '').trim();
  const authed = await requirePayrollAction(req, res, action);
  if (!authed) return;
  requirePayrollEnabled();
  const forbiddenProviderFields = [['safe', 'Evidence'], ['provider', 'EventId'], ['provider', 'PayloadChecksum']]
    .map((parts) => parts.join(''));
  if (forbiddenProviderFields.some((field) => Object.prototype.hasOwnProperty.call(body, field))) {
    throw new PayOpsError('Provider evidence fields are accepted only from signed ingestion records.', 'payroll_reconciliation_request_invalid', 400);
  }
  const idempotencyKey = cleanIdempotencyKey(req);
  let rpcName;
  let args;

  if (action === 'prepare_profile') {
    const workerCategory = String(body.workerCategory || '').trim().toLowerCase();
    if (!WORKER_CATEGORIES.has(workerCategory)) throw new PayOpsError('Worker category is invalid.', 'worker_category_invalid', 400);
    rpcName = 'prepare_employee_payroll_profile';
    args = {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_worker_profile_id: cleanUuid(body.workerProfileId, 'workerProfileId'),
      p_legal_entity_id: cleanUuid(body.legalEntityId, 'legalEntityId'),
      p_worker_category: workerCategory,
      p_work_jurisdictions: cleanJurisdictions(body.workJurisdictions, 'workJurisdictions'),
      p_tax_jurisdictions: cleanJurisdictions(body.taxJurisdictions, 'taxJurisdictions'),
      p_gusto_company_id: optionalReference(body.gustoCompanyId, 'gustoCompanyId'),
      p_gusto_employee_id: optionalReference(body.gustoEmployeeId, 'gustoEmployeeId'),
      p_pay_schedule_ref: optionalReference(body.payScheduleRef, 'payScheduleRef'),
      p_readiness_evidence_ref: optionalReference(body.readinessEvidenceRef, 'readinessEvidenceRef'),
      p_readiness_evidence_checksum: optionalChecksum(body.readinessEvidenceChecksum, 'readinessEvidenceChecksum'),
      p_idempotency_key: idempotencyKey,
    };
  } else if (action === 'prepare_calendar') {
    const runType = String(body.runType || 'REGULAR').trim().toUpperCase();
    if (!RUN_TYPES.has(runType)) throw new PayOpsError('Run type is invalid.', 'run_type_invalid', 400);
    rpcName = 'prepare_payroll_calendar';
    args = {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_legal_entity_id: cleanUuid(body.legalEntityId, 'legalEntityId'),
      p_period_start: cleanDate(body.periodStart, 'periodStart'),
      p_period_end: cleanDate(body.periodEnd, 'periodEnd'),
      p_cutoff_at: cleanTimestamp(body.cutoffAt, 'cutoffAt'),
      p_pay_date: cleanDate(body.payDate, 'payDate'),
      p_funding_date: cleanDate(body.fundingDate, 'fundingDate', { required: false }),
      p_timezone: String(body.timezone || 'America/Los_Angeles').trim(),
      p_run_type: runType,
      p_jurisdiction_policy_version: cleanSafeReference(body.policyVersion, 'policyVersion'),
      p_idempotency_key: idempotencyKey,
    };
  } else if (action === 'prepare_input') {
    rpcName = 'prepare_payroll_input';
    args = {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_payroll_profile_id: cleanUuid(body.payrollProfileId, 'payrollProfileId'),
      p_payroll_calendar_id: cleanUuid(body.payrollCalendarId, 'payrollCalendarId'),
      p_earning_event_id: cleanUuid(body.earningEventId, 'earningEventId'),
      p_expected_earning_version: cleanExpectedVersion(body.expectedEarningVersion),
      p_taxable: body.taxable !== false,
      p_regular_rate_component: body.regularRateComponent !== false,
      p_policy_version: cleanSafeReference(body.policyVersion, 'policyVersion'),
      p_idempotency_key: idempotencyKey,
    };
  } else if (action === 'prepare_run') {
    rpcName = 'prepare_payroll_run';
    args = {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_payroll_calendar_id: cleanUuid(body.payrollCalendarId, 'payrollCalendarId'),
      p_expected_calendar_version: cleanExpectedVersion(body.expectedCalendarVersion),
      p_idempotency_key: idempotencyKey,
    };
  } else if (action === 'approve_run') {
    rpcName = 'approve_payroll_run';
    args = {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_payroll_run_id: cleanUuid(body.payrollRunId, 'payrollRunId'),
      p_expected_version: cleanExpectedVersion(body.expectedVersion),
      p_reason_code: cleanReasonCode(body.reasonCode),
      p_idempotency_key: idempotencyKey,
    };
  } else if (action === 'queue_run') {
    requireGustoOutboxEnabled();
    rpcName = 'queue_payroll_run_command';
    args = {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_payroll_run_id: cleanUuid(body.payrollRunId, 'payrollRunId'),
      p_expected_version: cleanExpectedVersion(body.expectedVersion),
      p_reason_code: cleanReasonCode(body.reasonCode),
      p_idempotency_key: idempotencyKey,
    };
  } else if (action === 'hold_run') {
    rpcName = 'hold_payroll_run';
    args = {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_payroll_run_id: cleanUuid(body.payrollRunId, 'payrollRunId'),
      p_expected_version: cleanExpectedVersion(body.expectedVersion),
      p_hold_code: cleanReasonCode(body.holdCode, 'holdCode'),
      p_owner_profile_id: cleanUuid(body.ownerProfileId || authed.user.id, 'ownerProfileId'),
      p_idempotency_key: idempotencyKey,
    };
  } else if (action === 'cancel_run') {
    rpcName = 'cancel_payroll_run';
    args = {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_payroll_run_id: cleanUuid(body.payrollRunId, 'payrollRunId'),
      p_expected_version: cleanExpectedVersion(body.expectedVersion),
      p_reason_code: cleanReasonCode(body.reasonCode),
      p_idempotency_key: idempotencyKey,
    };
  } else if (action === 'reconcile_run') {
    const targetStatus = String(body.targetStatus || '').trim().toUpperCase();
    if (!RECONCILIATION_TARGETS.has(targetStatus)) throw new PayOpsError('Target status is invalid.', 'target_status_invalid', 400);
    const bankStatementItemId = body.bankStatementItemId == null || String(body.bankStatementItemId).trim() === ''
      ? null : cleanUuid(body.bankStatementItemId, 'bankStatementItemId');
    const payrollStatementIds = cleanUuidList(body.payrollStatementIds, 'payrollStatementIds', { required: targetStatus === 'PAID' });
    if ((targetStatus === 'PAID' && !bankStatementItemId)
      || (targetStatus !== 'PAID' && (bankStatementItemId || payrollStatementIds.length))) {
      throw new PayOpsError('Settlement evidence IDs are valid only for a paid reconciliation.', 'payroll_reconciliation_request_invalid', 400);
    }
    rpcName = 'reconcile_payroll_run';
    args = {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_payroll_run_id: cleanUuid(body.payrollRunId, 'payrollRunId'),
      p_expected_version: cleanExpectedVersion(body.expectedVersion),
      p_target_status: targetStatus,
      p_finance_integration_event_id: cleanUuid(body.financeIntegrationEventId, 'financeIntegrationEventId'),
      p_bank_statement_item_id: bankStatementItemId,
      p_payroll_statement_ids: payrollStatementIds,
      p_reason_code: cleanReasonCode(body.reasonCode),
      p_idempotency_key: idempotencyKey,
    };
  }

  const result = await authed.db.rpc(rpcName, args);
  if (result.error) throw normalizePayrollDbError(result.error);
  if (action === 'queue_run') {
    return res.status(202).json({
      command: commandView({ ...result.data, aggregate_id: result.data.aggregate_id }),
      providerNetworkCallMade: false,
      providerAccepted: false,
      paymentRecorded: false,
    });
  }
  let canonicalPaidEvidenceAccepted = false;
  if (action === 'reconcile_run' && result.data?.status === 'PAID') {
    const validation = await authed.db.rpc('payroll_run_paid_evidence_valid', {
      p_tenant_id: authed.tenantId,
      p_payroll_run_id: result.data.id,
    });
    if (validation.error) throw normalizePayrollDbError(validation.error);
    canonicalPaidEvidenceAccepted = validation.data === true;
    if (!canonicalPaidEvidenceAccepted) {
      throw new PayOpsError('Paid evidence did not survive live reconciliation validation.', 'payroll_paid_evidence_incomplete', 409);
    }
  }
  return res.status(action.startsWith('prepare_') ? 201 : 200).json({
    result: result.data,
    providerNetworkCallMade: false,
    directPaidMutation: false,
    canonicalPaidEvidenceAccepted,
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') return await getPayroll(req, res);
    if (req.method === 'POST') return await postPayroll(req, res);
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return sendPayrollError(res, error);
  }
}
