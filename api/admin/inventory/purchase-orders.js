import { requireConnectedInventory, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { assertInventoryEvidenceSafe, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanExpectedVersion, cleanIdempotencyKey, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res);
  if (!authed) return;
  try {
    requireConnectedInventory('manualProcurement');
    requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req);
    const action = String(body.action || '').trim();
    const common = {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_purchase_order_id: cleanUuid(body.purchaseOrderId, 'purchaseOrderId'),
      p_expected_version: cleanExpectedVersion(body.expectedVersion),
      p_idempotency_key: cleanIdempotencyKey(req),
    };
    let record;
    if (action === 'submit') {
      record = await rpc(authed.db, 'submit_inventory_purchase_order', { ...common, p_ship_to_location_id: cleanUuid(body.shipToLocationId, 'shipToLocationId') });
    } else if (action === 'approve') {
      const hash = String(body.expectedPayloadHash || '').trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(hash)) throw new PayOpsError('Expected payload hash is invalid.', 'inventory_po_hash_invalid', 400);
      record = await rpc(authed.db, 'approve_inventory_purchase_order', { ...common, p_expected_payload_hash: hash });
    } else if (action === 'record_event') {
      const evidence = body.evidence && typeof body.evidence === 'object' && !Array.isArray(body.evidence) ? body.evidence : {};
      assertInventoryEvidenceSafe(evidence);
      record = await rpc(authed.db, 'record_manual_purchase_order_event', {
        ...common,
        p_event_type: String(body.eventType || '').trim().toLowerCase(),
        p_external_order_id: body.externalOrderId ? String(body.externalOrderId).trim().slice(0, 180) : null,
        p_evidence: evidence,
      });
    } else throw new PayOpsError('Purchase order action is invalid.', 'inventory_po_action_invalid', 400);
    return res.status(201).json({ ok: true, action, record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Purchase order could not be updated.');
  }
}
