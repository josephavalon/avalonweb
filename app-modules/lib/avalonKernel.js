import { IV_ADDONS, IV_SESSIONS, IM_SHOTS } from '@/data/catalog';
import { SEED_ITEMS } from '@/data/inventorySeed';
import {
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  resolveGfeRequirement,
  validateTransition,
} from '@/lib/bookingLifecycle';
import {
  appendActivity,
  readActivity,
  readLastBooking,
  readLocal,
  writeLocal,
} from '@/lib/localOs';
import { queueCrossPortalEvent, upsertRepositoryEntity } from '@/lib/localRepository';
import {
  buildKitControlTower,
  buildTrainingControlTower,
  estimateShiftValue,
  inferBookingCity,
  readAnnouncements,
  readAssignmentBroadcasts,
  readCommunicationAlerts,
  readGfeRoutingQueue,
  readKitDeductionLedger,
  readKitRestockQueue,
  readPayrollProofQueue,
} from '@/lib/platformOps';

export const KERNEL_BUILD_ITEMS = [
  ['avalon-kernel', 'Avalon Kernel'],
  ['state-machine', 'Unified state machine'],
  ['event-bus', 'Event bus'],
  ['exception-engine', 'Exception engine'],
  ['role-permissions', 'Role permissions'],
  ['audit-ledger', 'Audit ledger'],
  ['protocol-registry', 'Protocol registry'],
  ['protocol-inventory-map', 'Protocol-to-inventory map'],
  ['protocol-credential-map', 'Protocol-to-credential map'],
  ['protocol-gfe-map', 'Protocol-to-GFE map'],
  ['nurse-eligibility', 'Nurse eligibility matching'],
  ['kit-readiness', 'Kit readiness score'],
  ['nurse-eta', 'Nurse final ETA flow'],
  ['no-acceptance', 'No-acceptance escalation'],
  ['late-risk', 'Late-risk detection'],
  ['thin-chart', 'Thin chart'],
  ['chart-lock', 'Chart lock/addendum'],
  ['visit-margin', 'Visit margin estimate'],
  ['nurse-payout', 'Nurse payout preview'],
  ['refund-state', 'Refund/adjustment state'],
  ['client-tracker', 'Client tracker hardening'],
  ['annual-gfe', 'GFE-valid returning-client flow'],
  ['launch-capacity', 'Launch capacity planning'],
  ['qr-redemption', 'QR redemption placeholder'],
  ['group-intake', 'Group intake'],
  ['follow-up', 'Follow-up recommendation'],
  ['founder-intelligence', 'Founder command intelligence'],
  ['compliance-copy', 'Compliance copy controls'],
  ['audit-export', 'Audit export'],
  ['system-health', 'System health monitor'],
  ['demand-forecast', 'Demand forecast'],
  ['coverage-matrix', 'Coverage matrix'],
  ['service-area-score', 'Service-area score'],
  ['price-integrity', 'Price integrity'],
  ['deposit-gate', 'Deposit gate'],
  ['checkout-friction', 'Checkout friction score'],
  ['protocol-recommendation', 'Protocol recommendation'],
  ['addon-guardrails', 'Add-on guardrails'],
  ['membership-fit', 'Membership fit'],
  ['subscription-controls', 'Subscription pause/resume'],
  ['client-risk-flags', 'Client risk flags'],
  ['consent-completeness', 'Consent completeness'],
  ['identity-placeholder', 'Identity verification placeholder'],
  ['route-packet', 'Nurse route packet'],
  ['mission-packet', 'Mission packet'],
  ['offline-queue', 'Offline mode queue'],
  ['notification-preferences', 'Notification preferences'],
  ['announcement-governance', 'Announcement governance'],
  ['broadcast-rate-limit', 'Broadcast rate limiting'],
  ['comms-triage', 'Comms inbox triage'],
  ['escalation-ladder', 'Escalation ladder'],
  ['shift-fairness', 'Shift offer fairness'],
  ['fatigue-guard', 'Fatigue guard'],
  ['credential-forecast', 'Credential expiry forecast'],
  ['training-gate', 'Training gate blocker'],
  ['inventory-expiry', 'Inventory expiry forecast'],
  ['cold-chain-placeholder', 'Cold-chain placeholder'],
  ['waste-log', 'Waste log'],
  ['incident-packet', 'Incident packet'],
  ['post-visit-qa', 'Post-visit QA score'],
].map(([id, label], index) => ({ id, label, number: index + 1, status: 'Live' }));

export const KERNEL_ROLE_PERMISSIONS = {
  client: ['book', 'viewOwnVisit', 'viewEta', 'completeIntake', 'viewGfeStatus', 'messageCareTeam'],
  nurse: ['claimShift', 'setEta', 'viewProtocol', 'viewKit', 'chartThin', 'lockChart', 'messageClient'],
  np: ['reviewGfe', 'approveProtocol', 'viewCharts', 'addAddendum', 'coverClinicalQueue'],
  physician: ['reviewGfe', 'approveProtocol', 'approveStandingOrders', 'viewCharts', 'addAddendum'],
  ops_manager: ['dispatch', 'broadcast', 'assignNurse', 'viewInventory', 'viewExceptions', 'exportAudit'],
  admin: ['godView', 'dispatch', 'broadcast', 'assignNurse', 'viewFinance', 'viewCompliance', 'exportAudit'],
  founder: ['godView', 'kernelHealth', 'viewFinance', 'viewCompliance', 'exportAudit', 'capacityPlan'],
};

const DISPATCH_STATUSES = ['Ready for Visit', 'En Route', 'Arrived', 'In Progress', 'Completed'];
const CHART_LOCKED_STATUS = 'Locked';
const CRITICAL_COPY_CLAIMS = [
  'cures',
  'treats disease',
  'reverses aging',
  'detoxes toxins',
  'prevents hangovers',
  'guarantees results',
  'fixes illness',
  'choose your drugs',
  'self-prescribed iv',
];

