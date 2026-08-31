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
} from '../../../_lib/payops-core.js';

const SETTLEMENT_ERRORS = Object.freeze({
  contractor_settlement_request_invalid: ['Settlement evidence details are invalid.', 400],
  payout_item_not_found: ['Payout not found.', 404],
  payout_settlement_version_or_state_conflict: ['The payout changed or is not ready for reconciliation.', 409],
  payout_settlement_aggregate_mismatch: ['The payout, payable, or batch no longer matches.', 409],
  successful_mercury_command_required: ['A successful immutable Mercury command is required.', 409],
  independent_settlement_controller_required: ['A separate accountant/controller must reconcile settlement.', 403],
  terminal_mercury_settlement_evidence_required: ['A processed, signed terminal Mercury event is required.', 409],
  mercury_settlement_evidence_already_used: ['That Mercury settlement evidence is already allocated.', 409],
  posted_bank_settlement_evidence_mismatch: ['The posted bank item does not exactly match this payout.', 409],
  bank_statement_capacity_exhausted: ['That bank item is already allocated.', 409],
  canonical_payout_settlement_evidence_required: ['Canonical settlement evidence is incomplete.', 409],
  canonical_payable_settlement_evidence_required: ['Canonical payable evidence is incomplete.', 409],
  payable_settlement_version_or_state_conflict: ['The linked payable changed during reconciliation.', 409],
  payout_batch_settlement_state_conflict: ['The payout batch changed during reconciliation.', 409],
});
const SETTLEMENT_BODY_KEYS = new Set([
  'expectedVersion',
  'financeIntegrationEventId',
  'bankStatementItemId',
  'reasonCode',
]);

function settlementError(error) {
  const normalized = normalizePayOpsDbError(error);
  if (normalized instanceof PayOpsError) return normalized;
  const raw = String(error?.message || error?.details || error?.hint || '').toLowerCase();
  const code = Object.keys(SETTLEMENT_ERRORS).find((candidate) => raw.includes(candidate));
  if (!code) return normalized;
  const [message, status] = SETTLEMENT_ERRORS[code];
  return new PayOpsError(message, code, status);
}

function parseBody(req) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new PayOpsError('The request body must be an object.', 'invalid_json', 400);
    }
    assertFinanceSafe(body);
    if ('status' in body || 'targetStatus' in body || 'paid' in body || 'settled' in body) {
      throw new PayOpsError('Direct payout status is not accepted.', 'direct_payout_status_forbidden', 400);
    }
    if (Object.keys(body).some((key) => !SETTLEMENT_BODY_KEYS.has(key))) {
      throw new PayOpsError('Only settlement evidence references are accepted.', 'settlement_body_field_forbidden', 400);
    }
    return body;
  } catch (error) {
    if (error instanceof PayOpsError) throw error;
    throw new PayOpsError('The request body must be valid JSON.', 'invalid_json', 400);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const authed = await requireFinanceActor(req, res, {
      allowedFinanceRoles: ['accountant_controller'],
      requireAal2: true,
    });
    if (!authed) return;
    const flags = payOpsFlags();
    if (!flags.payOps) {
      throw new PayOpsError('Avalon PayOps is disabled pending production gates.', 'avalon_payops_disabled', 503);
    }
    if (flags.mercurySendMode !== 'approval_queue') {
      throw new PayOpsError('Settlement reconciliation requires the controlled approval queue.', 'payout_approval_queue_required', 503);
    }

    const body = parseBody(req);
    const payoutItemId = cleanUuid(req.query?.id, 'payoutItemId');
    const expectedVersion = cleanExpectedVersion(body.expectedVersion);
    const financeIntegrationEventId = cleanUuid(body.financeIntegrationEventId, 'financeIntegrationEventId');
    const bankStatementItemId = cleanUuid(body.bankStatementItemId, 'bankStatementItemId');
    const reasonCode = cleanReasonCode(body.reasonCode);
    const idempotencyKey = cleanIdempotencyKey(req);

    const result = await authed.db.rpc('reconcile_contractor_payout_settlement', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_payout_item_id: payoutItemId,
      p_expected_version: expectedVersion,
      p_finance_integration_event_id: financeIntegrationEventId,
      p_bank_statement_item_id: bankStatementItemId,
      p_reason_code: reasonCode,
      p_idempotency_key: idempotencyKey,
    });
    if (result.error) throw settlementError(result.error);
    if (result.data?.id !== payoutItemId) {
      throw new PayOpsError('Settlement response did not match the requested payout.', 'payout_settlement_scope_mismatch', 409);
    }

    return res.status(200).json({
      payout: {
        id: result.data.id,
        payableId: result.data.payable_id,
        status: result.data.status,
        amountCents: String(result.data.amount_cents),
        currency: result.data.currency,
        reconciliationState: result.data.reconciliation_state,
        providerObservedAt: result.data.provider_observed_at,
        lastProviderSuccessAt: result.data.last_provider_success_at,
        version: result.data.version,
      },
      evidenceMatched: result.data.reconciliation_state === 'MATCHED',
      providerNetworkCallMade: false,
      providerEvidenceCreated: false,
      bankEvidenceCreated: false,
      directStatusAccepted: false,
    });
  } catch (error) {
    return sendPayOpsError(res, settlementError(error), 'The payout could not be reconciled.');
  }
}
