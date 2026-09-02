import { requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanExpectedVersion, cleanIdempotencyKey, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventoryWrite();
    requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req);
    if (body.action !== 'assign_custody') throw new PayOpsError('Kit action is invalid.', 'inventory_kit_action_invalid', 400);
    const record = await rpc(authed.db, 'assign_connected_kit_custody', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_kit_id: cleanUuid(body.kitId, 'kitId'),
      p_nurse_profile_id: cleanUuid(body.nurseProfileId, 'nurseProfileId'),
      p_expected_kit_version: cleanExpectedVersion(body.expectedKitVersion),
      p_idempotency_key: cleanIdempotencyKey(req),
    });
    return res.status(201).json({ ok: true, record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Kit custody could not be assigned.');
  }
}