const SAFE_COPY_PHRASES = [
  'supports hydration',
  'supports recovery',
  'clinician-reviewed',
  'licensed RN',
  'medical clearance required',
  'final treatment subject to clinical approval',
  'availability depends on clinical eligibility',
];

const BAY_AREA_MARKETS = [
  'San Francisco',
  'Oakland',
  'Berkeley',
  'Alameda',
  'Hayward',
  'San Mateo',
  'Palo Alto',
  'San Jose',
  'Marin',
  'Walnut Creek',
  'Napa',
  'Sonoma',
];

function nowIso() {
  return new Date().toISOString();
}

function compactText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bookingProtocolKey(booking = {}) {
  const service = compactText(booking.protocolKey || booking.service || booking.therapy);
  const match = IV_SESSIONS.find((item) => service.includes(item.key) || service.includes(compactText(item.label)));
  if (match) return match.key;
  if (service.includes('nad')) return 'nad';
  if (service.includes('cbd')) return 'cbd';
  if (service.includes('myers')) return 'myers';
  if (service.includes('recovery')) return 'recovery';
  if (service.includes('energy') || service.includes('performance')) return 'energy';
  return 'hydration';
}

function itemMatchesNeed(item = {}, terms = []) {
  const haystack = compactText(`${item.name} ${item.sku} ${item.category}`);
  return terms.some((term) => haystack.includes(compactText(term)));
}

function buildInventoryNeed(label, terms, quantity = 1, required = true) {
  const item = SEED_ITEMS.find((candidate) => itemMatchesNeed(candidate, terms));
  const stock = number(item?.qty, 0);
  return {
    key: compactText(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    label,
    terms,
    quantity,
    required,
    inventoryItemId: item?.id || '',
    sku: item?.sku || '',
    stock,
    ready: stock >= quantity,
  };
}

const BASE_IV_NEEDS = [
  buildInventoryNeed('Normal saline', ['normal saline', 'iv bag'], 1),
  buildInventoryNeed('IV start kit', ['iv start kit'], 1),
  buildInventoryNeed('Extension set', ['extension'], 1),
  buildInventoryNeed('Nitrile gloves', ['gloves'], 1),
  buildInventoryNeed('Sharps container', ['sharps'], 1),
  buildInventoryNeed('BP cuff', ['bp cuff'], 1),
  buildInventoryNeed('Pulse oximeter', ['pulse oximeter'], 1),
  buildInventoryNeed('Epinephrine', ['epinephrine'], 1),
  buildInventoryNeed('Diphenhydramine', ['diphenhydramine'], 1),
];

const PROTOCOL_NEEDS = {
  hydration: [buildInventoryNeed('B-Complex', ['b-complex'], 1)],
  energy: [
    buildInventoryNeed('B-Complex', ['b-complex'], 1),
    buildInventoryNeed('Magnesium', ['magnesium'], 1),
    buildInventoryNeed('B12', ['b12'], 1),
  ],
  immunity: [
    buildInventoryNeed('Vitamin C', ['vitamin c'], 1),
    buildInventoryNeed('Glutathione', ['glutathione'], 1),
  ],
  beauty: [
    buildInventoryNeed('Glutathione', ['glutathione'], 1),
    buildInventoryNeed('Biotin', ['biotin'], 1),
  ],
  recovery: [
    buildInventoryNeed('Magnesium', ['magnesium'], 1),
    buildInventoryNeed('Ondansetron', ['ondansetron', 'zofran'], 1, false),
  ],
  jetlag: [
    buildInventoryNeed('B-Complex', ['b-complex'], 1),
    buildInventoryNeed('Magnesium', ['magnesium'], 1),
  ],
  myers: [
    buildInventoryNeed('B-Complex', ['b-complex'], 1),
    buildInventoryNeed('Magnesium', ['magnesium'], 1),
    buildInventoryNeed('Vitamin C', ['vitamin c'], 1),
  ],
  postnight: [
    buildInventoryNeed('Glutathione', ['glutathione'], 1),
    buildInventoryNeed('Ondansetron', ['ondansetron', 'zofran'], 1, false),
  ],
  nad: [buildInventoryNeed('NAD+ 250mg', ['nad'], 1)],
  cbd: [buildInventoryNeed('CBD 33mg', ['cbd'], 1)],
};

export function canKernelRole(role = 'client', permission = '') {
  return Boolean(KERNEL_ROLE_PERMISSIONS[role]?.includes(permission));
}

export function emitKernelEvent(type, payload = {}, actor = 'Avalon Kernel') {
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    actor,
    payload,
    at: nowIso(),
  };
  const events = readLocal('kernel.events', []);
  writeLocal('kernel.events', [event, ...events].slice(0, 500));
  appendActivity(`Kernel: ${type}`, { actor, ...payload });
  return event;
}

export function readKernelEvents(limit = 80) {
  return readLocal('kernel.events', []).slice(0, limit);
}

export function buildProtocolInventoryMap(protocolKey = '') {
  if (protocolKey) return [...BASE_IV_NEEDS, ...(PROTOCOL_NEEDS[protocolKey] || PROTOCOL_NEEDS.hydration)];
  return Object.fromEntries(IV_SESSIONS.map((session) => [session.key, buildProtocolInventoryMap(session.key)]));
}

export function buildProtocolCredentialMap(protocolKey = '') {
  const map = Object.fromEntries(IV_SESSIONS.map((session) => {
    const advanced = ['nad', 'cbd'].includes(session.key);
    return [session.key, {
      rn: true,
      activeLicense: true,
      protocols: ['IV start', 'Vitals', 'Adverse event escalation', advanced ? 'Advanced protocol review' : 'Standard protocol review'],
      advanced,
      npOrMdApproval: advanced,
    }];
  }));
  return protocolKey ? map[protocolKey] || map.hydration : map;
}

export function buildProtocolGfeMap(protocolKey = '') {
  const map = Object.fromEntries(IV_SESSIONS.map((session) => [session.key, {
    annualRequired: true,
    reviewLevel: ['nad', 'cbd'].includes(session.key) ? 'Advanced annual GFE plus protocol approval' : 'Annual GFE',
    fallback: 'Qualiphy only if Avalon NP is not on call',
  }]));
  return protocolKey ? map[protocolKey] || map.hydration : map;
}

