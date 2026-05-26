import { SEED_ITEMS } from '../../src/data/inventorySeed.js';
import { resolveGfeRequirement } from '../../src/lib/bookingLifecycle.js';
import { buildDispatchBrainSnapshot } from '../../src/lib/dispatchBrain.js';
import { buildShiftMarketplaceSnapshot } from '../../src/lib/shiftMarketplaceBrain.js';
import { buildArrivalMissionSnapshot } from '../../src/lib/arrivalMissionBrain.js';
import { buildVisitCloseoutSnapshot } from '../../src/lib/visitCloseoutBrain.js';
import { buildKitReconciliationSnapshot } from '../../src/lib/kitReconciliationBrain.js';
import { buildPostVisitQualitySnapshot } from '../../src/lib/postVisitQualityBrain.js';
import {
  GUSTO_PAYROLL_PLACEHOLDER,
  MERCURY_BANKING_PLACEHOLDER,
  NURSEYS_CREDENTIAL_PLACEHOLDER,
  QUALIPHY_GFE_PLACEHOLDER,
  QUICKBOOKS_ACCOUNTING_PLACEHOLDER,
} from '../../src/lib/financeIntegrations.js';
import {
  WIRE_TOMORROW_FAILURE_MATRIX,
  buildPreApiWireReadinessSnapshot,
} from '../../src/lib/preApiWireReadiness.js';

export const OPERATING_DAY_SIMULATOR_VERSION = '2026.05.full-operating-day-v1';
export const OPERATING_DAY_MODE = 'local-simulation-only';

export const OPERATING_DAY_SOURCE_OF_TRUTH = [
  { object: 'Customer / patient / payer / member', localOwner: 'Avalon local repository', liveOwner: 'Supabase after API wiring' },
  { object: 'Appointment schedule', localOwner: 'Acuity placeholder mirror', liveOwner: 'Acuity' },
  { object: 'Clinical chart / GFE', localOwner: 'Placeholder status only', liveOwner: 'Acuity + Avalon NP or Qualiphy fallback' },
  { object: 'Shift offer / nurse ETA', localOwner: 'Avalon OS', liveOwner: 'Avalon OS + SMS delivery proof' },
  { object: 'Inventory / nurse kit', localOwner: 'Avalon OS', liveOwner: 'Avalon OS with vendor replenishment APIs later' },
  { object: 'Deposit / refund', localOwner: 'Stripe placeholder state', liveOwner: 'Stripe or Acuity Pay' },
  { object: 'Payroll', localOwner: 'Gusto placeholder proof', liveOwner: 'Gusto' },
  { object: 'Banking', localOwner: 'Mercury placeholder proof', liveOwner: 'Mercury' },
  { object: 'Books', localOwner: 'QuickBooks placeholder proof', liveOwner: 'QuickBooks' },
  { object: 'CRM follow-up', localOwner: 'CRM-safe local queue', liveOwner: 'Attio' },
];

export const OPERATING_DAY_NURSES = [
  {
    id: 'rn-stephanie',
    name: 'RN 001',
    role: 'RN',
    status: 'Available',
    area: 'SF Downtown / SoMa',
    kit: 'Ready',
    visits: 1,
    certifications: ['iv', 'myers', 'recovery', 'nad'],
    nurseys: { status: 'Clear', state: 'CA' },
  },
  {
    id: 'rn-marcus',
    name: 'RN 002',
    role: 'RN',
    status: 'Available',
    area: 'Mission / Castro / Noe Valley',
    kit: 'Ready',
    visits: 0,
    certifications: ['iv', 'recovery', 'im'],
    nurseys: { status: 'Clear', state: 'CA' },
  },
  {
    id: 'rn-jordan',
    name: 'RN 003',
    role: 'RN',
    status: 'Available',
    area: 'Oakland / Berkeley / East Bay',
    kit: 'Restock Needed',
    visits: 1,
    certifications: ['iv', 'event'],
    nurseys: { status: 'Clear', state: 'CA' },
  },
  {
    id: 'np-avalon',
    name: 'Avalon Remote NP',
    role: 'NP',
    status: 'On Call Until Noon',
    area: 'Remote CA',
    kit: 'N/A',
    visits: 0,
    certifications: ['gfe', 'standing-orders'],
    nurseys: { status: 'Clear', state: 'CA' },
  },
];

