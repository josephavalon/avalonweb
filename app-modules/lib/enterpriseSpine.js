export const ENTERPRISE_SPINE_MODE = 'no-api-local';
export const ENTERPRISE_CLINICAL_MODE = 'placeholder-only';

export const CANONICAL_DATA_CONTRACTS = [
  {
    id: 'booking',
    label: 'Booking Contract',
    sourceOfTruth: 'Acuity scheduling once connected',
    localTruth: 'Avalon operational booking mirror',
    requiredFields: ['id', 'client', 'time', 'city', 'therapy', 'status'],
    events: ['booking.created', 'booking.updated', 'booking.cancelled'],
    neverStore: ['full clinical chart', 'final eligibility decision'],
  },
  {
    id: 'client',
    label: 'Client Contract',
    sourceOfTruth: 'Avalon client account plus Acuity patient record',
    localTruth: 'Name, contact, service preferences, visible status',
    requiredFields: ['name', 'phone', 'email', 'location'],
    events: ['client.created', 'client.updated', 'client.messaged'],
    neverStore: ['diagnosis', 'clinical note body', 'private provider assessment'],
  },
  {
    id: 'nurse',
    label: 'Provider Contract',
    sourceOfTruth: 'Avalon provider OS plus Nursys placeholder',
    localTruth: 'Availability, kit state, city zone, certification tags',
    requiredFields: ['id', 'name', 'status', 'area', 'kit'],
    events: ['nurse.available', 'nurse.accepted_shift', 'route.started'],
    neverStore: ['credential document image without vault approval'],
  },
  {
    id: 'visit',
    label: 'Visit Contract',
    sourceOfTruth: 'Acuity EMR for chart, Avalon OS for operations',
    localTruth: 'Lifecycle stage, assignment, route status, closeout proof',
    requiredFields: ['bookingId', 'nurse', 'routeStatus', 'stage', 'closeoutStatus'],
    events: ['visit.assigned', 'visit.en_route', 'visit.completed'],
    neverStore: ['full EMR note', 'diagnostic conclusion'],
  },
  {
    id: 'protocol',
    label: 'Protocol Contract',
    sourceOfTruth: 'Avalon clinical entity',
    localTruth: 'Public protocol category, operational supply map',
    requiredFields: ['category', 'publicName', 'supplyClass', 'clearanceRequired'],
    events: ['protocol.selected', 'protocol.adjusted', 'protocol.blocked'],
    neverStore: ['dose decision', 'provider-only protocol details'],
  },
  {
    id: 'inventoryTransaction',
    label: 'Inventory Transaction Contract',
    sourceOfTruth: 'Avalon inventory ledger',
    localTruth: 'Planned deduction, kit transfer, restock signal',
    requiredFields: ['item', 'quantity', 'reason', 'bookingId', 'status'],
    events: ['inventory.reserved', 'inventory.deducted', 'inventory.restock_needed'],
    neverStore: ['clinical rationale beyond protocol category'],
  },
  {
    id: 'message',
    label: 'Message Contract',
    sourceOfTruth: 'Avalon comms until SMS/email APIs connect',
    localTruth: 'Audience, urgency, channel placeholder, acknowledgement state',
    requiredFields: ['audience', 'body', 'priority', 'channel', 'status'],
    events: ['message.queued', 'message.acknowledged', 'message.escalated'],
    neverStore: ['unredacted clinical notes'],
  },
  {
    id: 'auditEvent',
    label: 'Audit Event Contract',
    sourceOfTruth: 'Avalon audit ledger',
    localTruth: 'Actor, action, timestamp, entity, before/after summary',
    requiredFields: ['actor', 'action', 'at', 'entityId'],
    events: ['audit.recorded', 'audit.exported', 'audit.locked'],
    neverStore: ['secret keys', 'payment card data', 'full clinical note text'],
  },
];

