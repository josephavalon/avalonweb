import { requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { cleanQuantity, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanIdempotencyKey, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireRole } from '../../_lib/supabase-auth.js';
import { NURSE_ROLES, resolveNurseProvider } from '../../_lib/nurse-workflow.js';

function cleanLines(lines) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 500) throw new PayOpsError('Shift inventory lines are invalid.', 'shift_inventory_lines_invalid', 400);
  return lines.map((line) => ({
    reservationId: cleanUuid(line?.reservationId, 'reservationId'),
    consumedQuantity: cleanQuantity(line?.consumedQuantity, 'consumedQuantity', { allowZero: true }),
    wasteQuantity: cleanQuantity(line?.wasteQuantity, 'wasteQuantity', { allowZero: true }),
    damagedQuantity: cleanQuantity(line?.damagedQuantity, 'damagedQuantity', { allowZero: true }),
  }));
}

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
    const record = await rpc(authed.db, 'reconcile_shift_inventory', {
      p_tenant_id: authed.tenantId,
      p_nurse_profile_id: authed.user.id,
      p_shift_id: cleanUuid(body.shiftId, 'shiftId'),
      p_lines: cleanLines(body.lines),
      p_idempotency_key: cleanIdempotencyKey(req),
    });
    return res.status(201).json({ ok: true, record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Shift inventory could not be reconciled.');
  }
}