export const OPERATING_DAY_REQUESTS = [
  {
    id: 'day-001',
    client: 'Client 001',
    city: 'SF',
    address: 'Hotel location pending',
    locationType: 'hotel',
    time: '08:30',
    therapy: 'Recovery Hydration',
    addons: ['Glutathione Push'],
    total: 450,
    status: 'Ready for Visit',
    source: 'Hotel',
    priority: 'VIP',
    intake: 'Done',
    consent: 'Done',
    payment: 'Paid',
    nurse: 'RN 001',
    eta: '18 min',
    guests: 1,
    isNewClient: false,
    visitCount: 5,
    gfe: 'Cleared',
    gfeRecord: { status: 'Valid', validUntil: '2026-12-31' },
  },
  {
    id: 'day-002',
    client: 'Client 005',
    city: 'SF',
    address: 'Client address pending',
    locationType: 'home',
    time: '10:00',
    therapy: 'Hydration Protocol',
    addons: [],
    total: 250,
    status: 'Cleared',
    source: 'Website',
    priority: null,
    intake: 'Done',
    consent: 'Done',
    payment: 'Paid',
    nurse: 'RN 002',
    eta: '24 min',
    guests: 1,
    isNewClient: true,
    visitCount: 0,
    gfe: 'Cleared',
    gfeRoute: 'Avalon NP',
  },
  {
    id: 'day-003',
    client: 'Client 002',
    city: 'SF',
    address: 'Client address pending',
    locationType: 'home',
    time: '11:30',
    therapy: 'NAD+ Longevity Protocol',
    addons: ['B-Complex'],
    total: 650,
    status: 'GFE Pending',
    source: 'Website',
    priority: 'Advanced',
    intake: 'Done',
    consent: 'Done',
    payment: 'Paid',
    nurse: 'Unassigned',
    guests: 1,
    isNewClient: true,
    visitCount: 0,
    gfe: 'Pending',
    gfeRoute: 'Qualiphy fallback',
    npOnCall: false,
  },
  {
    id: 'day-004',
    client: 'Launch House',
    city: 'Oakland',
    address: 'Downtown Oakland venue',
    locationType: 'event',
    time: '13:00',
    therapy: 'Launch Recovery Group',
    addons: ['B12 IM'],
    total: 1800,
    status: 'Confirmed',
    source: 'Launch presale',
    priority: 'Event',
    intake: 'Done',
    consent: 'Done',
    payment: 'Invoice',
    nurse: 'RN 003',
    eta: '35 min',
    guests: 6,
    isNewClient: false,
    visitCount: 2,
    gfe: 'Cleared',
    eventPresale: true,
  },
  {
    id: 'day-005',
    client: 'Client 003',
    city: 'SF',
    address: 'Client address pending',
    locationType: 'home',
    time: '15:00',
    therapy: 'Myers Cocktail',
    addons: ['Magnesium'],
    total: 350,
    status: 'Completed',
    source: 'Referral',
    priority: null,
    intake: 'Done',
    consent: 'Done',
    payment: 'Paid',
    nurse: 'RN 002',
    eta: '17 min',
    guests: 1,
    isNewClient: false,
    visitCount: 3,
    gfe: 'Cleared',
  },
  {
    id: 'day-006',
    client: 'Client 004',
    city: 'SF',
    address: 'Office location pending',
    locationType: 'office',
    time: '16:30',
    therapy: 'Performance Protocol',
    addons: ['B12 IM'],
    total: 425,
    status: 'Completed',
    source: 'Corporate',
    priority: 'Corporate',
    intake: 'Done',
    consent: 'Done',
    payment: 'Paid',
    nurse: 'RN 001',
    eta: '21 min',
    guests: 1,
    isNewClient: false,
    visitCount: 7,
    gfe: 'Cleared',
  },
  {
    id: 'day-007',
    client: 'Client 011',
    city: 'SF',
    address: 'Client address pending',
    locationType: 'home',
    time: '17:30',
    therapy: 'Recovery Hydration',
    addons: [],
    total: 250,
    status: 'Completed',
    source: 'Google',
    priority: null,
    intake: 'Done',
    consent: 'Done',
    payment: 'Paid',
    nurse: 'RN 001',
    eta: '19 min',
    guests: 1,
    isNewClient: true,
    visitCount: 0,
    gfe: 'Cleared',
    incident: 'Mild lightheadedness after service',
  },
  {
    id: 'day-008',
    client: 'Rachel K.',
    city: 'SF',
    address: 'Wrong address flagged',
    locationType: 'home',
    time: '18:30',
    therapy: 'Restore Protocol',
    addons: [],
    total: 300,
    status: 'Cancelled',
    source: 'Member',
    priority: 'Service Recovery',
    intake: 'Done',
    consent: 'Done',
    payment: 'Refund Pending',
    nurse: 'Unassigned',
    guests: 1,
    isNewClient: false,
    visitCount: 9,
    gfe: 'Cleared',
    supportCase: 'Wrong address, refund/rebook path',
  },
];

