import crypto from 'node:crypto';
import { calculateA1ReorderProposal, requireConnectedInventory, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { parseJsonBody, rpc, sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanIdempotencyKey, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

async function rows(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data || [];
}

function requireInternalAgent(req) {
  const expected = String(process.env.INVENTORY_A1_INTERNAL_TOKEN || '');
  if (!expected) throw new PayOpsError('A1 internal authentication is not configured.', 'inventory_a1_internal_auth_not_configured', 503);
  const supplied = String(req.headers?.['x-avalon-inventory-agent-token'] || '');
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new PayOpsError('A1 internal authentication failed.', 'inventory_a1_internal_auth_invalid', 401);
  }
}

async function analyze(db, tenantId) {
  const [items, availabilityRows, allocations, demands, supplierItems, policies, unknownOrders] = await Promise.all([
    rows(db.from('os_inventory_items').select('id,regulated_class,classification_reviewed_at,storage_policy,safety_stock,max_on_hand,automation_eligible,status').eq('tenant_id', tenantId).eq('status', 'active').limit(20000)),
    rows(db.from('os_inventory_availability').select('item_id,variant_id,lot_id,quantity_available,quantity_reserved,quantity_on_order').eq('tenant_id', tenantId).limit(50000)),
    rows(db.from('os_inventory_allocations').select('item_id,variant_id,quantity,status,expires_at').eq('tenant_id', tenantId).in('status', ['reserved', 'picking']).limit(20000)),
    rows(db.from('os_inventory_demand_episodes').select('id,item_id,variant_id,validated_quantity,status,need_by').eq('tenant_id', tenantId).limit(20000)),
    rows(db.from('os_inventory_supplier_items').select('id,vendor_id,item_id,variant_id,units_per_pack,minimum_order_packs,order_multiple_packs,lead_time_days,unit_price_cents,price_effective_at,price_expires_at,substitution_policy,automation_eligible,status').eq('tenant_id', tenantId).limit(20000)),
    rows(db.from('os_inventory_procurement_policies').select('id,status,budget_remaining_cents,max_order_total_cents,max_units_per_line,max_lead_time_days,expiry_risk_days,effective_at,expires_at,version').eq('tenant_id', tenantId).eq('status', 'approved').lte('effective_at', new Date().toISOString()).order('version', { ascending: false }).limit(1)),
    rows(db.from('os_purchase_orders').select('id,status').eq('tenant_id', tenantId).in('status', ['sending', 'failed', 'unknown_external_state', 'exception']).limit(10000)),
  ]);
  const lotIds = [...new Set(availabilityRows.map((row) => row.lot_id).filter(Boolean))];
  const lots = lotIds.length ? await rows(db.from('os_inventory_lots').select('id,expires_on').eq('tenant_id', tenantId).in('id', lotIds).limit(50000)) : [];
  const expiryByLot = new Map(lots.map((lot) => [lot.id, lot.expires_on]));
  const availability = availabilityRows.map((row) => ({ ...row, expires_on: expiryByLot.get(row.lot_id) || null }));
  const input = { items, availability, allocations, demands, supplierItems, policy: policies[0] || null, unknownOrderCount: unknownOrders.length };
  return { input, proposal: calculateA1ReorderProposal(input) };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res);
  if (!authed) return;
  try {
    requireConnectedInventory('a1Drafts');
    requireInventoryCanaryProfile(authed.user.id);
    requireInternalAgent(req);
    if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const analysis = await analyze(authed.db, authed.tenantId);
    if (req.method === 'GET') return res.status(200).json({ status: 'DRAFT_ONLY', proposal: analysis.proposal });
    const body = parseJsonBody(req);
    if (body.action !== 'create_draft') throw new PayOpsError('A1 action is invalid.', 'inventory_a1_action_invalid', 400);
    const record = await rpc(authed.db, 'record_inventory_a1_proposal', {
      p_tenant_id: authed.tenantId,
      p_actor_profile_id: authed.user.id,
      p_evaluator_version: analysis.proposal.version,
      p_policy_version: analysis.input.policy ? `procurement-policy-${analysis.input.policy.version}` : 'procurement-policy-missing',
      p_input: analysis.input,
      p_proposal: analysis.proposal,
      p_evaluations: analysis.proposal.evaluations,
      p_idempotency_key: cleanIdempotencyKey(req),
    });
    return res.status(201).json({ ok: true, authority: 'DRAFT_ONLY', record });
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'A1 analysis is unavailable.');
  }
}