export function buildProtocolRegistry() {
  return {
    protocols: IV_SESSIONS.map((session) => ({
      key: session.key,
      label: session.label,
      price: session.price || session.doses?.[0]?.price || 0,
      category: session.category || 'recovery',
      status: session.key === 'cbd' ? 'Approval gated' : 'Live or consultation',
      duration: session.duration || session.doses?.[0]?.duration || 'Clinical window',
      inventory: buildProtocolInventoryMap(session.key),
      credentials: buildProtocolCredentialMap(session.key),
      gfe: buildProtocolGfeMap(session.key),
    })),
    addOns: IV_ADDONS.map((item) => ({ label: item.label, price: item.price, group: item.group || 'standard' })),
    imShots: IM_SHOTS.map((item) => ({ label: item.label, price: item.price })),
  };
}

export function buildKernelKitReadiness({ booking = readLastBooking(), nurse = null } = {}) {
  const protocolKey = bookingProtocolKey(booking || {});
  const lines = buildProtocolInventoryMap(protocolKey);
  const requiredLines = lines.filter((line) => line.required);
  const readyRequired = requiredLines.filter((line) => line.ready).length;
  const score = requiredLines.length ? Math.round((readyRequired / requiredLines.length) * 100) : 100;
  const tower = buildKitControlTower({ inventory: SEED_ITEMS, latestBooking: booking, nurses: nurse ? [nurse] : [] });
  return {
    protocolKey,
    score,
    status: score >= 95 ? 'Ready' : score >= 80 ? 'Watch' : 'Blocked',
    lines,
    blockers: requiredLines.filter((line) => !line.ready),
    restockQueue: readKitRestockQueue(),
    deductionLedger: readKitDeductionLedger(),
    tower,
  };
}

export function scoreNurseEligibility({ nurse = {}, booking = readLastBooking(), protocolKey = bookingProtocolKey(booking || {}) } = {}) {
  const credentials = buildProtocolCredentialMap(protocolKey);
  const training = buildTrainingControlTower({ nurses: nurse?.id ? [nurse] : [] });
  const kitReady = String(nurse.kit || '').toLowerCase().includes('ready') ? 25 : 5;
  const available = /available|assigned|ready/i.test(nurse.status || '') ? 20 : 0;
  const area = compactText(nurse.area).includes(compactText(inferBookingCity(booking || {}))) || compactText(nurse.area).includes('sf') ? 15 : 8;
  const license = nurse.license === 'Blocked' || nurse.credentialStatus === 'Blocked' ? 0 : 20;
  const advanced = credentials.advanced ? (/nad|advanced|np|md/i.test(`${nurse.training || ''} ${nurse.role || ''}`) ? 20 : 8) : 20;
  const score = Math.min(100, kitReady + available + area + license + advanced);
  return {
    nurseId: nurse.id || nurse.name || 'nurse',
    nurse: nurse.name || 'Nurse',
    score,
    eligible: score >= 75,
    reasons: [
      kitReady >= 20 ? 'Kit ready' : 'Kit needs review',
      available >= 20 ? 'Available' : 'Availability unclear',
      license > 0 ? 'Credential not blocked' : 'Credential blocked',
      advanced >= 20 ? 'Protocol fit' : 'Needs advanced review',
    ],
    training,
  };
}

export function buildKernelExceptions({ booking = readLastBooking(), nurses = [] } = {}) {
  const exceptions = [];
  const gfe = resolveGfeRequirement(booking || {});
  const kit = buildKernelKitReadiness({ booking });
  const status = booking?.status || 'Draft';
  const nurseName = booking?.nurse || '';
  const eta = readLocal(`routeEta.${booking?.id || booking?.reference || 'latest'}`, null);
  const chart = readThinChart(booking?.id || booking?.reference || 'latest');
  const broadcasts = readAssignmentBroadcasts();

  if (gfe.required && DISPATCH_STATUSES.includes(status)) {
    exceptions.push({ id: 'gfe-block', severity: 'Critical', label: 'GFE required before dispatch', owner: 'Clinical', action: gfe.reason });
  }
  if (kit.status === 'Blocked') {
    exceptions.push({ id: 'kit-block', severity: 'Critical', label: 'Kit missing required stock', owner: 'Ops', action: `${kit.blockers.length} required line(s) short.` });
  }
  if (!nurseName || nurseName === 'Unassigned') {
    exceptions.push({ id: 'nurse-open', severity: 'High', label: 'No nurse accepted', owner: 'Dispatch', action: 'Broadcast shift or assign manually.' });
  }
  if (nurseName && nurseName !== 'Unassigned' && DISPATCH_STATUSES.includes(status) && !eta) {
    exceptions.push({ id: 'eta-missing', severity: 'High', label: 'Nurse ETA missing', owner: 'Nurse', action: 'Nurse sets final ETA before client route text.' });
  }
  if (broadcasts.some((item) => item.status !== 'Assigned')) {
    exceptions.push({ id: 'acceptance-open', severity: 'Medium', label: 'Open shift acceptance', owner: 'Dispatch', action: 'Escalate if no Y/N reply.' });
  }
  if (isLateRisk(booking)) {
    exceptions.push({ id: 'late-risk', severity: 'High', label: 'Late-risk visit', owner: 'Dispatch', action: 'Confirm ETA, traffic, and client text.' });
  }
  if (status === 'Completed' && (!chart || chart.status !== CHART_LOCKED_STATUS)) {
    exceptions.push({ id: 'chart-open', severity: 'High', label: 'Completed visit needs locked chart', owner: 'Nurse', action: 'Save thin chart, lock, then add addendum only.' });
  }

  const nurseScores = nurses.map((nurse) => scoreNurseEligibility({ nurse, booking }));
  if (nurseScores.length && !nurseScores.some((item) => item.eligible)) {
    exceptions.push({ id: 'eligibility-gap', severity: 'High', label: 'No eligible nurse match', owner: 'Dispatch', action: 'Check kit, credential, protocol review.' });
  }

  return exceptions;
}

