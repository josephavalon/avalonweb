import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { calculateA1ReorderProposal, connectedInventoryFlags, inventoryCanaryProfileAllowed, requireConnectedInventoryWrite } from '../api/_lib/connected-inventory.js';
import { SUPPLIER_ADAPTER_METHODS, disabledSupplierAdapter } from '../api/_lib/inventory-supplier-adapters.js';

const root = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), 'utf8');
const migrationNames = [
  'connected_inventory_core', 'connected_inventory_workflows', 'connected_inventory_procurement',
  'connected_inventory_custody_and_count_review', 'connected_inventory_shift_reconciliation',
  'connected_inventory_catalog_commands', 'connected_inventory_governance', 'connected_inventory_safety_and_logistics',
  'connected_inventory_manifests_and_readiness', 'connected_inventory_requisition_conversion',
  'connected_inventory_safety_commands', 'connected_inventory_demand_lifecycle',
];
const migrations = migrationNames.map((name, index) => read(`supabase/migrations/${String(index + 83).padStart(3, '0')}_${name}.sql`));
const sql = migrations.join('\n');
const databaseContract = read('supabase/tests/connected_inventory_contract.sql');

function sourceFiles(directory) {
  return readdirSync(join(root, directory)).flatMap((name) => {
    const relative = join(directory, name); const absolute = join(root, relative);
    return statSync(absolute).isDirectory() ? sourceFiles(relative) : /\.(?:js|jsx|ts|tsx)$/.test(name) ? [relative] : [];
  });
}

for (const table of [
  'os_inventory_kits', 'os_inventory_handoffs', 'os_inventory_count_sessions',
  'os_inventory_demand_episodes', 'os_inventory_supplier_items', 'os_inventory_requisitions',
  'os_purchase_order_events', 'os_inventory_receiving_inspections', 'os_inventory_agent_proposals',
  'os_inventory_procurement_policies',
  'os_inventory_holds', 'os_inventory_recall_events', 'os_inventory_temperature_events',
  'os_inventory_calibration_events', 'os_inventory_allocations', 'os_inventory_readiness_evaluations',
  'os_inventory_shipments', 'os_inventory_supplier_connections', 'os_inventory_supplier_event_inbox',
]) assert.match(sql, new RegExp(`(?:create table if not exists|alter table) public\\.${table}`), `${table} is required`);

for (const command of [
  'start_inventory_count', 'submit_inventory_count', 'review_inventory_count',
  'dispatch_inventory_handoff', 'receive_inventory_handoff', 'reconcile_shift_inventory',
  'submit_inventory_purchase_order', 'approve_inventory_purchase_order',
  'record_manual_purchase_order_event', 'create_inventory_receiving_inspection',
  'post_inventory_receiving_inspection', 'record_inventory_a1_proposal',
  'classify_inventory_item', 'create_inventory_supplier_item', 'approve_inventory_supplier_item',
  'request_connected_kit_return', 'report_connected_kit_lost', 'assign_connected_kit_custody',
  'create_inventory_procurement_policy', 'approve_inventory_procurement_policy',
  'set_inventory_automation_control',
  'place_inventory_hold', 'release_inventory_hold', 'allocate_inventory_demand',
  'transition_inventory_requisition', 'record_inventory_shipment',
  'create_supply_manifest_version', 'approve_supply_manifest_version', 'evaluate_connected_shift_readiness',
  'create_inventory_requisition', 'convert_inventory_requisition_to_purchase_order',
  'review_inventory_supplier', 'register_inventory_supplier_connection', 'record_inventory_recall',
  'record_inventory_temperature_event', 'record_inventory_calibration_event',
  'transition_inventory_demand', 'transition_inventory_allocation',
]) {
  assert.match(sql, new RegExp(`create or replace function public\\.${command}\\(`), `${command} is required`);
  assert.match(sql, new RegExp(`grant execute on function public\\.${command}[\\s\\S]*?to service_role`), `${command} must be service-role-only`);
}

