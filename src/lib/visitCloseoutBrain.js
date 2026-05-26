import { buildVisitSupplyReservation } from './supplyBrain.js';

export const VISIT_CLOSEOUT_VERSION = '2026.05.no-api-visit-closeout-v1';
export const VISIT_CLOSEOUT_MODE = 'acuity-closeout-placeholder';

export const VISIT_CLOSEOUT_RULES = [
  'Acuity remains the clinical source of record.',
  'Avalon tracks local closeout proof before inventory deduction.',
  'Every completed IV creates a kit deduction ledger row.',
  'Client follow-up stays locked until closeout and incident state are known.',
  'Gusto payroll proof stays placeholder-ready after clean closeout.',
  'Adverse events route to review before rebooking or payroll release.',
];

const REQUIRED_CLOSEOUT_FIELDS = [
  ['identityVerified', 'ID/DOB'],
  ['consentVerified', 'Consent'],
  ['gfeVerified', 'Annual GFE'],
  ['allergiesReviewed', 'Allergies'],
  ['medicationsReviewed', 'Meds'],
  ['preBp', 'Pre BP'],
  ['preHr', 'Pre HR'],
  ['preSpo2', 'Pre SpO2'],
  ['postBp', 'Post BP'],
  ['postHr', 'Post HR'],
  ['postSpo2', 'Post SpO2'],
  ['routeSite', 'Route/site'],
  ['lotOrKitId', 'Lot/kit'],
  ['expirationChecked', 'Expiry'],
  ['adverseEvent', 'Event note'],
  ['dischargeCondition', 'Discharge'],
  ['nurseSignature', 'Signature'],
  ['attestation', 'RN attest'],
  ['acuityEntered', 'Acuity'],
];

const CLOSEOUT_DEFAULTS = {
  identityVerified: false,
  consentVerified: false,
  gfeVerified: false,
  allergiesReviewed: false,
  medicationsReviewed: false,
  preBp: '',
  preHr: '',
  preSpo2: '',
  postBp: '',
  postHr: '',
  postSpo2: '',
  routeSite: '',
  lotOrKitId: '',
  expirationChecked: false,
  adverseEvent: 'None',
  dischargeCondition: '',
  nurseSignature: '',
  attestation: false,
  acuityEntered: false,
};

function text(value = '') {
  return String(value || '').trim();
}