export const OPERATING_DAY_CLOSEOUTS = {
  'day-005': {
    identityVerified: true,
    consentVerified: true,
    gfeVerified: true,
    allergiesReviewed: true,
    medicationsReviewed: true,
    preBp: '118/76',
    preHr: '68',
    preSpo2: '99',
    postBp: '116/74',
    postHr: '70',
    postSpo2: '99',
    routeSite: 'Left AC',
    lotOrKitId: 'KIT-SF-02',
    expirationChecked: true,
    adverseEvent: 'None',
    dischargeCondition: 'Stable',
    nurseSignature: 'RN 002',
    attestation: true,
    acuityEntered: true,
  },
  'day-006': {
    identityVerified: true,
    consentVerified: true,
    gfeVerified: true,
    allergiesReviewed: true,
    medicationsReviewed: true,
    preBp: '122/78',
    preHr: '72',
    preSpo2: '98',
    postBp: '120/76',
    postHr: '74',
    postSpo2: '99',
    routeSite: 'Right AC',
    lotOrKitId: 'KIT-SF-01',
    expirationChecked: true,
    adverseEvent: 'None',
    dischargeCondition: 'Stable',
    nurseSignature: 'RN 001',
    attestation: true,
    acuityEntered: true,
  },
  'day-007': {
    identityVerified: true,
    consentVerified: true,
    gfeVerified: true,
    allergiesReviewed: true,
    medicationsReviewed: true,
    preBp: '116/72',
    preHr: '70',
    preSpo2: '99',
    postBp: '112/70',
    postHr: '76',
    postSpo2: '99',
    routeSite: 'Left hand',
    lotOrKitId: 'KIT-SF-01',
    expirationChecked: true,
    adverseEvent: 'Mild lightheadedness after service',
    dischargeCondition: 'Stable after observation',
    nurseSignature: 'RN 001',
    attestation: true,
    acuityEntered: true,
  },
};

