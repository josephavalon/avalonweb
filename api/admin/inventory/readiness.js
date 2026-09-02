import { requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanIdempotencyKey, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventoryWrite(); requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req);
    if (body.action !== 'evaluate') throw new PayOpsError('Readiness action is invalid.', 'inventory_readiness_action_invalid', 400);
    const ttlMinutes = Number(body.ttlMinutes || 30);
    if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 240) throw new PayOpsError('Readiness expiry is invalid.', 'inventory_readiness_ttl_invalid', 400);
    const record = await rpc(authed.db, 'evaluate_connected_shift_readiness', {
      p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
      p_shift_id: cleanUuid(body.shiftId, 'shiftId'), p_kit_id: cleanUuid(body.kitId, 'kitId'),
      p_evaluator_version: 'connected-readiness-v1', p_ttl_minutes: ttlMinutes,
      p_idempotency_key: cleanIdempotencyKey(req),
    });
    return res.status(201).json({ ok: true, action: 'evaluate', record });
  } catch (error) { return sendConnectedInventoryError(res, error, 'Shift readiness could not be evaluated.'); }
}
