import { requireConnectedInventory, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanIdempotencyKey, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

const SCOPES = new Set(['global', 'tenant', 'location', 'vendor', 'category', 'sku', 'adapter']);

function timestamp(value, field, { optional = false } = {}) {
  if (optional && !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  return date.toISOString();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventory();
    requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req); const scopeType = String(body.scopeType || '').trim().toLowerCase();
    if (body.action !== 'set' || !SCOPES.has(scopeType) || body.executionEnabled === true) {
      throw new PayOpsError('Automation control is invalid. Supplier execution cannot be enabled in V1.', 'inventory_control_invalid', 400);
    }
    const scopeId = String(body.scopeId || '').trim();
    if (!scopeId || scopeId.length > 160) throw new PayOpsError('Scope ID is invalid.', 'inventory_control_scope_invalid', 400);
    const reasonCode = String(body.reasonCode || '').trim().toUpperCase();
    if (!/^[A-Z0-9_]{3,100}$/.test(reasonCode)) throw new PayOpsError('Reason code is invalid.', 'inventory_control_reason_invalid', 400);
    const record = await rpc(authed.db, 'set_inventory_automation_control', {
      p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
      p_scope_type: scopeType, p_scope_id: scopeId, p_execution_enabled: false,
      p_a1_drafts_enabled: body.a1DraftsEnabled === true, p_kill_switch: body.killSwitch !== false,
      p_reason_code: reasonCode, p_effective_at: timestamp(body.effectiveAt, 'effectiveAt'),
      p_expires_at: timestamp(body.expiresAt, 'expiresAt', { optional: true }),
      p_idempotency_key: cleanIdempotencyKey(req),
    });
    return res.status(201).json({ ok: true, record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Automation control could not be updated.');
  }
}