assert.match(sql, /prevent_os_append_only_mutation/, 'evidence must be append-only');
assert.match(sql, /quantity_on_hand[\s\S]*quantity_usable[\s\S]*quantity_reserved[\s\S]*quantity_available[\s\S]*quantity_in_transit[\s\S]*quantity_on_order[\s\S]*quantity_quarantined[\s\S]*quantity_recalled[\s\S]*quantity_expired[\s\S]*quantity_damaged[\s\S]*quantity_disputed/, 'availability states must be derived');
assert.match(sql, /create or replace view public\.os_inventory_available_to_promise[\s\S]*quantity_pending_allocation[\s\S]*quantity_available/, 'available-to-promise must subtract pending allocations');
assert.match(sql, /inventory_purchase_order_self_approval_prohibited/, 'PO self approval must be blocked');
assert.match(sql, /inventory_count_self_approval_forbidden/, 'count self approval must be blocked');
assert.match(sql, /inventory_supplier_item_self_approval_prohibited/, 'supplier catalog self approval must be blocked');
assert.match(sql, /inventory_procurement_policy_self_approval_prohibited/, 'procurement policy self approval must be blocked');
assert.match(sql, /inventory_requisition_self_approval_prohibited/, 'requisition self approval must be blocked');
assert.match(sql, /inventory_manifest_self_approval_prohibited/, 'manifest self approval must be blocked');
assert.match(sql, /inventory_supplier_self_review_prohibited/, 'supplier self review must be blocked');
assert.match(sql, /inventory_approved_payload_immutable/, 'approved PO inputs must be immutable');
assert.match(sql, /approved_payload_hash<>v_po\.payload_hash|approved_payload_hash<>po\.payload_hash/, 'approved PO hash must be reread');
assert.match(sql, /inventory_receiving_inspection_required/, 'direct PO receipt must be sealed');
assert.match(sql, /inventory_shipment_evidence_required/, 'shipped PO events must require structured shipment evidence');
assert.match(sql, /inventory_supplier_review_required/, 'supplier items must require reviewed supplier identity');
assert.match(sql, /regulated_class='unknown'|regulated_class = 'unknown'/, 'unknown classification must fail closed');
assert.match(sql, /p_event_type not in \('manual_exported'/, 'Option A events must be allowlisted');
assert.doesNotMatch(sql, /https?:\/\/|smtp|resend|sendgrid|fetch\(/i, 'SQL must not contact suppliers');
assert.match(sql, /EXECUTION_DISABLED_V1|No function in this migration performs network/, 'supplier connections must remain non-executable');
assert.match(sql, /SAFETY_HOLD|RECALL_SIGNAL|TEMPERATURE_EVIDENCE_CHANGED|CALIBRATION_EVIDENCE_CHANGED/, 'safety changes must invalidate readiness');
assert.match(databaseContract, /relrowsecurity/, 'database postflight must verify RLS');
assert.match(databaseContract, /anon','authenticated/, 'database postflight must reject browser-role grants');
assert.match(databaseContract, /os_purchase_orders_connected_immutable/, 'database postflight must verify approved PO immutability');

const productionSource = sourceFiles('api').concat(sourceFiles('src'), sourceFiles('app-modules'))
  .map((path) => `${path}\n${read(path)}`).join('\n');
assert.doesNotMatch(productionSource, /\.from\(['"]items['"]\)/, 'production code must not use legacy items');
assert.doesNotMatch(sourceFiles('src').concat(sourceFiles('app-modules')).map(read).join('\n'),
  /\.from\(['"](?:os_inventory|os_stock|os_purchase)[^'"]*['"]\)\s*\.(?:insert|update|upsert|delete)/,
  'browser code must not mutate canonical inventory tables');

const nurseSources = sourceFiles('api/me/kit').map(read).join('\n');
assert.doesNotMatch(nurseSources, /unit_cost|supplier_item|vendor_id|subtotal|tax_cents|shipping_cents/i, 'nurse APIs must not expose cost or supplier fields');
assert.match(read('src/lib/inventoryOfflineQueue.js'), /new Set\(\['count', 'restock'\]\)/, 'offline queue must allow only count and restock');
assert.match(read('src/lib/inventoryOfflineQueue.js'), /FORBIDDEN_KEYS/, 'offline queue must reject supplier and PHI-like keys');

const env = read('.env.example');
for (const flag of ['CONNECTED_INVENTORY_ENABLED=false', 'INVENTORY_MANUAL_PROCUREMENT_ENABLED=false', 'INVENTORY_A1_DRAFTS_ENABLED=false', 'INVENTORY_SUPPLIER_EXECUTION_ENABLED=false', 'INVENTORY_GLOBAL_KILL_SWITCH=true']) {
  assert.match(env, new RegExp(flag), `${flag} must be the safe default`);
}
assert.match(env, /INVENTORY_CANARY_PROFILE_IDS=\s*(?:\n|$)/, 'canary allowlist must default empty');
for (const path of sourceFiles('api/admin/inventory').concat(sourceFiles('api/me/kit'))) {
  const source = read(path);
  if (source.includes('requireConnectedInventory')) {
    assert.match(source, /requireInventoryCanaryProfile\(authed\.user\.id\)/, `${path} must enforce the named-account canary`);
  }
}

const disabledFlags = connectedInventoryFlags({});
assert.equal(disabledFlags.connected, false);
assert.equal(disabledFlags.supplierExecution, false);
assert.equal(disabledFlags.killSwitch, true);
assert.equal(inventoryCanaryProfileAllowed('00000000-0000-4000-8000-000000000001', {}), false);
assert.equal(inventoryCanaryProfileAllowed('00000000-0000-4000-8000-000000000001', { INVENTORY_CANARY_PROFILE_IDS: '00000000-0000-4000-8000-000000000001' }), true);
assert.deepEqual(SUPPLIER_ADAPTER_METHODS, ['validateConnection', 'quoteOrPriceCheck', 'submitOrder', 'getOrder', 'cancelOrder', 'listShipments', 'verifyWebhook']);
assert.equal((await disabledSupplierAdapter.validateConnection()).status, 'DISABLED');
assert.throws(() => disabledSupplierAdapter.submitOrder({}), /disabled/i);

const now = new Date('2026-09-02T12:00:00.000Z');
const proposal = calculateA1ReorderProposal({
  now,
  items: [{ id: 'item-1', regulated_class: 'medical_supply', classification_reviewed_at: now.toISOString(), storage_policy: { storageClass: 'ambient' }, automation_eligible: true, safety_stock: 2 }],
  availability: [{ item_id: 'item-1', variant_id: null, quantity_available: 3, quantity_reserved: 1, quantity_on_order: 0 }],
  demands: [{ id: 'demand-1', item_id: 'item-1', variant_id: null, validated_quantity: 5, status: 'submitted' }],
  supplierItems: [{ id: 'supplier-1', vendor_id: 'vendor-1', item_id: 'item-1', variant_id: null, status: 'approved', automation_eligible: true, units_per_pack: 4, minimum_order_packs: 1, order_multiple_packs: 1, lead_time_days: 2, unit_price_cents: 100, price_effective_at: '2026-08-01T00:00:00.000Z', price_expires_at: '2026-09-30T00:00:00.000Z', substitution_policy: 'prohibited' }],
  policy: { id: 'policy-1', status: 'approved', budget_remaining_cents: 10000, max_order_total_cents: 10000, max_units_per_line: 100, max_lead_time_days: 10, expiry_risk_days: 7, expires_at: '2026-09-30T00:00:00.000Z' },
});
assert.equal(proposal.lines[0].netNeed, 4);
assert.equal(proposal.lines[0].orderPacks, 1);
assert.equal(proposal.lines[0].proposedUnits, 4);
assert.equal(proposal.lines[0].reserved, 1, 'reserved stock must be reported exactly once');
assert.equal(proposal.authority, 'DRAFT_ONLY');
assert.equal(proposal.supplierContactPermitted, false);
assert.equal(proposal.purchaseOrderPermitted, false);
assert.equal(proposal.paymentPermitted, false);

const allocatedProposal = calculateA1ReorderProposal({
  now,
  items: [{ id: 'item-1', regulated_class: 'medical_supply', classification_reviewed_at: now.toISOString(), storage_policy: { storageClass: 'ambient' }, automation_eligible: true, safety_stock: 2 }],
  availability: [{ item_id: 'item-1', variant_id: null, quantity_available: 6, quantity_reserved: 0, quantity_on_order: 0 }],
  allocations: [{ item_id: 'item-1', variant_id: null, quantity: 4, status: 'reserved', expires_at: '2026-09-03T12:00:00.000Z' }],
  demands: [{ id: 'demand-1', item_id: 'item-1', variant_id: null, validated_quantity: 5, status: 'submitted' }],
  supplierItems: [{ id: 'supplier-1', vendor_id: 'vendor-1', item_id: 'item-1', variant_id: null, status: 'approved', automation_eligible: true, units_per_pack: 4, minimum_order_packs: 1, order_multiple_packs: 1, lead_time_days: 2, unit_price_cents: 100, price_effective_at: '2026-08-01T00:00:00.000Z', price_expires_at: '2026-09-30T00:00:00.000Z', substitution_policy: 'prohibited' }],
  policy: { id: 'policy-1', status: 'approved', budget_remaining_cents: 10000, max_order_total_cents: 10000, max_units_per_line: 100, max_lead_time_days: 10, expiry_risk_days: 7, expires_at: '2026-09-30T00:00:00.000Z' },
});
assert.equal(allocatedProposal.lines[0].pendingAllocation, 4, 'pending allocation must reduce projected usable stock');
assert.equal(allocatedProposal.lines[0].netNeed, 5, 'allocation must affect deterministic net need');

const a1Input = {
  now,
  items: [{ id: 'item-1', regulated_class: 'medical_supply', classification_reviewed_at: now.toISOString(), storage_policy: { storageClass: 'ambient' }, automation_eligible: true, safety_stock: 2 }],
  availability: [],
  demands: [{ id: 'demand-1', item_id: 'item-1', variant_id: null, validated_quantity: 5, status: 'submitted' }],
  supplierItems: [{ id: 'supplier-1', vendor_id: 'vendor-1', item_id: 'item-1', variant_id: null, status: 'approved', automation_eligible: true, units_per_pack: 4, minimum_order_packs: 1, order_multiple_packs: 1, lead_time_days: 2, unit_price_cents: 100, price_effective_at: '2026-08-01T00:00:00.000Z', price_expires_at: '2026-09-30T00:00:00.000Z', substitution_policy: 'prohibited' }],
  policy: { id: 'policy-1', status: 'approved', budget_remaining_cents: 10000, max_order_total_cents: 10000, max_units_per_line: 100, max_lead_time_days: 10, expiry_risk_days: 7, expires_at: '2026-09-30T00:00:00.000Z' },
};
assert.equal(calculateA1ReorderProposal({ ...a1Input, unknownOrderCount: 1 }).lines.length, 0, 'unknown supplier state must hold ordering');
assert.equal(calculateA1ReorderProposal({ ...a1Input, items: [{ ...a1Input.items[0], regulated_class: 'unknown' }] }).lines.length, 0, 'unknown classification must hold ordering');
assert.equal(calculateA1ReorderProposal({ ...a1Input, supplierItems: [{ ...a1Input.supplierItems[0], price_effective_at: '2026-09-03T00:00:00.000Z' }] }).lines.length, 0, 'future or stale price state must hold ordering');
assert.equal(calculateA1ReorderProposal({ ...a1Input, supplierItems: [{ ...a1Input.supplierItems[0], substitution_policy: 'clinical_preapproved' }] }).lines.length, 0, 'A1 must not select substitutions');
assert.equal(calculateA1ReorderProposal({ ...a1Input, policy: { ...a1Input.policy, budget_remaining_cents: 100 } }).lines.length, 0, 'budget cap must hold ordering');
assert.throws(() => requireConnectedInventoryWrite({ CONNECTED_INVENTORY_ENABLED: 'true', INVENTORY_GLOBAL_KILL_SWITCH: 'true' }), /kill switch/i, 'global kill switch must stop connected writes');
assert.match(read('api/admin/inventory/agent.js'), /INVENTORY_A1_INTERNAL_TOKEN/, 'A1 commands must require internal authentication');
for (const endpoint of ['safety.js', 'allocations.js', 'demand.js', 'requisitions.js', 'shipments.js', 'manifests.js', 'readiness.js', 'supplier-connections.js']) {
  assert.match(read(`api/admin/inventory/${endpoint}`), /requireInventoryCanaryProfile\(authed\.user\.id\)/, `${endpoint} must enforce canary access`);
}
assert.match(read('api/me/kit.js'), /canaryAllowed && reasonCode === 'SHIFT_USE'/, 'legacy nurse shift use must be sealed for connected canaries');

console.log('Connected inventory QA passed: typed ledger, custody, counts, demand, manual Option A, receiving, and A1 draft-only controls are present.');
