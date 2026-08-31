import {
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const authed = await requireFinanceActor(req, res, {
      allowedFinanceRoles: ['finance_maker'],
      requireAal2: true,
    });
    if (!authed) return;
    if (!payOpsFlags().payOps) {
      throw new PayOpsError('Avalon PayOps is disabled pending production gates.', 'avalon_payops_disabled', 503);
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const payableId = cleanUuid(req.query?.id, 'payableId');
    const expectedVersion = cleanExpectedVersion(body.expectedVersion);
    const reasonCode = cleanReasonCode(body.reasonCode);
    const idempotencyKey = cleanIdempotencyKey(req);
    const result = await authed.db.rpc('approve_contractor_payable', {
      p_tenant_id: authed.tenantId,
      p_payable_id: payableId,
      p_expected_version: expectedVersion,
      p_actor_profile_id: authed.user.id,
      p_idempotency_key: idempotencyKey,
      p_reason_code: reasonCode,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return res.status(200).json({
      payable: {
        id: result.data.id,
        status: result.data.status,
        grossCents: String(result.data.gross_cents),
        reimbursementCents: String(result.data.reimbursement_cents),
        netCents: String(result.data.net_cents),
        currency: result.data.currency,
        makerApprovedAt: result.data.maker_approved_at,
        reconciliationState: result.data.reconciliation_state,
        version: result.data.version,
      },
    });
  } catch (error) {
    return sendPayOpsError(res, normalizePayOpsDbError(error), 'The payable could not be approved.');
  }
}
