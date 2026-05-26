import { bookingNeedsClinicalReview, resolveGfeRequirement } from './bookingLifecycle';
import { COVERED_ZIPS, extractZip } from './serviceArea';

const DISPATCH_STATUSES = ['Ready for Visit', 'En Route', 'Arrived', 'In Progress', 'Completed'];
const COMPLETE_RE = /done|received|complete|signed|cleared|valid|paid/i;
const BLOCKED_RE = /blocked|declined|failed|expired|contraindicated/i;
const HIGH_RISK_TERMS = ['pregnancy', 'breastfeeding', 'heart', 'kidney', 'liver', 'infection', 'infectious', 'covid', 'diabetes'];

function text(value) {
  return String(value || '').trim();
}

function contactName(contact = {}) {
  return contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Client';
}

function checkpoint({ key, label, complete, blocked = false, owner, detail, action }) {
  return {
    key,
    label,
    complete: Boolean(complete),
    blocked: Boolean(blocked),
    status: blocked ? 'Blocked' : complete ? 'Ready' : 'Needed',
    owner,
    detail,
    action,
  };
}

function profileDocComplete(profile, label) {
  return Boolean(profile?.documents?.some((doc) => doc.label === label && COMPLETE_RE.test(text(doc.status))));
}

function collectScreeningFlags(booking = {}, profile = {}) {
  const flags = [];
  const fields = [
    booking.covidPositive,
    booking.infectiousDisease,
    booking.medicalConditions,
    booking.allergies,
    booking.medications,
    profile.medicalConditions,
    profile.allergies,
    profile.medications,
  ].flat().map(text).filter(Boolean);

  fields.forEach((value) => {
    const normalized = value.toLowerCase();
    if (normalized === 'no' || normalized === 'none' || normalized === 'none of the above') return;
    if (HIGH_RISK_TERMS.some((term) => normalized.includes(term))) flags.push(value);
  });

  return Array.from(new Set(flags)).slice(0, 6);
}

