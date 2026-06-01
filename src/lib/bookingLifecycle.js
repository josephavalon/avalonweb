export const BOOKING_STATUSES = [
  'Draft',
  'Scheduling received',
  'Confirmed',
  'Intake Pending',
  'Clearance Pending',
  'Cleared',
  'Nurse Assigned',
  'Ready for Visit',
  'En Route',
  'Arrived',
  'In Progress',
  'Completed',
  'Follow-Up Due',
  'Cancelled',
];

export const BOOKING_TRANSITIONS = {
  Draft: ['Scheduling received', 'Cancelled'],
  'Scheduling received': ['Confirmed', 'Intake Pending', 'Clearance Pending', 'Cleared', 'Cancelled'],
  Confirmed: ['Intake Pending', 'Clearance Pending', 'Cleared', 'Cancelled'],
  'Intake Pending': ['Clearance Pending', 'Cancelled'],
  'Clearance Pending': ['Cleared', 'Cancelled'],
  Cleared: ['Nurse Assigned', 'Cancelled'],
  'Nurse Assigned': ['Ready for Visit', 'En Route', 'Cancelled'],
  'Ready for Visit': ['En Route', 'Cancelled'],
  'En Route': ['Arrived', 'Cancelled'],
  Arrived: ['In Progress', 'Completed'],
  'In Progress': ['Completed'],
  Completed: ['Follow-Up Due'],
  'Follow-Up Due': [],
  Cancelled: [],
};

export const GFE_VALID_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;
const HIGH_REVIEW_TERMS = ['nad', 'exosome', 'cbd', 'vitamin c', 'high dose', 'group', 'event'];

export function normalizeBookingStatus(status = 'Draft') {
  return BOOKING_STATUSES.includes(status) ? status : 'Draft';
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const parsed = parseDate(date);
  if (!parsed) return null;
  return new Date(parsed.getTime() + Number(days || 0) * DAY_MS);
}

function gfeField(gfe, key) {
  return gfe && typeof gfe === 'object' ? gfe[key] : '';
}

export function isGfeCurrent(gfe = {}, now = new Date()) {
  const record = typeof gfe === 'string' ? { status: gfe } : gfe || {};
  const status = String(record.status || record.state || '').toLowerCase();
  const expiresAt = parseDate(record.expiresAt || record.validUntil || record.validThrough || record.expirationDate);
  const clearedAt = parseDate(record.clearedAt || record.completedAt || record.approvedAt);
  const derivedExpiresAt = expiresAt || (clearedAt ? addDays(clearedAt, GFE_VALID_DAYS) : null);

  if (!/valid|clear|approved|complete/.test(status)) return false;
  if (!derivedExpiresAt) return false;
  return derivedExpiresAt.getTime() > now.getTime();
}

export function resolveGfeRequirement(booking = {}, now = new Date()) {
  const rawGfe = booking.gfeRecord || booking.gfe || {};
  const status = typeof rawGfe === 'string' ? rawGfe : rawGfe.status;
  const visitCount = Number(booking.visitCount ?? booking.client?.visitCount ?? booking.contact?.visitCount ?? 0);
  const isNewClient = booking.isNewClient ?? (booking.clientType === 'new' || visitCount === 0);
  const expiresAt = booking.gfeExpiresAt || gfeField(rawGfe, 'expiresAt') || gfeField(rawGfe, 'validUntil') || gfeField(rawGfe, 'validThrough');
  const clearedAt = booking.gfeClearedAt || gfeField(rawGfe, 'clearedAt') || gfeField(rawGfe, 'completedAt') || gfeField(rawGfe, 'approvedAt');
  const record = { status, expiresAt, clearedAt };
  const current = isGfeCurrent(record, now);

  if (current) {
    const derivedExpiresAt = parseDate(expiresAt) || addDays(clearedAt, GFE_VALID_DAYS);
    return {
      required: false,
      status: 'Valid',
      isNewClient: Boolean(isNewClient),
      visitCount,
      expiresAt: derivedExpiresAt?.toISOString() || expiresAt || '',
      reason: derivedExpiresAt
        ? `GFE valid through ${derivedExpiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`
        : 'Current GFE is on file.',
    };
  }

  return {
    required: true,
    status: 'Required',
    isNewClient: Boolean(isNewClient),
    visitCount,
    expiresAt: '',
    reason: isNewClient ? 'New client requires GFE before dispatch.' : 'GFE is missing or older than one year.',
  };
}

export function bookingNeedsClinicalReview(booking = {}) {
  const therapy = [
    booking.service,
    booking.protocolKey,
    ...(booking.addOns || []),
    ...(booking.items || []).map((item) => item.label || item.cartKey),
  ].filter(Boolean).join(' ').toLowerCase();
  return Boolean(booking.manualReview) || HIGH_REVIEW_TERMS.some((term) => therapy.includes(term)) || Number(booking.guests || 1) > 1;
}

export function isSlotExpired(slot, now = new Date()) {
  const raw = slot?.datetime || slot?.acuityDatetime || slot?.time;
  if (!raw) return true;
  const slotDate = new Date(raw);
  if (Number.isNaN(slotDate.getTime())) return true;
  return slotDate.getTime() <= now.getTime();
}

