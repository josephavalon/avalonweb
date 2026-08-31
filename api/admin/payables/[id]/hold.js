import {
  cleanExpectedVersion,
  cleanIdempotencyKey,
  cleanReasonCode,
  cleanUuid,
  normalizePayOpsDbError,
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
      allowedFinanceRoles: ['finance_maker', 'finance_checker'],
      requireAal2: true,
    });
    if (!authed) return;
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const payableId = cleanUuid(req.query?.id, 'payableId');
    const expectedVersion = cleanExpectedVersion(body.expectedVersion);
    const holdCode = cleanReasonCode(body.holdCode, 'holdCode');
    const ownerProfileId = cleanUuid(body.ownerProfileId || authed.user.id, 'ownerProfileId');
    const idempotencyKey = cleanIdempotencyKey(req);
    const result = await authed.db.rpc('set_contractor_payable_hold', {
      p_tenant_id: authed.tenantId,
      p_payable_id: payableId,
      p_expected_version: expectedVersion,
      p_actor_profile_id: authed.user.id,
      p_idempotency_key: idempotencyKey,
      p_hold_code: holdCode,
      p_owner_profile_id: ownerProfileId,
    });
    if (result.error) throw normalizePayOpsDbError(result.error);
    return res.status(200).json({
      payable: {
        id: result.data.id,
        status: result.data.status,
        holdCode: result.data.hold_code,
        holdOwnerProfileId: result.data.hold_owner_profile_id,
        version: result.data.version,
      },
    });
  } catch (error) {
    return sendPayOpsError(res, normalizePayOpsDbError(error), 'The payable could not be held.');
  }
}