export function isLateRisk(booking = {}) {
  const raw = booking?.acuitySlot?.datetime || booking?.slot?.datetime || booking?.datetime || '';
  if (!raw) return false;
  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) return false;
  const minutes = (time - Date.now()) / 60000;
  return minutes > 0 && minutes <= 90 && (!booking.nurse || booking.nurse === 'Unassigned' || !booking.eta);
}

export function setKernelNurseEta(visitId = 'latest', eta = '', actor = 'Nurse') {
  const record = { visitId, eta, finalSay: true, actor, updatedAt: nowIso() };
  writeLocal(`routeEta.${visitId}`, record);
  upsertRepositoryEntity('visit', {
    id: visitId,
    client: 'Client visible after assignment',
    status: 'En Route',
    eta,
  }, actor);
  queueCrossPortalEvent({
    type: 'nurse.eta_set',
    visitId,
    payload: { visitId, eta, finalSay: true, clientVisible: true, nurseVisible: true },
    actor,
  });
  emitKernelEvent('nurse.eta_set', record, actor);
  return record;
}

export function readThinChart(visitId = 'latest') {
  return readLocal(`thinChart.${visitId}`, null);
}

export function saveThinChart(visitId = 'latest', chart = {}, actor = 'Nurse') {
  const existing = readThinChart(visitId);
  if (existing?.status === CHART_LOCKED_STATUS) {
    return { ok: false, chart: existing, error: 'Locked charts require an addendum.' };
  }
  const next = {
    id: visitId,
    status: 'Draft',
    vitals: chart.vitals || {},
    protocol: chart.protocol || '',
    startTime: chart.startTime || '',
    stopTime: chart.stopTime || '',
    adverseEvent: chart.adverseEvent || 'None reported',
    rnNote: chart.rnNote || '',
    updatedAt: nowIso(),
  };
  writeLocal(`thinChart.${visitId}`, next);
  emitKernelEvent('chart.saved', { visitId }, actor);
  return { ok: true, chart: next };
}

export function lockThinChart(visitId = 'latest', actor = 'Nurse') {
  const chart = readThinChart(visitId) || { id: visitId, vitals: {}, adverseEvent: 'None reported' };
  const next = { ...chart, status: CHART_LOCKED_STATUS, lockedAt: nowIso(), lockedBy: actor };
  writeLocal(`thinChart.${visitId}`, next);
  emitKernelEvent('chart.locked', { visitId }, actor);
  return next;
}

export function addChartAddendum(visitId = 'latest', note = '', actor = 'Nurse') {
  const chart = readThinChart(visitId) || lockThinChart(visitId, actor);
  const addendum = { id: `${Date.now()}`, note, actor, at: nowIso() };
  const next = { ...chart, status: CHART_LOCKED_STATUS, addenda: [...(chart.addenda || []), addendum] };
  writeLocal(`thinChart.${visitId}`, next);
  emitKernelEvent('chart.addendum', { visitId }, actor);
  return next;
}

export function estimateVisitEconomics({ booking = readLastBooking() } = {}) {
  const revenue = number(booking?.subtotal || booking?.total || booking?.amount, 250);
  const shiftValue = estimateShiftValue(booking || {});
  const protocolKey = bookingProtocolKey(booking || {});
  const inventoryCost = buildProtocolInventoryMap(protocolKey).reduce((sum, line) => {
    const item = SEED_ITEMS.find((candidate) => candidate.id === line.inventoryItemId);
    return sum + number(item?.price, 0) * number(line.quantity, 1);
  }, 0);
  const platformReserve = Math.round(revenue * 0.08);
  const margin = Math.max(0, revenue - shiftValue - inventoryCost - platformReserve);
  return {
    revenue,
    nursePayout: shiftValue,
    inventoryCost: Math.round(inventoryCost),
    platformReserve,
    margin: Math.round(margin),
    marginPercent: revenue ? Math.round((margin / revenue) * 100) : 0,
  };
}

export function estimateRefundState({ booking = readLastBooking() } = {}) {
  const status = booking?.status || 'Draft';
  const payment = booking?.payment || 'Pending';
  const gfe = resolveGfeRequirement(booking || {});
  if (/cancel/i.test(status)) return { state: 'Review', action: 'Apply cancellation policy.', amount: number(booking?.deposit, 50) };
  if (payment === 'Paid' && gfe.required) return { state: 'Protected', action: 'Clinical ineligible visits are adjusted or refunded by policy.', amount: number(booking?.deposit, 50) };
  if (payment === 'Paid') return { state: 'Settled', action: 'No refund action.', amount: 0 };
  return { state: 'Open', action: 'Collect deposit before confirmation.', amount: number(booking?.deposit, 50) };
}

export function buildClientTracker({ booking = readLastBooking() } = {}) {
  const gfe = resolveGfeRequirement(booking || {});
  const validation = validateTransition(booking || {}, booking?.status || 'Draft', { override: true });
  const eta = readLocal(`routeEta.${booking?.id || booking?.reference || 'latest'}`, null);
  return {
    reference: booking?.reference || booking?.id || 'Pending',
    status: booking?.status || 'Draft',
    next: gfe.required ? 'Clinical clearance' : booking?.nurse && booking.nurse !== 'Unassigned' ? 'Nurse ETA' : 'Nurse assignment',
    gfe,
    eta,
    validation,
    visibleCopy: gfe.required
      ? 'Clinical clearance is required before your visit.'
      : 'Annual clinical clearance is current.',
  };
}

export function estimateLaunchCapacity({ requests = [], nurses = [] } = {}) {
  const activeNurses = nurses.filter((nurse) => /available|assigned|ready/i.test(nurse.status || ''));
  const totalVisits = requests.reduce((sum, item) => sum + Math.max(1, number(item.guests, 1)), 0);
  const capacity = activeNurses.length * 4;
  return {
    activeNurses: activeNurses.length,
    requestLoad: totalVisits,
    capacity,
    remaining: capacity - totalVisits,
    status: capacity >= totalVisits ? 'Ready' : 'Need nurses',
  };
}

