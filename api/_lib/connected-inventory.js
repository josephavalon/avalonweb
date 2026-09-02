import { PayOpsError } from './payops-core.js';

const TRUE = new Set(['1', 'true', 'yes', 'on']);
const TERMINAL_DEMAND = new Set(['denied', 'cancelled', 'closed']);

function enabled(value) {
  return TRUE.has(String(value || '').trim().toLowerCase());
}

export function connectedInventoryFlags(env = process.env) {
  const killSwitch = !['0', 'false', 'no', 'off'].includes(String(env.INVENTORY_GLOBAL_KILL_SWITCH || 'true').trim().toLowerCase());
  return Object.freeze({
    connected: enabled(env.CONNECTED_INVENTORY_ENABLED),
    manualProcurement: enabled(env.INVENTORY_MANUAL_PROCUREMENT_ENABLED),
    a1Drafts: enabled(env.INVENTORY_A1_DRAFTS_ENABLED),
    supplierExecution: enabled(env.INVENTORY_SUPPLIER_EXECUTION_ENABLED),
    killSwitch,
  });
}

export function inventoryCanaryProfileAllowed(profileId, env = process.env) {
  const allowed = String(env.INVENTORY_CANARY_PROFILE_IDS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  return Boolean(profileId) && allowed.includes(String(profileId).trim().toLowerCase());
}

export function requireInventoryCanaryProfile(profileId, env = process.env) {
  if (!inventoryCanaryProfileAllowed(profileId, env)) {
    throw new PayOpsError('Connected inventory is limited to named beta test accounts.', 'connected_inventory_canary_access_required', 403);
  }
}

export function requireConnectedInventory(capability = 'connected', env = process.env) {
  const flags = connectedInventoryFlags(env);
  if (!flags.connected || (capability !== 'connected' && !flags[capability])) {
    throw new PayOpsError('Connected inventory is disabled pending migration and control verification.', 'connected_inventory_disabled', 503);
  }
  if (capability !== 'connected' && flags.killSwitch) {
    throw new PayOpsError('This connected inventory capability is paused by the inventory kill switch.', 'inventory_kill_switch_active', 503);
  }
  return flags;
}

export function requireConnectedInventoryWrite(env = process.env) {
  const flags = requireConnectedInventory('connected', env);
  if (flags.killSwitch) {
    throw new PayOpsError('Connected inventory writes are paused by the inventory kill switch.', 'inventory_kill_switch_active', 503);
  }
  return flags;
}

export function isConnectedInventoryMigrationError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return ['42P01', '42703', '42883', 'PGRST200', 'PGRST202', 'PGRST204'].includes(code)
    || /os_inventory_(?:availability|kits|handoffs|count_|demand_|supplier_items|requisitions|receiving_|agent_|automation_|exceptions)|submit_inventory_purchase_order|approve_inventory_purchase_order|record_manual_purchase_order_event|start_inventory_count|submit_inventory_count|receive_inventory_handoff|schema cache/i.test(message);
}

export function connectedInventoryError(error, fallback = 'Connected inventory is unavailable.') {
  if (error instanceof PayOpsError) return error;
  if (isConnectedInventoryMigrationError(error)) {
    return new PayOpsError('Connected inventory is waiting for its verified database migration.', 'connected_inventory_migration_required', 503);
  }
  return new PayOpsError(fallback, String(error?.code || 'connected_inventory_unavailable'), 500);
}

function number(value) {
  const result = Number(value || 0);
  return Number.isFinite(result) ? result : 0;
}

function byKey(rows, key) {
  return new Map((rows || []).map((row) => [row[key], row]));
}

async function checked(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data || [];
}