const SEVERITY_WEIGHT = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_READY = ['done', 'cleared', 'paid', 'ready', 'valid', 'completed', 'complete'];

function text(value) {
  return String(value ?? '').trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function idText(value) {
  return lower(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  const match = text(value).match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function isReady(value) {
  const current = lower(value);
  return STATUS_READY.some((status) => current.includes(status));
}

function isToday(value) {
  return lower(value).includes('today');
}

function isOffDuty(nurse = {}) {
  return lower(nurse.status).includes('off');
}

function areaMatches(request = {}, nurse = {}) {
  const city = lower(request.city || request.market || request.location);
  const area = lower(nurse.area || nurse.city || nurse.market);
  if (!city || !area) return false;
  if (area.includes(city)) return true;
  if (city === 'sf' && (area.includes('sf') || area.includes('san francisco'))) return true;
  if (city.includes('san francisco') && (area.includes('sf') || area.includes('san francisco'))) return true;
  if (city.includes('oakland') && area.includes('east bay')) return true;
  if (city.includes('berkeley') && area.includes('east bay')) return true;
  return false;
}

function normalizeRequest(request = {}, index = 0) {
  const rawId = request.id || request.reference || request.bookingId || `request-${index + 1}`;
  const addOns = asArray(request.addons || request.addOns);
  return {
    id: text(rawId),
    client: text(request.client || request.name || request.contact?.name || 'Client pending'),
    phone: text(request.phone || request.contact?.phone || ''),
    email: text(request.email || request.contact?.email || ''),
    city: text(request.city || request.market || request.zip || 'Bay Area'),
    address: text(request.address || request.location || 'Address pending'),
    locationType: text(request.locationType || 'mobile'),
    time: text(request.time || [request.date, request.appointmentTime].filter(Boolean).join(' ') || 'Time pending'),
    therapy: text(request.therapy || request.service || request.protocol || 'Protocol pending'),
    addons: addOns,
    total: numeric(request.total || request.subtotal || request.price, 0),
    status: text(request.status || 'New Request'),
    source: text(request.source || 'Avalon'),
    priority: text(request.priority || ''),
    intake: text(request.intake || 'Pending'),
    consent: text(request.consent || 'Pending'),
    gfe: text(request.gfe || request.clearance || 'Pending'),
    nurse: text(request.nurse || request.assignedNurse || 'Unassigned'),
    payment: text(request.payment || 'Pending'),
    guests: Math.max(1, numeric(request.guests || request.guestCount, 1)),
    notes: text(request.notes || ''),
    created: text(request.created || request.createdAt || ''),
  };
}

function normalizeRequests(requests = []) {
  return asArray(requests).filter(Boolean).map((request, index) => normalizeRequest(request, index));
}

function normalizeNurse(nurse = {}, index = 0) {
  return {
    id: text(nurse.id || `nurse-${index + 1}`),
    name: text(nurse.name || 'Nurse pending'),
    status: text(nurse.status || 'Unknown'),
    area: text(nurse.area || nurse.city || 'Unmapped'),
    visits: numeric(nurse.visits, 0),
    kit: text(nurse.kit || 'Not Set'),
    phone: text(nurse.phone || ''),
    assigned: asArray(nurse.assigned),
    certifications: asArray(nurse.certifications),
  };
}

function normalizeNurses(nurses = []) {
  return asArray(nurses).filter(Boolean).map((nurse, index) => normalizeNurse(nurse, index));
}

function inventoryQuantity(item = {}) {
  if (Number.isFinite(Number(item.qty))) return Number(item.qty);
  if (Number.isFinite(Number(item.quantity))) return Number(item.quantity);
  return numeric(item.detail || item.status || item.note, item.status === 'Ready' ? 10 : 0);
}

function inventoryMin(item = {}) {
  if (Number.isFinite(Number(item.minLevel))) return Number(item.minLevel);
  const name = lower(item.name);
  if (name.includes('iv bag')) return 20;
  if (name.includes('vitamin c')) return 8;
  if (name.includes('nad')) return 6;
  if (name.includes('glutathione')) return 6;
  if (name.includes('cbd')) return 6;
  if (name.includes('nurse bag')) return 4;
  return 5;
}

function normalizeInventory(inventory = []) {
  return asArray(inventory).filter(Boolean).map((item, index) => ({
    id: text(item.id || `inventory-${index + 1}`),
    name: text(item.name || 'Unnamed item'),
    status: text(item.status || 'Unknown'),
    detail: text(item.detail || ''),
    note: text(item.note || ''),
    qty: inventoryQuantity(item),
    minLevel: inventoryMin(item),
  }));
}

function addAction(actions, action) {
  actions.push({
    id: action.id,
    label: action.label,
    owner: action.owner,
    severity: action.severity || 'medium',
    source: action.source || 'Avalon OS',
    nextStep: action.nextStep,
    reason: action.reason,
    entityId: action.entityId || '',
  });
}

export function normalizeEnterpriseContract(type, input = {}) {
  const contract = CANONICAL_DATA_CONTRACTS.find((item) => item.id === type);
  return {
    contractId: contract?.id || type,
    label: contract?.label || 'Unknown Contract',
    clinicalMode: ENTERPRISE_CLINICAL_MODE,
    sourceOfTruth: contract?.sourceOfTruth || 'Avalon OS',
    payload: { ...input },
  };
}

export function buildEnterpriseActionQueue({ requests = [], nurses = [], inventory = [] } = {}) {
  const normalizedRequests = normalizeRequests(requests);
  const normalizedNurses = normalizeNurses(nurses);
  const normalizedInventory = normalizeInventory(inventory);
  const actions = [];

  normalizedRequests.forEach((request) => {
    const sameDay = isToday(request.time);
    if (!isReady(request.intake)) {
      addAction(actions, {
        id: `intake-${request.id}`,
        label: `${request.client}: intake`,
        owner: 'Client',
        severity: sameDay ? 'critical' : 'high',
        source: request.source,
        entityId: request.id,
        nextStep: 'Send intake link placeholder',
        reason: 'No service should move without intake status visible.',
      });
    }

    if (!isReady(request.consent)) {
      addAction(actions, {
        id: `consent-${request.id}`,
        label: `${request.client}: consent`,
        owner: 'Compliance placeholder',
        severity: sameDay ? 'critical' : 'high',
        source: request.source,
        entityId: request.id,
        nextStep: 'Collect consent before dispatch',
        reason: 'Consent must be visible before nurse arrival.',
      });
    }

    if (!isReady(request.gfe)) {
      addAction(actions, {
        id: `gfe-${request.id}`,
        label: `${request.client}: GFE`,
        owner: 'Clinical placeholder',
        severity: sameDay ? 'critical' : 'high',
        source: request.source,
        entityId: request.id,
        nextStep: 'Route Avalon NP first; Qualiphy fallback only if uncovered',
        reason: 'Clinical clearance is placeholder-only until the clinical source of record responds.',
      });
    }

    if (lower(request.nurse).includes('unassigned')) {
      addAction(actions, {
        id: `nurse-${request.id}`,
        label: `${request.client}: nurse`,
        owner: 'Dispatch',
        severity: sameDay ? 'high' : 'medium',
        source: request.source,
        entityId: request.id,
        nextStep: 'Offer shift to best certified available RN',
        reason: 'A premium visit needs a claimed provider before client confidence drops.',
      });
    }

    if (!isReady(request.payment)) {
      addAction(actions, {
        id: `payment-${request.id}`,
        label: `${request.client}: payment`,
        owner: 'Finance placeholder',
        severity: lower(request.payment).includes('overdue') ? 'high' : 'medium',
        source: request.source,
        entityId: request.id,
        nextStep: 'Confirm deposit or mark invoice path',
        reason: 'Payment state must be legible before the visit closes.',
      });
    }
  });

  normalizedNurses.forEach((nurse) => {
    if (!isReady(nurse.kit)) {
      addAction(actions, {
        id: `kit-${nurse.id}`,
        label: `${nurse.name}: kit`,
        owner: 'Inventory',
        severity: lower(nurse.status).includes('available') ? 'high' : 'medium',
        source: 'Provider OS',
        entityId: nurse.id,
        nextStep: 'Restock or block shift claim',
        reason: 'A nurse without a ready kit should not claim field work.',
      });
    }
  });

  normalizedInventory.forEach((item) => {
    const status = lower(item.status);
    const belowMin = item.qty <= item.minLevel;
    if (belowMin || status.includes('low') || status.includes('restock') || status.includes('expiry')) {
      addAction(actions, {
        id: `inventory-${item.id}`,
        label: item.name,
        owner: 'Inventory',
        severity: status.includes('restock') || item.qty <= 3 ? 'high' : 'medium',
        source: 'Inventory ledger',
        entityId: item.id,
        nextStep: status.includes('expiry') ? 'Review expiry before use' : 'Create restock order placeholder',
        reason: `${item.qty} on hand; minimum ${item.minLevel}.`,
      });
    }
  });

  return actions.sort((a, b) => {
    const severityDelta = SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity];
    if (severityDelta !== 0) return severityDelta;
    return a.label.localeCompare(b.label);
  });
}

export function scoreEnterpriseDispatchMatch({ request = {}, nurse = {}, inventory = [] } = {}) {
  const currentRequest = normalizeRequest(request);
  const currentNurse = normalizeNurse(nurse);
  const blockers = [];
  const reasons = [];
  let score = 52;

  if (isOffDuty(currentNurse)) {
    score -= 70;
    blockers.push('Off duty');
  } else if (lower(currentNurse.status).includes('available')) {
    score += 20;
    reasons.push('Available');
  } else if (lower(currentNurse.status).includes('assigned')) {
    score += 6;
    reasons.push('Working but usable');
  }

  if (areaMatches(currentRequest, currentNurse)) {
    score += 16;
    reasons.push('City zone match');
  } else {
    score -= 8;
    blockers.push('Zone mismatch');
  }

  if (isReady(currentNurse.kit)) {
    score += 14;
    reasons.push('Kit ready');
  } else {
    score -= 28;
    blockers.push('Kit not ready');
  }

  if (currentNurse.visits <= 1) score += 8;
  if (currentNurse.visits >= 3) {
    score -= 12;
    blockers.push('High workload');
  }

  if (!isReady(currentRequest.intake)) {
    score -= 22;
    blockers.push('Intake pending');
  }
  if (!isReady(currentRequest.consent)) {
    score -= 18;
    blockers.push('Consent pending');
  }
  if (!isReady(currentRequest.gfe)) {
    score -= 30;
    blockers.push('GFE placeholder pending');
  }
  if (!isReady(currentRequest.payment)) {
    score -= 6;
    reasons.push('Payment not final');
  }
  if (lower(currentRequest.priority).includes('vip')) score += 5;
  if (currentRequest.guests > 1) score -= Math.min(12, currentRequest.guests * 2);

  const relevantShortages = buildEnterpriseInventoryLedger({ requests: [currentRequest], inventory }).projectedShortages;
  if (relevantShortages.length) {
    score -= Math.min(18, relevantShortages.length * 6);
    blockers.push('Inventory risk');
  }

  const finalScore = clamp(Math.round(score));
  return {
    requestId: currentRequest.id,
    requestClient: currentRequest.client,
    nurseId: currentNurse.id,
    nurseName: currentNurse.name,
    score: finalScore,
    status: blockers.length ? 'Blocked' : finalScore >= 82 ? 'Top Match' : finalScore >= 68 ? 'Usable' : 'Weak',
    blockers: unique(blockers),
    reasons: unique(reasons),
    clinicalMode: ENTERPRISE_CLINICAL_MODE,
  };
}

export function buildEnterpriseDispatchMatrix({ requests = [], nurses = [], inventory = [] } = {}) {
  const normalizedRequests = normalizeRequests(requests);
  const normalizedNurses = normalizeNurses(nurses).filter((nurse) => !isOffDuty(nurse));
  return normalizedRequests
    .filter((request) => lower(request.nurse).includes('unassigned') || !isReady(request.gfe) || !isReady(request.intake))
    .map((request) => {
      const matches = normalizedNurses
        .map((nurse) => scoreEnterpriseDispatchMatch({ request, nurse, inventory }))
        .sort((a, b) => b.score - a.score);
      return {
        request,
        best: matches[0] || null,
        alternates: matches.slice(1, 3),
      };
    })
    .sort((a, b) => (b.best?.score || 0) - (a.best?.score || 0));
}

function supplyMapForRequest(request = {}) {
  const haystack = lower([request.therapy, ...asArray(request.addons)].join(' '));
  const supplies = [
    ['IV Bags (1L)', request.guests],
    ['IV Start Kit', request.guests],
    ['IV Extension Set', request.guests],
    ['Nitrile Gloves', request.guests * 2],
    ['Sharps Container', 1],
  ];

  if (haystack.includes('nad')) supplies.push(['NAD+ (250mg)', request.guests]);
  if (haystack.includes('glutathione')) supplies.push(['Glutathione 600mg', request.guests]);
  if (haystack.includes('b12')) supplies.push(['B12 Shot', request.guests]);
  if (haystack.includes('biotin') || haystack.includes('beauty')) supplies.push(['Biotin IM', request.guests]);
  if (haystack.includes('myers') || haystack.includes('energy')) {
    supplies.push(['B-Complex', request.guests]);
    supplies.push(['Vitamin C (50ml)', request.guests]);
  }
  if (haystack.includes('immunity')) {
    supplies.push(['Vitamin C (50ml)', request.guests]);
    supplies.push(['Glutathione 600mg', request.guests]);
  }
  if (haystack.includes('extra fluid')) supplies.push(['IV Bags (1L)', request.guests]);

  return supplies.map(([item, quantity]) => ({ item, quantity }));
}

function findInventoryItem(items = [], name = '') {
  const needle = lower(name).replace(/[^a-z0-9]+/g, ' ').trim();
  return items.find((item) => {
    const haystack = lower(item.name).replace(/[^a-z0-9]+/g, ' ').trim();
    return haystack.includes(needle) || needle.includes(haystack);
  });
}

export function buildEnterpriseInventoryLedger({ requests = [], inventory = [] } = {}) {
  const normalizedRequests = normalizeRequests(requests);
  const normalizedInventory = normalizeInventory(inventory);
  const transactions = [];
  const totals = new Map();

  normalizedRequests.forEach((request) => {
    supplyMapForRequest(request).forEach((line) => {
      const key = line.item;
      const existing = totals.get(key) || 0;
      totals.set(key, existing + line.quantity);
      transactions.push({
        id: `${request.id}-${idText(line.item)}`,
        bookingId: request.id,
        client: request.client,
        item: line.item,
        quantity: line.quantity,
        reason: request.therapy,
        status: 'planned',
        clinicalMode: ENTERPRISE_CLINICAL_MODE,
      });
    });
  });

  const projectedShortages = Array.from(totals.entries())
    .map(([itemName, needed]) => {
      const item = findInventoryItem(normalizedInventory, itemName);
      const onHand = item?.qty || 0;
      return {
        item: itemName,
        needed,
        onHand,
        shortage: Math.max(0, needed - onHand),
        status: item ? (needed > onHand ? 'Short' : 'Covered') : 'Missing seed',
      };
    })
    .filter((item) => item.shortage > 0 || item.status === 'Missing seed');

  return {
    status: projectedShortages.length ? 'Action' : 'Covered',
    transactions,
    totalLines: transactions.length,
    projectedShortages,
    clinicalMode: ENTERPRISE_CLINICAL_MODE,
  };
}

export function buildNurseMissionPacket({ request = {}, nurse = {}, inventory = [] } = {}) {
  const currentRequest = normalizeRequest(request);
  const currentNurse = normalizeNurse(nurse);
  const ledger = buildEnterpriseInventoryLedger({ requests: [currentRequest], inventory });
  return {
    id: `mission-${currentRequest.id}`,
    title: `${currentRequest.client} mission packet`,
    client: currentRequest.client,
    appointment: `${currentRequest.time} - ${currentRequest.city}`,
    address: currentRequest.address,
    nurse: currentNurse.name,
    route: {
      destination: currentRequest.address,
      maps: 'Apple/Google Maps placeholder',
      routeRule: 'Open navigation after accepting the visit.',
    },
    contact: {
      clientPhone: currentRequest.phone || 'Phone pending',
      nursePhone: currentNurse.phone || 'Nurse phone pending',
      textRule: 'Nurse may text the client after accepting the visit.',
    },
    bringList: ledger.transactions.map((line) => `${line.quantity} x ${line.item}`),
    closeoutSteps: [
      'Confirm Acuity entry before local completion.',
      'Log kit deductions against this visit.',
      'Flag incident or exception if anything deviates.',
      'Lock thin operational closeout after review.',
    ],
    blockers: buildEnterpriseActionQueue({ requests: [currentRequest], nurses: [currentNurse], inventory }).slice(0, 6),
    clinicalMode: ENTERPRISE_CLINICAL_MODE,
  };
}

export function buildEnterpriseSpineSnapshot({ requests = [], nurses = [], inventory = [], booking = null } = {}) {
  const normalizedRequests = normalizeRequests([booking, ...asArray(requests)].filter(Boolean));
  const normalizedNurses = normalizeNurses(nurses);
  const normalizedInventory = normalizeInventory(inventory);
  const actionQueue = buildEnterpriseActionQueue({
    requests: normalizedRequests,
    nurses: normalizedNurses,
    inventory: normalizedInventory,
  });
  const dispatchMatrix = buildEnterpriseDispatchMatrix({
    requests: normalizedRequests,
    nurses: normalizedNurses,
    inventory: normalizedInventory,
  });
  const inventoryLedger = buildEnterpriseInventoryLedger({
    requests: normalizedRequests,
    inventory: normalizedInventory,
  });
  const missionRequest = dispatchMatrix[0]?.request || normalizedRequests[0] || {};
  const missionNurseId = dispatchMatrix[0]?.best?.nurseId;
  const missionNurse = normalizedNurses.find((nurse) => nurse.id === missionNurseId)
    || normalizedNurses.find((nurse) => !isOffDuty(nurse))
    || {};
  const missionPacket = buildNurseMissionPacket({
    request: missionRequest,
    nurse: missionNurse,
    inventory: normalizedInventory,
  });

  return {
    mode: ENTERPRISE_SPINE_MODE,
    clinicalMode: ENTERPRISE_CLINICAL_MODE,
    contracts: CANONICAL_DATA_CONTRACTS,
    actionQueue,
    dispatchMatrix,
    inventoryLedger,
    missionPacket,
    metrics: {
      contracts: CANONICAL_DATA_CONTRACTS.length,
      requests: normalizedRequests.length,
      nurses: normalizedNurses.length,
      actions: actionQueue.length,
      dispatchRows: dispatchMatrix.length,
      topDispatchScore: dispatchMatrix[0]?.best?.score || 0,
      ledgerLines: inventoryLedger.totalLines,
      shortages: inventoryLedger.projectedShortages.length,
    },
  };
}
