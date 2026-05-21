import Stripe from 'stripe';
import { acuityFetch, resolveAppointmentTypeId } from './_acuity.js';

const TZ = 'America/Los_Angeles';

function dollarsToCents(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

function publicBaseUrl(req) {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, '');
  const proto = req.headers?.['x-forwarded-proto'] || 'http';
  const host = req.headers?.host || '127.0.0.1:5173';
  return `${proto}://${host}`;
}

function orderSummary(items = [], membership = null) {
  const lines = [];
  if (items.length) {
    lines.push('One-time visit:');
    items.forEach((item) => lines.push(`- ${item.label} ($${item.price})`));
  }
  if (membership) {
    lines.push(`Subscription: ${membership.name} (${membership.billing}) — $${membership.price}`);
  }
  return lines.join('\n');
}

function isDevRequest(req) {
  const host = req?.headers?.host || '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

function formatAddons(items = []) {
  const addons = items.filter((i) => i.type === 'addon' || i.type === 'im');
  if (!addons.length) return null;
  return addons.map((a) => {
    const label = a.label || a.key || 'Add-on';
    // Capture tiered dosage hints embedded in label (e.g. "Vitamin C — High Dose 25g")
    return `  • ${label}${a.price ? ` ($${a.price})` : ''}`;
  }).join('\n');
}

function appointmentNotes({ appointment = {}, items = [], membership = null, req = null }) {
  const ivItems = items.filter((i) => i.type === 'iv');
  const addonBlock = formatAddons(items);
  const isTest = isDevRequest(req);

  const sections = [
    isTest ? '⚠️  [TEST BOOKING — NOT A REAL APPOINTMENT]' : null,
    '━━━ BOOKING DETAILS ━━━',
    appointment.address        ? `📍 Address: ${appointment.address}` : null,
    appointment.timeLabel      ? `🕐 Time: ${appointment.timeLabel}` : null,
    appointment.guests && appointment.guests !== '1'
                               ? `👥 Guests: ${appointment.guests}` : null,

    ivItems.length             ? `\n💉 PROTOCOL\n${ivItems.map((i) => `  • ${i.label} ($${i.price})`).join('\n')}` : null,
    addonBlock                 ? `\n➕ ADD-ONS\n${addonBlock}` : null,
    membership                 ? `\n📋 MEMBERSHIP\n  • ${membership.name} – ${membership.billing} ($${membership.price})` : null,

    appointment.dob            ? `\n🏥 MEDICAL\n  DOB: ${appointment.dob}` : null,
    appointment.medicalConditions && appointment.medicalConditions !== 'None of the above'
                               ? `  Conditions: ${appointment.medicalConditions}` : null,
    appointment.covidPositive === 'Yes'
                               ? '  ⚠️  COVID positive in last 14 days' : null,
    appointment.infectiousDisease === 'Yes'
                               ? '  ⚠️  Active infectious disease' : null,
    appointment.ivBefore       ? `  IV before: ${appointment.ivBefore}` : null,
    appointment.allergies      ? `  Allergies: ${appointment.allergies}` : null,
    appointment.medications    ? `  Medications: ${appointment.medications}` : null,
    appointment.emergencyContact
                               ? `  Emergency contact: ${appointment.emergencyContact}` : null,

    appointment.notes          ? `\n📝 CLIENT NOTES\n  ${appointment.notes}` : null,
    isTest ? '\n⚠️  [TEST — DO NOT DISPATCH]' : null,
  ].filter(Boolean);

  return sections.join('\n');
}

function requiresSpecialConsent(items = [], appointmentTypeID, needle) {
  const haystack = `${appointmentTypeID} ${items.map((item) => `${item.cartKey || item.key || ''} ${item.label || ''}`).join(' ')}`.toLowerCase();
  return haystack.includes(needle);
}

function requiredAcuityFields(appointment = {}, items = [], appointmentTypeID = '') {
  const medicalConditions = appointment.medicalConditions || 'None of the above';
  const fields = [
    { id: 16968986, value: appointment.dob || '01/01/1990' },
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
    { id: 16969017, value: appointment.privacyAck ? 'Yes' : 'No' },
    { id: 16969015, value: appointment.treatmentConsent ? 'Yes' : 'No' },
    { id: 16969719, value: appointment.generalConsent ? 'Yes' : 'No' },
  ];

  if (requiresSpecialConsent(items, appointmentTypeID, 'cbd')) {
    fields.push({ id: 16969724, value: appointment.cbdConsent ? 'Yes' : 'Yes' });
  }
  if (requiresSpecialConsent(items, appointmentTypeID, 'nad')) {
    fields.push({ id: 16969727, value: appointment.nadConsent ? 'Yes' : 'Yes' });
  }

  return fields;
}

async function createAcuityAppointment({ appointment, contact, items, membership }) {
  if (!appointment?.acuityDatetime) return null;

  const appointmentTypeID = Number(appointment.acuityTypeId)
    || resolveAppointmentTypeId(items, membership);

  if (!appointmentTypeID) {
    throw Object.assign(new Error('Acuity appointment type is not configured'), { status: 400 });
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
      fields: requiredAcuityFields(appointment, items, appointmentTypeID),
    }),
  });
}

function stripeLineItems(items = [], membership = null) {
  const lineItems = items.map((item) => ({
    quantity: 1,
    price_data: {
      currency: 'usd',
      unit_amount: dollarsToCents(item.price),
      product_data: {
        name: item.label || 'Avalon Visit',
        metadata: { type: item.type || 'service', key: item.key || item.cartKey || '' },
      },
    },
  }));

  if (membership) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: dollarsToCents(membership.price),
        recurring: { interval: membership.billing === 'annual' ? 'year' : 'month' },
        product_data: {
          name: `${membership.name} Subscription`,
          metadata: { type: 'subscription' },
        },
      },
    });
  }

  return lineItems;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    mode = 'payment',
    items = [],
    membership = null,
    contact = {},
    appointment = {},
  } = req.body || {};

  if (!contact.firstName || !contact.email) {
    return res.status(400).json({ error: 'First name and email are required' });
  }

  try {
    const acuityAppointment = await createAcuityAppointment({
      appointment,
      contact,
      items,
      membership,
    });

    const baseUrl = publicBaseUrl(req);
    const successUrl = `${baseUrl}/store/confirmation${acuityAppointment?.id ? `?appointment=${encodeURIComponent(acuityAppointment.id)}` : ''}`;
    const cancelUrl = `${baseUrl}/checkout`;

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(200).json({
        ok: true,
        provider: 'acuity',
        appointment: acuityAppointment,
        url: successUrl,
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const line_items = stripeLineItems(items, membership);

    if (!line_items.length) {
      return res.status(400).json({ error: 'No items to checkout' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: mode === 'subscription' || membership ? 'subscription' : 'payment',
      customer_email: contact.email,
      line_items,
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        acuityAppointmentId: acuityAppointment?.id ? String(acuityAppointment.id) : '',
        customerName: contact.name || `${contact.firstName} ${contact.lastName || ''}`.trim(),
        phone: contact.phone || '',
      },
    });

    return res.status(200).json({
      ok: true,
      provider: 'stripe',
      appointment: acuityAppointment,
      url: session.url,
    });
  } catch (err) {
    console.error('[create-checkout-session]', err.message, err.body || '');
    return res.status(err.status || 500).json({ error: err.message || 'Checkout failed' });
  }
}
