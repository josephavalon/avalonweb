import { loadConnectedNurseKit, requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { cleanRestockLines, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanIdempotencyKey, PayOpsError } from '../../_lib/payops-core.js';
import { requireRole } from '../../_lib/supabase-auth.js';
import { NURSE_ROLES, resolveNurseProvider } from '../../_lib/nurse-workflow.js';

const RESTOCK_REASONS = new Set(['BELOW_PAR', 'UPCOMING_SHIFT', 'EXPIRED_REMOVAL', 'DAMAGED', 'COUNT_VARIANCE']);

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
    if (!kit.assigned || kit.assignment?.assignment_status !== 'accepted') throw new PayOpsError('Accept kit custody before requesting restock.', 'nurse_kit_acceptance_required', 409);
    const body = parseJsonBody(req);
    const reason = String(body.reasonCode || '').trim().toUpperCase();
    if (!RESTOCK_REASONS.has(reason)) throw new PayOpsError('Restock reason is invalid.', 'kit_restock_reason_invalid', 400);
    const record = await rpc(authed.db, 'create_nurse_kit_restock_request', {
      p_tenant_id: authed.tenantId,
      p_nurse_profile_id: authed.user.id,
      p_location_id: kit.assignment.location_id,
      p_reason_code: reason,
      p_lines: cleanRestockLines(body.lines),
      p_idempotency_key: cleanIdempotencyKey(req),
    });
    return res.status(201).json({ ok: true, record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Restock request could not be created.');
  }
}