export function evaluateClinicalClearance(booking = {}, { profile = {}, now = new Date() } = {}) {
  const contact = booking.contact || {};
  const zip = text(booking.zip) || extractZip(booking.address || profile.defaultAddress || '');
  const gfeRequirement = resolveGfeRequirement({
    ...booking,
    gfe: booking.gfeRecord || booking.gfe || profile.gfe,
    gfeExpiresAt: booking.gfeExpiresAt || profile.gfe?.validUntil,
    visitCount: booking.visitCount,
    isNewClient: booking.isNewClient,
  }, now);
  const screeningFlags = collectScreeningFlags(booking, profile);
  const protocolReview = bookingNeedsClinicalReview(booking) || screeningFlags.length > 0;
  const intakeComplete = COMPLETE_RE.test(text(booking.intake)) || profileDocComplete(profile, 'Intake');
  const consentComplete = COMPLETE_RE.test(text(booking.consent)) || profileDocComplete(profile, 'Consent');
  const depositPaid = COMPLETE_RE.test(text(booking.payment || profile.wallet?.deposits?.[0]?.status));
  const hasContact = Boolean(contactName(contact) !== 'Client' && (contact.phone || profile.phone) && (contact.email || profile.email));
  const inServiceArea = zip ? COVERED_ZIPS.has(zip) : false;
  const gfeBlocked = BLOCKED_RE.test(text(booking.gfe));
  const intakeBlocked = BLOCKED_RE.test(text(booking.intake));
  const consentBlocked = BLOCKED_RE.test(text(booking.consent));
  const operationallyDispatched = DISPATCH_STATUSES.includes(booking.status);

  const checkpoints = [
    checkpoint({
      key: 'contact',
      label: 'Contact',
      complete: hasContact,
      owner: 'Client',
      detail: hasContact ? `${contactName(contact)} can receive follow-up.` : 'Name, phone, and email are required.',
      action: 'Collect client contact.',
    }),
    checkpoint({
      key: 'intake',
      label: 'Intake',
      complete: intakeComplete,
      blocked: intakeBlocked,
      owner: 'Client',
      detail: intakeComplete ? 'Medical intake is represented locally.' : 'Medical intake must be complete before review.',
      action: 'Finish medical intake.',
    }),
    checkpoint({
      key: 'consent',
      label: 'Consent',
      complete: consentComplete,
      blocked: consentBlocked,
      owner: 'Client',
      detail: consentComplete ? 'Consent is represented locally.' : 'Treatment, HIPAA, and waiver acknowledgements are required.',
      action: 'Sign consent.',
    }),
    checkpoint({
      key: 'gfe',
      label: 'GFE',
      complete: !gfeRequirement.required,
      blocked: gfeBlocked,
      owner: gfeRequirement.required ? 'Avalon NP first' : 'Clinical placeholder',
      detail: gfeRequirement.reason,
      action: gfeRequirement.required ? 'Route GFE before dispatch.' : 'Keep GFE current.',
    }),
    checkpoint({
      key: 'protocol',
      label: 'Protocol',
      complete: !protocolReview,
      owner: 'Clinical placeholder',
      detail: protocolReview
        ? `Provider review required${screeningFlags.length ? `: ${screeningFlags.join(', ')}` : '.'}`
        : 'No extra placeholder review flags detected.',
      action: 'Clinical source of record may adjust or decline protocol.',
    }),
    checkpoint({
      key: 'service-area',
      label: 'Service area',
      complete: inServiceArea,
      owner: 'Dispatch',
      detail: zip ? `${zip}${inServiceArea ? ' is in coverage.' : ' needs manual service-area review.'}` : 'ZIP is missing.',
      action: 'Verify address and travel approval.',
    }),
    checkpoint({
      key: 'deposit',
      label: 'Deposit',
      complete: depositPaid,
      owner: 'Stripe/Acuity placeholder',
      detail: depositPaid ? '$50 deposit is represented locally.' : '$50 deposit is not marked paid.',
      action: 'Collect deposit before active dispatch.',
    }),
  ];

  const blocked = checkpoints.filter((item) => item.blocked);
  const missing = checkpoints.filter((item) => !item.complete && !item.blocked);
  const hardStop = blocked.length > 0 || (operationallyDispatched && missing.length > 0);
  const dispatchAllowed = blocked.length === 0 && missing.length === 0;
  const status = hardStop ? 'blocked' : dispatchAllowed ? 'ready' : 'action';
  const next = blocked[0] || missing[0] || null;

  return {
    status,
    label: status === 'ready' ? 'Cleared' : status === 'blocked' ? 'Blocked' : 'Clearance Needed',
    dispatchAllowed,
    hardStop,
    client: contactName(contact),
    zip,
    gfe: gfeRequirement,
    gfeRoute: gfeRequirement.required
      ? 'Avalon NP first. Qualiphy only if no Avalon NP is on call.'
      : 'Current GFE on file.',
    protocolReview,
    screeningFlags,
    checkpoints,
    missing,
    blocked,
    blockers: [...blocked, ...missing],
    summary: dispatchAllowed
      ? 'Intake, consent, GFE, protocol review, service area, and deposit are clear.'
      : `${missing.length + blocked.length} clearance item${missing.length + blocked.length === 1 ? '' : 's'} before RN dispatch.`,
    nextAction: next?.action || 'Ready for nurse dispatch.',
  };
}

export function clinicalStatusTone(verdict = {}) {
  if (verdict.status === 'ready') return 'ready';
  if (verdict.status === 'blocked') return 'blocked';
  return 'action';
}

export function buildClinicalClearanceQueueItem(booking = {}, options = {}) {
  const verdict = evaluateClinicalClearance(booking, options);
  const checkpointMap = Object.fromEntries(verdict.checkpoints.map((item) => [item.key, item]));
  return {
    id: booking.id || booking.reference || 'latest-booking',
    client: verdict.client,
    therapy: booking.service || booking.plan || 'Avalon visit',
    date: booking.date || 'Date pending',
    time: booking.time || 'Time pending',
    location: booking.address || booking.city || 'Location pending',
    intake: checkpointMap.intake?.blocked ? 'Blocked' : checkpointMap.intake?.complete ? 'Received' : 'Pending',
    consent: checkpointMap.consent?.blocked ? 'Blocked' : checkpointMap.consent?.complete ? 'Signed' : 'Pending',
    gfe: checkpointMap.gfe?.blocked ? 'Blocked' : checkpointMap.gfe?.complete ? 'Cleared' : 'Pending',
    nurse: booking.nurse || 'Unassigned',
    payment: booking.payment || 'Pending',
    source: booking.source || 'Website',
    notes: [booking.notes, verdict.summary, verdict.gfeRoute].filter(Boolean).join(' '),
    clearance: verdict,
    bookingSnapshot: booking,
    isLocalBooking: true,
  };
}
