import {
  assertFinanceSafe,
  cleanExpectedVersion,
  cleanIdempotencyKey,
  cleanUuid,
  financeAdapterHealth,
  normalizePayOpsDbError,
  PayOpsError,
  payOpsFlags,
  requireFinanceActor,
  sendPayOpsError,
} from '../_lib/payops-core.js';

const DEFAULT_PAGE = 50;
const MAX_PAGE = 100;

const PAYOUT_ERROR_MAP = Object.freeze({
  payout_prepare_request_invalid: ['The payout preparation request is invalid.', 400],
  payable_not_ready_for_payout: ['The payable changed or is not approved for payout preparation.', 409],
  payout_authority_or_destination_not_ready: ['Contractor, tax, or payment-destination approval is no longer current.', 409],
  payout_amount_invalid: ['The payout amount must be greater than zero.', 409],
  payout_item_not_found: ['Payout not found.', 404],
  payout_item_version_or_state_conflict: ['The payout changed. Refresh and try again.', 409],
  payout_batch_version_or_state_conflict: ['The payout batch changed. Refresh and try again.', 409],
  payout_approval_snapshot_changed: ['The locked payout proposal changed and must be reviewed again.', 409],
  payout_send_snapshot_changed: ['The approved payout proposal changed and cannot be queued.', 409],
  payout_maker_checker_required: ['A different Finance checker must approve this payout.', 403],
  payout_send_authorization_invalid: ['A separate Finance executor must authorize the provider command.', 403],
});

function payoutDbError(error) {
  const normalized = normalizePayOpsDbError(error);
  if (normalized instanceof PayOpsError) return normalized;
  const raw = String(error?.message || error?.details || error?.hint || '').toLowerCase();
  const code = Object.keys(PAYOUT_ERROR_MAP).find((candidate) => raw.includes(candidate));
  if (!code) return normalized;
  const [message, status] = PAYOUT_ERROR_MAP[code];
  return new PayOpsError(message, code, status);
}

function parseBody(req) {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    throw new PayOpsError('The request body must be valid JSON.', 'invalid_json', 400);
  }
}

function exactCents(value, field = 'amount') {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new PayOpsError(`${field} could not be represented exactly.`, 'pay_amount_precision_unavailable', 503);
    }
    return BigInt(value).toString();
  }
  const raw = typeof value === 'bigint' ? value.toString() : String(value ?? '');
  if (!/^\d+$/.test(raw)) {
    throw new PayOpsError(`${field} could not be represented exactly.`, 'pay_amount_precision_unavailable', 503);
  }
  return BigInt(raw).toString();
}

function boundedLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE;
  return Math.min(MAX_PAGE, Math.max(1, Math.trunc(parsed)));
}

function cleanFundingAccountRef(value) {
  const ref = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/.test(ref)) {
    throw new PayOpsError('Choose the exact approved Mercury provider account ID.', 'funding_account_ref_invalid', 400);
  }
  return ref;
}

function cleanFundingAccountLabel(value) {
  const label = String(value || '').trim();
  const visiblyMasked = /[*•]/.test(label) || /\bending\s+\d{1,4}\b/i.test(label);
  if (label.length < 3
    || label.length > 120
    || /[\u0000-\u001f\u007f]/.test(label)
    || /\d{5,}/.test(label)
    || !visiblyMasked) {
    throw new PayOpsError('Enter a short masked funding-account label.', 'funding_account_label_invalid', 400);
  }
  return label;
}