export async function loadConnectedInventoryOverview(db, tenantId) {
  const [availability, kits, assignments, counts, demands, handoffs, supplierItems, requisitions, purchaseOrders, inspections, exceptions, proposals, controls, policies] = await Promise.all([
    checked(db.from('os_inventory_availability')
      .select('location_id,location_type,item_id,variant_id,lot_id,quantity_on_hand,quantity_usable,quantity_reserved,quantity_available,quantity_in_transit,quantity_on_order,quantity_quarantined,quantity_recalled,quantity_expired,quantity_damaged,quantity_disputed,last_movement_at')
      .eq('tenant_id', tenantId).limit(50000)),
    checked(db.from('os_inventory_kits')
      .select('id,location_id,kit_code,barcode,qr_code,seal_code,status,version,updated_at')
      .eq('tenant_id', tenantId).order('kit_code').limit(5000)),
    checked(db.from('os_inventory_location_assignments')
      .select('id,location_id,kit_id,provider_profile_id,nurse_profile_id,assignment_status,accepted_at,version')
      .eq('tenant_id', tenantId).in('assignment_status', ['assigned', 'accepted']).limit(5000)),
    checked(db.from('os_inventory_count_sessions')
      .select('id,location_id,kit_id,status,snapshot_at,count_reason,version,started_by,submitted_at,reviewed_at,updated_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5000)),
    checked(db.from('os_inventory_demand_episodes')
      .select('id,location_id,kit_id,item_id,variant_id,reason_code,validated_quantity,need_by,status,version,created_at,updated_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20000)),
    checked(db.from('os_inventory_handoffs')
      .select('id,kit_id,from_location_id,transit_location_id,to_location_id,restock_request_id,status,seal_code,version,dispatched_at,received_at,dispute_code,updated_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10000)),
    checked(db.from('os_inventory_supplier_items')
      .select('id,vendor_id,item_id,variant_id,supplier_sku,manufacturer,pack_uom,units_per_pack,minimum_order_packs,order_multiple_packs,lead_time_days,unit_price_cents,currency,price_effective_at,price_expires_at,substitution_policy,automation_eligible,status,version')
      .eq('tenant_id', tenantId).order('supplier_sku').limit(20000)),
    checked(db.from('os_inventory_requisitions')
      .select('id,requisition_number,source,status,calculation_hash,version,created_at,updated_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10000)),
    checked(db.from('os_purchase_orders')
      .select('id,vendor_id,order_number,status,expected_on,subtotal_cents,tax_cents,shipping_cents,payload_hash,approved_payload_hash,approved_at,ship_to_location_id,version,created_at,updated_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20000)),
    checked(db.from('os_inventory_receiving_inspections')
      .select('id,purchase_order_id,location_id,status,condition_code,version,inspected_at,posted_at,updated_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10000)),
    checked(db.from('os_inventory_exceptions')
      .select('id,exception_type,severity,entity_type,entity_id,status,reason_code,owner_profile_id,created_at,updated_at')
      .eq('tenant_id', tenantId).in('status', ['open', 'investigating']).order('created_at', { ascending: false }).limit(10000)),
    checked(db.from('os_inventory_agent_proposals')
      .select('id,requisition_id,status,agent_level,evaluator_version,policy_version,proposal_hash,explanation,created_at,expires_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5000)),
    checked(db.from('os_inventory_automation_controls')
      .select('scope_type,scope_id,execution_enabled,a1_drafts_enabled,kill_switch,version,effective_at,expires_at,reason_code')
      .eq('tenant_id', tenantId).order('version', { ascending: false }).limit(5000)),
    checked(db.from('os_inventory_procurement_policies')
      .select('id,status,budget_remaining_cents,max_order_total_cents,max_units_per_line,max_lead_time_days,expiry_risk_days,version,created_by,approved_by,approved_at,effective_at,expires_at,created_at')
      .eq('tenant_id', tenantId).order('version', { ascending: false }).limit(500)),
  ]);
  const assignmentByKit = byKey(assignments, 'kit_id');
  const latestCountByKit = new Map();
  for (const count of counts) if (count.kit_id && !latestCountByKit.has(count.kit_id)) latestCountByKit.set(count.kit_id, count);
  const availabilityByLocation = new Map();
  for (const row of availability) {
    const current = availabilityByLocation.get(row.location_id) || {
      onHand: 0, usable: 0, reserved: 0, available: 0, inTransit: 0,
      onOrder: 0, quarantined: 0, recalled: 0, expired: 0, damaged: 0, disputed: 0,
    };
    current.onHand += number(row.quantity_on_hand);
    current.usable += number(row.quantity_usable);
    current.reserved += number(row.quantity_reserved);
    current.available += number(row.quantity_available);
    current.inTransit += number(row.quantity_in_transit);
    current.onOrder += number(row.quantity_on_order);
    current.quarantined += number(row.quantity_quarantined);
    current.recalled += number(row.quantity_recalled);
    current.expired += number(row.quantity_expired);
    current.damaged += number(row.quantity_damaged);
    current.disputed += number(row.quantity_disputed);
    availabilityByLocation.set(row.location_id, current);
  }
  return {
    availability,
    kits: kits.map((kit) => ({
      ...kit,
      assignment: assignmentByKit.get(kit.id) || null,
      latestCount: latestCountByKit.get(kit.id) || null,
      totals: availabilityByLocation.get(kit.location_id) || null,
    })),
    counts,
    demands,
    handoffs,
    supplierItems,
    requisitions,
    purchaseOrders,
    inspections,
    exceptions,
    proposals,
    controls,
    policies,
  };
}

export async function loadConnectedNurseKit(db, tenantId, nurseProfileId) {
  const assignmentResult = await db.from('os_inventory_location_assignments')
    .select('id,location_id,kit_id,assignment_status,accepted_at,version,assigned_at')
    .eq('tenant_id', tenantId).eq('nurse_profile_id', nurseProfileId)
    .in('assignment_status', ['assigned', 'accepted'])
    .is('ended_at', null).order('assigned_at', { ascending: false }).limit(1).maybeSingle();
  if (assignmentResult.error) throw assignmentResult.error;
  const assignment = assignmentResult.data;
  if (!assignment?.kit_id) return { assigned: false, assignment: null, kit: null, items: [], counts: [], handoffs: [], requests: [], exceptions: [] };
  const [kit, availability, counts, handoffs, requests, exceptions] = await Promise.all([
    checked(db.from('os_inventory_kits')
      .select('id,kit_code,barcode,qr_code,seal_code,status,version,updated_at')
      .eq('tenant_id', tenantId).eq('id', assignment.kit_id).limit(1)),
    checked(db.from('os_inventory_availability')
      .select('item_id,variant_id,lot_id,quantity_on_hand,quantity_usable,quantity_reserved,quantity_available,quantity_in_transit,quantity_quarantined,quantity_recalled,quantity_expired,quantity_damaged,quantity_disputed,last_movement_at')
      .eq('tenant_id', tenantId).eq('location_id', assignment.location_id).limit(5000)),
    checked(db.from('os_inventory_count_sessions')
      .select('id,status,snapshot_at,count_reason,version,submitted_at,reviewed_at,updated_at')
      .eq('tenant_id', tenantId).eq('kit_id', assignment.kit_id)
      .order('created_at', { ascending: false }).limit(25)),
    checked(db.from('os_inventory_handoffs')
      .select('id,status,seal_code,version,dispatched_at,received_at,dispute_code,updated_at')
      .eq('tenant_id', tenantId).eq('kit_id', assignment.kit_id)
      .order('created_at', { ascending: false }).limit(100)),
    checked(db.from('os_inventory_demand_episodes')
      .select('id,item_id,variant_id,reason_code,validated_quantity,need_by,status,version,created_at,updated_at')
      .eq('tenant_id', tenantId).eq('kit_id', assignment.kit_id)
      .order('created_at', { ascending: false }).limit(500)),
    checked(db.from('os_inventory_exceptions')
      .select('id,exception_type,severity,entity_type,entity_id,status,reason_code,created_at,updated_at')
      .eq('tenant_id', tenantId).in('status', ['open', 'investigating'])
      .or(`entity_id.eq.${assignment.kit_id},entity_id.eq.${assignment.location_id}`)
      .order('created_at', { ascending: false }).limit(100)),
  ]);
  const itemIds = [...new Set(availability.map((row) => row.item_id).concat(requests.map((row) => row.item_id)).filter(Boolean))];
  const variantIds = [...new Set(availability.map((row) => row.variant_id).filter(Boolean))];
  const lotIds = [...new Set(availability.map((row) => row.lot_id).filter(Boolean))];
  const [items, variants, lots] = await Promise.all([
    itemIds.length ? checked(db.from('os_inventory_items')
      .select('id,name,sku,base_uom,regulated_class,storage_policy,status')
      .eq('tenant_id', tenantId).in('id', itemIds).limit(5000)) : [],
    variantIds.length ? checked(db.from('os_inventory_variants')
      .select('id,item_id,name,sku').eq('tenant_id', tenantId)
      .in('id', variantIds).limit(5000)) : [],
    lotIds.length ? checked(db.from('os_inventory_lots')
      .select('id,item_id,variant_id,lot_code,expires_on,disposition_status')
      .eq('tenant_id', tenantId).in('id', lotIds).limit(5000)) : [],
  ]);
  const itemMap = byKey(items, 'id');
  const variantMap = byKey(variants, 'id');
  const lotMap = byKey(lots, 'id');
  return {
    assigned: true,
    assignment,
    kit: kit[0] || null,
    items: availability.map((row) => ({
      ...row,
      name: itemMap.get(row.item_id)?.name || 'Inventory item',
      sku: variantMap.get(row.variant_id)?.sku || itemMap.get(row.item_id)?.sku || null,
      variantName: variantMap.get(row.variant_id)?.name || null,
      unit: itemMap.get(row.item_id)?.base_uom || 'unit',
      regulatedClass: itemMap.get(row.item_id)?.regulated_class || 'unknown',
      storagePolicy: itemMap.get(row.item_id)?.storage_policy || {},
      lotCode: lotMap.get(row.lot_id)?.lot_code || null,
      expiresOn: lotMap.get(row.lot_id)?.expires_on || null,
      disposition: lotMap.get(row.lot_id)?.disposition_status || null,
      recallStatus: lotMap.get(row.lot_id)?.disposition_status === 'recalled' ? 'recalled' : null,
    })),
    counts, handoffs, requests, exceptions,
  };
}

export function calculateA1ReorderProposal({ items = [], availability = [], demands = [], supplierItems = [], policy = null, unknownOrderCount = 0, now = new Date() } = {}) {
  const itemById = byKey(items, 'id');
  const supplierByItem = new Map();
  for (const supplier of supplierItems) {
    const priceEffectiveAt = Date.parse(supplier.price_effective_at);
    if (supplier.status !== 'approved' || supplier.automation_eligible !== true
      || supplier.substitution_policy !== 'prohibited'
      || !Number.isFinite(priceEffectiveAt) || priceEffectiveAt > now.getTime()) continue;
    const key = `${supplier.item_id}:${supplier.variant_id || ''}`;
    const previous = supplierByItem.get(key);
    if (!previous || String(supplier.price_expires_at).localeCompare(String(previous.price_expires_at)) > 0) supplierByItem.set(key, supplier);
  }
  const stockRows = new Map();
  for (const row of availability) {
    const key = `${row.item_id}:${row.variant_id || ''}`;
    const current = stockRows.get(key) || { rows: [], onOrder: 0, reserved: 0 };
    current.rows.push(row);
    current.onOrder += number(row.quantity_on_order);
    current.reserved += number(row.quantity_reserved);
    stockRows.set(key, current);
  }
  const groupedDemand = new Map();
  for (const demand of demands) {
    if (TERMINAL_DEMAND.has(demand.status)) continue;
    const key = `${demand.item_id}:${demand.variant_id || ''}`;
    const current = groupedDemand.get(key) || { itemId: demand.item_id, variantId: demand.variant_id || null, quantity: 0, episodeIds: [], earliestNeedBy: null };
    current.quantity += number(demand.validated_quantity);
    current.episodeIds.push(demand.id);
    if (demand.need_by && (!current.earliestNeedBy || demand.need_by < current.earliestNeedBy)) current.earliestNeedBy = demand.need_by;
    groupedDemand.set(key, current);
  }
  const lines = [];
  const evaluations = [];
  let proposedTotalCents = 0;
  const policyReady = Boolean(policy && policy.status === 'approved'
    && (!policy.expires_at || Date.parse(policy.expires_at) > now.getTime()));
  evaluations.push({ ruleCode: 'PROCUREMENT_POLICY', outcome: policyReady ? 'pass' : 'hold', evidence: { policyId: policy?.id || null } });
  evaluations.push({ ruleCode: 'UNKNOWN_ORDER_STATE', outcome: number(unknownOrderCount) === 0 ? 'pass' : 'hold', evidence: { unknownOrderCount: number(unknownOrderCount) } });
  for (const [key, demand] of [...groupedDemand.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const item = itemById.get(demand.itemId);
    const supplier = supplierByItem.get(key);
    const current = stockRows.get(key) || { rows: [], onOrder: 0, reserved: 0 };
    const needBy = demand.earliestNeedBy ? new Date(demand.earliestNeedBy) : null;
    const expiryCutoff = needBy || new Date(now.getTime() + number(policy?.expiry_risk_days) * 86400000);
    const available = current.rows.reduce((total, row) => {
      const expires = row.expires_on ? Date.parse(`${row.expires_on}T00:00:00Z`) : Infinity;
      return total + (expires <= expiryCutoff.getTime() ? 0 : number(row.quantity_available));
    }, 0);
    const expiryRiskQuantity = current.rows.reduce((total, row) => {
      const expires = row.expires_on ? Date.parse(`${row.expires_on}T00:00:00Z`) : Infinity;
      return total + (expires <= expiryCutoff.getTime() ? number(row.quantity_available) : 0);
    }, 0);
    const safetyStock = number(item?.safety_stock);
    const projectedUsable = available + current.onOrder;
    const netNeed = Math.max(0, demand.quantity + safetyStock - projectedUsable);
    const classificationReady = Boolean(item && item.automation_eligible === true
      && item.regulated_class !== 'unknown' && item.classification_reviewed_at
      && item.storage_policy && typeof item.storage_policy.storageClass === 'string');
    const supplierReady = Boolean(supplier && Date.parse(supplier.price_expires_at) > now.getTime() && number(supplier.units_per_pack) > 0);
    const leadTimeReady = Boolean(supplier && policyReady && number(supplier.lead_time_days) <= number(policy.max_lead_time_days)
      && (!needBy || now.getTime() + number(supplier.lead_time_days) * 86400000 <= needBy.getTime()));
    evaluations.push({ ruleCode: `CLASSIFICATION:${key}`, outcome: classificationReady ? 'pass' : 'hold', evidence: { itemId: demand.itemId } });
    evaluations.push({ ruleCode: `SUPPLIER_ITEM:${key}`, outcome: supplierReady ? 'pass' : 'hold', evidence: { supplierItemId: supplier?.id || null } });
    evaluations.push({ ruleCode: `LEAD_TIME:${key}`, outcome: leadTimeReady ? 'pass' : 'hold', evidence: { leadTimeDays: supplier?.lead_time_days ?? null, needBy: demand.earliestNeedBy } });
    evaluations.push({ ruleCode: `EXPIRY_RISK:${key}`, outcome: expiryRiskQuantity > 0 ? 'hold' : 'pass', evidence: { excludedQuantity: expiryRiskQuantity } });
    evaluations.push({ ruleCode: `POSITIVE_NET_NEED:${key}`, outcome: netNeed > 0 ? 'pass' : 'hold', evidence: { netNeed } });
    if (!policyReady || number(unknownOrderCount) > 0 || !classificationReady || !supplierReady || !leadTimeReady || netNeed <= 0) continue;
    const pack = number(supplier.units_per_pack);
    const multiple = Math.max(1, number(supplier.order_multiple_packs));
    const minimum = Math.max(1, number(supplier.minimum_order_packs));
    const rawPacks = Math.ceil(netNeed / pack);
    let orderPacks = Math.max(minimum, Math.ceil(rawPacks / multiple) * multiple);
    const storageCap = Math.min(...[number(item?.max_on_hand), number(item?.storage_policy?.max_units), number(policy.max_units_per_line)]
      .filter((value) => value > 0));
    const maxAdditionalUnits = Number.isFinite(storageCap) ? Math.max(0, storageCap - projectedUsable) : Infinity;
    orderPacks = Math.min(orderPacks, Math.floor(maxAdditionalUnits / pack / multiple) * multiple);
    const proposedUnits = orderPacks * pack;
    const lineTotalCents = Math.ceil(proposedUnits * number(supplier.unit_price_cents));
    const budgetReady = orderPacks >= minimum && proposedTotalCents + lineTotalCents <= Math.min(number(policy.budget_remaining_cents), number(policy.max_order_total_cents));
    evaluations.push({ ruleCode: `STORAGE_CAP:${key}`, outcome: orderPacks >= minimum ? 'pass' : 'hold', evidence: { storageCap, maxAdditionalUnits } });
    evaluations.push({ ruleCode: `BUDGET:${key}`, outcome: budgetReady ? 'pass' : 'hold', evidence: { lineTotalCents, proposedTotalCents } });
    if (!budgetReady) continue;
    proposedTotalCents += lineTotalCents;
    lines.push({
      itemId: demand.itemId,
      variantId: demand.variantId,
      demandEpisodeIds: demand.episodeIds,
      supplierItemId: supplier.id,
      vendorId: supplier.vendor_id,
      validatedDemand: demand.quantity,
      safetyStock,
      projectedUsable,
      expiryRiskQuantity,
      reserved: current.reserved,
      netNeed,
      unitsPerPack: pack,
      orderPacks,
      proposedUnits,
      proposedUnitPriceCents: String(supplier.unit_price_cents || '0'),
      priceExpiresAt: supplier.price_expires_at,
      substitutionPolicy: supplier.substitution_policy,
      leadTimeDays: number(supplier.lead_time_days),
      lineTotalCents,
    });
  }
  return {
    version: 'connected-inventory-a1-v1',
    generatedAt: now.toISOString(),
    authority: 'DRAFT_ONLY',
    lines,
    evaluations,
    holds: evaluations.filter((row) => row.outcome !== 'pass').length,
    distinctShortageCount: groupedDemand.size,
    proposedTotalCents,
    supplierContactPermitted: false,
    purchaseOrderPermitted: false,
    paymentPermitted: false,
  };
}
