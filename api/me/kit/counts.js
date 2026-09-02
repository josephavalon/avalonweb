import { loadConnectedNurseKit, requireConnectedInventory, requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { cleanCountLines, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanExpectedVersion, cleanIdempotencyKey, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireRole } from '../../_lib/supabase-auth.js';
import { NURSE_ROLES, resolveNurseProvider } from '../../_lib/nurse-workflow.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireRole(req, res, NURSE_ROLES);
  if (!authed) return;
  try {
    requireConnectedInventory();
    requireInventoryCanaryProfile(authed.user.id);
    const provider = await resolveNurseProvider(authed);
    if (!provider.active) throw new PayOpsError('An active provisioned RN/NP profile is required.', 'nurse_kit_provider_inactive', 403);
    const kit = await loadConnectedNurseKit(authed.db, authed.tenantId, authed.user.id);
    if (!kit.assigned || kit.assignment?.assignment_status !== 'accepted') throw new PayOpsError('Accept kit custody before counting.', 'nurse_kit_acceptance_required', 409);
    if (req.method === 'GET') {
      const active = kit.counts.find((count) => ['draft', 'in_progress'].includes(count.status));
      if (!active) return res.status(200).json({ status: 'EMPTY', count: null, lines: [] });
      const result = await authed.db.from('os_inventory_count_lines')
        .select('id,item_id,variant_id,lot_id,actual_quantity,scanned_identifier,counted_at')
        .eq('tenant_id', authed.tenantId).eq('count_session_id', active.id).order('id').limit(5000);
      if (result.error) throw result.error;
      return res.status(200).json({ status: 'AVAILABLE', count: active, lines: result.data || [] });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    requireConnectedInventoryWrite();
    const body = parseJsonBody(req);
    const action = String(body.action || '').trim();
    const key = cleanIdempotencyKey(req);
    let record;
    if (action === 'start') {
      const reason = String(body.reasonCode || '').trim().toLowerCase();
      if (!['scheduled', 'handoff', 'return', 'variance', 'recall', 'admin_requested'].includes(reason)) throw new PayOpsError('Count reason is invalid.', 'inventory_count_reason_invalid', 400);
      record = await rpc(authed.db, 'start_inventory_count', { p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id, p_location_id: kit.assignment.location_id, p_reason: reason, p_idempotency_key: key });
    } else if (action === 'submit') {
      record = await rpc(authed.db, 'submit_inventory_count', {
        p_tenant_id: authed.tenantId,
        p_actor_profile_id: authed.user.id,
        p_count_session_id: cleanUuid(body.countSessionId, 'countSessionId'),
        p_expected_version: cleanExpectedVersion(body.expectedVersion),
        p_lines: cleanCountLines(body.lines),
        p_idempotency_key: key,
      });
    } else throw new PayOpsError('Count action is invalid.', 'inventory_count_action_invalid', 400);
    return res.status(201).json({ ok: true, action, record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Kit count could not be updated.');
  }
}
