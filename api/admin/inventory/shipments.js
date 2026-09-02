import { requireConnectedInventory, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { assertInventoryEvidenceSafe, cleanQuantity, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanExpectedVersion, cleanIdempotencyKey, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

function cleanLines(lines) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 100) throw new PayOpsError('Shipment lines are invalid.', 'inventory_shipment_lines_invalid', 400);
  return lines.map((line) => ({ purchaseOrderLineId: cleanUuid(line?.purchaseOrderLineId, 'purchaseOrderLineId'), quantityShipped: cleanQuantity(line?.quantityShipped, 'quantityShipped') }));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventory('manualProcurement'); requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req);
    if (body.action !== 'record_shipment') throw new PayOpsError('Shipment action is invalid.', 'inventory_shipment_action_invalid', 400);
    const evidence = body.evidence && typeof body.evidence === 'object' && !Array.isArray(body.evidence) ? body.evidence : {};
    assertInventoryEvidenceSafe(evidence);
    const expectedAt = body.expectedAt ? new Date(body.expectedAt) : null;
    if (expectedAt && !Number.isFinite(expectedAt.getTime())) throw new PayOpsError('Expected date is invalid.', 'inventory_shipment_date_invalid', 400);
    const record = await rpc(authed.db, 'record_inventory_shipment', {
      p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
      p_purchase_order_id: cleanUuid(body.purchaseOrderId, 'purchaseOrderId'),
      p_shipment_reference: String(body.shipmentReference || '').trim().slice(0, 180),
      p_carrier_code: body.carrierCode ? String(body.carrierCode).trim().slice(0, 80) : null,
      p_tracking_reference: body.trackingReference ? String(body.trackingReference).trim().slice(0, 180) : null,
      p_expected_at: expectedAt?.toISOString() || null, p_lines: cleanLines(body.lines), p_evidence: evidence,
      p_expected_po_version: cleanExpectedVersion(body.expectedVersion), p_idempotency_key: cleanIdempotencyKey(req),
    });
    return res.status(201).json({ ok: true, action: 'record_shipment', record });
  } catch (error) { return sendConnectedInventoryError(res, error, 'Shipment could not be recorded.'); }
}
