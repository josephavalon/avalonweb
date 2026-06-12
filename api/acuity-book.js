/**
 * POST /api/scheduling-book
 *
 * Body:
 *   appointmentTypeID  number     — scheduling service type
 *   datetime           string     — ISO 8601 slot time (from availability response)
 *   firstName          string
 *   lastName           string
 *   email              string
 *   phone              string
 *   notes              string     — address + any special requests
 *   fields             object[]   — optional scheduling custom fields [{ id, value }]
 *
 * Returns: created scheduling appointment object
 */

import { acuityFetch } from './_acuity.js';
import { upsertAttioPerson } from './_attio.js';
import { blockLiveVendorAction } from './_lib/pre-api-guard.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (blockLiveVendorAction(req, res, 'Acuity appointment creation')) return;

  const {
    appointmentTypeID,
    datetime,
    firstName,
    lastName,
    email,
    phone,
    notes,
    fields = [],
  } = req.body || {};

  if (!appointmentTypeID || !datetime || !firstName || !email) {
    return res.status(400).json({ error: 'appointmentTypeID, datetime, firstName, and email are required' });
  }

  try {
    const appointment = await acuityFetch('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        appointmentTypeID,
        datetime,
        firstName,
        lastName: lastName || '',
        email,
        phone: phone || '',
        notes: notes || '',
        fields,
      }),
    });

    // Sync to Attio CRM - non-blocking, never fails the booking.
    // Keep this CRM-safe: no clinical notes or intake details.
    upsertAttioPerson({
      firstName,
      lastName,
      email,
      phone,
      source: 'Avalon Scheduling',
      lifecycleStage: 'Booked',
      service: appointment?.type || 'IV Therapy',
    }).catch((e) => console.warn('[scheduling-book] Attio sync failed:', e.message));

    return res.status(200).json(appointment);
  } catch (err) {
    console.error('[scheduling-book]', err.message || 'unknown_error');
    return res.status(err.status || 500).json({ error: err.message });
  }
}
