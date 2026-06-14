export const SUPPLY_BRAIN_VERSION = '2026.05.no-api-supply-v1';
export const SUPPLY_CLINICAL_MODE = 'operational-placeholder-only';

export const SUPPLY_BRAIN_RULES = [
  'Every booked protocol creates a local supply reservation.',
  'Every reservation projects central stock impact before dispatch.',
  'Every nurse gets a kit mission before the visit.',
  'Every completed visit must produce a deduction proof.',
  'Clinical administration details stay in the clinical source of record.',
];

const BASE_PROTOCOL_LINES = [
  { match: 'IV Bag', qty: 1, category: 'base' },
  { match: 'IV Start Kit', qty: 1, category: 'base' },
  { match: 'IV Extension', qty: 1, category: 'base' },
  { match: 'Nitrile Gloves', qty: 1, category: 'base' },
  { match: 'Sharps Container', qty: 1, category: 'base' },
  { match: 'Digital BP Cuff', qty: 1, category: 'device', reusable: true },
  { match: 'Pulse Oximeter', qty: 1, category: 'device', reusable: true },
  { match: 'Epinephrine', qty: 1, category: 'emergency', reusable: true },
  { match: 'Diphenhydramine', qty: 1, category: 'emergency', reusable: true },
];

const PROTOCOL_LINES = {
  hydration: [{ match: 'B-Complex', qty: 1, category: 'addon' }],
  recovery: [
    { match: 'Magnesium', qty: 1, category: 'addon' },
    { match: 'Glutathione', qty: 1, category: 'addon' },
    { match: 'Ondansetron', qty: 1, category: 'optional' },
  ],
  myers: [
    { match: 'B-Complex', qty: 1, category: 'addon' },
    { match: 'Magnesium', qty: 1, category: 'addon' },
    { match: 'Vitamin C', qty: 1, category: 'addon' },
  ],
  nad: [{ match: 'NAD+', qty: 1, category: 'advanced', cold: true }],
  beauty: [
    { match: 'Glutathione', qty: 1, category: 'addon', cold: true },
    { match: 'Biotin', qty: 1, category: 'im' },
  ],
  energy: [
    { match: 'B-Complex', qty: 1, category: 'addon' },
    { match: 'Magnesium', qty: 1, category: 'addon' },
    { match: 'B12', qty: 1, category: 'im' },
  ],
  immunity: [
    { match: 'Vitamin C', qty: 1, category: 'addon', cold: true },
    { match: 'Glutathione', qty: 1, category: 'addon', cold: true },
  ],
  cbd: [{ match: 'CBD', qty: 1, category: 'advanced' }],
  im: [
    { match: 'B12', qty: 1, category: 'im' },
    { match: 'IM Syringe', qty: 1, category: 'im' },
  ],
};

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

function parseQuantity(item = {}) {
  const direct = item.qty ?? item.quantity ?? item.count ?? item.available;
  if (direct !== undefined && direct !== null && direct !== '') return number(direct);
  const detailMatch = String(item.detail || item.note || '').match(/(\d+(?:\.\d+)?)/);
  return detailMatch ? number(detailMatch[1]) : 0;
}

function parseMin(item = {}) {
  return number(item.minLevel ?? item.minimum ?? item.reorderPoint, Math.max(1, Math.ceil(parseQuantity(item) * 0.35)));
}

function daysUntilExpiry(item = {}) {
  if (!item.expirationDate) return null;
  const expiry = new Date(item.expirationDate);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.ceil((expiry.getTime() - Date.now()) / 86400000);
}

