import { sendPayOpsError } from '../../../_lib/payops-core.js';
import {
  idempotencyKey, normalizeVendorApError, parseVendorBody, reason,
  requireVendorActor, requireVendorApEnabled, shapeRpcResult, uuid, version,
} from '../../../_lib/vendor-ap.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const authed = await requireVendorActor(req, res, ['finance_checker'], { aal2: true });
    if (!authed) return;
    requireVendorApEnabled();
    const body = parseVendorBody(req);
    const result = await authed.db.rpc('cancel_vendor_bill', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_vendor_bill_id: uuid(req.query?.id, 'billId'),
      p_expected_bill_version: version(body.expectedVersion),
      p_reason_code: reason(body.reasonCode),
      p_idempotency_key: idempotencyKey(req),
    });
    if (result.error) throw result.error;
    return res.status(200).json({ bill: shapeRpcResult('bill', result.data) });
  } catch (error) {
    return sendPayOpsError(res, normalizeVendorApError(error), 'The vendor bill could not be cancelled.');
  }
}
