/**
 * POST /api/manual-booking
 *
 * Creates a no-Stripe/manual-billing booking only after both live vendor
 * handoffs succeed:
 * - Attio person upsert
 * - Acuity appointment creation
 */

import { upsertAttioPerson } from './_attio.js';
import { createSchedulingAppointmentWithFallback } from './_checkout-fulfillment.js';
import { blockLiveVendorAction } from './_lib/pre-api-guard.js';
import { safeErrorCode, safeLogContext } from './_lib/safe-error.js';

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

function attioIdFrom(response) {
  return response?.data?.id || response?.id || response?.record_id || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (blockLiveVendorAction(req, res, 'Manual Acuity and Attio booking')) return;

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
    let attioResponse;
    try {
      attioResponse = await upsertAttioPerson({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        source: 'Avalon VIP Manual Booking',
        lifecycleStage: 'Booked',
        service: primaryService || items[0]?.label || 'Avalon Visit',
      });
    } catch (err) {
      throw Object.assign(err, { vendorStage: 'attio_person_upsert' });
    }

    const attioPersonId = attioIdFrom(attioResponse);

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
      throw Object.assign(err, { vendorStage: 'acuity_appointment_create', attioPersonId });
    }

    if (!acuityAppointment?.id) {
      return res.status(502).json({
        ok: false,
        error: 'Acuity did not return an appointment ID.',
        code: 'acuity_appointment_missing_id',
        vendorStage: 'acuity_appointment_create',
        attioPersonId,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: 'manual_acuity_attio',
      acuityAppointmentId: String(acuityAppointment.id),
      attioPersonId,
      appointment: {
        id: String(acuityAppointment.id),
        provider: 'acuity',
        status: 'scheduled',
        datetime: acuityAppointment.datetime || appointment.acuityDatetime,
        type: acuityAppointment.type || items[0]?.label || primaryService || 'Avalon Visit',
      },
      attio: {
        id: attioPersonId,
        provider: 'attio',
        status: 'synced',
      },
    });
  } catch (err) {
    console.error('[manual-booking] live handoff failed', safeLogContext(err, 'manual_booking_failed'));
    return res.status(err.status || 500).json({
      ok: false,
      error: 'Could not create the Acuity appointment and Attio client.',
      code: safeErrorCode(err, 'manual_booking_failed'),
      vendorStage: err.vendorStage || 'manual_booking',
      attioPersonId: err.attioPersonId || null,
    });
  }
}