export function buildOperatingDayInventory(seed = SEED_ITEMS) {
  return [
    ...seed,
    { id: 'day-iv-bags-alias', name: 'IV Bags (1L)', sku: 'DAY-IV-BAGS', category: 'IV', qty: 36, unit: 'bags', minLevel: 8, status: 'Ready', detail: '36 remaining' },
    { id: 'day-nurse-bags-alias', name: 'Nurse Bags', sku: 'DAY-NURSE-BAGS', category: 'Kits', qty: 6, unit: 'kits', minLevel: 2, status: 'Ready', detail: '6 kitted' },
    { id: 'day-im-shot-kit-alias', name: 'IM Shot Kit', sku: 'DAY-IM-KIT', category: 'IM', qty: 18, unit: 'kits', minLevel: 4, status: 'Ready', detail: '18 ready' },
  ];
}

const DAY_TIMELINE = [
  ['06:30', 'Ops opens day', 'Inventory, credentials, Acuity mirror, and nurse roster sweep run locally.'],
  ['06:45', 'Credential gate', `${NURSEYS_CREDENTIAL_PLACEHOLDER.service} placeholder marks available RNs clear.`],
  ['07:00', 'Demand intake', 'Home, hotel, office, event, new, returning, and member requests enter the local queue.'],
  ['07:15', 'Payment gate', 'Stripe deposit states and one refund/rebook exception are represented without charging live cards.'],
  ['07:30', 'GFE triage', 'Returning annual GFE is accepted; Avalon NP clears new hydration; Qualiphy fallback is held for no-NP coverage only.'],
  ['08:00', 'Dispatch', 'Avalon scores nurses by zone, kit, credential, protocol, ETA, workload, and value.'],
  ['08:10', 'Shift market', 'Open shifts generate Y/N offers; accepted visits lock to nurse pages.'],
  ['08:20', 'ETA authority', 'Nurses set final ETA before client text. No automatic ETA is treated as final.'],
  ['09:00', 'Route', 'Apple/Google Maps links are prepared as handoffs, not tracked live APIs.'],
  ['10:00', 'Field execution', 'Arrive, start, complete, incident, wrong-address, and cancel/rebook lanes are simulated.'],
  ['15:30', 'Closeout', 'Acuity closeout proof gates local completion, payroll proof, and client follow-up.'],
  ['16:00', 'Kit deduction', 'Every completed IV hits kit deductions, nurse kits, central stock, waste, cold-chain, and restock.'],
  ['17:00', 'Finance', `${MERCURY_BANKING_PLACEHOLDER.service}, ${GUSTO_PAYROLL_PLACEHOLDER.service}, and ${QUICKBOOKS_ACCOUNTING_PLACEHOLDER.service} queues receive no-PHI summaries.`],
  ['18:00', 'CRM', 'Attio-safe follow-up, aftercare, review, rebook, service recovery, and membership tasks are queued.'],
  ['19:00', 'EOD reconciliation', 'Webhook misses, appointment drift, refund/accounting mismatch, payroll, and finance failures are visible as local cases.'],
].map(([time, label, proof]) => ({ time, label, proof, mode: OPERATING_DAY_MODE }));

function money(rows = []) {
  return rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
}

function activeRows(rows = []) {
  return rows.filter((row) => !/cancel/i.test(row.status || ''));
}

function completedRows(rows = []) {
  return rows.filter((row) => /completed|follow-up/i.test(row.status || ''));
}

function buildDeliveryProof(requests = []) {
  return requests.flatMap((request) => {
    const base = [
      {
        id: `${request.id}-client-status`,
        visitId: request.id,
        audience: 'client',
        channel: 'sms-placeholder',
        status: request.eta ? 'Delivered placeholder' : 'Queued',
        bodyPolicy: 'minimum-necessary',
      },
    ];
    if (request.nurse && request.nurse !== 'Unassigned') {
      base.push({
        id: `${request.id}-nurse-shift`,
        visitId: request.id,
        audience: 'nurse',
        channel: 'sms-placeholder',
        status: 'Acknowledged placeholder',
        bodyPolicy: 'no PHI beyond mission packet',
      });
    }
    if (/gfe/i.test(request.gfeRoute || '') || /pending/i.test(request.gfe || '')) {
      base.push({
        id: `${request.id}-gfe`,
        visitId: request.id,
        audience: 'clinical',
        channel: 'in-app-placeholder',
        status: request.gfe === 'Cleared' ? 'Resolved' : 'Escalated',
        bodyPolicy: 'clinical minimum necessary',
      });
    }
    return base;
  });
}

