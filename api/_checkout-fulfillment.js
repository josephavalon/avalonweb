import { acuityFetch, resolveAppointmentTypeId } from './_acuity.js';
import { upsertAttioPerson } from './_attio.js';

export const STRIPE_PAID_FULFILLMENT_VERSION = 'stripe_paid_then_acuity_attio_v1';

const TZ = 'America/Los_Angeles';

function isDevRequest(req) {
  const host = req?.headers?.host || '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

function yesNo(value) {
  return value === true || value === 'true' || value === 'Yes' ? 'Yes' : 'No';
}

function metadataValue(value, max = 480) {
  const stringValue = value == null ? '' : String(value);
  return stringValue.length > max ? stringValue.slice(0, max) : stringValue;
}

function dollarsFromCents(cents = 0) {
  return (Number(cents || 0) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function balanceStatus(amounts = {}) {
  const deposit = Number(amounts.depositAmountCents || 0);
  const balance = Number(amounts.balanceDueCents || 0);
  if (!deposit && !balance) return null;
  return [
    'PAYMENT',
    `  Deposit paid: ${dollarsFromCents(deposit)} non-refundable deductible`,
    balance > 0
      ? `  Balance due at visit: ${dollarsFromCents(balance)}`
      : '  Balance due at visit: $0.00',
    balance > 0 ? '  Status: NOT PAID IN FULL' : '  Status: Paid in full',
  ].join('\n');
}

function formatAddons(items = []) {
  const addons = items.filter((i) => i.type === 'addon' || i.type === 'im');
  if (!addons.length) return null;
  return addons.map((a) => {
    const label = a.label || a.key || 'Add-on';
    return `  - ${label}${a.price ? ` ($${a.price})` : ''}`;
  }).join('\n');
}

export function appointmentNotes({ appointment = {}, items = [], membership = null, amounts = {}, req = null }) {
  const ivItems = items.filter((i) => i.type === 'iv');
  const addonBlock = formatAddons(items);
  const isTest = isDevRequest(req);

  const sections = [
    isTest ? '[TEST BOOKING - NOT A REAL APPOINTMENT]' : null,
    balanceStatus(amounts),
    'BOOKING DETAILS',
    appointment.localBookingId ? `Booking ID: ${appointment.localBookingId}` : null,
    appointment.reference ? `Reference: ${appointment.reference}` : null,
    appointment.clientType ? `Client type: ${appointment.clientType}` : null,
    appointment.locationType ? `Location type: ${appointment.locationType}` : null,
    appointment.address ? `Address: ${appointment.address}` : null,
    appointment.zip ? `ZIP: ${appointment.zip}` : null,
    appointment.timeLabel ? `Time: ${appointment.timeLabel}` : null,
    appointment.guests && appointment.guests !== '1' ? `Guests: ${appointment.guests}` : null,
    appointment.gfeRequired != null ? `GFE required: ${yesNo(appointment.gfeRequired)}` : null,
    appointment.clinicalReviewOnFile != null ? `Clinical review on file: ${yesNo(appointment.clinicalReviewOnFile)}` : null,

    ivItems.length
      ? `\nPROTOCOL\n${ivItems.map((i) => `  - ${i.label} ($${i.price})`).join('\n')}`
      : null,
    addonBlock ? `\nADD-ONS\n${addonBlock}` : null,
    membership ? `\nMEMBERSHIP\n  - ${membership.name} - ${membership.billing} ($${membership.price})` : null,

    appointment.dob ? `\nMEDICAL\n  DOB: ${appointment.dob}` : null,
    appointment.medicalConditions && appointment.medicalConditions !== 'None of the above'
      ? `  Conditions: ${appointment.medicalConditions}`
      : null,
    appointment.covidPositive === 'Yes' ? '  COVID positive in last 14 days' : null,
    appointment.infectiousDisease === 'Yes' ? '  Active infectious disease' : null,
    appointment.ivBefore ? `  IV before: ${appointment.ivBefore}` : null,
    appointment.allergies ? `  Allergies: ${appointment.allergies}` : null,
    appointment.medications ? `  Medications: ${appointment.medications}` : null,
    appointment.emergencyContact ? `  Emergency contact: ${appointment.emergencyContact}` : null,

    appointment.notes ? `\nCLIENT NOTES\n  ${appointment.notes}` : null,
    isTest ? '\n[TEST - DO NOT DISPATCH]' : null,
  ].filter(Boolean);

  return sections.join('\n');
}

function requiresSpecialConsent(items = [], appointmentTypeID, needle) {
  const haystack = `${appointmentTypeID} ${items.map((item) => `${item.cartKey || item.key || ''} ${item.label || ''}`).join(' ')}`.toLowerCase();
  return haystack.includes(needle);
}

export function requiredSchedulingFields(appointment = {}, items = [], appointmentTypeID = '') {
  const medicalConditions = appointment.medicalConditions || 'None of the above';
  const fields = [
    { id: 16968986, value: appointment.dob || '' },
    { id: 16968987, value: appointment.address || '' },
    { id: 16978048, value: appointment.guests || '1' },
    { id: 16968998, value: appointment.covidPositive || 'No' },
    { id: 16978067, value: appointment.infectiousDisease || 'No' },
    { id: 16968997, value: appointment.ivBefore || 'Yes' },
    { id: 16969005, value: medicalConditions },
    { id: 16969010, value: appointment.allergies || '' },
    { id: 16969009, value: appointment.medications || '' },
    { id: 16968994, value: appointment.emergencyContact || '' },
    { id: 16969698, value: appointment.additionalComments || '' },
    { id: 16969017, value: yesNo(appointment.privacyAck) },
    { id: 16969015, value: yesNo(appointment.treatmentConsent) },
    { id: 16969719, value: yesNo(appointment.generalConsent) },
  ];

  if (requiresSpecialConsent(items, appointmentTypeID, 'cbd')) {
    fields.push({ id: 16969724, value: yesNo(appointment.cbdConsent) });
  }
  if (requiresSpecialConsent(items, appointmentTypeID, 'nad')) {
    fields.push({ id: 16969727, value: yesNo(appointment.nadConsent) });
  }

  return fields;
}

function dateOnly(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function firstAvailableDatetime({ appointment = {}, appointmentTypeID }) {
  const startDate = dateOnly(appointment.acuityDatetime || new Date());
  const now = Date.now();

  for (let offset = 0; offset < 21; offset += 1) {
    const date = addDays(startDate, offset);
    const qs = new URLSearchParams({
      date,
      appointmentTypeID: String(appointmentTypeID),
      timezone: appointment.acuityTimezone || TZ,
    }).toString();

    const slots = await acuityFetch(`/availability/times?${qs}`);
    const candidates = Array.isArray(slots) ? slots : [];
    for (const slot of candidates) {
      const datetime = typeof slot === 'string' ? slot : slot?.datetime || slot?.time;
      if (!datetime) continue;
      const parsed = new Date(datetime);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= now + 5 * 60000) continue;
      return datetime;
    }
  }

  return null;
}

export async function createSchedulingAppointment({ appointment, contact, items, membership, amounts, req }) {
  if (!appointment?.acuityDatetime) return null;

  const appointmentTypeID = Number(appointment.acuityTypeId)
    || resolveAppointmentTypeId(items, membership);

  if (!appointmentTypeID) {
    throw Object.assign(new Error('Appointment type is not configured'), { status: 400 });
  }

  return acuityFetch('/appointments', {
    method: 'POST',
    body: JSON.stringify({
      appointmentTypeID,
      datetime: appointment.acuityDatetime,
      firstName: contact.firstName,
      lastName: contact.lastName || '',
      email: contact.email,
      phone: contact.phone || '',
      timezone: appointment.acuityTimezone || TZ,
      notes: appointmentNotes({ appointment, items, membership, amounts, req }),
      fields: requiredSchedulingFields(appointment, items, appointmentTypeID),
    }),
  });
}

export async function createSchedulingAppointmentWithFallback({ appointment, contact, items, membership, amounts, req }) {
  try {
    return await createSchedulingAppointment({ appointment, contact, items, membership, amounts, req });
  } catch (err) {
    const noCalendar = err?.body?.error === 'no_available_calendar'
      || /available calendar/i.test(err?.message || '');
    if (!noCalendar) throw err;

    const appointmentTypeID = Number(appointment.acuityTypeId)
      || resolveAppointmentTypeId(items, membership);
    const fallbackDatetime = await firstAvailableDatetime({ appointment, appointmentTypeID });
    if (!fallbackDatetime) throw err;

    return createSchedulingAppointment({
      appointment: {
        ...appointment,
        acuityDatetime: fallbackDatetime,
        timeLabel: 'Next available',
      },
      contact,
      items,
      membership,
      amounts,
      req,
    });
  }
}

export function buildCheckoutPayload({
  contact = {},
  appointment = {},
  items = [],
  membership = null,
  paymentMethod = 'card',
  primaryService = 'Avalon Visit',
  visitSubtotalCents = 0,
  depositCents = 0,
  balanceDueCents = 0,
} = {}) {
  return {
    fulfillment: STRIPE_PAID_FULFILLMENT_VERSION,
    contact,
    appointment,
    items,
    membership,
    paymentMethod,
    primaryService,
    amounts: {
      currency: 'usd',
      visitSubtotalCents,
      depositAmountCents: depositCents,
      balanceDueCents,
      depositType: 'non_refundable_deductible',
    },
    createdAt: new Date().toISOString(),
  };
}

export function buildPendingAppointmentRecord(payload = {}) {
  const appointment = payload.appointment || {};
  const amounts = payload.amounts || {};
  return {
    status: 'payment_pending',
    starts_at: appointment.acuityDatetime || null,
    protocol_key: payload.primaryService || null,
    payment_status: 'pending',
    reconciliation_status: 'pending',
    visit_subtotal_cents: amounts.visitSubtotalCents ?? null,
    deposit_amount_cents: amounts.depositAmountCents ?? null,
    balance_due_cents: amounts.balanceDueCents ?? null,
    external_payload: {
      provider: 'avalon_checkout',
      ...payload,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function checkoutPayloadFromRecord(record = {}) {
  const payload = record.external_payload || {};
  if (payload.provider === 'avalon_checkout') return payload;
  return payload.checkout || payload;
}

export function buildStripeCheckoutMetadata({
  appointmentRecordId,
  contact = {},
  appointment = {},
  items = [],
  membership = null,
  paymentMethod = 'card',
  primaryService = 'Avalon Visit',
  visitSubtotalCents = 0,
  depositCents = 0,
  balanceDueCents = 0,
} = {}) {
  return {
    fulfillment: STRIPE_PAID_FULFILLMENT_VERSION,
    appointmentRecordId: metadataValue(appointmentRecordId),
    customerName: metadataValue(contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim()),
    customerEmail: metadataValue(contact.email),
    firstName: metadataValue(contact.firstName),
    lastName: metadataValue(contact.lastName),
    phone: metadataValue(contact.phone),
    paymentMethod: metadataValue(paymentMethod || 'card'),
    service: metadataValue(primaryService),
    localBookingId: metadataValue(appointment.localBookingId),
    reference: metadataValue(appointment.reference),
    acuityDatetime: metadataValue(appointment.acuityDatetime),
    acuityTimezone: metadataValue(appointment.acuityTimezone || TZ),
    acuityTypeId: metadataValue(appointment.acuityTypeId),
    timeLabel: metadataValue(appointment.timeLabel),
    address: metadataValue(appointment.address),
    zip: metadataValue(appointment.zip),
    guests: metadataValue(appointment.guests || '1'),
    locationType: metadataValue(appointment.locationType),
    notes: metadataValue(appointment.notes),
    clientType: metadataValue(appointment.clientType),
    clinicalReviewOnFile: metadataValue(appointment.clinicalReviewOnFile),
    gfeRequired: metadataValue(appointment.gfeRequired),
    itemLabels: metadataValue(items.map((item) => item.label || item.key || 'Avalon Visit').join(' | ')),
    itemKeys: metadataValue(items.map((item) => item.cartKey || item.key || '').filter(Boolean).join(' | ')),
    itemTypes: metadataValue(items.map((item) => item.type || 'service').join(' | ')),
    itemPrices: metadataValue(items.map((item) => item.price || 0).join(' | ')),
    membershipName: metadataValue(membership?.name),
    membershipBilling: metadataValue(membership?.billing),
    membershipPrice: metadataValue(membership?.price),
    depositType: 'non_refundable_deductible',
    visitSubtotalCents: String(visitSubtotalCents),
    depositAmountCents: String(depositCents),
    balanceDueCents: String(balanceDueCents),
  };
}

export function checkoutPayloadFromStripeMetadata(metadata = {}) {
  const split = (value) => String(value || '').split('|').map((item) => item.trim());
  const labels = split(metadata.itemLabels).filter(Boolean);
  const keys = split(metadata.itemKeys);
  const types = split(metadata.itemTypes);
  const prices = split(metadata.itemPrices);
  const items = labels.map((label, index) => ({
    label,
    key: keys[index] || label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    cartKey: keys[index] || label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    type: types[index] || 'service',
    price: Number(prices[index] || 0),
  }));

  return {
    fulfillment: metadata.fulfillment || STRIPE_PAID_FULFILLMENT_VERSION,
    contact: {
      name: metadata.customerName || [metadata.firstName, metadata.lastName].filter(Boolean).join(' '),
      firstName: metadata.firstName || String(metadata.customerName || '').trim().split(/\s+/)[0] || '',
      lastName: metadata.lastName || String(metadata.customerName || '').trim().split(/\s+/).slice(1).join(' '),
      email: metadata.customerEmail || '',
      phone: metadata.phone || '',
    },
    appointment: {
      localBookingId: metadata.localBookingId || '',
      reference: metadata.reference || '',
      acuityDatetime: metadata.acuityDatetime || '',
      acuityTimezone: metadata.acuityTimezone || TZ,
      acuityTypeId: metadata.acuityTypeId || '',
      timeLabel: metadata.timeLabel || '',
      address: metadata.address || '',
      zip: metadata.zip || '',
      guests: metadata.guests || '1',
      locationType: metadata.locationType || '',
      notes: metadata.notes || '',
      clientType: metadata.clientType || '',
      clinicalReviewOnFile: metadata.clinicalReviewOnFile || '',
      gfeRequired: metadata.gfeRequired || '',
    },
    items,
    membership: metadata.membershipName ? {
      name: metadata.membershipName,
      billing: metadata.membershipBilling || 'monthly',
      price: Number(metadata.membershipPrice || 0),
    } : null,
    paymentMethod: metadata.paymentMethod || 'card',
    primaryService: metadata.service || labels[0] || metadata.membershipName || 'Avalon Visit',
    amounts: {
      currency: 'usd',
      visitSubtotalCents: Number(metadata.visitSubtotalCents || 0),
      depositAmountCents: Number(metadata.depositAmountCents || 0),
      balanceDueCents: Number(metadata.balanceDueCents || 0),
      depositType: metadata.depositType || 'non_refundable_deductible',
    },
  };
}

export async function syncCheckoutAttioPerson({
  contact = {},
  primaryService = 'Avalon Visit',
  appointment = {},
  items = [],
  membership = null,
  amounts = {},
} = {}) {
  const response = await upsertAttioPerson({
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    source: 'Avalon Booking',
    lifecycleStage: 'Booked',
    service: primaryService,
    bookingId: appointment.localBookingId,
    bookingReference: appointment.reference,
    address: appointment.address,
    zip: appointment.zip,
    locationType: appointment.locationType,
    appointmentTime: appointment.timeLabel || appointment.acuityDatetime,
    clientType: appointment.clientType || contact.clientType,
    clinicalReviewOnFile: appointment.clinicalReviewOnFile,
    gfeRequired: appointment.gfeRequired,
    itemLabels: items.map((item) => item.label || item.key).filter(Boolean).join(', '),
    membership: membership?.name || '',
    depositPaid: dollarsFromCents(amounts.depositAmountCents || 0),
    balanceDue: dollarsFromCents(amounts.balanceDueCents || 0),
    paymentStatus: Number(amounts.balanceDueCents || 0) > 0 ? 'Deposit paid; balance due at visit' : 'Paid in full',
  });

  return response?.data?.id || response?.id || null;
}
