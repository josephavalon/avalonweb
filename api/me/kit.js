import { writeAuditEvent } from '../_lib/audit-events.js';
import { cleanIdempotencyKey, cleanUuid, normalizePayOpsDbError, PayOpsError, sendPayOpsError } from '../_lib/payops-core.js';
import { loadNurseKit } from '../_lib/shared-inventory.js';
import { connectedInventoryFlags, inventoryCanaryProfileAllowed, loadConnectedNurseKit } from '../_lib/connected-inventory.js';
import { requireRole } from '../_lib/supabase-auth.js';
import { NURSE_ROLES, resolveNurseProvider } from '../_lib/nurse-workflow.js';

const MOVEMENT_REASONS = Object.freeze({
  consume: new Set(['SHIFT_USE', 'TRAINING_USE', 'ADMIN_AUTHORIZED']),
  expire: new Set(['EXPIRED_REMOVAL']),
  shrink: new Set(['DAMAGED', 'MISSING']),
});
const RESTOCK_REASONS = new Set(['BELOW_PAR', 'UPCOMING_SHIFT', 'EXPIRED_REMOVAL', 'DAMAGED', 'COUNT_VARIANCE']);

function parseBody(req) {
  try { return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}; }
  catch { throw new PayOpsError('Request body must be valid JSON.', 'invalid_json', 400); }
}

function optionalUuid(value, field) {
  return value ? cleanUuid(value, field) : null;
}

function quantity(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,3})?$/.test(raw) || Number(raw) <= 0) {
    throw new PayOpsError('Quantity is invalid.', 'kit_quantity_invalid', 400);
  }
  return raw;
}

function cleanRestockLines(lines) {
  if (!Array.isArray(lines) || lines.length !== 1) {
    throw new PayOpsError('Request one kit item at a time so fulfillment stays tied to one exact transfer.', 'kit_restock_lines_invalid', 400);
  }
  return lines.map((line) => ({
    itemId: cleanUuid(line?.itemId, 'itemId'),
    variantId: optionalUuid(line?.variantId, 'variantId'),
    quantity: quantity(line?.quantity),
  }));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireRole(req, res, NURSE_ROLES);
  if (!authed) return;
  try {
    const provider = await resolveNurseProvider(authed);
    if (!provider.active) {
      throw new PayOpsError('An active nurse provider profile is required for kit access.', 'nurse_kit_provider_inactive', 403);
    }
    if (req.method === 'GET') {
      const kit = await loadNurseKit(authed.db, authed.tenantId, authed.user.id, provider.id);
      const flags = connectedInventoryFlags();
      const canaryAllowed = flags.connected && inventoryCanaryProfileAllowed(authed.user.id);
      if (canaryAllowed) kit.connected = await loadConnectedNurseKit(authed.db, authed.tenantId, authed.user.id);
      await writeAuditEvent(authed.db, {
        tenantId: authed.tenantId,
        actorProfileId: authed.user.id,
        action: 'nurse_kit_read',
        entityType: 'provider_profiles',
        entityId: provider.id,
        phiTouched: false,
        payload: { assigned: kit.assigned, itemLineCount: kit.items.length },
      });
      return res.status(200).json({ status: 'AVAILABLE', flags: { connectedInventory: canaryAllowed }, kit });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const body = parseBody(req);
    const key = cleanIdempotencyKey(req);
    const flags = connectedInventoryFlags();
    const canaryAllowed = flags.connected && inventoryCanaryProfileAllowed(authed.user.id);
    const current = await loadNurseKit(authed.db, authed.tenantId, authed.user.id, provider.id);
    if (!current.assigned || !current.location?.id) {
      throw new PayOpsError('An active nurse kit assignment is required.', 'nurse_kit_assignment_required', 409);
    }
    const action = String(body.action || '').trim();
    if (action === 'accept_assignment') {
      const result = await authed.db.rpc('accept_nurse_kit_assignment', {
        p_tenant_id: authed.tenantId,
        p_nurse_profile_id: authed.user.id,
        p_location_id: current.location.id,
      });
      if (result.error) throw normalizePayOpsDbError(result.error);
      const kit = await loadNurseKit(authed.db, authed.tenantId, authed.user.id, provider.id);
      return res.status(200).json({ ok: true, action, assignmentId: result.data.id, kit });
    }
    if (current.location.assignmentStatus !== 'accepted') {
      throw new PayOpsError('Accept kit custody before recording use or requesting restock.', 'nurse_kit_acceptance_required', 409);
    }
    if (action === 'record_movement') {
      const movementType = String(body.movementType || '').trim().toLowerCase();
      const reasonCode = String(body.reasonCode || '').trim().toUpperCase();
      if (canaryAllowed && reasonCode === 'SHIFT_USE') {
        throw new PayOpsError(
          'Connected shift consumption must reconcile exact reserved kit stock at shift closeout.',
          'connected_inventory_reservation_reconciliation_required',
          409,
        );
      }
      if (!MOVEMENT_REASONS[movementType]?.has(reasonCode)) {
        throw new PayOpsError('Choose a valid structured kit reason.', 'nurse_kit_reason_invalid', 400);
      }
      const result = await authed.db.rpc('record_nurse_kit_movement', {
        p_tenant_id: authed.tenantId,
        p_nurse_profile_id: authed.user.id,
        p_location_id: current.location.id,
        p_item_id: cleanUuid(body.itemId, 'itemId'),
        p_variant_id: optionalUuid(body.variantId, 'variantId'),
        p_lot_id: optionalUuid(body.lotId, 'lotId'),
        p_movement_type: movementType,
        p_quantity: quantity(body.quantity),
        p_reason_code: reasonCode,
        p_idempotency_key: key,
      });
      if (result.error) throw normalizePayOpsDbError(result.error);
      const kit = await loadNurseKit(authed.db, authed.tenantId, authed.user.id, provider.id);
      return res.status(201).json({ ok: true, action, movementId: result.data.id, kit });
    }
    if (action === 'request_restock') {
      const reasonCode = String(body.reasonCode || '').trim().toUpperCase();
      if (!RESTOCK_REASONS.has(reasonCode)) {
        throw new PayOpsError('Choose a valid restock reason.', 'kit_restock_reason_invalid', 400);
      }
      const result = await authed.db.rpc('create_nurse_kit_restock_request', {
        p_tenant_id: authed.tenantId,
        p_nurse_profile_id: authed.user.id,
        p_location_id: current.location.id,
        p_reason_code: reasonCode,
        p_lines: cleanRestockLines(body.lines),
        p_idempotency_key: key,
      });
      if (result.error) throw normalizePayOpsDbError(result.error);
      const kit = await loadNurseKit(authed.db, authed.tenantId, authed.user.id, provider.id);
      return res.status(201).json({ ok: true, action, restockRequestId: result.data.id, kit });
    }
    throw new PayOpsError('Kit action is invalid.', 'nurse_kit_action_invalid', 400);
  } catch (error) {
    return sendPayOpsError(res, normalizePayOpsDbError(error), 'Your kit is unavailable.');
  }
}
