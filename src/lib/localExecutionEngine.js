import {
  BOOKING_TRANSITIONS,
  resolveGfeRequirement,
  validateTransition,
} from './bookingLifecycle.js';
import { appendActivity, readLocal, writeLocal } from './localOs.js';
import {
  appendRepositoryEvent,
  buildUnifiedOperationalTruth,
  queueCrossPortalEvent,
  syncLocalRepository,
} from './localRepository.js';
import {
  buildSupplyBrainSnapshot,
  buildVisitSupplyReservation,
  normalizeSupplyItem,
} from './supplyBrain.js';
import { buildVisitCloseoutSnapshot } from './visitCloseoutBrain.js';
import { buildKitReconciliationSnapshot } from './kitReconciliationBrain.js';

export const LOCAL_EXECUTION_ENGINE_VERSION = '2026.05.no-api-execution-v1';

export const LOCAL_EXECUTION_PHASES = [
  {
    id: 'phase-4',
    label: 'Execution Engine',
    goal: 'Turn booking state into one deterministic local operating flow.',
    api: false,
  },
  {
    id: 'phase-5',
    label: 'Inventory Coupling',
    goal: 'Every visit creates projected supply impact and every completed IV creates kit deduction proof.',
    api: false,
  },
  {
    id: 'phase-6',
    label: 'Launch Gate',
    goal: 'Expose what is clear, blocked, or placeholder-safe before real operations.',
    api: false,
  },
];

const FIELD_STATUSES = ['Nurse Assigned', 'Ready for Visit', 'En Route', 'Arrived', 'In Progress'];
const DEDUCTION_STATUSES = ['Completed', 'Follow-Up Due'];