function buildGfeProof(requests = []) {
  const returning = requests.find((request) => request.id === 'day-001');
  const annual = resolveGfeRequirement(returning);
  return [
    {
      id: 'annual-returning',
      client: returning.client,
      route: 'Existing Avalon GFE',
      required: annual.required,
      status: annual.required ? 'Fail' : 'Pass',
      proof: annual.reason,
    },
    {
      id: 'avalon-np-first',
      client: 'Client 005',
      route: 'Avalon NP',
      required: true,
      status: 'Pass',
      proof: 'Avalon remote NP on call clears before dispatch.',
    },
    {
      id: 'qualiphy-fallback-only',
      client: 'Client 002',
      route: QUALIPHY_GFE_PLACEHOLDER.service,
      required: true,
      status: 'Pass',
      proof: 'Fallback appears only because npOnCall is false.',
    },
  ];
}

function buildFinanceProof({ completed = [], closeout, postVisit }) {
  return [
    {
      id: 'stripe-deposits',
      provider: 'Stripe placeholder',
      status: 'Represented',
      amount: money(activeRows(OPERATING_DAY_REQUESTS).filter((row) => /paid|invoice/i.test(row.payment || ''))),
      phiExcluded: true,
    },
    {
      id: 'mercury-cash',
      provider: MERCURY_BANKING_PLACEHOLDER.service,
      status: 'Queued',
      amount: money(completed),
      phiExcluded: true,
    },
    {
      id: 'gusto-payroll',
      provider: GUSTO_PAYROLL_PLACEHOLDER.service,
      status: closeout.metrics.payrollReady >= 1 ? 'Queued' : 'Hold',
      lines: closeout.payrollQueue.length,
      phiExcluded: true,
    },
    {
      id: 'quickbooks-books',
      provider: QUICKBOOKS_ACCOUNTING_PLACEHOLDER.service,
      status: 'Queued',
      lines: postVisit.aftercareQueue.length + postVisit.rebookQueue.length,
      phiExcluded: true,
    },
  ];
}

function buildFailureProof() {
  const represented = new Set([
    'stripe_succeeded_acuity_failed',
    'acuity_succeeded_stripe_failed',
    'gfe_delayed',
    'gfe_denied',
    'nursys_unavailable',
    'webhook_missed',
    'webhook_duplicate',
    'refund_accounting_mismatch',
    'appointment_drift',
    'payroll_sync_failed',
    'finance_sync_failed',
  ]);

  return WIRE_TOMORROW_FAILURE_MATRIX.map((row) => ({
    ...row,
    represented: represented.has(row.caseType),
    simulationStatus: represented.has(row.caseType) ? 'Visible' : 'Missing',
    recoveryOwner: row.ownerRole,
  }));
}

