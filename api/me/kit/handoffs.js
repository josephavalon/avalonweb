import { requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanExpectedVersion, cleanIdempotencyKey, cleanReasonCode, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireRole } from '../../_lib/supabase-auth.js';
import { NURSE_ROLES, resolveNurseProvider } from '../../_lib/nurse-workflow.js';

const RESULTS = new Set(['accepted', 'short', 'damaged', 'wrong_item', 'wrong_lot', 'temperature_excursion', 'disputed']);

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
    const result = String(body.result || '').trim().toLowerCase();
    if (!RESULTS.has(result)) throw new PayOpsError('Handoff result is invalid.', 'inventory_handoff_result_invalid', 400);
    const record = await rpc(authed.db, 'receive_inventory_handoff', {
      p_tenant_id: authed.tenantId,
      p_nurse_profile_id: authed.user.id,
      p_handoff_id: cleanUuid(body.handoffId, 'handoffId'),
      p_expected_version: cleanExpectedVersion(body.expectedVersion),
      p_result: result,
      p_reason_code: result === 'accepted' ? null : cleanReasonCode(body.reasonCode || result),
      p_idempotency_key: cleanIdempotencyKey(req),
    });
    return res.status(201).json({ ok: true, record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Handoff receipt could not be recorded.');
  }
}
