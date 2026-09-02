import { requireConnectedInventoryWrite, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { cleanQuantity, parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanCents, cleanExpectedVersion, cleanIdempotencyKey, cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

function timestamp(value, field, { optional = false } = {}) {
  if (optional && !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  return date.toISOString();
}

function integer(value, field) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new PayOpsError(`${field} is invalid.`, `${field}_invalid`, 400);
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res); if (!authed) return;
  try {
    requireConnectedInventoryWrite();
    requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = parseJsonBody(req); const action = String(body.action || '').trim(); const key = cleanIdempotencyKey(req);
    let record;
    if (action === 'create') {
      record = await rpc(authed.db, 'create_inventory_procurement_policy', {
        p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
        p_budget_remaining_cents: cleanCents(body.budgetRemainingCents, 'budgetRemainingCents'),
        p_max_order_total_cents: cleanCents(body.maxOrderTotalCents, 'maxOrderTotalCents'),
        p_max_units_per_line: cleanQuantity(body.maxUnitsPerLine, 'maxUnitsPerLine'),
        p_max_lead_time_days: integer(body.maxLeadTimeDays, 'maxLeadTimeDays'),
        p_expiry_risk_days: integer(body.expiryRiskDays, 'expiryRiskDays'),
        p_effective_at: timestamp(body.effectiveAt, 'effectiveAt'),
        p_expires_at: timestamp(body.expiresAt, 'expiresAt', { optional: true }),
        p_idempotency_key: key,
      });
    } else if (action === 'approve') {
      record = await rpc(authed.db, 'approve_inventory_procurement_policy', {
        p_tenant_id: authed.tenantId, p_actor_profile_id: authed.user.id,
        p_policy_id: cleanUuid(body.policyId, 'policyId'),
        p_expected_version: cleanExpectedVersion(body.expectedVersion), p_idempotency_key: key,
      });
    } else throw new PayOpsError('Procurement policy action is invalid.', 'inventory_policy_action_invalid', 400);
    return res.status(201).json({ ok: true, action, record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Procurement policy could not be updated.');
  }
}