export function buildQrRedemptionPlaceholder({ booking = readLastBooking(), eventId = 'launch' } = {}) {
  return {
    code: `AV-${eventId}-${String(booking?.reference || booking?.id || 'LOCAL').replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()}`,
    status: 'Local placeholder',
    action: 'Redeem into Acuity presale handoff when API is configured.',
  };
}

export function buildGroupIntakePlan({ booking = readLastBooking() } = {}) {
  const guests = Math.max(1, number(booking?.guests, 1));
  return {
    guests,
    requiredIntakes: guests,
    completed: number(booking?.completedIntakes, guests > 1 ? 1 : guests),
    status: guests > 1 ? 'Group intake required' : 'Single intake',
    rule: 'Each participant gets individual consent and annual GFE check.',
  };
}

export function buildFollowUpRecommendation({ booking = readLastBooking() } = {}) {
  const protocolKey = bookingProtocolKey(booking || {});
  const days = ['nad', 'cbd'].includes(protocolKey) ? 7 : 2;
  return {
    type: protocolKey === 'nad' ? 'Advanced protocol check-in' : 'Recovery check-in',
    dueInDays: days,
    message: 'Send a short post-visit check-in, review request if appropriate, and membership prompt only after care is complete.',
  };
}

export function buildFounderCommandIntelligence({ requests = [], nurses = [], booking = readLastBooking() } = {}) {
  const exceptions = buildKernelExceptions({ booking, nurses });
  const economics = estimateVisitEconomics({ booking });
  const capacity = estimateLaunchCapacity({ requests, nurses });
  return {
    score: Math.max(0, 100 - exceptions.filter((item) => item.severity === 'Critical').length * 30 - exceptions.filter((item) => item.severity === 'High').length * 12),
    thesis: 'Fast premium recovery depends on clearance, nurse acceptance, ETA, kit readiness, and locked chart proof.',
    topMove: exceptions[0]?.action || (capacity.remaining < 2 ? 'Add nurse coverage before adding demand.' : 'Push booked visits through dispatch.'),
    economics,
    capacity,
    exceptions,
  };
}

export function buildComplianceCopyControls(copy = '') {
  const lower = compactText(copy);
  const blocked = CRITICAL_COPY_CLAIMS.filter((claim) => lower.includes(claim));
  return {
    ok: blocked.length === 0,
    blocked,
    safePhrases: SAFE_COPY_PHRASES,
    rule: 'Protocols can be selected by outcome; final treatment remains subject to clinical eligibility and approval.',
  };
}

export function exportKernelAudit() {
  return {
    exportedAt: nowIso(),
    buildItems: KERNEL_BUILD_ITEMS,
    events: readKernelEvents(500),
    activity: readActivity(80),
    gfeQueue: readGfeRoutingQueue(),
    payrollQueue: readPayrollProofQueue(),
    kitDeductions: readKitDeductionLedger(),
  };
}

export function buildKernelSystemHealth({ requests = [], nurses = [] } = {}) {
  const events = readKernelEvents(500);
  const gfeQueue = readGfeRoutingQueue();
  const payrollQueue = readPayrollProofQueue();
  const restockQueue = readKitRestockQueue();
  const critical = [
    gfeQueue.length > 4 ? 'GFE queue load' : '',
    restockQueue.length > 4 ? 'Restock queue load' : '',
  ].filter(Boolean);
  return {
    score: Math.max(0, 100 - critical.length * 20),
    status: critical.length ? 'Watch' : 'Nominal',
    checks: [
      { label: 'Local event bus', value: `${events.length} events`, status: 'Live' },
      { label: 'Annual GFE resolver', value: `${gfeQueue.length} queued`, status: gfeQueue.length ? 'Watch' : 'Clear' },
      { label: 'Payroll placeholders', value: `${payrollQueue.length} queued`, status: 'Placeholder' },
      { label: 'Kit restock', value: `${restockQueue.length} queued`, status: restockQueue.length ? 'Watch' : 'Clear' },
      { label: 'Launch capacity', value: estimateLaunchCapacity({ requests, nurses }).status, status: 'Live' },
    ],
    critical,
  };
}

export function forecastDemand({ requests = [], booking = readLastBooking() } = {}) {
  const latestCity = inferBookingCity(booking || {});
  const cityCounts = requests.reduce((acc, item) => {
    const city = item.city || item.location?.split(',').at(-2)?.trim() || latestCity || 'Bay Area';
    acc[city] = (acc[city] || 0) + Math.max(1, number(item.guests, 1));
    return acc;
  }, {});
  if (booking) cityCounts[latestCity || 'Bay Area'] = (cityCounts[latestCity || 'Bay Area'] || 0) + Math.max(1, number(booking.guests, 1));
  const topMarkets = Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([market, load]) => ({ market, load }));
  return {
    totalLoad: Object.values(cityCounts).reduce((sum, value) => sum + value, 0),
    topMarkets,
    nextMove: topMarkets[0] ? `Protect ${topMarkets[0].market} coverage first.` : 'Keep Bay Area coverage warm.',
  };
}

export function buildCoverageMatrix({ requests = [], nurses = [] } = {}) {
  return BAY_AREA_MARKETS.map((market) => {
    const demand = requests.filter((item) => compactText(`${item.city} ${item.location} ${item.address}`).includes(compactText(market))).length;
    const coverage = nurses.filter((nurse) => compactText(nurse.area).includes(compactText(market)) || (market === 'San Francisco' && compactText(nurse.area).includes('sf'))).length;
    return {
      market,
      demand,
      coverage,
      status: coverage > demand ? 'Covered' : coverage === demand && coverage > 0 ? 'Tight' : demand > 0 ? 'Gap' : 'Dormant',
    };
  });
}