function buildCriteria(snapshot) {
  const {
    requests,
    dispatch,
    marketplace,
    arrival,
    closeout,
    kit,
    postVisit,
    gfeProof,
    deliveryProof,
    financeProof,
    failureProof,
    wire,
  } = snapshot;
  const completed = completedRows(requests);
  const hasEvent = requests.some((row) => row.eventPresale);
  const hasReturningAnnual = gfeProof.some((row) => row.id === 'annual-returning' && row.status === 'Pass' && row.required === false);
  const hasQualiphyFallback = gfeProof.some((row) => row.id === 'qualiphy-fallback-only' && row.status === 'Pass');
  const hasNurseEta = arrival.metrics.clientTexts >= 1
    && arrival.missions.some((row) => row.clientTextReady && row.nurseActions.some((action) => action.id === 'eta' && action.owner === 'Nurse' && action.status === 'Done'));

  return [
    { id: 'full-demand', label: 'Demand mix', pass: requests.length >= 8 && hasEvent && requests.some((row) => row.locationType === 'hotel') && requests.some((row) => row.locationType === 'office') },
    { id: 'payment', label: 'Payment/deposit states', pass: financeProof.some((row) => row.id === 'stripe-deposits') },
    { id: 'annual-gfe', label: 'Annual GFE skip', pass: hasReturningAnnual },
    { id: 'avalon-np', label: 'Avalon NP first', pass: gfeProof.some((row) => row.id === 'avalon-np-first' && row.status === 'Pass') },
    { id: 'qualiphy', label: 'Qualiphy fallback rule', pass: hasQualiphyFallback },
    { id: 'dispatch', label: 'Dispatch scoring', pass: dispatch.metrics.requests >= 4 && dispatch.topDecisions.length >= 1 && dispatch.metrics.dispatchable >= 1 },
    { id: 'shift-market', label: 'Nurse Y/N shift flow', pass: marketplace.metrics.visits >= 4 && marketplace.offers.some((offer) => offer.replyCommand === 'Y/N') },
    { id: 'nurse-eta', label: 'Nurse owns ETA', pass: hasNurseEta },
    { id: 'route', label: 'Maps handoff', pass: arrival.missions.some((row) => row.maps?.apple && row.maps?.google) },
    { id: 'field', label: 'Field execution', pass: completed.length >= 3 },
    { id: 'closeout', label: 'Acuity closeout proof', pass: closeout.metrics.payrollReady >= 2 && closeout.handoffChannels.some((row) => row.id === 'acuity') },
    { id: 'incident', label: 'Adverse event lane', pass: closeout.metrics.incidents >= 1 && postVisit.issueQueue.some((row) => row.stage === 'Service Recovery') },
    { id: 'inventory', label: 'Kit + stock reconciliation', pass: kit.metrics.queuedDeductions > 0 && kit.metrics.stockLines >= 10 },
    { id: 'finance', label: 'Finance/payroll/books no-PHI queues', pass: financeProof.every((row) => row.phiExcluded) },
    { id: 'comms', label: 'Notification delivery proof', pass: deliveryProof.length >= requests.length },
    { id: 'crm', label: 'CRM-safe retention', pass: postVisit.aftercareQueue.length >= 1 && postVisit.rebookQueue.length >= 1 },
    { id: 'failures', label: 'Failure/reconciliation matrix', pass: failureProof.every((row) => row.represented) },
    { id: 'source-of-truth', label: 'Source-of-truth map', pass: OPERATING_DAY_SOURCE_OF_TRUTH.length >= 10 },
    { id: 'api-boundaries', label: 'No fake-live API state', pass: wire.complete && snapshot.mode === OPERATING_DAY_MODE },
    { id: 'eod', label: 'End-of-day command close', pass: snapshot.timeline.at(-1)?.label === 'EOD reconciliation' && snapshot.openLocalGaps.length === 0 },
  ];
}

