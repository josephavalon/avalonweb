import { sendPayOpsError } from '../../../_lib/payops-core.js';
import {
  idempotencyKey, normalizeVendorApError, parseVendorBody, reason,
  mercuryProviderAccountId, requireVendorActor, requireVendorApEnabled, shapeRpcResult,
  uuid, version,
} from '../../../_lib/vendor-ap.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = parseVendorBody(req);
    const stage = String(body.stage || 'maker').trim().toLowerCase();
    const role = stage === 'checker' ? 'finance_checker' : 'finance_maker';
    const authed = await requireVendorActor(req, res, [role], { aal2: true });
    if (!authed) return;
    requireVendorApEnabled();
    const billId = uuid(req.query?.id, 'billId');
    const key = idempotencyKey(req);

    if (stage === 'maker') {
      const result = await authed.db.rpc('maker_approve_vendor_bill', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_vendor_bill_id: billId,
        p_expected_bill_version: version(body.expectedVersion),
        p_funding_account_ref: mercuryProviderAccountId(body.fundingAccountRef),
        p_funding_account_masked_label: String(body.fundingAccountMaskedLabel || '').trim(),
        p_reason_code: reason(body.reasonCode),
        p_idempotency_key: key,
      });
      if (result.error) throw result.error;
      if (result.data.vendor_bill_id !== billId) throw new Error('paymentId does not belong to this bill.');
      return res.status(201).json({ payment: shapeRpcResult('payment', result.data) });
    }

    if (stage === 'checker') {
      const result = await authed.db.rpc('checker_approve_vendor_payment', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_vendor_bill_id: billId,
        p_vendor_payment_id: uuid(body.paymentId, 'paymentId'),
        p_expected_payment_version: version(body.expectedVersion),
        p_reason_code: reason(body.reasonCode),
        p_idempotency_key: key,
      });
      if (result.error) throw result.error;
      if (result.data.vendor_bill_id !== billId) throw new Error('paymentId does not belong to this bill.');
      return res.status(200).json({ payment: shapeRpcResult('payment', result.data) });
    }

    throw new Error('Approval stage is invalid.');
  } catch (error) {
    return sendPayOpsError(res, normalizeVendorApError(error), 'The vendor approval could not be completed.');
  }
}
