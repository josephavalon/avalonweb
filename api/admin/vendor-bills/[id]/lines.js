import { sendPayOpsError } from '../../../_lib/payops-core.js';
import {
  cents, idempotencyKey, normalizeVendorApError, optionalUuid,
  parseVendorBody, quantity, requireVendorActor, requireVendorApEnabled,
  safeCode, uuid, version,
} from '../../../_lib/vendor-ap.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const authed = await requireVendorActor(req, res, ['finance_maker'], { aal2: true });
    if (!authed) return;
    requireVendorApEnabled();
    const body = parseVendorBody(req);
    const lineType = String(body.lineType || '').trim().toUpperCase();
    if (!['INVENTORY', 'SERVICE', 'FEE', 'OTHER'].includes(lineType)) throw new Error('lineType is invalid.');
    const result = await authed.db.rpc('add_vendor_bill_line', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_vendor_bill_id: uuid(req.query?.id, 'billId'),
      p_expected_bill_version: version(body.expectedVersion),
      p_purchase_order_line_id: optionalUuid(body.purchaseOrderLineId, 'purchaseOrderLineId'),
      p_inventory_item_id: optionalUuid(body.inventoryItemId, 'inventoryItemId'),
      p_line_type: lineType,
      p_line_code: safeCode(body.lineCode, 'lineCode'),
      p_quantity: quantity(body.quantity),
      p_unit_amount_cents: cents(body.unitAmountCents, 'unitAmountCents'),
      p_amount_cents: cents(body.amountCents, 'amountCents', { positive: true }),
      p_idempotency_key: idempotencyKey(req),
    });
    if (result.error) throw result.error;
    return res.status(201).json({ line: result.data });
  } catch (error) {
    return sendPayOpsError(res, normalizeVendorApError(error), 'The vendor bill line could not be added.');
  }
}