export function normalizeSupplyItem(item = {}) {
  const qty = parseQuantity(item);
  const minLevel = parseMin(item);
  const days = daysUntilExpiry(item);
  const statusText = compactText(item.status, item.detail, item.note);
  const expired = days !== null && days < 0;
  const expiring = days !== null && days <= 30 && days >= 0;
  const low = qty <= minLevel || /low|restock|critical|out/.test(statusText);
  const critical = expired || qty <= Math.max(1, Math.floor(minLevel / 2)) || /restock|out|missing|critical/.test(statusText);
  return {
    ...item,
    id: item.id || item.sku || slug(item.name),
    name: item.name || 'Inventory item',
    sku: item.sku || item.sortlyId || '',
    qty,
    minLevel,
    unit: item.unit || 'units',
    supplier: item.supplier || 'Supplier pending',
    refrigerated: Boolean(item.refrigeration || item.refrigerated || /cold|refrigerate/.test(statusText)),
    expired,
    expiring,
    low,
    critical,
    daysUntilExpiry: days,
    risk: critical ? 'critical' : low || expiring ? 'action' : 'ready',
  };
}

export function inferSupplyProtocol(request = {}) {
  const text = compactText(
    request.therapy,
    request.service,
    request.plan,
    request.protocol,
    request.addons || [],
    request.notes,
    request.source
  );
  if (text.includes('nad')) return 'nad';
  if (text.includes('cbd')) return 'cbd';
  if (text.includes('myers')) return 'myers';
  if (text.includes('beauty') || text.includes('glow') || text.includes('biotin')) return 'beauty';
  if (text.includes('immune') || text.includes('immunity')) return 'immunity';
  if (text.includes('energy') || text.includes('performance')) return 'energy';
  if (text.includes('b12') || text.includes(' im ') || text.includes('shot')) return 'im';
  if (text.includes('recovery') || text.includes('vip') || text.includes('hangover')) return 'recovery';
  return 'hydration';
}