function commandView(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    commandType: row.command_type,
    status: row.status,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    claimedAt: row.claimed_at,
    lastSafeErrorCode: row.last_safe_error_code,
    correlationId: row.correlation_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function payoutView(row, { batch, payable, approvals, commands, settlementEvidence }) {
  const amountCents = exactCents(row.amount_cents, 'Payout amount');
  const payableNetCents = payable ? exactCents(payable.net_cents, 'Payable amount') : null;
  const canonicalSettled = Boolean(
    payable
      && settlementEvidence
      && row.status === 'SETTLED'
      && row.reconciliation_state === 'MATCHED'
      && row.provider_observed_at
      && row.last_provider_success_at
      && payable.status === 'SETTLED'
      && payable.reconciliation_state === 'MATCHED'
      && payable.settled_at
      && amountCents === payableNetCents
      && row.currency === payable.currency
      && settlementEvidence.payable_id === row.payable_id
      && settlementEvidence.provider_transaction_id === row.provider_transaction_id
      && exactCents(settlementEvidence.amount_cents, 'Settlement evidence amount') === amountCents
      && settlementEvidence.currency === row.currency,
  );
  const settlementClaimed = row.status === 'SETTLED' || payable?.status === 'SETTLED';
  const displayStatus = canonicalSettled
    ? 'SETTLED'
    : settlementClaimed ? 'RECONCILIATION_REQUIRED' : row.status;
  const checkerApproval = approvals.find((approval) => approval.approval_role === 'finance_checker' && approval.decision === 'APPROVED');
  const executorApproval = approvals.find((approval) => approval.approval_role === 'finance_executor' && approval.decision === 'SEND_AUTHORIZED');

  return {
    id: row.id,
    payableId: row.payable_id,
    payoutBatchId: row.payout_batch_id,
    status: displayStatus,
    persistedStatus: row.status,
    canonicalSettled,
    amountCents,
    currency: row.currency,
    destinationMaskedLabel: row.destination_masked_label,
    reconciliationState: row.reconciliation_state,
    providerObservedAt: row.provider_observed_at,
    lastProviderSuccessAt: row.last_provider_success_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorization: {
      maker: { profileId: row.maker_prepared_by, at: row.maker_prepared_at },
      checker: checkerApproval ? {
        profileId: checkerApproval.actor_profile_id,
        at: checkerApproval.created_at,
        reasonCode: checkerApproval.reason_code,
      } : null,
      executor: executorApproval ? {
        profileId: executorApproval.actor_profile_id,
        at: executorApproval.created_at,
        reasonCode: executorApproval.reason_code,
      } : null,
    },
    batch: batch ? {
      id: batch.id,
      status: batch.status,
      sendMode: batch.send_mode,
      itemCount: batch.item_count,
      totalCents: exactCents(batch.total_cents, 'Batch total'),
      currency: batch.currency,
      fundingAccountMaskedLabel: batch.funding_account_masked_label,
      version: batch.version,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at,
    } : null,
    payable: payable ? {
      id: payable.id,
      status: payable.status,
      netCents: payableNetCents,
      currency: payable.currency,
      reconciliationState: payable.reconciliation_state,
      settledAt: canonicalSettled ? payable.settled_at : null,
      version: payable.version,
    } : null,
    command: commandView(commands[0]),
    commandHistory: commands.map(commandView),
    evidence: {
      providerObserved: Boolean(row.provider_observed_at),
      providerSuccessObserved: Boolean(row.last_provider_success_at),
      payableMatched: payable?.reconciliation_state === 'MATCHED',
      payoutMatched: row.reconciliation_state === 'MATCHED',
      settlementComplete: canonicalSettled,
      settlementEvidenceRecorded: Boolean(settlementEvidence),
    },
  };
}

async function loadPayouts(db, tenantId, rows) {
  const payoutIds = rows.map((row) => row.id);
  const batchIds = [...new Set(rows.map((row) => row.payout_batch_id).filter(Boolean))];
  const payableIds = [...new Set(rows.map((row) => row.payable_id).filter(Boolean))];
  const [batchResult, payableResult, approvalResult, commandResult, settlementResult] = await Promise.all([
    batchIds.length
      ? db.from('payout_batches')
        .select('id,status,send_mode,item_count,total_cents,currency,funding_account_masked_label,version,created_at,updated_at')
        .eq('tenant_id', tenantId)
        .in('id', batchIds)
      : Promise.resolve({ data: [], error: null }),
    payableIds.length
      ? db.from('payables')
        .select('id,status,net_cents,currency,reconciliation_state,settled_at,version')
        .eq('tenant_id', tenantId)
        .in('id', payableIds)
      : Promise.resolve({ data: [], error: null }),
    payoutIds.length
      ? db.from('payout_approvals')
        .select('payout_item_id,decision,approval_role,actor_profile_id,payout_item_version,reason_code,created_at')
        .eq('tenant_id', tenantId)
        .in('payout_item_id', payoutIds)
        .order('created_at', { ascending: false })
        .limit(MAX_PAGE * 3)
      : Promise.resolve({ data: [], error: null }),
    payoutIds.length
      ? db.from('finance_integration_commands')
        .select('id,provider,command_type,aggregate_id,status,attempt_count,next_attempt_at,claimed_at,last_safe_error_code,correlation_id,created_at,updated_at')
        .eq('tenant_id', tenantId)
        .eq('provider', 'mercury')
        .eq('aggregate_type', 'payout_item')
        .in('aggregate_id', payoutIds)
        .order('created_at', { ascending: false })
        .limit(MAX_PAGE * 3)
      : Promise.resolve({ data: [], error: null }),
    payoutIds.length
      ? db.from('contractor_payout_settlement_evidence')
        .select('payout_item_id,payable_id,provider_transaction_id,amount_cents,currency,created_at')
        .eq('tenant_id', tenantId)
        .in('payout_item_id', payoutIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [batchResult, payableResult, approvalResult, commandResult, settlementResult]) {
    if (result.error) throw result.error;
  }
  const batches = new Map((batchResult.data || []).map((row) => [row.id, row]));
  const payables = new Map((payableResult.data || []).map((row) => [row.id, row]));
  const approvals = new Map(payoutIds.map((id) => [id, []]));
  const commands = new Map(payoutIds.map((id) => [id, []]));
  const settlementEvidence = new Map((settlementResult.data || []).map((row) => [row.payout_item_id, row]));
  for (const approval of approvalResult.data || []) approvals.get(approval.payout_item_id)?.push(approval);
  for (const command of commandResult.data || []) commands.get(command.aggregate_id)?.push(command);
  return rows.map((row) => payoutView(row, {
    batch: batches.get(row.payout_batch_id),
    payable: payables.get(row.payable_id),
    approvals: approvals.get(row.id) || [],
    commands: commands.get(row.id) || [],
    settlementEvidence: settlementEvidence.get(row.id) || null,
  }));
}

function safeProviderState() {
  const mercury = financeAdapterHealth().mercury;
  return {
    state: mercury.state,
    live: mercury.live,
    sendMode: mercury.sendMode,
    action: mercury.action,
    networkCallFromThisApi: false,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const authed = await requireFinanceActor(req, res, {
        allowedFinanceRoles: ['finance_maker', 'finance_checker', 'finance_executor', 'accountant_controller', 'security_auditor'],
      });
      if (!authed) return;
      const limit = boundedLimit(req.query?.limit);
      let query = authed.db.from('payout_items')
        .select('id,payout_batch_id,payable_id,payable_version,payee_profile_version,provider,status,amount_cents,currency,destination_masked_label,maker_prepared_by,maker_prepared_at,checker_approved_by,checker_approved_at,provider_transaction_id,provider_observed_at,last_provider_success_at,reconciliation_state,version,created_at,updated_at')
        .eq('tenant_id', authed.tenantId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);
      if (req.query?.status) query = query.eq('status', String(req.query.status).trim().toUpperCase());
      if (req.query?.payableId) query = query.eq('payable_id', cleanUuid(req.query.payableId, 'payableId'));
      if (req.query?.cursor) query = query.lt('created_at', String(req.query.cursor));
      const result = await query;
      if (result.error) throw result.error;
      const hasMore = (result.data || []).length > limit;
      const rows = (result.data || []).slice(0, limit);
      const payouts = await loadPayouts(authed.db, authed.tenantId, rows);
      const flags = payOpsFlags();
      return res.status(200).json({
        payouts,
        pagination: {
          hasMore,
          nextCursor: hasMore ? rows[rows.length - 1]?.created_at || null : null,
        },
        capabilities: {
          enabled: flags.payOps,
          prepare: flags.payOps && authed.financeRoles.includes('finance_maker'),
          approve: flags.payOps && authed.financeRoles.includes('finance_checker'),
          queueCommand: flags.payOps
            && flags.mercurySendMode === 'approval_queue'
            && authed.financeRoles.includes('finance_executor'),
          reconcileSettlement: flags.payOps
            && flags.mercurySendMode === 'approval_queue'
            && authed.financeRoles.includes('accountant_controller'),
          providerDispatch: false,
          markSettled: false,
          settlementEvidenceOnly: true,
          actorProfileId: authed.user.id,
          roles: authed.financeRoles,
        },
        provider: safeProviderState(),
      });
    }

    if (req.method === 'POST') {
      const authed = await requireFinanceActor(req, res, {
        allowedFinanceRoles: ['finance_maker'],
        requireAal2: true,
      });
      if (!authed) return;
      const flags = payOpsFlags();
      if (!flags.payOps) {
        throw new PayOpsError('Avalon PayOps is disabled pending production gates.', 'avalon_payops_disabled', 503);
      }
      if (flags.mercurySendMode !== 'approval_queue') {
        throw new PayOpsError('Contractor payouts require the controlled approval queue.', 'payout_approval_queue_required', 503);
      }
      const body = parseBody(req);
      assertFinanceSafe(body);
      const payableId = cleanUuid(body.payableId, 'payableId');
      const expectedPayableVersion = cleanExpectedVersion(body.expectedPayableVersion);
      const fundingAccountRef = cleanFundingAccountRef(body.fundingAccountRef);
      const fundingAccountMaskedLabel = cleanFundingAccountLabel(body.fundingAccountMaskedLabel);
      const idempotencyKey = cleanIdempotencyKey(req);
      const result = await authed.db.rpc('prepare_contractor_payout', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_payable_id: payableId,
        p_expected_payable_version: expectedPayableVersion,
        p_funding_account_ref: fundingAccountRef,
        p_funding_account_masked_label: fundingAccountMaskedLabel,
        p_idempotency_key: idempotencyKey,
      });
      if (result.error) throw payoutDbError(result.error);
      return res.status(201).json({
        payout: {
          id: result.data.id,
          payableId: result.data.payable_id,
          payoutBatchId: result.data.payout_batch_id,
          status: result.data.status,
          amountCents: exactCents(result.data.amount_cents, 'Payout amount'),
          currency: result.data.currency,
          destinationMaskedLabel: result.data.destination_masked_label,
          version: result.data.version,
        },
        providerNetworkCallMade: false,
        settlementRecorded: false,
        nextRequiredRole: 'finance_checker',
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return sendPayOpsError(res, payoutDbError(error), 'Contractor payouts are unavailable.');
  }
}