export function scoreServiceArea({ booking = readLastBooking(), nurses = [] } = {}) {
  const city = inferBookingCity(booking || {});
  const coverage = buildCoverageMatrix({ requests: booking ? [booking] : [], nurses });
  const row = coverage.find((item) => compactText(item.market) === compactText(city)) || coverage.find((item) => item.market === 'San Francisco');
  const score = row?.status === 'Covered' ? 100 : row?.status === 'Tight' ? 82 : row?.status === 'Gap' ? 48 : 70;
  return {
    city: city || 'Bay Area',
    score,
    status: score >= 80 ? 'Serve' : 'Manual review',
    reason: row ? `${row.coverage} nurse(s), ${row.demand} demand.` : 'Market needs manual review.',
  };
}

export function checkPriceIntegrity({ booking = readLastBooking() } = {}) {
  const protocolKey = bookingProtocolKey(booking || {});
  const registry = buildProtocolRegistry();
  const protocol = registry.protocols.find((item) => item.key === protocolKey);
  const addOns = booking?.addOns || booking?.addons || [];
  const expected = number(protocol?.price, 150) + addOns.reduce((sum, label) => {
    const addOn = IV_ADDONS.find((item) => compactText(item.label) === compactText(label) || compactText(label).includes(compactText(item.label)));
    return sum + number(addOn?.price, 0);
  }, 0);
  const actual = number(booking?.subtotal || booking?.total || booking?.amount, expected);
  return {
    expected,
    actual,
    delta: actual - expected,
    status: Math.abs(actual - expected) <= 5 ? 'Clean' : 'Review',
  };
}

export function buildDepositGate({ booking = readLastBooking() } = {}) {
  const paid = /paid|deposit|authorized|complete/i.test(`${booking?.payment || ''} ${booking?.depositStatus || ''}`);
  const amount = number(booking?.deposit, 50);
  return {
    required: true,
    amount,
    status: paid ? 'Satisfied' : 'Required',
    canConfirm: paid || number(booking?.total || booking?.subtotal, 0) === 0,
  };
}

export function scoreCheckoutFriction({ booking = readLastBooking() } = {}) {
  const missing = [
    booking?.service || booking?.protocolKey ? '' : 'Protocol',
    booking?.address ? '' : 'Address',
    booking?.date && (booking?.time || booking?.acuitySlot?.datetime) ? '' : 'Time',
    booking?.contact?.phone ? '' : 'Phone',
    booking?.contact?.email ? '' : 'Email',
  ].filter(Boolean);
  const score = Math.max(0, 100 - missing.length * 18 - (number(booking?.guests, 1) > 1 ? 8 : 0));
  return {
    score,
    missing,
    target: 'Under 60 seconds, one decision per screen.',
    status: score >= 86 ? 'Fast' : 'Trim',
  };
}

export function recommendProtocol({ outcome = '', booking = readLastBooking() } = {}) {
  const text = compactText(`${outcome} ${booking?.outcome || ''} ${booking?.service || ''} ${booking?.notes || ''}`);
  const key = text.includes('focus') || text.includes('perform') || text.includes('energy')
    ? 'energy'
    : text.includes('longevity') || text.includes('nad') || text.includes('optimize')
      ? 'nad'
      : text.includes('restore') || text.includes('immune')
        ? 'immunity'
        : text.includes('beauty') || text.includes('glow')
          ? 'beauty'
          : 'recovery';
  const protocol = buildProtocolRegistry().protocols.find((item) => item.key === key);
  return {
    key,
    label: protocol?.label || 'Recovery',
    reason: 'Outcome mapped to the smallest clinically reviewable protocol set.',
    alternatives: ['hydration', 'myers', 'recovery'].filter((item) => item !== key).slice(0, 2),
  };
}

export function evaluateAddonGuardrails({ booking = readLastBooking() } = {}) {
  const addOns = booking?.addOns || booking?.addons || [];
  const flagged = addOns.filter((item) => /nad|cbd|vitamin c|high dose|glutathione 1800/i.test(item));
  return {
    status: flagged.length ? 'Review' : 'Clear',
    flagged,
    rule: 'Add-ons can enrich a visit, but advanced medication choices stay clinician-reviewed.',
  };
}

export function scoreMembershipFit({ profile = {}, booking = readLastBooking() } = {}) {
  const visits = number(profile.visitCount ?? booking?.visitCount, 0);
  const premium = number(booking?.subtotal || booking?.total, 0) >= 300;
  const score = Math.min(100, visits * 18 + (premium ? 22 : 0) + (booking?.source === 'Hotel' ? 12 : 0));
  return {
    score,
    status: score >= 65 ? 'Offer' : 'Wait',
    pitch: score >= 65 ? 'Recovery on repeat. Priority booking. Preferred pricing.' : 'Complete care first, then offer membership only if useful.',
  };
}

export function updateSubscriptionControl(action = 'pause', actor = 'Client') {
  const current = readLocal('kernel.subscriptionControl', { status: 'Active', history: [] });
  const next = {
    status: action === 'resume' ? 'Active' : 'Paused',
    updatedAt: nowIso(),
    history: [{ action, actor, at: nowIso() }, ...(current.history || [])].slice(0, 20),
  };
  writeLocal('kernel.subscriptionControl', next);
  emitKernelEvent(`subscription.${action}`, {}, actor);
  return next;
}

export function buildClientRiskFlags({ booking = readLastBooking(), profile = {} } = {}) {
  return [
    number(booking?.guests, 1) > 1 ? 'Group visit' : '',
    resolveGfeRequirement(booking || {}).required ? 'GFE required' : '',
    /latex/i.test(booking?.notes || profile.notes || '') ? 'Latex note' : '',
    /nad|cbd|high dose/i.test(`${booking?.service || ''} ${(booking?.addOns || []).join(' ')}`) ? 'Advanced protocol' : '',
  ].filter(Boolean).map((label) => ({ label, severity: label === 'GFE required' ? 'High' : 'Review' }));
}

export function checkConsentCompleteness({ booking = readLastBooking() } = {}) {
  const required = ['Treatment consent', 'HIPAA acknowledgement', 'Liability waiver'];
  const signed = booking?.consent === 'Done' || booking?.consent === 'Signed' ? required : booking?.signedConsents || [];
  return {
    required,
    signed,
    missing: required.filter((item) => !signed.includes(item)),
    status: required.every((item) => signed.includes(item)) ? 'Complete' : 'Incomplete',
  };
}

