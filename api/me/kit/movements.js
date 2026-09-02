import { loadConnectedNurseKit, requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { cleanQuantity, optionalUuid, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanIdempotencyKey, cleanReasonCode, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireRole } from '../../_lib/supabase-auth.js';
import { NURSE_ROLES, resolveNurseProvider } from '../../_lib/nurse-workflow.js';

const REASONS = Object.freeze({
  consume: new Set(['SHIFT_USE', 'TRAINING_USE', 'ADMIN_AUTHORIZED']),
  expire: new Set(['EXPIRED_REMOVAL']),
  shrink: new Set(['DAMAGED', 'MISSING']),
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireRole(req, res, NURSE_ROLES);
  if (!authed) return;
  try {
    requireConnectedInventoryWrite();
    requireInventoryCanaryProfile(authed.user.id);
    const provider = await resolveNurseProvider(authed);
    if (!provider.active) throw new PayOpsError('An active provisioned RN/NP profile is required.', 'nurse_kit_provider_inactive', 403);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const kit = await loadConnectedNurseKit(authed.db, authed.tenantId, authed.user.id);
    if (!kit.assigned || kit.assignment?.assignment_status !== 'accepted') throw new PayOpsError('Accept kit custody before recording stock movement.', 'nurse_kit_acceptance_required', 409);
    const body = parseJsonBody(req);
    const movementType = String(body.movementType || '').trim().toLowerCase();
    const reasonCode = cleanReasonCode(body.reasonCode);
    if (!REASONS[movementType]?.has(reasonCode)) throw new PayOpsError('Movement reason is invalid.', 'nurse_kit_reason_invalid', 400);
    if (reasonCode === 'SHIFT_USE') {
      throw new PayOpsError('Shift use must reconcile exact reservation IDs at closeout.', 'shift_inventory_reservation_reconciliation_required', 409);
    }
    const record = await rpc(authed.db, 'record_nurse_kit_movement', {
      p_tenant_id: authed.tenantId,
      p_nurse_profile_id: authed.user.id,
      p_location_id: kit.assignment.location_id,
      p_item_id: cleanUuid(body.itemId, 'itemId'),
      p_variant_id: optionalUuid(body.variantId, 'variantId'),
      p_lot_id: optionalUuid(body.lotId, 'lotId'),
      p_movement_type: movementType,
      p_quantity: cleanQuantity(body.quantity),
      p_reason_code: reasonCode,
      p_idempotency_key: cleanIdempotencyKey(req),
    });
    return res.status(201).json({ ok: true, record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Kit movement could not be recorded.');
  }
}
