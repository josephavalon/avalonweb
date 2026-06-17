import { acuityFetch, resolveAppointmentTypeId, resolveAppointmentTypeIdFromLive } from './_acuity.js';
import { upsertAttioPerson } from './_attio.js';
import { safeLogContext } from './_lib/safe-error.js';
import { safeStripeMetadata } from './_lib/safe-stripe.js';

export const STRIPE_PAID_FULFILLMENT_VERSION = 'stripe_paid_then_acuity_attio_v1';

const TZ = 'America/Los_Angeles';

function isDevRequest(req) {
  const host = req?.headers?.host || '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

function yesNo(value) {
  return value === true || value === 'true' || value === 'Yes' ? 'Yes' : 'No';
}

function yesNoDefaultYes(value) {
  return value === false || value === 'false' || value === 'No' ? 'No' : 'Yes';
}

function dollarsFromCents(cents = 0) {
  return (Number(cents || 0) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function balanceStatus(amounts = {}) {
  const paid = Number(amounts.depositAmountCents || 0);
  const balance = Number(amounts.balanceDueCents || 0);
  if (!paid && !balance) return null;
  return [
    'PAYMENT',
    `  Paid online: ${dollarsFromCents(paid)}`,
    balance > 0
      ? `  Balance due at visit: ${dollarsFromCents(balance)}`
      : null,
    balance > 0 ? '  Status: NOT PAID IN FULL' : '  Status: Paid in full',
  ].filter(Boolean).join('\n');
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
    { id: 16969010, value: appointment.allergies || 'None reported' },
    { id: 16969009, value: appointment.medications || 'None reported' },
    { id: 16968994, value: appointment.emergencyContact || '' },
    { id: 16969698, value: appointment.additionalComments || appointment.notes || 'None' },
    { id: 16969017, value: yesNoDefaultYes(appointment.privacyAck) },
    { id: 16969015, value: yesNoDefaultYes(appointment.treatmentConsent) },
    { id: 16969719, value: yesNoDefaultYes(appointment.generalConsent) },
  ];

  if (requiresSpecialConsent(items, appointmentTypeID, 'cbd')) {
    fields.push({ id: 16969724, value: yesNoDefaultYes(appointment.cbdConsent) });
  }
  if (requiresSpecialConsent(items, appointmentTypeID, 'nad')) {
    fields.push({ id: 16969727, value: yesNoDefaultYes(appointment.nadConsent) });
  }

  return fields;
}

function dateOnly(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function shouldUseNextAvailable(appointment = {}) {
  const label = `${appointment.timeLabel || ''} ${appointment.availabilityWindow || ''}`.toLowerCase();
  const requested = parseDate(appointment.acuityDatetime);
  if (!requested) return true;
  if (label.includes('asap') || label.includes('soonest')) return true;
  return requested.getTime() <= Date.now() + 5 * 60000;
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

async function resolveSchedulingTypeId({ appointment = {}, items = [], membership = null } = {}) {
  const explicitId = Number(appointment.acuityTypeId);
  if (explicitId) return explicitId;

  const envId = resolveAppointmentTypeId(items, membership);
  if (envId) return envId;

  const liveId = await resolveAppointmentTypeIdFromLive(items, membership);
  if (liveId) return liveId;

  throw Object.assign(new Error('Appointment type is not configured'), { status: 400 });
}

function shouldRetryWithAvailability(err = {}) {
  const text = `${err?.message || ''} ${err?.body?.message || ''} ${err?.body?.error || ''}`.toLowerCase();
  return /available|availability|calendar|datetime|time|past|invalid/.test(text);
}

export async function createSchedulingAppointment({ appointment, contact, items, membership, amounts, req }) {
  if (!appointment?.acuityDatetime) return null;

  const appointmentTypeID = await resolveSchedulingTypeId({ appointment, items, membership });
  let appointmentForAcuity = appointment;

  if (shouldUseNextAvailable(appointment)) {
    const fallbackDatetime = await firstAvailableDatetime({ appointment, appointmentTypeID });
    if (fallbackDatetime) {
      appointmentForAcuity = {
        ...appointment,
        acuityDatetime: fallbackDatetime,
        timeLabel: appointment.timeLabel || 'Next available',
      };
    }
  }

  const first = await acuityFetch('/appointments', {
    method: 'POST',
    body: JSON.stringify({
      appointmentTypeID,
      datetime: appointmentForAcuity.acuityDatetime,
      firstName: contact.firstName,
      lastName: contact.lastName || '',
      email: contact.email,
      phone: contact.phone || '',
      timezone: appointmentForAcuity.acuityTimezone || TZ,
      notes: appointmentNotes({ appointment: appointmentForAcuity, items, membership, amounts, req }),
      fields: requiredSchedulingFields(appointmentForAcuity, items, appointmentTypeID),
    }),
  });

  // Memberships recur: book the SAME day/time monthly for the committed term.
  // Capped at 6 inline to keep the payment webhook fast/safe (annual gets a
  // 6-month runway; extending it is a fast-follow that needs a scheduled job).
  // Best-effort — a month that can't be booked is logged + skipped, never
  // blocking the sale. Changes go through admin.
  if (membership && first?.id) {
    const months = Math.min(monthsForMembershipTerm(membership.billing), 6);
    if (months > 1) {
      await bookMonthlyRecurrences({
        baseDatetime: first.datetime || appointmentForAcuity.acuityDatetime,
        months,
        appointmentTypeID,
        contact,
        appointment: appointmentForAcuity,
        items,
        membership,
        amounts,
        req,
      });
    }
  }

  return first;
}

function monthsForMembershipTerm(billing) {
  switch (billing) {
    case 'annual': return 12;
    case 'six-month': return 6;
    case 'three-month': return 3;
    default: return 3; // monthly (ongoing) — 3-month rolling horizon
  }
}

function addMonthsToDatetime(iso, monthsToAdd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})(.*)$/.exec(String(iso || ''));
  if (!m) return null;
  let year = Number(m[1]);
  let month = Number(m[2]) - 1 + monthsToAdd; // 0-based
  const day = Number(m[3]);
  const time = m[4];
  const offset = m[5] || '';
  year += Math.floor(month / 12);
  month = ((month % 12) + 12) % 12;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dd = String(Math.min(day, daysInMonth)).padStart(2, '0');
  const mm = String(month + 1).padStart(2, '0');
  return `${year}-${mm}-${dd}T${time}${offset}`;
}

async function bookMonthlyRecurrences({ baseDatetime, months, appointmentTypeID, contact, appointment, items, membership, amounts, req }) {
  const created = [];
  for (let i = 1; i < months; i += 1) {
    const datetime = addMonthsToDatetime(baseDatetime, i);
    if (!datetime) continue;
    try {
      const appt = await acuityFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          appointmentTypeID,
          datetime,
          firstName: contact.firstName,
          lastName: contact.lastName || '',
          email: contact.email,
          phone: contact.phone || '',
          timezone: appointment.acuityTimezone || TZ,
          notes: appointmentNotes({ appointment, items, membership, amounts, req }),
          fields: requiredSchedulingFields(appointment, items, appointmentTypeID),
        }),
      });
      if (appt?.id) created.push(appt.id);
    } catch (err) {
      console.warn(`[fulfillment] membership recurrence month ${i} failed`, safeLogContext(err, 'membership_recurrence_failed'));
    }
  }
  if (created.length) console.log(`[fulfillment] booked ${created.length} recurring membership appointment(s)`);
  return created;
}