function activeRequests(requests = [], booking = null) {
  const latest = booking ? [{
    id: booking.id || booking.reference || 'latest-booking',
    client: booking.contact?.name || booking.client || 'Latest client',
    therapy: booking.service || booking.plan || 'Avalon protocol',
    status: booking.status || 'New Request',
    nurse: booking.nurse || 'Unassigned',
    guests: booking.guests || 1,
    addons: booking.addons || [],
    time: [booking.date, booking.time].filter(Boolean).join(' '),
  }] : [];
  const seen = new Set();
  return [...latest, ...requests]
    .filter((request) => !/cancel|complete|archiv/i.test(request.status || ''))
    .filter((request) => {
      const id = request.id || `${request.client}-${request.time}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function manifestForRequest(request = {}) {
  const protocol = inferSupplyProtocol(request);
  const guests = Math.max(1, number(request.guests, 1));
  const advanced = PROTOCOL_LINES[protocol] || PROTOCOL_LINES.hydration;
  const rawLines = [...BASE_PROTOCOL_LINES, ...advanced];
  const byMatch = new Map();
  rawLines.forEach((line) => {
    const key = slug(line.match);
    const current = byMatch.get(key) || { ...line, qty: 0 };
    byMatch.set(key, {
      ...current,
      ...line,
      qty: current.qty + (line.reusable ? line.qty : line.qty * guests),
      perGuest: !line.reusable,
    });
  });
  return { protocol, guests, lines: [...byMatch.values()] };
}

function matchInventoryItem(items = [], need = {}) {
  const target = compactText(need.match);
  return items.find((item) => compactText(item.name, item.sku, item.category).includes(target))
    || items.find((item) => target.split('-').some((part) => part && compactText(item.name, item.sku, item.category).includes(part)));
}

export function buildVisitSupplyReservation(request = {}, inventory = []) {
  const items = inventory.map(normalizeSupplyItem);
  const manifest = manifestForRequest(request);
  const lines = manifest.lines.map((need) => {
    const item = matchInventoryItem(items, need);
    const available = number(item?.qty, 0);
    const projectedRemaining = Math.max(0, available - need.qty);
    const reusableReady = need.reusable && available >= 1 && !item?.expired;
    const consumableReady = !need.reusable && available >= need.qty && !item?.expired;
    const status = item && (reusableReady || consumableReady)
      ? projectedRemaining <= number(item.minLevel, 0) && !need.reusable ? 'Watch' : 'Ready'
      : 'Short';
    return {
      id: `${request.id || request.client || 'visit'}-${slug(need.match)}`,
      match: need.match,
      itemId: item?.id || '',
      name: item?.name || need.match,
      sku: item?.sku || '',
      qty: need.qty,
      unit: item?.unit || 'units',
      available,
      projectedRemaining,
      category: need.category,
      reusable: Boolean(need.reusable),
      cold: Boolean(need.cold || item?.refrigerated),
      status,
      risk: status === 'Short' || item?.expired ? 'critical' : status === 'Watch' || item?.expiring ? 'action' : 'ready',
    };
  });
  return {
    id: `reserve-${request.id || slug(request.client || 'visit')}`,
    visitId: request.id || request.reference || request.client || 'visit',
    client: request.client || request.contact?.name || 'Client',
    nurse: request.nurse || request.nurseName || 'Unassigned',
    service: request.therapy || request.service || request.plan || 'Avalon protocol',
    protocol: manifest.protocol,
    guests: manifest.guests,
    status: lines.some((line) => line.risk === 'critical') ? 'Blocked' : lines.some((line) => line.risk === 'action') ? 'Watch' : 'Ready',
    lines,
    closeoutRule: 'Deduct consumables after field closeout proof. Reusable emergency/device lines require presence proof.',
    clinicalMode: SUPPLY_CLINICAL_MODE,
  };
}

function buildStockLedger(reservations = [], inventory = []) {
  const items = inventory.map(normalizeSupplyItem);
  const ledger = new Map();
  reservations.forEach((reservation) => {
    reservation.lines.forEach((line) => {
      if (line.reusable) return;
      const key = line.itemId || slug(line.match);
      const current = ledger.get(key) || {
        itemId: key,
        name: line.name,
        sku: line.sku,
        unit: line.unit,
        demand: 0,
        visits: 0,
        available: line.available,
        minLevel: number(items.find((item) => item.id === line.itemId)?.minLevel, 0),
      };
      current.demand += number(line.qty);
      current.visits += 1;
      current.available = Math.max(current.available, line.available);
      ledger.set(key, current);
    });
  });
  return [...ledger.values()].map((entry) => {
    const projectedRemaining = Math.max(0, number(entry.available) - number(entry.demand));
    const shortage = Math.max(0, number(entry.demand) - number(entry.available));
    const reorderQty = Math.max(0, number(entry.minLevel) * 2 + number(entry.demand) - number(entry.available));
    return {
      ...entry,
      projectedRemaining,
      shortage,
      reorderQty,
      status: shortage ? 'Short' : projectedRemaining <= number(entry.minLevel) ? 'Reorder' : 'Ready',
      risk: shortage ? 'critical' : projectedRemaining <= number(entry.minLevel) ? 'action' : 'ready',
    };
  }).sort((a, b) => b.shortage - a.shortage || b.demand - a.demand || a.projectedRemaining - b.projectedRemaining);
}

function buildRestockMissions(stockLedger = [], inventory = []) {
  const itemRisk = inventory
    .map(normalizeSupplyItem)
    .filter((item) => item.low || item.critical || item.expiring || item.expired)
    .map((item) => ({
      id: `restock-${item.id}`,
      itemId: item.id,
      name: item.name,
      reason: item.expired ? 'Expired' : item.expiring ? 'Expiry watch' : item.critical ? 'Critical stock' : 'Low stock',
      qty: item.qty,
      reorderQty: Math.max(1, item.minLevel * 2 - item.qty),
      priority: item.critical || item.expired ? 'High' : 'Normal',
      source: 'central-stock',
    }));
  const projectionRisk = stockLedger
    .filter((line) => line.risk !== 'ready')
    .map((line) => ({
      id: `projection-${line.itemId}`,
      itemId: line.itemId,
      name: line.name,
      reason: line.status === 'Short' ? 'Projected shortage' : 'Projected reorder point',
      qty: line.projectedRemaining,
      reorderQty: line.reorderQty,
      priority: line.risk === 'critical' ? 'High' : 'Normal',
      source: 'visit-demand',
    }));
  const merged = new Map();
  [...itemRisk, ...projectionRisk].forEach((mission) => {
    const key = mission.itemId || mission.name;
    const current = merged.get(key);
    if (!current || current.priority !== 'High') merged.set(key, mission);
  });
  return [...merged.values()].sort((a, b) => (a.priority === 'High' ? -1 : 1) - (b.priority === 'High' ? -1 : 1));
}

function buildNurseKitMissions(nurses = [], reservations = []) {
  return nurses.map((nurse) => {
    const nurseName = nurse.name || nurse.nurseName || 'Nurse';
    const assigned = reservations.filter((reservation) => compactText(reservation.nurse) === compactText(nurseName));
    const unassignedReady = reservations.filter((reservation) => /unassigned/i.test(reservation.nurse) && reservation.status !== 'Blocked');
    const candidateReservations = assigned.length ? assigned : unassignedReady.slice(0, 2);
    const kitText = compactText(nurse.kit, nurse.kitStatus);
    const kitBlocked = /restock|not set|hold|missing|review/.test(kitText);
    const riskLines = candidateReservations.flatMap((reservation) => reservation.lines.filter((line) => line.risk !== 'ready'));
    return {
      id: nurse.id || slug(nurseName),
      nurse: nurseName,
      area: nurse.area || 'Bay Area',
      kit: nurse.kit || nurse.kitStatus || 'Unknown',
      visits: candidateReservations.length,
      status: kitBlocked || riskLines.length ? 'Hold' : 'Ready',
      risk: kitBlocked || riskLines.length ? 'action' : 'ready',
      reservations: candidateReservations.map((reservation) => reservation.client),
      missing: [...new Set(riskLines.map((line) => line.match))].slice(0, 5),
      nextAction: kitBlocked
        ? 'Restock kit before shift claim.'
        : riskLines.length
          ? `Confirm ${riskLines[0].match} before route.`
          : 'Ready for route packet.',
    };
  });
}

export function buildSupplyBrainSnapshot({ requests = [], nurses = [], inventory = [], booking = null } = {}) {
  const active = activeRequests(requests, booking);
  const normalizedInventory = inventory.map(normalizeSupplyItem);
  const reservations = active.map((request) => buildVisitSupplyReservation(request, normalizedInventory));
  const stockLedger = buildStockLedger(reservations, normalizedInventory);
  const restockMissions = buildRestockMissions(stockLedger, normalizedInventory);
  const kitMissions = buildNurseKitMissions(nurses, reservations);
  const coldChain = normalizedInventory.filter((item) => item.refrigerated).map((item) => ({
    id: item.id,
    name: item.name,
    qty: item.qty,
    status: item.expired ? 'Expired' : item.expiring ? 'Expiry Watch' : 'Proof Required',
    risk: item.expired || item.expiring ? 'action' : 'ready',
  }));
  const blockedReservations = reservations.filter((reservation) => reservation.status === 'Blocked');
  const watchReservations = reservations.filter((reservation) => reservation.status === 'Watch');
  const integrityScore = Math.max(0, 100
    - blockedReservations.length * 12
    - watchReservations.length * 5
    - restockMissions.filter((mission) => mission.priority === 'High').length * 8
    - kitMissions.filter((mission) => mission.status !== 'Ready').length * 6);

  return {
    version: SUPPLY_BRAIN_VERSION,
    clinicalMode: SUPPLY_CLINICAL_MODE,
    rules: SUPPLY_BRAIN_RULES,
    reservations,
    stockLedger,
    restockMissions,
    kitMissions,
    coldChain,
    metrics: {
      visits: reservations.length,
      readyReservations: reservations.filter((reservation) => reservation.status === 'Ready').length,
      blockedReservations: blockedReservations.length,
      watchReservations: watchReservations.length,
      stockLines: stockLedger.length,
      restock: restockMissions.length,
      highPriorityRestock: restockMissions.filter((mission) => mission.priority === 'High').length,
      nurseKitsReady: kitMissions.filter((mission) => mission.status === 'Ready').length,
      nurseKitsHold: kitMissions.filter((mission) => mission.status !== 'Ready').length,
      coldChain: coldChain.length,
      integrityScore,
    },
  };
}
