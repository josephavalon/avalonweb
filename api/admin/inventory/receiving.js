import { requireConnectedInventory, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { assertInventoryEvidenceSafe, cleanQuantity, optionalUuid, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanExpectedVersion, cleanIdempotencyKey, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

function cleanLines(lines) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 100) throw new PayOpsError('Receiving lines are invalid.', 'inventory_receiving_lines_invalid', 400);
  return lines.map((line) => {
    const evidence = line?.evidence && typeof line.evidence === 'object' && !Array.isArray(line.evidence) ? line.evidence : {};
    assertInventoryEvidenceSafe(evidence);
    return {
      purchaseOrderLineId: cleanUuid(line?.purchaseOrderLineId, 'purchaseOrderLineId'),
      lotId: optionalUuid(line?.lotId, 'lotId'),
      quantityReceived: cleanQuantity(line?.quantityReceived, 'quantityReceived', { allowZero: true }),
      quantityAccepted: cleanQuantity(line?.quantityAccepted, 'quantityAccepted', { allowZero: true }),
      disposition: String(line?.disposition || '').trim().toLowerCase(),
      varianceCode: line?.varianceCode ? String(line.varianceCode).trim().toUpperCase().slice(0, 100) : null,
      evidence,
    };
  });
}

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
    const key = cleanIdempotencyKey(req);
    let record;
    if (action === 'create_inspection') {
      const temperatureEvidence = body.temperatureEvidence && typeof body.temperatureEvidence === 'object' && !Array.isArray(body.temperatureEvidence) ? body.temperatureEvidence : {};
      assertInventoryEvidenceSafe(temperatureEvidence);
      record = await rpc(authed.db, 'create_inventory_receiving_inspection', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_purchase_order_id: cleanUuid(body.purchaseOrderId, 'purchaseOrderId'),
        p_location_id: cleanUuid(body.locationId, 'locationId'),
        p_lines: cleanLines(body.lines),
        p_condition_code: body.conditionCode ? String(body.conditionCode).trim().toUpperCase().slice(0, 100) : null,
        p_temperature_evidence: temperatureEvidence,
        p_idempotency_key: key,
      });
    } else if (action === 'post_inspection') {
      record = await rpc(authed.db, 'post_inventory_receiving_inspection', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_inspection_id: cleanUuid(body.inspectionId, 'inspectionId'),
        p_expected_version: cleanExpectedVersion(body.expectedVersion),
        p_idempotency_key: key,
      });
    } else throw new PayOpsError('Receiving action is invalid.', 'inventory_receiving_action_invalid', 400);
    return res.status(201).json({ ok: true, action, record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Receiving could not be updated.');
  }
}
