import { requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { operationInput, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanIdempotencyKey, cleanReasonCode, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res);
  if (!authed) return;
  try {
    requireConnectedInventoryWrite();
    requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req);
    const action = String(body.action || '').trim();
    const key = cleanIdempotencyKey(req);
    let record;
    if (action === 'start') {
      const reason = String(body.reasonCode || '').trim().toLowerCase();
      if (!['scheduled', 'handoff', 'return', 'variance', 'recall', 'admin_requested'].includes(reason)) throw new PayOpsError('Count reason is invalid.', 'inventory_count_reason_invalid', 400);
      record = await rpc(authed.db, 'start_inventory_count', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_location_id: cleanUuid(body.locationId, 'locationId'),
        p_reason: reason,
        p_idempotency_key: key,
      });
    } else if (action === 'review') {
      const input = operationInput(req, body);
      const decision = String(body.decision || '').trim().toLowerCase();
      if (!['approve', 'reject'].includes(decision)) throw new PayOpsError('Decision is invalid.', 'inventory_count_decision_invalid', 400);
      record = await rpc(authed.db, 'review_inventory_count', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_count_session_id: cleanUuid(body.countSessionId, 'countSessionId'),
        p_expected_version: input.expectedVersion,
        p_decision: decision,
        p_reason_code: input.reasonCode || cleanReasonCode('COUNT_REVIEW'),
        p_idempotency_key: key,
      });
    } else {
      throw new PayOpsError('Count action is invalid.', 'inventory_count_action_invalid', 400);
    }
    return res.status(201).json({ ok: true, action, record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Inventory count could not be updated.');
  }
}
