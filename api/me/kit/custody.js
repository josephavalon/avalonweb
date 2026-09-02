import { loadConnectedNurseKit, requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanExpectedVersion, cleanIdempotencyKey, cleanReasonCode, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireRole } from '../../_lib/supabase-auth.js';
import { NURSE_ROLES, resolveNurseProvider } from '../../_lib/nurse-workflow.js';

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
    const body = parseJsonBody(req);
    const action = String(body.action || '').trim();
    const common = {
      p_tenant_id: authed.tenantId,
      p_nurse_profile_id: authed.user.id,
      p_kit_id: cleanUuid(body.kitId, 'kitId'),
      p_expected_version: cleanExpectedVersion(body.expectedVersion),
      p_idempotency_key: cleanIdempotencyKey(req),
    };
    let record;
    if (action === 'accept') record = await rpc(authed.db, 'accept_connected_kit_custody', common);
    else if (action === 'dispute') record = await rpc(authed.db, 'dispute_connected_kit_custody', { ...common, p_reason_code: cleanReasonCode(body.reasonCode) });
    else if (action === 'request_return') record = await rpc(authed.db, 'request_connected_kit_return', { ...common, p_reason_code: cleanReasonCode(body.reasonCode) });
    else if (action === 'report_lost') record = await rpc(authed.db, 'report_connected_kit_lost', { ...common, p_reason_code: cleanReasonCode(body.reasonCode) });
    else throw new PayOpsError('Custody action is invalid.', 'kit_custody_action_invalid', 400);
    const kit = await loadConnectedNurseKit(authed.db, authed.tenantId, authed.user.id);
    return res.status(201).json({ ok: true, action, record, kit });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Kit custody could not be updated.');
  }
}
