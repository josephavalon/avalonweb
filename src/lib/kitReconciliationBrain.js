import { normalizeSupplyItem } from './supplyBrain.js';
import { buildVisitCloseoutSnapshot } from './visitCloseoutBrain.js';

export const KIT_RECONCILIATION_VERSION = '2026.05.no-api-kit-reconciliation-v1';
export const KIT_RECONCILIATION_MODE = 'local-stock-control-placeholder';

export const KIT_RECONCILIATION_RULES = [
  'Queued closeout deductions change projected stock.',
  'Locked closeout deductions stay visible but do not change stock.',
  'Nurse kit restock is separate from central inventory restock.',
  'Expired, cold, and waste items require proof before dispatch.',
  'Every reconciliation produces an audit trail.',
  'Ordering vendors remain placeholder handoffs until APIs exist.',
];

const KIT_PAR_LINES = [
  { id: 'iv-bag', match: 'IV Bag', par: 2, category: 'base' },
  { id: 'iv-start', match: 'IV Start Kit', par: 2, category: 'base' },
  { id: 'extension', match: 'IV Extension', par: 2, category: 'base' },
  { id: 'gloves', match: 'Nitrile Gloves', par: 1, category: 'ppe' },
  { id: 'sharps', match: 'Sharps Container', par: 1, category: 'safety' },
  { id: 'b-complex', match: 'B-Complex', par: 2, category: 'addon' },
  { id: 'magnesium', match: 'Magnesium', par: 2, category: 'addon' },
  { id: 'glutathione', match: 'Glutathione', par: 2, category: 'addon' },
  { id: 'vitamin-c', match: 'Vitamin C', par: 1, category: 'addon' },
  { id: 'nad', match: 'NAD+', par: 1, category: 'advanced' },
  { id: 'b12', match: 'B12', par: 1, category: 'im' },
  { id: 'im-syringe', match: 'IM Syringe', par: 2, category: 'im' },
  { id: 'epi', match: 'Epinephrine', par: 1, category: 'emergency' },
  { id: 'diphenhydramine', match: 'Diphenhydramine', par: 1, category: 'emergency' },
];

