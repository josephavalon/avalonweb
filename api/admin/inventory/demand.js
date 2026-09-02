import { requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanExpectedVersion, cleanIdempotencyKey, cleanReasonCode, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

const ACTIONS = new Set(['triage', 'approve', 'partial', 'deny', 'cancel', 'await_purchase', 'close']);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventoryWrite(); requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req); const action = String(body.action || '').trim().toLowerCase();
    if (!ACTIONS.has(action)) throw new PayOpsError('Demand action is invalid.', 'inventory_demand_action_invalid', 400);
    const record = await rpc(authed.db, 'transition_inventory_demand', {
      p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
      p_demand_episode_id: cleanUuid(body.demandEpisodeId, 'demandEpisodeId'), p_action: action,
      p_expected_version: cleanExpectedVersion(body.expectedVersion), p_reason_code: cleanReasonCode(body.reasonCode),
      p_idempotency_key: cleanIdempotencyKey(req),
    });
    return res.status(201).json({ ok: true, action, record });
  } catch (error) { return sendConnectedInventoryError(res, error, 'Demand could not be updated.'); }
}