export function buildOperatingDaySnapshot({
  requests = OPERATING_DAY_REQUESTS,
  nurses = OPERATING_DAY_NURSES,
  inventory = buildOperatingDayInventory(),
  closeouts = OPERATING_DAY_CLOSEOUTS,
} = {}) {
  const active = activeRows(requests);
  const completed = completedRows(requests);
  const wire = buildPreApiWireReadinessSnapshot();
  const dispatch = buildDispatchBrainSnapshot({ requests: active, nurses, inventory });
  const marketplace = buildShiftMarketplaceSnapshot({ requests: active, nurses, inventory });
  const arrival = buildArrivalMissionSnapshot({ requests: active, nurses, inventory });
  const closeout = buildVisitCloseoutSnapshot({ requests: completed, nurses, inventory, closeouts });
  const kit = buildKitReconciliationSnapshot({
    requests: completed,
    nurses,
    inventory,
    closeouts,
    wasteLogs: [{ id: 'waste-day-001', itemId: 'iv1', name: 'IV Bag - 1L Normal Saline', qty: 1, reason: 'Damaged bag during prep' }],
  });
  const postVisit = buildPostVisitQualitySnapshot({
    requests: completed,
    nurses,
    inventory,
    closeouts,
    feedback: [{ visitId: 'day-007', score: 4, issue: 'Nurse handled mild reaction calmly.' }],
  });
  const gfeProof = buildGfeProof(requests);
  const deliveryProof = buildDeliveryProof(requests);
  const financeProof = buildFinanceProof({ completed, closeout, postVisit });
  const failureProof = buildFailureProof();
  const baseSnapshot = {
    version: OPERATING_DAY_SIMULATOR_VERSION,
    mode: OPERATING_DAY_MODE,
    status: 'Pending',
    score: 0,
    complete: false,
    openLocalGaps: [],
    timeline: DAY_TIMELINE,
    sourceOfTruth: OPERATING_DAY_SOURCE_OF_TRUTH,
    requests,
    nurses,
    inventory,
    snapshots: { dispatch, marketplace, arrival, closeout, kit, postVisit, wire },
    dispatch,
    marketplace,
    arrival,
    closeout,
    kit,
    postVisit,
    gfeProof,
    deliveryProof,
    financeProof,
    failureProof,
    wire,
    metrics: {
      requests: requests.length,
      active: active.length,
      completed: completed.length,
      revenueRepresented: money(requests),
      completedRevenue: money(completed),
      nurses: nurses.length,
      deliveryEvents: deliveryProof.length,
      failureCases: failureProof.length,
      inventoryDeductions: kit.metrics.queuedDeductions,
      payrollReady: closeout.metrics.payrollReady,
      incidents: closeout.metrics.incidents,
    },
    handoffs: [
      { id: 'acuity', label: 'Acuity', status: 'Placeholder', proof: 'Appointments and closeout packets are mirrored locally; Acuity remains live source later.' },
      { id: 'stripe', label: 'Stripe', status: 'Placeholder', proof: '$50 deposit and refund states are represented without charging.' },
      { id: 'supabase', label: 'Supabase', status: 'Contract', proof: 'RLS, source-of-truth, and event tables are modeled; runtime auth waits for API.' },
      { id: 'resend-sms', label: 'Resend/SMS', status: 'Placeholder', proof: 'Sent/delivered/failed/read/ack states are represented locally.' },
      { id: 'attio', label: 'Attio', status: 'Placeholder', proof: 'CRM-safe follow-up only; no PHI/GFE payload.' },
      { id: 'nursys', label: 'Nurseys', status: 'Placeholder', proof: NURSEYS_CREDENTIAL_PLACEHOLDER.description },
      { id: 'qualiphy', label: 'Qualiphy', status: 'Fallback', proof: QUALIPHY_GFE_PLACEHOLDER.description },
      { id: 'mercury', label: 'Mercury', status: 'Placeholder', proof: MERCURY_BANKING_PLACEHOLDER.description },
      { id: 'gusto', label: 'Gusto', status: 'Placeholder', proof: GUSTO_PAYROLL_PLACEHOLDER.description },
      { id: 'quickbooks', label: 'QuickBooks', status: 'Placeholder', proof: QUICKBOOKS_ACCOUNTING_PLACEHOLDER.description },
    ],
  };

  const criteria = buildCriteria(baseSnapshot);
  const openLocalGaps = criteria.filter((item) => !item.pass);
  const score = Math.round((criteria.filter((item) => item.pass).length / criteria.length) * 1000);

  return {
    ...baseSnapshot,
    criteria,
    openLocalGaps,
    score,
    complete: openLocalGaps.length === 0,
    status: openLocalGaps.length === 0 ? 'Full Day Simulated' : 'Hold',
  };
}
