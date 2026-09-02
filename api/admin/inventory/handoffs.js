import { requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { cleanQuantity, optionalUuid, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanIdempotencyKey, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

function cleanLines(lines) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 100) throw new PayOpsError('Handoff lines are invalid.', 'inventory_handoff_lines_invalid', 400);
  return lines.map((line) => ({ itemId: cleanUuid(line?.itemId, 'itemId'), variantId: optionalUuid(line?.variantId, 'variantId'), lotId: optionalUuid(line?.lotId, 'lotId'), quantity: cleanQuantity(line?.quantity) }));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res);
  if (!authed) return;
  try {
    requireConnectedInventoryWrite();
    requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req);
    const record = await rpc(authed.db, 'dispatch_inventory_handoff', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_kit_id: cleanUuid(body.kitId, 'kitId'),
      p_from_location_id: cleanUuid(body.fromLocationId, 'fromLocationId'),
      p_restock_request_id: optionalUuid(body.restockRequestId, 'restockRequestId'),
      p_lines: cleanLines(body.lines),
      p_seal_code: body.sealCode ? String(body.sealCode).trim().slice(0, 120) : null,
      p_idempotency_key: cleanIdempotencyKey(req),
    });
    return res.status(201).json({ ok: true, record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Inventory handoff could not be dispatched.');
  }
}