export async function createSchedulingAppointmentWithFallback({ appointment, contact, items, membership, amounts, req }) {
  try {
    return await createSchedulingAppointment({ appointment, contact, items, membership, amounts, req });
  } catch (err) {
    if (!shouldRetryWithAvailability(err)) throw err;

    const appointmentTypeID = await resolveSchedulingTypeId({ appointment, items, membership });
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

function planRecurringInterval(billing) {
  switch (billing) {
    case 'annual': return { interval: 'year' };
    case 'six-month': return { interval: 'month', interval_count: 6 };
    case 'three-month': return { interval: 'month', interval_count: 3 };
    default: return { interval: 'month' };
  }
}

// Stripe requires trial_end strictly in the future. Anchor the first recurring
// charge to ONE period after the first visit so month one is covered by the
// $50 deposit plus after-visit balance, not a same-day subscription charge.
function planTrialEndUnix(firstVisitIso, recurring) {
  const nowSec = Math.floor(Date.now() / 1000);
  const base = firstVisitIso ? new Date(firstVisitIso) : new Date();
  const start = Number.isFinite(base.getTime()) ? new Date(base.getTime()) : new Date();
  if (recurring.interval === 'year') {
    start.setFullYear(start.getFullYear() + 1);
  } else {
    start.setMonth(start.getMonth() + (recurring.interval_count || 1));
  }
  return Math.max(Math.floor(start.getTime() / 1000), nowSec + 3600);
}

// Create the recurring full-price plan subscription that begins one period AFTER
// the first visit. Idempotent on the appointment/session id so either the Stripe
// webhook or /api/checkout/verify can safely create it after Acuity succeeds.
export async function createDeferredPlanSubscription(stripe, { session, md, paymentMethodId, recordId }) {
  const monthlyCents = Math.round(Number(md.planMonthlyPriceCents || 0));
  if (!session.customer || !paymentMethodId || !(monthlyCents > 0)) return null;
  const recurring = planRecurringInterval(md.membershipBilling || 'monthly');
  const trialEnd = planTrialEndUnix(md.planFirstVisitDate, recurring);
  const planName = `${md.membershipName || 'Avalon'} Plan`;
  const scope = recordId || session.id;
  const product = await stripe.products.create(
    { name: planName, metadata: safeStripeMetadata({ kind: 'plan_recurring' }) },
    { idempotencyKey: `plan-prod:${scope}` },
  );
  const subscription = await stripe.subscriptions.create(
    {
      customer: session.customer,
      default_payment_method: paymentMethodId,
      trial_end: trialEnd,
      items: [{
        price_data: {
          currency: 'usd',
          product: product.id,
          unit_amount: monthlyCents,
          recurring,
        },
      }],
      metadata: safeStripeMetadata({
        kind: 'plan_recurring',
        appointmentRecordId: recordId || '',
        stripeCheckoutSessionId: session.id,
        planName,
      }),
    },
    { idempotencyKey: `plan-sub:${scope}` },
  );
  return subscription.id;
}

// ── Double-booking guard ─────────────────────────────────────────────────────
// The Stripe webhook AND the client return-page (checkout/verify) both create
// the Acuity appointment after payment. Without a lock they can race and create
// TWO appointments — double-booking a nurse. claimSchedulingCreation() is an
// atomic, time-expiring claim on the appointments row: only the path that flips
// `scheduling_lock_at` (from null or stale) wins the right to create. The TTL
// makes it crash-safe — if a winner dies mid-fulfillment the lock expires and a
// later webhook retry re-claims. It is best-effort: with no DB, or before the
// `scheduling_lock_at` column exists (pre-migration), it returns true so we fall
// back to the prior behaviour rather than ever blocking a real booking.
const SCHEDULING_LOCK_TTL_MS = 120000;

export async function claimSchedulingCreation(db, recordId) {
  if (!db || !recordId) return true;
  const staleBefore = new Date(Date.now() - SCHEDULING_LOCK_TTL_MS).toISOString();
  try {
    const { data, error } = await db.from('appointments')
      .update({ scheduling_lock_at: new Date().toISOString() })
      .eq('id', recordId)
      .is('acuity_appointment_id', null)
      .or(`scheduling_lock_at.is.null,scheduling_lock_at.lt.${staleBefore}`)
      .select('id')
      .maybeSingle();
    if (error) return true; // column missing / transient — never block fulfillment
    return Boolean(data);   // a returned row means this path won the claim
  } catch {
    return true;
  }
}

export async function readAcuityAppointmentId(db, recordId) {
  if (!db || !recordId) return null;
  try {
    const { data } = await db.from('appointments')
      .select('acuity_appointment_id')
      .eq('id', recordId)
      .maybeSingle();
    return data?.acuity_appointment_id || null;
  } catch {
    return null;
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
      depositType: balanceDueCents > 0 ? 'non_refundable_deductible' : 'full_payment',
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

export function isLegacyStripeMetadataPayload(metadata = {}) {
  return [
    'customerEmail',
    'customerName',
    'firstName',
    'lastName',
    'phone',
    'dob',
    'emergencyContact',
    'address',
    'zip',
    'notes',
    'acuityDatetime',
    'timeLabel',
    'itemPrices',
  ].some((key) => String(metadata?.[key] || '').trim());
}

export function buildStripeCheckoutMetadata({
  appointmentRecordId,
  appointment = {},
  items = [],
  membership = null,
  paymentMethod = 'card',
  primaryService = 'Avalon Visit',
  visitSubtotalCents = 0,
  depositCents = 0,
  balanceDueCents = 0,
} = {}) {
  // All Stripe metadata is filtered through safeStripeMetadata (whitelist +
  // PHI-name deny patterns) per the HIPAA route-around in docs/PHI_DATA_FLOW.md.
  // peopleManifest is intentionally NOT included — it contained per-patient DOB.
  // The canonical patient manifest lives in Supabase appointments.external_payload
  // (BAA-covered) and is read at fulfillment time, not from Stripe.
  return safeStripeMetadata({
    fulfillment: STRIPE_PAID_FULFILLMENT_VERSION,
    appointmentRecordId,
    paymentMethod: paymentMethod || 'card',
    service: primaryService,
    acuityTypeId: appointment.acuityTypeId,
    guests: appointment.guests || '1',
    locationType: appointment.locationType,
    orderType: appointment.orderType,
    paymentType: appointment.paymentType,
    itemLabels: items.map((item) => item.label || item.key || 'Avalon Visit').join(' | '),
    itemKeys: items.map((item) => item.cartKey || item.key || '').filter(Boolean).join(' | '),
    itemTypes: items.map((item) => item.type || 'service').join(' | '),
    membershipName: membership?.name,
    membershipBilling: membership?.billing,
    depositType: balanceDueCents > 0 ? 'non_refundable_deductible' : 'full_payment',
    visitSubtotalCents: String(visitSubtotalCents),
    depositAmountCents: String(depositCents),
    balanceDueCents: String(balanceDueCents),
    // Plan-signup carry-through: fulfillment uses these to create the recurring
    // Stripe subscription AFTER the first visit (full price, starts one period
    // later). Empty for one-time visits.
    planSignup: membership ? 'true' : '',
    planMonthlyPriceCents: membership ? String(Math.round(Number(membership.price || 0) * 100)) : '',
    planFirstVisitDate: appointment.acuityDatetime,
    peopleCount: String(appointment.peopleCount || 1),
  });
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
      dob: metadata.dob || '',
      emergencyContact: metadata.emergencyContact || '',
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
      orderType: metadata.orderType || '',
      paymentType: metadata.paymentType || '',
      notes: metadata.notes || '',
      clientType: metadata.clientType || '',
      clinicalReviewOnFile: metadata.clinicalReviewOnFile || '',
      gfeRequired: metadata.gfeRequired || '',
      dob: metadata.dob || '',
      emergencyContact: metadata.emergencyContact || '',
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
      depositType: metadata.depositType || (Number(metadata.balanceDueCents || 0) > 0 ? 'non_refundable_deductible' : 'full_payment'),
    },
  };
}

export async function syncCheckoutAttioPerson({
  contact = {},
} = {}) {
  const response = await upsertAttioPerson({
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    source: 'Avalon Booking',
    lifecycleStage: 'Booked',
  });

  if (response?.skipped) {
    return { id: null, skipped: true, reason: response.reason || 'attio_sync_disabled' };
  }
  return { id: response?.data?.id || response?.id || null, skipped: false };
}
