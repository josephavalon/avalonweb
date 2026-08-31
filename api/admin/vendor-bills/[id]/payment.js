import { sendPayOpsError } from '../../../_lib/payops-core.js';
import {
  idempotencyKey, normalizeVendorApError, optionalUuid,
  parseVendorBody, reason, requireVendorActor, requireVendorApEnabled,
  safeRef, shapeRpcResult, uuid, version,
} from '../../../_lib/vendor-ap.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = parseVendorBody(req);
    const action = String(body.action || '').trim().toLowerCase();
    const role = action === 'settle' ? 'accountant_controller' : 'finance_executor';
    const authed = await requireVendorActor(req, res, [role], { aal2: true });
    if (!authed) return;
    requireVendorApEnabled();
    const billId = uuid(req.query?.id, 'billId');
    const paymentId = uuid(body.paymentId, 'paymentId');

    if (action === 'queue') {
      const result = await authed.db.rpc('queue_vendor_payment_command', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_vendor_bill_id: billId,
        p_vendor_payment_id: paymentId,
        p_expected_payment_version: version(body.expectedVersion),
        p_reason_code: reason(body.reasonCode),
        p_idempotency_key: idempotencyKey(req),
      });
      if (result.error) throw result.error;
      if (result.data.safe_payload?.vendor_bill_id !== billId) throw new Error('paymentId does not belong to this bill.');
      return res.status(202).json({
        command: {
          id: result.data.id,
          vendorPaymentId: result.data.aggregate_id,
          provider: result.data.provider,
          status: result.data.status,
          queuedOnly: true,
        },
      });
    }

    if (action === 'settle') {
      const evidenceSource = String(body.evidenceSource || '').trim().toUpperCase();
      if (!['PROVIDER_CONFIRMED', 'CONTROLLED_MANUAL'].includes(evidenceSource)) throw new Error('evidenceSource is invalid.');
      const result = await authed.db.rpc('settle_vendor_payment', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_vendor_bill_id: billId,
        p_vendor_payment_id: paymentId,
        p_expected_payment_version: version(body.expectedVersion),
        p_evidence_source: evidenceSource,
        p_finance_integration_event_id: optionalUuid(body.financeIntegrationEventId, 'financeIntegrationEventId'),
        p_bank_statement_item_id: uuid(body.bankStatementItemId, 'bankStatementItemId'),
        p_provider_transaction_id: safeRef(body.providerTransactionId, 'providerTransactionId'),
        p_evidence_ref: safeRef(body.evidenceRef, 'evidenceRef'),
        p_reason_code: reason(body.reasonCode),
        p_idempotency_key: idempotencyKey(req),
      });
      if (result.error) throw result.error;
      if (result.data.vendor_bill_id !== billId) throw new Error('paymentId does not belong to this bill.');
      return res.status(200).json({ payment: shapeRpcResult('payment', result.data) });
    }

    throw new Error('Payment action is invalid.');
  } catch (error) {
    return sendPayOpsError(res, normalizeVendorApError(error), 'The vendor payment action could not be completed.');
  }
}
