import { appendActivity, readLocal, writeLocal } from './localOs';

export const REQUIRED_CLOSEOUT_DEFAULTS = {
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

const CLOSEOUT_SECTIONS = [
  {
    key: 'clearance',
    label: 'Clearance',
    checks: [
      ['identityVerified', 'ID/DOB'],
      ['consentVerified', 'Consent'],
      ['gfeVerified', 'GFE'],
    ],
  },
  {
    key: 'review',
    label: 'Review',
    checks: [
      ['allergiesReviewed', 'Allergies'],
      ['medicationsReviewed', 'Meds'],
    ],
  },
  {
    key: 'vitals',
    label: 'Vitals',
    fields: [
      ['preBp', 'Pre BP'],
      ['preHr', 'Pre HR'],
      ['preSpo2', 'Pre SpO2'],
      ['postBp', 'Post BP'],
      ['postHr', 'Post HR'],
      ['postSpo2', 'Post SpO2'],
    ],
  },
  {
    key: 'supplies',
    label: 'Supplies',
    checks: [['expirationChecked', 'Expiry']],
    fields: [
      ['routeSite', 'Route/site'],
      ['lotOrKitId', 'Lot/kit'],
    ],
  },
  {
    key: 'event',
    label: 'Event',
    fields: [['adverseEvent', 'Event note']],
  },
  {
    key: 'close',
    label: 'Close',
    fields: [
      ['dischargeCondition', 'Discharge'],
      ['nurseSignature', 'Signature'],
    ],
    checks: [
      ['attestation', 'RN attest'],
      ['acuityEntered', 'Acuity'],
    ],
  },
];

function text(value) {
  return String(value || '').trim();
}

function fullName(person = {}) {
  return [person.first_name, person.last_name].filter(Boolean).join(' ') || person.name || 'Client';
}

function draftKey(visitId) {
  return `acuityCloseout.${visitId}`;
}

function legacyChartKey(visitId) {
  return `av.visit.${visitId}.requiredChart`;
}

function readLegacyChartDraft(visitId) {
  try {
    const saved = window.localStorage.getItem(legacyChartKey(visitId));
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function sectionStatus(section, draft) {
  const missing = [];

  (section.checks || []).forEach(([key, label]) => {
    if (!draft[key]) missing.push(label);
  });

  (section.fields || []).forEach(([key, label]) => {
    if (!text(draft[key])) missing.push(label);
  });

  return {
    key: section.key,
    label: section.label,
    complete: missing.length === 0,
    missing,
  };
}

export function readAcuityCloseoutDraft(visitId) {
  const saved = readLocal(draftKey(visitId), null);
  if (saved) return { ...REQUIRED_CLOSEOUT_DEFAULTS, ...saved };

  const legacy = readLegacyChartDraft(visitId);
  if (legacy) return { ...REQUIRED_CLOSEOUT_DEFAULTS, ...legacy, source: 'legacy-chart-draft' };

  return { ...REQUIRED_CLOSEOUT_DEFAULTS };
}

export function saveAcuityCloseoutDraft(visitId, patch = {}) {
  const next = {
    ...readAcuityCloseoutDraft(visitId),
    ...patch,
    updatedAt: new Date().toISOString(),
    sourceOfRecord: 'Acuity',
    storageMode: 'local-preview',
  };
  return writeLocal(draftKey(visitId), next);
}

export function evaluateAcuityCloseout(draft = {}) {
  const merged = { ...REQUIRED_CLOSEOUT_DEFAULTS, ...draft };
  const sections = CLOSEOUT_SECTIONS.map((section) => sectionStatus(section, merged));
  const missing = sections.flatMap((section) => section.missing);
  const eventFlagged = Boolean(text(merged.adverseEvent) && !/^none$/i.test(text(merged.adverseEvent)));
  const complete = missing.length === 0;

  return {
    sourceOfRecord: 'Acuity',
    storageMode: 'local-preview',
    complete,
    readyToComplete: complete,
    eventFlagged,
    label: complete ? 'Ready' : `${missing.length} left`,
    status: complete ? 'ready' : 'action',
    sections,
    missing,
    nextAction: missing[0]
      ? `Finish ${missing[0]} before closing.`
      : eventFlagged
        ? 'Close visit and flag event follow-up.'
        : 'Ready to close and keep Acuity as record.',
    summary: complete
      ? 'Acuity closeout is ready.'
      : `${missing.length} required Acuity closeout item${missing.length === 1 ? '' : 's'} remaining.`,
  };
}

export function buildAcuityCloseoutPacket({
  appointment = {},
  client = {},
  service = {},
  closeout = {},
  note = '',
  nurseName = 'Nurse',
  completedAt = new Date().toISOString(),
} = {}) {
  const draft = { ...REQUIRED_CLOSEOUT_DEFAULTS, ...closeout };
  const verdict = evaluateAcuityCloseout(draft);
  const appointmentId = appointment.id || `visit-${Date.now()}`;

  return {
    id: `acuity-closeout-${appointmentId}-${Date.now()}`,
    appointmentId,
    sourceOfRecord: 'Acuity',
    mode: 'manual-acuity-handoff',
    status: verdict.complete ? 'Complete' : 'Incomplete',
    acuityStatus: draft.acuityEntered ? 'Entered in Acuity' : 'Ready for Acuity entry',
    clientName: fullName(client),
    clientId: client.id || appointment.client_id || '',
    serviceName: service.name || appointment.serviceName || 'Avalon visit',
    nurseName,
    completedAt,
    requiredMissing: verdict.missing,
    eventFlagged: verdict.eventFlagged,
    preVitals: {
      bp: draft.preBp,
      hr: draft.preHr,
      spo2: draft.preSpo2,
    },
    postVitals: {
      bp: draft.postBp,
      hr: draft.postHr,
      spo2: draft.postSpo2,
    },
    acuityNote: text(note),
    routeSite: draft.routeSite,
    lotOrKitId: draft.lotOrKitId,
    adverseEvent: draft.adverseEvent,
    dischargeCondition: draft.dischargeCondition,
    nurseSignature: draft.nurseSignature,
    attested: draft.attestation,
    acuityEntered: draft.acuityEntered,
  };
}

export function saveAcuityCloseoutPacket(packet = {}) {
  const packets = readLocal('acuityCloseoutPackets', []);
  const next = [packet, ...packets.filter((item) => item.appointmentId !== packet.appointmentId)].slice(0, 80);
  writeLocal('acuityCloseoutPackets', next);
  writeLocal(`acuityCloseoutPacket.${packet.appointmentId}`, packet);
  appendActivity(`Acuity closeout ${packet.status.toLowerCase()}: ${packet.clientName}`, {
    role: 'nurse',
    visit: packet.appointmentId,
    sourceOfRecord: 'Acuity',
  });
  return packet;
}
