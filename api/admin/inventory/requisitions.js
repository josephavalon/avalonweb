import { requireConnectedInventory, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanCents, cleanExpectedVersion, cleanIdempotencyKey, cleanReasonCode, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

const ACTIONS = new Set(['create', 'recalculate', 'submit', 'approve', 'reject', 'cancel', 'expire', 'convert']);

function requisitionLines(lines) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 200) throw new PayOpsError('Requisition lines are invalid.', 'inventory_requisition_lines_invalid', 400);
  return lines.map((line) => ({
    demandEpisodeId: cleanUuid(line?.demandEpisodeId, 'demandEpisodeId'),
    supplierItemId: cleanUuid(line?.supplierItemId, 'supplierItemId'),
    netNeed: String(line?.netNeed || ''), orderPacks: String(line?.orderPacks || ''),
  }));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventory('manualProcurement'); requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req); const action = String(body.action || '').trim().toLowerCase();
    if (!ACTIONS.has(action)) throw new PayOpsError('Requisition action is invalid.', 'inventory_requisition_action_invalid', 400);
    const key = cleanIdempotencyKey(req); let record;
    if (['create', 'recalculate'].includes(action)) {
      const trace = body.calculationTrace && typeof body.calculationTrace === 'object' && !Array.isArray(body.calculationTrace) ? body.calculationTrace : null;
      const expiresAt = new Date(body.expiresAt || '');
      if (!trace || !Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) throw new PayOpsError('Calculation trace and a future expiry are required.', 'inventory_requisition_trace_invalid', 400);
      record = await rpc(authed.db, 'create_inventory_requisition', {
        p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id, p_lines: requisitionLines(body.lines),
        p_calculation_trace: trace, p_expires_at: expiresAt.toISOString(),
        p_supersedes_requisition_id: action === 'recalculate' ? cleanUuid(body.requisitionId, 'requisitionId') : null,
        p_idempotency_key: key,
      });
    } else {
      const hash = String(body.expectedCalculationHash || '').trim().toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(hash)) throw new PayOpsError('Expected calculation hash is invalid.', 'inventory_requisition_hash_invalid', 400);
      if (action === 'convert') {
        const expectedOn = String(body.expectedOn || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedOn)) throw new PayOpsError('Expected delivery date is invalid.', 'inventory_requisition_delivery_invalid', 400);
        record = await rpc(authed.db, 'convert_inventory_requisition_to_purchase_order', {
          p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
          p_requisition_id: cleanUuid(body.requisitionId, 'requisitionId'), p_expected_version: cleanExpectedVersion(body.expectedVersion),
          p_expected_calculation_hash: hash, p_order_number: String(body.orderNumber || '').trim(), p_expected_on: expectedOn,
          p_tax_cents: cleanCents(body.taxCents || 0, 'taxCents'), p_shipping_cents: cleanCents(body.shippingCents || 0, 'shippingCents'),
          p_idempotency_key: key,
        });
      } else {
        record = await rpc(authed.db, 'transition_inventory_requisition', {
          p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
          p_requisition_id: cleanUuid(body.requisitionId, 'requisitionId'), p_action: action,
          p_expected_version: cleanExpectedVersion(body.expectedVersion), p_expected_calculation_hash: hash,
          p_reason_code: ['reject', 'cancel'].includes(action) ? cleanReasonCode(body.reasonCode) : null,
          p_idempotency_key: key,
        });
      }
    }
    return res.status(201).json({ ok: true, action, record });
  } catch (error) { return sendConnectedInventoryError(res, error, 'Requisition could not be updated.'); }
}
