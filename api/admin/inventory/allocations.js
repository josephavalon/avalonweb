import { requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { cleanQuantity, optionalUuid, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanExpectedVersion, cleanIdempotencyKey, cleanReasonCode, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventoryWrite(); requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req);
    const action = String(body.action || '').trim(); let record;
    if (action === 'allocate') {
      const expiresAt = new Date(body.expiresAt || '');
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) throw new PayOpsError('A future allocation expiry is required.', 'inventory_allocation_expiry_invalid', 400);
      record = await rpc(authed.db, 'allocate_inventory_demand', {
        p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
        p_demand_episode_id: cleanUuid(body.demandEpisodeId, 'demandEpisodeId'),
        p_source_location_id: cleanUuid(body.sourceLocationId, 'sourceLocationId'),
        p_lot_id: optionalUuid(body.lotId, 'lotId'), p_quantity: cleanQuantity(body.quantity),
        p_expires_at: expiresAt.toISOString(), p_expected_version: cleanExpectedVersion(body.expectedVersion),
        p_idempotency_key: cleanIdempotencyKey(req),
      });
    } else if (action === 'transition') {
      record = await rpc(authed.db, 'transition_inventory_allocation', {
        p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
        p_allocation_id: cleanUuid(body.allocationId, 'allocationId'), p_action: String(body.transition || '').trim().toLowerCase(),
        p_expected_version: cleanExpectedVersion(body.expectedVersion), p_handoff_id: optionalUuid(body.handoffId, 'handoffId'),
        p_reason_code: cleanReasonCode(body.reasonCode), p_idempotency_key: cleanIdempotencyKey(req),
      });
    } else throw new PayOpsError('Allocation action is invalid.', 'inventory_allocation_action_invalid', 400);
    return res.status(201).json({ ok: true, action, record });
  } catch (error) { return sendConnectedInventoryError(res, error, 'Demand could not be allocated.'); }
}