function compactText(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function slug(value = '') {
  return compactText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'visit';
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requestId(request = {}) {
  return request.id || request.reference || slug(`${request.client || 'client'}-${request.time || 'visit'}`);
}

function clientName(request = {}) {
  return request.client || request.contact?.name || request.name || 'Client';
}

function serviceName(request = {}) {
  return request.therapy || request.service || request.plan || request.protocol || 'Avalon protocol';
}

function nurseName(request = {}, nurse = null) {
  return nurse?.name || request.nurse || request.nurseName || 'Unassigned';
}

function activeCloseoutRequests(requests = [], booking = null) {
  const latest = booking ? [{
    id: booking.id || booking.reference || 'latest-booking',
    client: booking.contact?.name || booking.client || 'Latest client',
    city: booking.city || booking.contact?.city || '',
    address: booking.address || booking.contact?.address || '',
    time: [booking.date, booking.time].filter(Boolean).join(' ') || booking.time || 'Time pending',
    therapy: booking.service || booking.plan || 'Avalon protocol',
    addons: booking.addons || [],
    total: booking.total || booking.depositAmount || 0,
    status: booking.status || 'New Request',
    nurse: booking.nurse || 'Unassigned',
    payment: booking.payment || booking.paymentStatus || 'Pending',
    closeout: booking.closeout || null,
  }] : [];

  const seen = new Set();
  return [...latest, ...requests]
    .filter((request) => !/cancel|archiv/i.test(request.status || ''))
    .filter((request) => {
      const id = requestId(request);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function closeoutFrom(request = {}, closeouts = {}) {
  const id = requestId(request);
  if (closeouts instanceof Map) return closeouts.get(id) || request.closeout || {};
  return closeouts[id] || closeouts[String(id)] || request.closeout || {};
}

function evaluateCloseout(closeout = {}) {
  const draft = { ...CLOSEOUT_DEFAULTS, ...closeout };
  const missing = REQUIRED_CLOSEOUT_FIELDS
    .filter(([key]) => {
      const value = draft[key];
      if (typeof value === 'boolean') return !value;
      return !text(value);
    })
    .map(([, label]) => label);
  const missingWithoutAcuity = missing.filter((label) => label !== 'Acuity');
  const fieldProofComplete = missingWithoutAcuity.length === 0;
  const eventFlagged = Boolean(text(draft.adverseEvent) && !/^none$/i.test(text(draft.adverseEvent)));
  const complete = missing.length === 0;

  return {
    draft,
    missing,
    missingWithoutAcuity,
    complete,
    fieldProofComplete,
    eventFlagged,
    acuityEntered: Boolean(draft.acuityEntered),
    status: complete ? 'Complete' : fieldProofComplete ? 'Ready for Acuity Entry' : 'Incomplete',
    nextAction: missingWithoutAcuity[0]
      ? `Finish ${missingWithoutAcuity[0]}.`
      : !draft.acuityEntered
        ? 'Enter closeout in Acuity.'
        : eventFlagged
          ? 'Route event review before release.'
          : 'Release follow-up and payroll proof.',
  };
}

function stageFor({ request = {}, verdict = {} } = {}) {
  const status = compactText(request.status, request.visitStatus);
  if (!/ready for visit|nurse assigned|arrived|in treatment|progress|complete|closed/.test(status)) return 'Waiting';
  if (!verdict.fieldProofComplete) return 'Closeout Needed';
  if (!verdict.acuityEntered) return 'Acuity Entry';
  if (verdict.eventFlagged) return 'Incident Review';
  return 'Payroll Ready';
}

function riskFor(stage) {
  if (stage === 'Closeout Needed' || stage === 'Incident Review') return 'critical';
  if (stage === 'Acuity Entry' || stage === 'Waiting') return 'action';
  return 'ready';
}

function closeoutPacket({ request = {}, nurse = null, verdict = {} } = {}) {
  const draft = verdict.draft || CLOSEOUT_DEFAULTS;
  return {
    id: `acuity-closeout-${requestId(request)}`,
    appointmentId: requestId(request),
    sourceOfRecord: 'Acuity',
    mode: VISIT_CLOSEOUT_MODE,
    status: verdict.status,
    acuityStatus: draft.acuityEntered ? 'Entered in Acuity' : 'Ready for Acuity entry',
    clientName: clientName(request),
    serviceName: serviceName(request),
    nurseName: nurseName(request, nurse),
    requiredMissing: verdict.missing,
    eventFlagged: verdict.eventFlagged,
    routeSite: draft.routeSite,
    lotOrKitId: draft.lotOrKitId,
    adverseEvent: draft.adverseEvent,
    dischargeCondition: draft.dischargeCondition,
    nurseSignature: draft.nurseSignature,
    attested: Boolean(draft.attestation),
    acuityEntered: Boolean(draft.acuityEntered),
  };
}

function buildDeductionProof({ request = {}, reservation = {}, verdict = {} } = {}) {
  return reservation.lines
    .filter((line) => !line.reusable)
    .map((line) => ({
      id: `deduct-${requestId(request)}-${line.itemId || slug(line.name || line.match)}`,
      visitId: requestId(request),
      client: clientName(request),
      itemId: line.itemId || slug(line.name || line.match),
      name: line.name || line.match,
      sku: line.sku,
      qty: line.qty,
      unit: line.unit || 'units',
      lotOrKitId: verdict.draft?.lotOrKitId || 'Kit pending',
      status: verdict.fieldProofComplete ? 'Queued' : 'Locked',
      source: 'visit-closeout-proof',
    }));
}

function buildPayrollProof({ request = {}, nurse = null, verdict = {}, stage = '' } = {}) {
  const clean = verdict.complete && !verdict.eventFlagged;
  const total = number(request.total || request.amount || request.price, 0);
  return {
    id: `gusto-proof-${requestId(request)}`,
    visitId: requestId(request),
    nurse: nurseName(request, nurse),
    client: clientName(request),
    amount: Math.max(75, Math.round(total * 0.22)),
    status: clean ? 'Ready' : stage === 'Incident Review' ? 'Hold' : 'Locked',
    source: 'Gusto placeholder',
    nextAction: clean ? 'Queue payout proof for payroll review.' : 'Hold payroll proof until clean closeout.',
  };
}

function buildClientFollowUp({ request = {}, verdict = {}, stage = '' } = {}) {
  const ready = verdict.complete && !verdict.eventFlagged;
  return {
    id: `follow-up-${requestId(request)}`,
    visitId: requestId(request),
    client: clientName(request),
    status: ready ? 'Ready' : 'Locked',
    source: 'manual-message-placeholder',
    copy: ready
      ? `Avalon: your ${serviceName(request)} is complete. Reply here if anything changes.`
      : stage === 'Incident Review'
        ? 'Hold client rebook prompt until event review clears.'
        : 'Hold client follow-up until Acuity closeout is complete.',
  };
}

function findNurse(request = {}, nurses = []) {
  const assigned = compactText(request.nurse || request.nurseName);
  if (!assigned || assigned === 'unassigned') return null;
  return nurses.find((nurse) => compactText(nurse.name) === assigned) || null;
}

export function buildVisitCloseout({ request = {}, inventory = [], closeout = {}, nurse = null } = {}) {
  const verdict = evaluateCloseout(closeout);
  const reservation = buildVisitSupplyReservation(request, inventory);
  const stage = stageFor({ request, verdict });
  const packet = closeoutPacket({ request, nurse, verdict });
  const deductionProof = buildDeductionProof({ request, reservation, verdict });
  const payrollProof = buildPayrollProof({ request, nurse, verdict, stage });
  const clientFollowUp = buildClientFollowUp({ request, verdict, stage });
  const risk = riskFor(stage);

  return {
    id: `closeout-${requestId(request)}`,
    visitId: requestId(request),
    client: clientName(request),
    service: serviceName(request),
    nurse: nurseName(request, nurse),
    time: request.time || 'Time pending',
    city: request.city || 'Market pending',
    stage,
    risk,
    sourceOfRecord: 'Acuity',
    mode: VISIT_CLOSEOUT_MODE,
    closeoutStatus: verdict.status,
    missing: verdict.missing,
    eventFlagged: verdict.eventFlagged,
    fieldProofComplete: verdict.fieldProofComplete,
    deductionReady: verdict.fieldProofComplete,
    payrollReady: payrollProof.status === 'Ready',
    followUpReady: clientFollowUp.status === 'Ready',
    packet,
    reservation,
    deductionProof,
    payrollProof,
    clientFollowUp,
    handoffs: [
      { id: 'acuity', label: 'Acuity EMR', status: packet.acuityStatus },
      { id: 'inventory', label: 'Inventory ledger', status: verdict.fieldProofComplete ? 'Deduction queued' : 'Locked' },
      { id: 'gusto', label: 'Gusto payroll', status: payrollProof.status },
      { id: 'client', label: 'Client follow-up', status: clientFollowUp.status },
    ],
    nextAction: verdict.nextAction,
  };
}

function buildIncidentQueue(rows = []) {
  return rows
    .filter((row) => row.eventFlagged)
    .map((row) => ({
      id: `incident-${row.visitId}`,
      visitId: row.visitId,
      client: row.client,
      nurse: row.nurse,
      severity: 'Review',
      action: 'Review event note before payroll, rebook, or follow-up release.',
      sourceOfRecord: 'Acuity',
    }));
}

export function buildVisitCloseoutSnapshot({ requests = [], nurses = [], inventory = [], booking = null, closeouts = {} } = {}) {
  const active = activeCloseoutRequests(requests, booking);
  const rows = active.map((request) => buildVisitCloseout({
    request,
    inventory,
    nurse: findNurse(request, nurses),
    closeout: closeoutFrom(request, closeouts),
  }));
  const deductionLedger = rows.flatMap((row) => row.deductionProof);
  const payrollQueue = rows.map((row) => row.payrollProof).filter((proof) => proof.status !== 'Locked');
  const incidentQueue = buildIncidentQueue(rows);
  const followUpQueue = rows.map((row) => row.clientFollowUp).filter((followUp) => followUp.status === 'Ready');
  const escalations = rows
    .filter((row) => row.risk !== 'ready')
    .map((row) => ({
      id: `closeout-escalation-${row.visitId}`,
      visitId: row.visitId,
      client: row.client,
      severity: row.risk === 'critical' ? 'High' : 'Action',
      reason: row.stage,
      action: row.nextAction,
    }));

  return {
    version: VISIT_CLOSEOUT_VERSION,
    mode: VISIT_CLOSEOUT_MODE,
    rules: VISIT_CLOSEOUT_RULES,
    rows,
    deductionLedger,
    payrollQueue,
    incidentQueue,
    followUpQueue,
    escalations,
    handoffChannels: [
      { id: 'acuity', label: 'Acuity closeout', status: rows.some((row) => row.packet.acuityEntered) ? 'Entered' : 'Manual' },
      { id: 'inventory', label: 'Kit inventory', status: deductionLedger.some((line) => line.status === 'Queued') ? 'Queued' : 'Locked' },
      { id: 'gusto', label: 'Gusto payroll', status: payrollQueue.some((proof) => proof.status === 'Ready') ? 'Ready' : 'Hold' },
      { id: 'client', label: 'Client follow-up', status: followUpQueue.length ? 'Ready' : 'Hold' },
    ],
    metrics: {
      visits: rows.length,
      closeoutNeeded: rows.filter((row) => row.stage === 'Closeout Needed').length,
      acuityEntry: rows.filter((row) => row.stage === 'Acuity Entry').length,
      deductionReady: rows.filter((row) => row.deductionReady).length,
      payrollReady: rows.filter((row) => row.payrollReady).length,
      incidents: incidentQueue.length,
      followUps: followUpQueue.length,
      locked: rows.filter((row) => row.risk !== 'ready').length,
    },
  };
}
