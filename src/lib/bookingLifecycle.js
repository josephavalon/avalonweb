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
  'Scheduling received': ['Intake Pending', 'Clearance Pending', 'Cleared', 'Cancelled'],
  Confirmed: ['Cleared', 'Nurse Assigned', 'Cancelled'],
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

const HIGH_REVIEW_TERMS = ['nad', 'exosome', 'cbd', 'vitamin c', 'high dose', 'group', 'event'];

export function normalizeBookingStatus(status = 'Draft') {
  return BOOKING_STATUSES.includes(status) ? status : 'Draft';
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

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    manualReview: warnings.length > 0,
  };
}

export function createBookingRecord(input = {}) {
  const review = bookingNeedsClinicalReview(input);
  const initialStatus = input.status && !(input.status === 'Scheduling received' && review)
    ? input.status
    : review ? 'Clearance Pending' : 'Scheduling received';
  return {
    ...input,
    status: initialStatus,
    gfe: input.gfe || (review ? 'Pending' : 'Not Started'),
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

  if (!override && current !== next && !allowed.includes(next)) {
    errors.push(`Cannot move from ${current} to ${next}.`);
  }
  if (next === 'Nurse Assigned' && booking.gfe !== 'Cleared') {
    errors.push('Clinical clearance is required before nurse assignment.');
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