function text(value = '', fallback = '') {
  const next = String(value ?? '').trim();
  return next || fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

function requestId(request = {}, index = 0) {
  return text(request.id || request.reference || request.bookingId || request.visitId, `visit-${index + 1}`);
}

function clientName(request = {}) {
  return text(request.client || request.name || request.contact?.name || [request.contact?.firstName, request.contact?.lastName].filter(Boolean).join(' '), 'Client');
}

function serviceName(request = {}) {
  return text(request.therapy || request.service || request.plan || request.protocol, 'Avalon protocol');
}

function activeRequests(requests = [], booking = null) {
  const latest = booking ? [{
    ...booking,
    id: booking.id || booking.reference || 'latest-booking',
    client: booking.client || booking.contact?.name || 'Latest client',
    therapy: booking.service || booking.plan || booking.protocol,
    status: booking.status || 'New Request',
  }] : [];
  const seen = new Set();
  return [...latest, ...requests]
    .filter((request) => !/cancel|archive/i.test(request.status || ''))
    .filter((request, index) => {
      const id = requestId(request, index);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function done(value = '') {
  return /done|complete|signed|clear|valid|paid|confirmed/i.test(String(value || ''));
}

function statusStage(status = '') {
  if (/new|draft|scheduling/i.test(status)) return 'Intake';
  if (/intake|consent|clearance|gfe/i.test(status)) return 'Clearance';
  if (/nurse assigned|ready|en route|arrived|progress/i.test(status)) return 'Field';
  if (/completed|follow-up/i.test(status)) return 'Closeout';
  return 'Ops';
}

function findNurse(request = {}, nurses = []) {
  const assigned = compactText(request.nurse || request.nurseName || request.assignedNurse);
  if (!assigned || assigned === 'unassigned') return null;
  return nurses.find((nurse) => compactText(nurse.name) === assigned) || null;
}

function transitionChecks(request = {}) {
  const current = text(request.status, 'Draft');
  const allowed = BOOKING_TRANSITIONS[current] || [];
  return allowed.map((nextStatus) => ({
    status: nextStatus,
    ...validateTransition(request, nextStatus, { override: false }),
  }));
}

function readinessForRequest({ request = {}, nurses = [], inventory = [], index = 0 } = {}) {
  const id = requestId(request, index);
  const status = text(request.status, 'New Request');
  const gfe = resolveGfeRequirement(request);
  const nurse = findNurse(request, nurses);
  const assigned = Boolean(nurse || (request.nurse && request.nurse !== 'Unassigned'));
  const intakeReady = done(request.intake);
  const consentReady = done(request.consent);
  const paymentReady = done(request.payment || request.paymentStatus);
  const reservation = buildVisitSupplyReservation({ ...request, id }, inventory);
  const inventoryReady = reservation.status !== 'Blocked';
  const eta = text(request.eta || request.routeEta);
  const transitions = transitionChecks(request);

  const blockers = [
    !intakeReady && 'Intake',
    !consentReady && 'Consent',
    gfe.required && 'GFE',
    !paymentReady && 'Deposit',
    !assigned && 'Nurse',
    !inventoryReady && 'Inventory',
  ].filter(Boolean);

  const dispatchReady = blockers.length === 0;
  const nextAction = blockers[0]
    ? blockers[0] === 'GFE'
      ? 'Route Avalon NP first. Qualiphy only if no Avalon NP is on call.'
      : `Resolve ${blockers[0]}.`
    : eta
      ? 'Ready to execute.'
      : 'Nurse sets final ETA.';

  return {
    id,
    client: clientName(request),
    service: serviceName(request),
    status,
    stage: statusStage(status),
    request,
    nurse: nurse?.name || text(request.nurse || request.nurseName, 'Unassigned'),
    nurseId: nurse?.id || text(request.nurseId),
    eta: eta || 'Nurse sets final ETA',
    etaAuthority: assigned ? 'Nurse final say' : 'Locked until nurse accepts',
    gfe,
    intakeReady,
    consentReady,
    paymentReady,
    assigned,
    dispatchReady,
    inventoryReady,
    reservation,
    transitions,
    blockers,
    risk: blockers.length ? 'critical' : reservation.status === 'Watch' ? 'action' : 'ready',
    nextAction,
  };
}

function buildInventoryImpact(rows = []) {
  const grouped = new Map();
  rows.forEach((row) => {
    row.reservation.lines
      .filter((line) => !line.reusable)
      .forEach((line) => {
        const key = line.itemId || slug(line.name || line.match);
        const current = grouped.get(key) || {
          itemId: key,
          name: line.name || line.match,
          visits: 0,
          demand: 0,
          blocked: 0,
          projectedRemaining: line.available,
          unit: line.unit || 'units',
        };
        current.visits += 1;
        current.demand += number(line.qty);
        current.blocked += line.status === 'Short' ? 1 : 0;
        current.projectedRemaining = Math.min(current.projectedRemaining, number(line.projectedRemaining));
        grouped.set(key, current);
      });
  });
  return [...grouped.values()].sort((a, b) => b.blocked - a.blocked || a.projectedRemaining - b.projectedRemaining);
}

function readExecutionLedger() {
  return readLocal('localExecutionLedger', []);
}

function writeExecutionLedger(entries = []) {
  return writeLocal('localExecutionLedger', entries.slice(0, 240));
}

function deductionEntry(row = {}) {
  return {
    id: `execution-deduct-${row.id}`,
    visitId: row.id,
    client: row.client,
    service: row.service,
    nurseName: row.nurse,
    source: LOCAL_EXECUTION_ENGINE_VERSION,
    status: 'Queued',
    phiExcluded: true,
    createdAt: new Date().toISOString(),
    lines: row.reservation.lines
      .filter((line) => !line.reusable)
      .map((line) => ({
        match: line.match,
        itemId: line.itemId,
        name: line.name,
        qty: line.qty,
        unit: line.unit,
        available: line.available,
        status: line.status,
      })),
  };
}

function applyExecutionLedgerToInventory(inventory = [], ledger = []) {
  const totals = ledger.reduce((acc, entry) => {
    entry.lines?.forEach((line) => {
      if (!line.itemId) return;
      acc[line.itemId] = (acc[line.itemId] || 0) + number(line.qty);
    });
    return acc;
  }, {});

  return inventory.map((item) => {
    const normalized = normalizeSupplyItem(item);
    const used = totals[normalized.id] || 0;
    const qty = Math.max(0, normalized.qty - used);
    return normalizeSupplyItem({
      ...item,
      qty,
      quantity: qty,
      consumedByVisits: used,
      status: qty <= Math.max(1, Math.floor(normalized.minLevel / 2))
        ? 'Critical'
        : qty <= normalized.minLevel
          ? 'Low Stock'
          : normalized.status,
    });
  });
}

function queueExecutionDeductions(rows = [], inventory = []) {
  const current = readExecutionLedger();
  const existing = new Set(current.map((entry) => entry.visitId));
  const nextEntries = rows
    .filter((row) => DEDUCTION_STATUSES.includes(row.status))
    .filter((row) => row.reservation.lines.some((line) => !line.reusable))
    .filter((row) => !existing.has(row.id))
    .map(deductionEntry);
  const ledger = [...nextEntries, ...current].slice(0, 240);
  if (nextEntries.length) writeExecutionLedger(ledger);
  const projectedInventory = applyExecutionLedgerToInventory(inventory, ledger);
  if (nextEntries.length) writeLocal('inventorySimulation', projectedInventory);
  return {
    entries: nextEntries,
    ledger,
    inventory: projectedInventory,
  };
}

function launchGate(metrics = {}) {
  const gates = [
    { id: 'client', label: 'Client flow', clear: metrics.active > 0, detail: `${metrics.active} active local visits.` },
    { id: 'dispatch', label: 'Dispatch', clear: metrics.dispatchReady > 0, detail: `${metrics.dispatchReady} visits ready to dispatch.` },
    { id: 'gfe', label: 'Annual GFE', clear: metrics.gfeRequired === 0, detail: `${metrics.gfeRequired} GFE action${metrics.gfeRequired === 1 ? '' : 's'}.` },
    { id: 'inventory', label: 'Inventory', clear: metrics.inventoryBlocked === 0, detail: `${metrics.inventoryBlocked} inventory block${metrics.inventoryBlocked === 1 ? '' : 's'}.` },
    { id: 'closeout', label: 'Closeout', clear: metrics.closeoutNeeded === 0, detail: `${metrics.closeoutNeeded} closeout lock${metrics.closeoutNeeded === 1 ? '' : 's'}.` },
    { id: 'api-boundary', label: 'API boundary', clear: true, detail: 'Third-party handoffs stay placeholder-safe.' },
  ];
  const clear = gates.filter((gate) => gate.clear).length;
  return {
    gates,
    clear,
    blocked: gates.length - clear,
    score: Math.round((clear / gates.length) * 100),
    status: clear === gates.length ? 'Launch Ready' : clear >= 4 ? 'Constrained' : 'Blocked',
  };
}

export function buildLocalExecutionSnapshot({
  requests = [],
  nurses = [],
  inventory = [],
  booking = null,
} = {}) {
  const visits = activeRequests(requests, booking).map((request, index) => readinessForRequest({
    request,
    nurses,
    inventory,
    index,
  }));
  const supply = buildSupplyBrainSnapshot({ requests, nurses, inventory, booking });
  const closeout = buildVisitCloseoutSnapshot({ requests, nurses, inventory, booking });
  const kit = buildKitReconciliationSnapshot({ requests, nurses, inventory, booking });
  const truth = buildUnifiedOperationalTruth({ requests, nurses, inventory, booking });
  const inventoryImpact = buildInventoryImpact(visits);
  const metrics = {
    active: visits.length,
    dispatchReady: visits.filter((row) => row.dispatchReady).length,
    blocked: visits.filter((row) => row.blockers.length).length,
    gfeRequired: visits.filter((row) => row.gfe.required).length,
    inventoryBlocked: visits.filter((row) => !row.inventoryReady).length,
    field: visits.filter((row) => FIELD_STATUSES.includes(row.status)).length,
    closeoutNeeded: closeout.metrics?.closeoutNeeded || 0,
    ledgerEvents: truth.ledger.eventCount,
  };
  const gate = launchGate(metrics);
  const phaseScores = [
    { id: 'phase-4', label: 'Execution Engine', score: truth.score, status: truth.status },
    { id: 'phase-5', label: 'Inventory Coupling', score: Math.max(0, 100 - metrics.inventoryBlocked * 18), status: metrics.inventoryBlocked ? 'Action' : 'Ready' },
    { id: 'phase-6', label: 'Launch Gate', score: gate.score, status: gate.status },
  ];

  return {
    version: LOCAL_EXECUTION_ENGINE_VERSION,
    phases: LOCAL_EXECUTION_PHASES,
    metrics,
    visits,
    inventoryImpact,
    supply,
    closeout,
    kit,
    truth,
    gate,
    phaseScores,
    status: gate.status,
    score: Math.round(phaseScores.reduce((sum, item) => sum + item.score, 0) / phaseScores.length),
  };
}

export function runLocalExecutionSweep({
  requests = [],
  nurses = [],
  inventory = [],
  booking = null,
  actor = 'Avalon OS',
} = {}) {
  const seed = { requests, nurses, inventory, booking };
  const snapshot = buildLocalExecutionSnapshot(seed);
  const repo = syncLocalRepository(seed, actor);
  const deduction = queueExecutionDeductions(snapshot.visits, inventory);
  const dispatchEvents = snapshot.visits
    .filter((row) => row.dispatchReady)
    .map((row) => queueCrossPortalEvent({
      type: 'execution.dispatch.ready',
      visitId: row.id,
      actor,
      payload: {
        bookingId: row.id,
        client: row.client,
        service: row.service,
        nurse: row.nurse,
        eta: row.eta,
        clientVisible: true,
        nurseVisible: true,
      },
    }));
  const ledgerEvent = appendRepositoryEvent({
    type: 'execution.sweep.completed',
    entityType: 'execution',
    entityId: LOCAL_EXECUTION_ENGINE_VERSION,
    actor,
    payload: {
      active: snapshot.metrics.active,
      dispatchReady: snapshot.metrics.dispatchReady,
      blocked: snapshot.metrics.blocked,
      deductionsQueued: deduction.entries.length,
      gate: snapshot.gate.status,
    },
  });

  appendActivity('Local execution sweep complete', {
    role: actor,
    visits: snapshot.metrics.active,
    deductionsQueued: deduction.entries.length,
  });

  return {
    snapshot: buildLocalExecutionSnapshot(seed),
    repo,
    deduction,
    dispatchEvents,
    ledgerEvent,
    actions: [
      ...dispatchEvents.map((event) => ({ type: event.type, id: event.id })),
      ...deduction.entries.map((entry) => ({ type: 'kit-deduction', id: entry.id })),
      { type: ledgerEvent.type, id: ledgerEvent.id },
    ],
  };
}
