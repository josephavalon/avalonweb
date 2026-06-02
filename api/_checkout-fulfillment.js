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

function formatAddons(items = []) {
  const addons = items.filter((i) => i.type === 'addon' || i.type === 'im');
  if (!addons.length) return null;
  return addons.map((a) => {
    const label = a.label || a.key || 'Add-on';
    return `  - ${label}${a.price ? ` ($${a.price})` : ''}`;
  }).join('\n');
}

export function appointmentNotes({ appointment = {}, items = [], membership = null, req = null }) {
  const ivItems = items.filter((i) => i.type === 'iv');
  const addonBlock = formatAddons(items);
  const isTest = isDevRequest(req);

  const sections = [
    isTest ? '[TEST BOOKING - NOT A REAL APPOINTMENT]' : null,
    'BOOKING DETAILS',
    appointment.address ? `Address: ${appointment.address}` : null,
    appointment.timeLabel ? `Time: ${appointment.timeLabel}` : null,
    appointment.guests && appointment.guests !== '1' ? `Guests: ${appointment.guests}` : null,

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

export async function createSchedulingAppointment({ appointment, contact, items, membership, req }) {
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
      notes: appointmentNotes({ appointment, items, membership, req }),
      fields: requiredSchedulingFields(appointment, items, appointmentTypeID),
    }),
  });
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
    phone: metadataValue(contact.phone),
    paymentMethod: metadataValue(paymentMethod || 'card'),
    service: metadataValue(primaryService),
    depositType: 'non_refundable_deductible',
    visitSubtotalCents: String(visitSubtotalCents),
    depositAmountCents: String(depositCents),
    balanceDueCents: String(balanceDueCents),
  };
}

export async function syncCheckoutAttioPerson({ contact = {}, primaryService = 'Avalon Visit' } = {}) {
  const response = await upsertAttioPerson({
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    source: 'Avalon Booking',
    lifecycleStage: 'Booked',
    service: primaryService,
  });

  return response?.data?.id || response?.id || null;
}