export function validateBookingForCheckout(booking = {}, { coveredZips } = {}) {
  const errors = [];
  const warnings = [];
  const contact = booking.contact || {};
  const slot = booking.acuitySlot || booking.slot || {
    datetime: booking.datetime,
    time: booking.time,
  };
  const zip = String(booking.zip || '').trim();
  const guests = Number(booking.guests || 1);
  const gfeRequirement = resolveGfeRequirement(booking);

  if (!booking.service && !booking.protocolKey) errors.push('Choose a protocol before checkout.');
  if (!booking.address) errors.push('Add a service address.');
  if (!zip || zip.length !== 5) errors.push('Add a valid ZIP code.');
  if (coveredZips && zip.length === 5 && !coveredZips.has(zip)) warnings.push('ZIP requires manual service-area review.');
  if (!booking.date) errors.push('Choose a visit date.');
  if (!slot?.datetime) errors.push('Choose an available time.');
  if (slot?.datetime && isSlotExpired(slot)) errors.push('This time has passed. Select a new time.');
  if (!contact.firstName || !contact.lastName) errors.push('Add the client name.');
  if (!contact.email || !/\S+@\S+\.\S+/.test(contact.email)) errors.push('Add a valid email.');
  if (!contact.phone || String(contact.phone).replace(/\D/g, '').length < 10) errors.push('Add a valid phone number.');
  if (guests > 4) errors.push('Groups over 4 require direct coordination.');
  if (bookingNeedsClinicalReview(booking)) warnings.push('Clinical review required before dispatch.');
  if (gfeRequirement.required) warnings.push(gfeRequirement.reason);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    manualReview: warnings.length > 0,
  };
}

export function createBookingRecord(input = {}) {
  const gfeRequirement = resolveGfeRequirement(input);
  const review = bookingNeedsClinicalReview(input) || gfeRequirement.required;
  const initialStatus = input.status && !(input.status === 'Scheduling received' && review)
    ? input.status
    : review ? 'Clearance Pending' : 'Scheduling received';
  return {
    ...input,
    status: initialStatus,
    gfe: input.gfe || (gfeRequirement.required ? 'Pending' : 'Cleared'),
    gfeRequired: gfeRequirement.required,
    gfeExpiresAt: input.gfeExpiresAt || gfeRequirement.expiresAt || '',
    gfeStatusReason: input.gfeStatusReason || gfeRequirement.reason,
    isNewClient: gfeRequirement.isNewClient,
    visitCount: gfeRequirement.visitCount,
    nurse: input.nurse || 'Unassigned',
    payment: input.payment || 'Pending',
    audit: input.audit || [
      makeAuditEntry({
        from: null,
        to: initialStatus,
        actor: input.source || 'Website',
        reason: 'Booking created',
      }),
    ],
  };
}

export function makeAuditEntry({ from, to, actor = 'system', reason = 'Status changed', source = 'local' }) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    from,
    to,
    actor,
    reason,
    source,
    at: new Date().toISOString(),
  };
}

export function validateTransition(booking = {}, nextStatus, { override = false } = {}) {
  const current = normalizeBookingStatus(booking.status || 'Draft');
  const next = normalizeBookingStatus(nextStatus);
  const allowed = BOOKING_TRANSITIONS[current] || [];
  const errors = [];
  const gfeRequirement = resolveGfeRequirement(booking);
  const clinicallyCleared = !gfeRequirement.required;

  if (!override && current !== next && !allowed.includes(next)) {
    errors.push(`Cannot move from ${current} to ${next}.`);
  }
  if (['Nurse Assigned', 'Ready for Visit', 'En Route', 'Arrived', 'In Progress', 'Completed'].includes(next) && !clinicallyCleared) {
    errors.push('GFE clearance is required before dispatch.');
  }
  if (['Ready for Visit', 'En Route', 'Arrived', 'In Progress', 'Completed'].includes(next) && (!booking.nurse || booking.nurse === 'Unassigned')) {
    errors.push('Assign a nurse before dispatching this visit.');
  }
  if (['En Route', 'Arrived', 'In Progress', 'Completed'].includes(next) && !['Nurse Assigned', 'Ready for Visit', 'En Route', 'Arrived', 'In Progress'].includes(current) && !override) {
    errors.push('Dispatch steps must happen after nurse assignment.');
  }
  if (next === 'Completed' && !['Arrived', 'In Progress'].includes(current) && !override) {
    errors.push('Mark arrived before completing the visit.');
  }

  return { ok: errors.length === 0, errors, from: current, to: next };
}

export function transitionBooking(booking = {}, nextStatus, options = {}) {
  const validation = validateTransition(booking, nextStatus, options);
  if (!validation.ok) return { ok: false, booking, errors: validation.errors };

  const patch = options.patch || {};
  const next = {
    ...booking,
    ...patch,
    status: validation.to,
    audit: [
      ...(booking.audit || []),
      makeAuditEntry({
        from: validation.from,
        to: validation.to,
        actor: options.actor || 'system',
        reason: options.reason || 'Status changed',
        source: options.source || 'local',
      }),
    ],
    updatedAt: new Date().toISOString(),
  };

  return { ok: true, booking: next, errors: [] };
}
