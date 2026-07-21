/**
 * POST /api/manual-booking
 *
 * Creates a no-Stripe/manual-billing booking. Acuity is the blocking vendor;
 * HubSpot CRM sync is best-effort (non-blocking) alongside.
 */

import { upsertHubspotContact } from './_hubspot.js';
import { createSchedulingAppointmentWithFallback } from './_checkout-fulfillment.js';
import { blockLiveVendorAction } from './_lib/pre-api-guard.js';
import { safeErrorCode, safeLogContext } from './_lib/safe-error.js';
import { requireStaff } from './_lib/supabase-auth.js';
import { checkRateLimit } from './_lib/rate-limit.js';

function dollarsToCents(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

function splitName(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function normalizeContact(contact = {}) {
  const parsed = splitName(contact.name);
  return {
    name: contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' '),
    firstName: contact.firstName || parsed.firstName,
    lastName: contact.lastName || parsed.lastName,
    email: String(contact.email || '').trim().toLowerCase(),
    phone: String(contact.phone || '').trim(),
    dob: contact.dob || '',
    emergencyContact: contact.emergencyContact || '',
  };
}

function validatePayload({ contact = {}, appointment = {}, items = [] } = {}) {
  const missing = [];
  if (!contact.firstName) missing.push('contact.firstName');
  if (!contact.email) missing.push('contact.email');
  if (!appointment.acuityDatetime) missing.push('appointment.acuityDatetime');
  if (!appointment.address) missing.push('appointment.address');
  if (!items.length) missing.push('items');
  return missing;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (blockLiveVendorAction(req, res, 'Manual Acuity booking')) return;

  // Dispatches a real nurse to a real address + creates a real CRM contact.
  // Must be an authenticated operator, never anonymous.
  const authed = await requireStaff(req, res);
  if (!authed) return;

  const limit = await checkRateLimit({
    key: `manual-booking:${authed.user.id}`,
    windowMs: 60 * 1000,
    max: 5,
  });
  if (!limit.ok) {
    return res.status(429).json({ ok: false, error: 'Too many manual bookings. Try again shortly.', code: 'rate_limited' });
  }

  const {
    contact: rawContact = {},
    appointment: rawAppointment = {},
    items = [],
    membership = null,
    primaryService = '',
  } = req.body || {};
  const contact = normalizeContact(rawContact);
  const appointment = {
    ...rawAppointment,
    paymentType: rawAppointment.paymentType || 'manual_invoice',
    paymentStatus: rawAppointment.paymentStatus || 'manual_invoice_pending',
    billingMode: rawAppointment.billingMode || 'vip-manual',
    manualBilling: true,
  };
  const missing = validatePayload({ contact, appointment, items });

  if (missing.length) {
    return res.status(400).json({
      ok: false,
      error: 'Manual booking is missing required fields.',
      code: 'manual_booking_missing_fields',
      fields: missing,
    });
  }

  const visitSubtotal = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const amounts = {
    currency: 'usd',
    visitSubtotalCents: dollarsToCents(visitSubtotal),
    depositAmountCents: 0,
    balanceDueCents: dollarsToCents(visitSubtotal),
    depositType: 'manual_invoice',
  };

  try {
    // HubSpot CRM sync — non-blocking. CRM failure never gates the booking.
    let hubspotContactId = null;
    try {
      const hubspotResponse = await upsertHubspotContact({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        source: 'Avalon VIP Manual Booking',
        lifecycleStage: 'Booked',
      });
      hubspotContactId = hubspotResponse?.id || null;
    } catch (err) {
      console.warn('[manual-booking] HubSpot sync failed', safeLogContext(err, 'hubspot_sync_failed'));
    }

    let acuityAppointment;
    try {
      acuityAppointment = await createSchedulingAppointmentWithFallback({
        appointment,
        contact,
        items,
        membership,
        amounts,
        req,
      });
    } catch (err) {
      throw Object.assign(err, { vendorStage: 'acuity_appointment_create', hubspotContactId });
    }

    if (!acuityAppointment?.id) {
      return res.status(502).json({
        ok: false,
        error: 'Acuity did not return an appointment ID.',
        code: 'acuity_appointment_missing_id',
        vendorStage: 'acuity_appointment_create',
        hubspotContactId,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: 'manual_acuity_hubspot',
      acuityAppointmentId: String(acuityAppointment.id),
      hubspotContactId,
      appointment: {
        id: String(acuityAppointment.id),
        provider: 'acuity',
        status: 'scheduled',
        datetime: acuityAppointment.datetime || appointment.acuityDatetime,
        type: acuityAppointment.type || items[0]?.label || primaryService || 'Avalon Visit',
      },
      hubspot: {
        id: hubspotContactId,
        provider: 'hubspot',
        status: hubspotContactId ? 'synced' : 'skipped',
      },
    });
  } catch (err) {
    console.error('[manual-booking] live handoff failed', safeLogContext(err, 'manual_booking_failed'));
    return res.status(err.status || 500).json({
      ok: false,
      error: 'Could not create the Acuity appointment.',
      code: safeErrorCode(err, 'manual_booking_failed'),
      vendorStage: err.vendorStage || 'manual_booking',
      hubspotContactId: err.hubspotContactId || null,
    });
  }
}