export function buildIdentityVerificationPlaceholder({ booking = readLastBooking() } = {}) {
  return {
    status: booking?.identityVerified ? 'Verified' : 'Placeholder',
    requiredBefore: 'Treatment start',
    method: 'Government ID check placeholder; API can replace later.',
  };
}

export function buildNurseRoutePacket({ booking = readLastBooking() } = {}) {
  return {
    client: booking?.contact?.name || [booking?.contact?.firstName, booking?.contact?.lastName].filter(Boolean).join(' ') || 'Client',
    address: booking?.address || 'Address pending',
    eta: readLocal(`routeEta.${booking?.id || booking?.reference || 'latest'}`, null)?.eta || 'Nurse sets final ETA',
    parking: booking?.parking || 'Ask client/concierge if unclear',
    maps: {
      apple: booking?.address ? `https://maps.apple.com/?q=${encodeURIComponent(booking.address)}` : '',
      google: booking?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}` : '',
    },
  };
}

export function buildMissionPacket({ booking = readLastBooking() } = {}) {
  return {
    protocol: booking?.service || 'Protocol pending',
    gfe: resolveGfeRequirement(booking || {}),
    consent: checkConsentCompleteness({ booking }),
    kit: buildKernelKitReadiness({ booking }),
    contact: booking?.contact || {},
    notes: booking?.notes || 'No notes.',
  };
}

export function queueOfflineKernelAction(action = {}, actor = 'Avalon Kernel') {
  const item = { id: `${Date.now()}`, action, actor, at: nowIso(), status: 'Queued' };
  const queue = readLocal('kernel.offlineQueue', []);
  writeLocal('kernel.offlineQueue', [item, ...queue].slice(0, 100));
  emitKernelEvent('offline.queued', { type: action.type || 'action' }, actor);
  return item;
}

export function readOfflineKernelQueue() {
  return readLocal('kernel.offlineQueue', []);
}

export function buildNotificationPreferenceCenter(profile = {}) {
  return {
    sms: profile.sms !== false,
    email: profile.email !== false,
    inApp: true,
    quietHours: profile.quietHours || '10 PM - 8 AM',
    criticalOverride: true,
  };
}

export function buildAnnouncementGovernance() {
  const announcements = readAnnouncements();
  return {
    count: announcements.length,
    pendingAck: announcements.filter((item) => item.requiresAck && !item.readBy?.length).length,
    rule: 'Announcements need audience, owner, severity, and expiration before blast.',
  };
}

export function buildBroadcastRateLimit() {
  const broadcasts = readAssignmentBroadcasts();
  const recent = broadcasts.filter((item) => Date.now() - new Date(item.createdAt || item.updatedAt || 0).getTime() < 60 * 60 * 1000);
  return {
    sentLastHour: recent.length,
    limit: 12,
    status: recent.length >= 12 ? 'Hold' : 'Clear',
  };
}

export function triageCommsInbox() {
  const alerts = readCommunicationAlerts();
  return {
    open: alerts.filter((item) => item.status !== 'Resolved').length,
    critical: alerts.filter((item) => /critical|urgent|high/i.test(`${item.severity} ${item.priority}`)).length,
    next: alerts.find((item) => item.status !== 'Resolved')?.title || 'No open alert',
  };
}

export function buildEscalationLadder({ booking = readLastBooking() } = {}) {
  const gfe = resolveGfeRequirement(booking || {});
  return [
    { step: 1, owner: 'Nurse', trigger: 'ETA missing or late risk' },
    { step: 2, owner: 'Dispatch', trigger: 'No Y/N acceptance' },
    { step: 3, owner: 'NP on call', trigger: gfe.required ? 'GFE required' : 'Clinical question' },
    { step: 4, owner: 'Founder', trigger: 'VIP, incident, refund, or reputational risk' },
  ];
}

export function scoreShiftOfferFairness({ nurses = [] } = {}) {
  const active = nurses.filter((nurse) => /available|assigned|ready/i.test(nurse.status || ''));
  const visits = active.map((nurse) => number(nurse.visits, 0));
  const spread = visits.length ? Math.max(...visits) - Math.min(...visits) : 0;
  return {
    score: Math.max(0, 100 - spread * 12),
    spread,
    status: spread <= 2 ? 'Fair' : 'Rebalance',
  };
}

export function buildFatigueGuard({ nurse = {}, nurses = [] } = {}) {
  const roster = nurse?.name ? [nurse] : nurses;
  const rows = roster.map((item) => {
    const visits = number(item.visits, 0);
    return {
      nurse: item.name || 'Nurse',
      visits,
      status: visits >= 5 ? 'Block' : visits >= 4 ? 'Watch' : 'Clear',
    };
  });
  return { rows, blockers: rows.filter((item) => item.status === 'Block') };
}

export function forecastCredentialExpiry({ nurses = [] } = {}) {
  return nurses.map((nurse) => ({
    nurse: nurse.name || 'Nurse',
    status: nurse.credentialStatus || nurse.nurseys?.status || 'Clear',
    expiresInDays: number(nurse.credentialExpiresInDays, 90),
    action: number(nurse.credentialExpiresInDays, 90) <= 30 ? 'Renew' : 'Monitor',
  }));
}

export function buildTrainingGate({ nurses = [] } = {}) {
  const tower = buildTrainingControlTower({ nurses });
  return {
    blocked: tower.nurseRows?.filter((row) => row.critical?.length).length || 0,
    due: tower.nurseRows?.reduce((sum, row) => sum + (row.due?.length || 0), 0) || 0,
    tower,
  };
}

export function forecastInventoryExpiry({ inventory = SEED_ITEMS } = {}) {
  const now = Date.now();
  return inventory
    .filter((item) => item.expirationDate)
    .map((item) => {
      const days = Math.ceil((new Date(item.expirationDate).getTime() - now) / (24 * 60 * 60 * 1000));
      return { id: item.id, name: item.name, days, status: days <= 14 ? 'Use/replace' : days <= 45 ? 'Watch' : 'Clear' };
    })
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);
}

export function buildColdChainPlaceholder({ inventory = SEED_ITEMS } = {}) {
  const cold = inventory.filter((item) => item.refrigeration);
  return {
    status: 'Placeholder',
    items: cold.length,
    rule: 'Cold-chain logging stays local until sensor/API integration exists.',
  };
}

export function addWasteLog(entry = {}, actor = 'Nurse') {
  const item = { id: `${Date.now()}`, ...entry, actor, at: nowIso() };
  const logs = readLocal('kernel.wasteLog', []);
  writeLocal('kernel.wasteLog', [item, ...logs].slice(0, 100));
  emitKernelEvent('waste.logged', { item: entry.item || 'Waste' }, actor);
  return item;
}

export function buildIncidentPacket({ booking = readLastBooking(), incident = {} } = {}) {
  return {
    visit: booking?.reference || booking?.id || 'latest',
    severity: incident.severity || 'Review',
    client: booking?.contact?.name || 'Client',
    protocol: booking?.service || 'Protocol',
    chart: readThinChart(booking?.id || booking?.reference || 'latest'),
    audit: readKernelEvents(20),
    action: 'Lock facts, notify clinical owner, preserve audit trail.',
  };
}

export function scorePostVisitQa({ booking = readLastBooking() } = {}) {
  const chart = readThinChart(booking?.id || booking?.reference || 'latest');
  const consent = checkConsentCompleteness({ booking });
  const deductions = readKitDeductionLedger();
  const score = 100
    - (chart?.status === CHART_LOCKED_STATUS ? 0 : 25)
    - (consent.status === 'Complete' ? 0 : 20)
    - (deductions.length ? 0 : 10)
    - (booking?.payment === 'Paid' ? 0 : 10);
  return {
    score: Math.max(0, score),
    status: score >= 90 ? 'Clean' : score >= 75 ? 'Review' : 'Fix',
    checks: { chart: chart?.status || 'Missing', consent: consent.status, inventory: deductions.length ? 'Logged' : 'No deduction', payment: booking?.payment || 'Pending' },
  };
}

export function buildAvalonKernelSnapshot({ booking = readLastBooking(), requests = [], nurses = [], role = 'admin' } = {}) {
  const protocolKey = bookingProtocolKey(booking || {});
  const protocolRegistry = buildProtocolRegistry();
  const kitReadiness = buildKernelKitReadiness({ booking });
  const exceptions = buildKernelExceptions({ booking, nurses });
  const health = buildKernelSystemHealth({ requests, nurses });
  const founder = buildFounderCommandIntelligence({ requests, nurses, booking });
  const scale = {
    demand: forecastDemand({ requests, booking }),
    coverage: buildCoverageMatrix({ requests, nurses }),
    serviceArea: scoreServiceArea({ booking, nurses }),
    priceIntegrity: checkPriceIntegrity({ booking }),
    depositGate: buildDepositGate({ booking }),
    checkoutFriction: scoreCheckoutFriction({ booking }),
    recommendation: recommendProtocol({ booking }),
    addOnGuardrails: evaluateAddonGuardrails({ booking }),
    membershipFit: scoreMembershipFit({ booking }),
    subscription: readLocal('kernel.subscriptionControl', { status: 'Active', history: [] }),
    clientRisks: buildClientRiskFlags({ booking }),
    consent: checkConsentCompleteness({ booking }),
    identity: buildIdentityVerificationPlaceholder({ booking }),
    routePacket: buildNurseRoutePacket({ booking }),
    missionPacket: buildMissionPacket({ booking }),
    offlineQueue: readOfflineKernelQueue(),
    notifications: buildNotificationPreferenceCenter(),
    announcements: buildAnnouncementGovernance(),
    broadcastLimit: buildBroadcastRateLimit(),
    commsTriage: triageCommsInbox(),
    escalationLadder: buildEscalationLadder({ booking }),
    fairness: scoreShiftOfferFairness({ nurses }),
    fatigue: buildFatigueGuard({ nurses }),
    credentialExpiry: forecastCredentialExpiry({ nurses }),
    trainingGate: buildTrainingGate({ nurses }),
    inventoryExpiry: forecastInventoryExpiry(),
    coldChain: buildColdChainPlaceholder(),
    wasteLog: readLocal('kernel.wasteLog', []),
    incidentPacket: buildIncidentPacket({ booking }),
    postVisitQa: scorePostVisitQa({ booking }),
  };
  return {
    version: 'local-kernel-1.0',
    shipped: KERNEL_BUILD_ITEMS.length,
    buildItems: KERNEL_BUILD_ITEMS,
    role,
    permissions: KERNEL_ROLE_PERMISSIONS[role] || [],
    stateMachine: {
      statuses: BOOKING_STATUSES,
      transitions: BOOKING_TRANSITIONS,
      current: booking?.status || 'Draft',
    },
    protocolKey,
    protocolRegistry,
    protocolInventory: buildProtocolInventoryMap(protocolKey),
    protocolCredentials: buildProtocolCredentialMap(protocolKey),
    protocolGfe: buildProtocolGfeMap(protocolKey),
    nurseEligibility: nurses.map((nurse) => scoreNurseEligibility({ nurse, booking, protocolKey })),
    kitReadiness,
    exceptions,
    chart: readThinChart(booking?.id || booking?.reference || 'latest'),
    economics: estimateVisitEconomics({ booking }),
    refund: estimateRefundState({ booking }),
    clientTracker: buildClientTracker({ booking }),
    launchCapacity: estimateLaunchCapacity({ requests, nurses }),
    qr: buildQrRedemptionPlaceholder({ booking }),
    groupIntake: buildGroupIntakePlan({ booking }),
    followUp: buildFollowUpRecommendation({ booking }),
    founder,
    compliance: buildComplianceCopyControls(),
    scale,
    audit: {
      eventCount: readKernelEvents(500).length,
      exportable: true,
    },
    health,
  };
}
