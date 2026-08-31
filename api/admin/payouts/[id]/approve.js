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

const PAYOUT_APPROVAL_ERRORS = Object.freeze({
  payout_approval_request_invalid: ['The payout approval request is invalid.', 400],
  payout_item_not_found: ['Payout not found.', 404],
  payout_item_version_or_state_conflict: ['The payout changed. Refresh and review it again.', 409],
  payout_batch_version_or_state_conflict: ['The payout batch changed. Refresh and review it again.', 409],
  payout_maker_checker_required: ['A payout maker cannot approve the same payout as checker.', 403],
  payout_approval_snapshot_changed: ['Amount, destination, tax, or contractor authority changed. Prepare a new review.', 409],
});

function approvalError(error) {
  const normalized = normalizePayOpsDbError(error);
  if (normalized instanceof PayOpsError) return normalized;
  const raw = String(error?.message || error?.details || error?.hint || '').toLowerCase();
  const code = Object.keys(PAYOUT_APPROVAL_ERRORS).find((candidate) => raw.includes(candidate));
  if (!code) return normalized;
  const [message, status] = PAYOUT_APPROVAL_ERRORS[code];
  return new PayOpsError(message, code, status);
}

function parseBody(req) {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
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
      allowedFinanceRoles: ['finance_checker'],
      requireAal2: true,
    });
    if (!authed) return;
    if (!payOpsFlags().payOps) {
      throw new PayOpsError('Avalon PayOps is disabled pending production gates.', 'avalon_payops_disabled', 503);
    }
    const body = parseBody(req);
    assertFinanceSafe(body);
    const payoutItemId = cleanUuid(req.query?.id, 'payoutItemId');
    const expectedVersion = cleanExpectedVersion(body.expectedVersion);
    const reasonCode = cleanReasonCode(body.reasonCode);
    const idempotencyKey = cleanIdempotencyKey(req);
    const result = await authed.db.rpc('approve_contractor_payout', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_payout_item_id: payoutItemId,
      p_expected_version: expectedVersion,
      p_reason_code: reasonCode,
      p_idempotency_key: idempotencyKey,
    });
    if (result.error) throw approvalError(result.error);
    return res.status(200).json({
      payout: {
        id: result.data.id,
        payableId: result.data.payable_id,
        payoutBatchId: result.data.payout_batch_id,
        status: result.data.status,
        amountCents: String(result.data.amount_cents),
        currency: result.data.currency,
        checkerApprovedAt: result.data.checker_approved_at,
        version: result.data.version,
      },
      providerNetworkCallMade: false,
      settlementRecorded: false,
      nextRequiredRole: 'finance_executor',
    });
  } catch (error) {
    return sendPayOpsError(res, approvalError(error), 'The payout could not be approved.');
  }
}