function compactText(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function slug(value = '') {
  return compactText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nurseKey(value = '') {
  return compactText(value || 'unassigned') || 'unassigned';
}

function itemKey(line = {}) {
  return line.itemId || slug(line.name || line.match || line.item || 'item');
}

function matchLine(item = {}, line = {}) {
  const itemText = compactText(item.name, item.sku, item.category);
  const lineText = compactText(line.match, line.name);
  if (!lineText) return false;
  return itemText.includes(lineText) || lineText.split('-').some((part) => part && itemText.includes(part));
}

function groupDeductions(lines = []) {
  const grouped = new Map();
  lines.forEach((line) => {
    const key = itemKey(line);
    const current = grouped.get(key) || {
      itemId: key,
      name: line.name || line.match || 'Inventory item',
      sku: line.sku || '',
      unit: line.unit || 'units',
      queued: 0,
      locked: 0,
      visits: new Set(),
      clients: new Set(),
    };
    if (line.status === 'Queued') current.queued += number(line.qty, 0);
    else current.locked += number(line.qty, 0);
    current.visits.add(line.visitId || line.id);
    current.clients.add(line.client || 'Client');
    grouped.set(key, current);
  });

  return [...grouped.values()].map((entry) => ({
    ...entry,
    visits: [...entry.visits].filter(Boolean).length,
    clients: [...entry.clients].filter(Boolean).slice(0, 4),
  }));
}

function normalizeWasteLogs(wasteLogs = []) {
  return wasteLogs.map((log, index) => ({
    id: log.id || `waste-${index}`,
    itemId: log.itemId || slug(log.item || log.name || `waste-${index}`),
    name: log.item || log.name || 'Waste item',
    qty: number(log.qty ?? log.quantity, 1),
    reason: log.reason || 'Waste review',
    status: log.status || 'Logged',
    source: log.source || 'local-waste-placeholder',
  }));
}

function buildCentralStock({ inventory = [], deductionGroups = [], wasteLogs = [] } = {}) {
  const normalized = inventory.map(normalizeSupplyItem);
  const waste = normalizeWasteLogs(wasteLogs);
  return normalized.map((item) => {
    const group = deductionGroups.find((entry) => entry.itemId === item.id || matchLine(item, entry)) || null;
    const wasteQty = waste
      .filter((entry) => entry.itemId === item.id || compactText(entry.name) === compactText(item.name))
      .reduce((sum, entry) => sum + number(entry.qty), 0);
    const deducted = number(group?.queued, 0);
    const locked = number(group?.locked, 0);
    const projectedQty = Math.max(0, number(item.qty) - deducted - wasteQty);
    const shortage = Math.max(0, number(item.minLevel) - projectedQty);
    const reorderQty = shortage ? Math.max(shortage + deducted, number(item.minLevel)) : 0;
    const status = item.expired
      ? 'Expired'
      : shortage
        ? 'Restock'
        : item.expiring
          ? 'Expiry Watch'
          : locked
            ? 'Pending Deduction'
            : 'Ready';
    const risk = status === 'Expired' || status === 'Restock'
      ? 'critical'
      : status === 'Expiry Watch' || status === 'Pending Deduction'
        ? 'action'
        : 'ready';

    return {
      ...item,
      startingQty: number(item.qty),
      deducted,
      locked,
      wasteQty,
      projectedQty,
      shortage,
      reorderQty,
      status,
      risk,
    };
  }).sort((a, b) => {
    const rank = { critical: 3, action: 2, ready: 1 };
    return (rank[b.risk] || 0) - (rank[a.risk] || 0) || b.shortage - a.shortage || a.projectedQty - b.projectedQty;
  });
}

function findStockLine(stock = [], parLine = {}) {
  return stock.find((item) => matchLine(item, parLine)) || null;
}

function buildNurseUsage(closeoutRows = []) {
  const byNurse = new Map();
  closeoutRows.forEach((row) => {
    const key = nurseKey(row.nurse);
    const current = byNurse.get(key) || {
      nurse: row.nurse || 'Unassigned',
      visits: 0,
      lines: [],
    };
    current.visits += 1;
    current.lines.push(...(row.deductionProof || []));
    byNurse.set(key, current);
  });
  return byNurse;
}

function buildNurseKits({ nurses = [], stock = [], closeoutRows = [] } = {}) {
  const usage = buildNurseUsage(closeoutRows);
  const sourceNurses = nurses.length ? nurses : [...usage.values()].map((entry) => ({ name: entry.nurse, kit: 'Unknown' }));
  return sourceNurses.map((nurse) => {
    const used = usage.get(nurseKey(nurse.name)) || { visits: 0, lines: [] };
    const lines = KIT_PAR_LINES.map((parLine) => {
      const central = findStockLine(stock, parLine);
      const usedQty = used.lines
        .filter((line) => matchLine({ name: line.name, sku: line.sku, category: line.category }, parLine))
        .reduce((sum, line) => sum + number(line.status === 'Queued' ? line.qty : 0), 0);
      const lockedQty = used.lines
        .filter((line) => matchLine({ name: line.name, sku: line.sku, category: line.category }, parLine))
        .reduce((sum, line) => sum + number(line.status !== 'Queued' ? line.qty : 0), 0);
      const par = parLine.par + Math.min(2, used.visits);
      const remaining = Math.max(0, par - usedQty);
      const restockQty = Math.max(0, par - remaining);
      const centralProjected = number(central?.projectedQty, 0);
      const centralBlocked = central?.risk === 'critical';
      const status = centralBlocked
        ? 'Central Hold'
        : lockedQty
          ? 'Pending Closeout'
          : restockQty
            ? 'Restock'
            : 'Ready';
      const risk = status === 'Central Hold'
        ? 'critical'
        : status === 'Restock' || status === 'Pending Closeout'
          ? 'action'
          : 'ready';
      return {
        id: `${nurse.id || slug(nurse.name)}-${parLine.id}`,
        itemId: central?.id || parLine.id,
        match: parLine.match,
        category: parLine.category,
        par,
        used: usedQty,
        locked: lockedQty,
        remaining,
        restockQty,
        centralProjected,
        status,
        risk,
      };
    });
    const holds = lines.filter((line) => line.risk !== 'ready');
    const explicitKitHold = /restock|hold|not set|missing/i.test(nurse.kit || nurse.kitStatus || '');
    const status = explicitKitHold || holds.some((line) => line.risk === 'critical')
      ? 'Hold'
      : holds.length
        ? 'Restock'
        : 'Ready';
    return {
      id: nurse.id || slug(nurse.name || 'nurse'),
      nurse: nurse.name || 'Nurse',
      area: nurse.area || 'Bay Area',
      status,
      risk: status === 'Hold' ? 'critical' : status === 'Restock' ? 'action' : 'ready',
      visits: used.visits,
      kitState: nurse.kit || nurse.kitStatus || 'Unknown',
      lines,
      restockLines: lines.filter((line) => line.restockQty || line.risk !== 'ready'),
      nextAction: explicitKitHold
        ? 'Confirm physical kit before next assignment.'
        : holds[0]
          ? `Reconcile ${holds[0].match}.`
          : 'Kit ready for next route.',
    };
  });
}

function buildRestockOrders(stock = [], kits = []) {
  const centralOrders = stock
    .filter((item) => item.reorderQty || item.risk !== 'ready')
    .map((item) => ({
      id: `central-restock-${item.id}`,
      scope: 'Central',
      itemId: item.id,
      name: item.name,
      qty: item.reorderQty || Math.max(1, item.minLevel),
      status: item.expired ? 'Destroy/Replace' : item.reorderQty ? 'Order' : 'Review',
      priority: item.risk === 'critical' ? 'High' : 'Normal',
      reason: item.expired ? 'Expired stock.' : item.shortage ? `Projected below minimum by ${item.shortage}.` : item.status,
      vendor: item.supplier || 'Vendor placeholder',
    }));
  const kitOrders = kits.flatMap((kit) => kit.restockLines
    .filter((line) => line.restockQty || line.status === 'Central Hold')
    .map((line) => ({
      id: `kit-restock-${kit.id}-${line.id}`,
      scope: 'Nurse Kit',
      nurse: kit.nurse,
      itemId: line.itemId,
      name: line.match,
      qty: line.restockQty || 1,
      status: line.status === 'Central Hold' ? 'Central Hold' : 'Pack',
      priority: line.risk === 'critical' ? 'High' : 'Normal',
      reason: `${kit.nurse} kit ${line.status.toLowerCase()}.`,
      vendor: 'Internal stock',
    })));
  return [...centralOrders, ...kitOrders].sort((a, b) => {
    const rank = { High: 2, Normal: 1 };
    return (rank[b.priority] || 0) - (rank[a.priority] || 0) || a.scope.localeCompare(b.scope);
  });
}

function buildWasteQueue(stock = [], wasteLogs = []) {
  const manual = normalizeWasteLogs(wasteLogs).map((entry) => ({
    ...entry,
    status: entry.status || 'Logged',
    priority: 'Normal',
  }));
  const expired = stock
    .filter((item) => item.expired)
    .map((item) => ({
      id: `expired-${item.id}`,
      itemId: item.id,
      name: item.name,
      qty: item.projectedQty,
      reason: 'Expired stock requires disposal proof.',
      status: 'Review',
      priority: 'High',
      source: 'inventory-expiry',
    }));
  return [...expired, ...manual];
}

function buildColdChain(stock = []) {
  return stock
    .filter((item) => item.refrigerated)
    .map((item) => ({
      id: `cold-${item.id}`,
      itemId: item.id,
      name: item.name,
      projectedQty: item.projectedQty,
      expirationDate: item.expirationDate || 'None',
      status: item.expired ? 'Expired' : item.expiring ? 'Expiry Watch' : 'Temp Proof',
      risk: item.expired ? 'critical' : item.expiring ? 'action' : 'ready',
      nextAction: item.expired
        ? 'Remove from kit and replace.'
        : item.expiring
          ? 'Use first only if clinically approved and not expired.'
          : 'Capture cooler proof before route.',
    }));
}

function buildLaunchReadiness(stock = []) {
  const capacityItems = [
    ['IV Bags', ['iv bag', 'normal saline']],
    ['Start Kits', ['iv start kit']],
    ['Extensions', ['extension']],
    ['B-Complex', ['b-complex']],
    ['Magnesium', ['magnesium']],
  ].map(([label, terms]) => {
    const item = stock.find((candidate) => terms.some((term) => compactText(candidate.name, candidate.sku).includes(term)));
    return {
      label,
      qty: number(item?.projectedQty, 0),
      risk: item?.risk || 'critical',
    };
  });
  const capacity = Math.min(...capacityItems.map((item) => item.qty));
  return {
    capacity: Number.isFinite(capacity) ? capacity : 0,
    status: capacity >= 10 ? 'Launch Ready' : capacity >= 4 ? 'Constrained' : 'Blocked',
    blockers: capacityItems.filter((item) => item.qty < 4 || item.risk === 'critical'),
    items: capacityItems,
    nextAction: capacity >= 10 ? 'Ready for small launch block.' : 'Build launch kit before selling group capacity.',
  };
}

function buildAuditTrail({ closeout = {}, stock = [], orders = [], wasteQueue = [] } = {}) {
  const deductionEvents = (closeout.deductionLedger || []).map((line) => ({
    id: `audit-${line.id}`,
    type: line.status === 'Queued' ? 'inventory.deducted' : 'inventory.pending',
    label: `${line.client}: ${line.name} x${line.qty}`,
    status: line.status,
  }));
  const stockEvents = stock
    .filter((item) => item.risk !== 'ready')
    .slice(0, 8)
    .map((item) => ({
      id: `audit-stock-${item.id}`,
      type: 'stock.review',
      label: `${item.name}: ${item.status}`,
      status: item.risk,
    }));
  const orderEvents = orders.slice(0, 8).map((order) => ({
    id: `audit-order-${order.id}`,
    type: 'restock.needed',
    label: `${order.scope}: ${order.name} x${order.qty}`,
    status: order.status,
  }));
  const wasteEvents = wasteQueue.map((entry) => ({
    id: `audit-waste-${entry.id}`,
    type: 'waste.review',
    label: `${entry.name}: ${entry.reason}`,
    status: entry.status,
  }));
  return [...deductionEvents, ...stockEvents, ...orderEvents, ...wasteEvents].slice(0, 40);
}

export function buildKitReconciliation({ inventory = [], deductionLedger = [], nurses = [], wasteLogs = [] } = {}) {
  const deductionGroups = groupDeductions(deductionLedger);
  const stock = buildCentralStock({ inventory, deductionGroups, wasteLogs });
  const kits = buildNurseKits({ nurses, stock, closeoutRows: [] });
  const orders = buildRestockOrders(stock, kits);
  const wasteQueue = buildWasteQueue(stock, wasteLogs);
  const coldChain = buildColdChain(stock);
  const launchReadiness = buildLaunchReadiness(stock);

  return {
    version: KIT_RECONCILIATION_VERSION,
    mode: KIT_RECONCILIATION_MODE,
    rules: KIT_RECONCILIATION_RULES,
    stock,
    kits,
    orders,
    wasteQueue,
    coldChain,
    launchReadiness,
    auditTrail: buildAuditTrail({ closeout: { deductionLedger }, stock, orders, wasteQueue }),
  };
}

export function buildKitReconciliationSnapshot({
  requests = [],
  nurses = [],
  inventory = [],
  booking = null,
  closeouts = {},
  wasteLogs = [],
} = {}) {
  const closeout = buildVisitCloseoutSnapshot({ requests, nurses, inventory, booking, closeouts });
  const deductionGroups = groupDeductions(closeout.deductionLedger);
  const stock = buildCentralStock({ inventory, deductionGroups, wasteLogs });
  const kits = buildNurseKits({ nurses, stock, closeoutRows: closeout.rows });
  const orders = buildRestockOrders(stock, kits);
  const wasteQueue = buildWasteQueue(stock, wasteLogs);
  const coldChain = buildColdChain(stock);
  const launchReadiness = buildLaunchReadiness(stock);
  const auditTrail = buildAuditTrail({ closeout, stock, orders, wasteQueue });
  const centralOrders = orders.filter((order) => order.scope === 'Central');
  const nurseOrders = orders.filter((order) => order.scope === 'Nurse Kit');
  const lockedDeductions = closeout.deductionLedger.filter((line) => line.status !== 'Queued');
  const queuedDeductions = closeout.deductionLedger.filter((line) => line.status === 'Queued');
  const score = Math.max(0, 100
    - centralOrders.filter((order) => order.priority === 'High').length * 9
    - nurseOrders.filter((order) => order.priority === 'High').length * 5
    - lockedDeductions.length * 2
    - wasteQueue.filter((entry) => entry.priority === 'High').length * 8
    - coldChain.filter((entry) => entry.risk === 'critical').length * 8
    - (launchReadiness.status === 'Blocked' ? 12 : launchReadiness.status === 'Constrained' ? 5 : 0));

  return {
    version: KIT_RECONCILIATION_VERSION,
    mode: KIT_RECONCILIATION_MODE,
    rules: KIT_RECONCILIATION_RULES,
    closeout,
    deductionGroups,
    stock,
    kits,
    orders,
    centralOrders,
    nurseOrders,
    wasteQueue,
    coldChain,
    launchReadiness,
    auditTrail,
    metrics: {
      visits: closeout.metrics.visits,
      queuedDeductions: queuedDeductions.length,
      lockedDeductions: lockedDeductions.length,
      stockLines: stock.length,
      centralRestock: centralOrders.length,
      nurseRestock: nurseOrders.length,
      kitsReady: kits.filter((kit) => kit.status === 'Ready').length,
      kitsHold: kits.filter((kit) => kit.status !== 'Ready').length,
      waste: wasteQueue.length,
      cold: coldChain.length,
      launchCapacity: launchReadiness.capacity,
      score,
    },
  };
}
