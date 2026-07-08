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
import { upsertHubspotContact } from './_hubspot.js';
import { blockLiveVendorAction } from './_lib/pre-api-guard.js';
import { safeErrorCode, safeLogContext } from './_lib/safe-error.js';

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

    // Sync to CRMs - non-blocking, never fails the booking.
    // Keep this CRM-safe: no clinical notes or intake details.
    const crmPayload = {
      firstName,
      lastName,
      email,
      phone,
      source: 'Avalon Scheduling',
      lifecycleStage: 'Booked',
    };
    upsertAttioPerson({ ...crmPayload, service: appointment?.type || 'IV Therapy' })
      .catch((e) => console.warn('[scheduling-book] Attio sync failed', safeLogContext(e, 'attio_sync_failed')));
    upsertHubspotContact(crmPayload)
      .catch((e) => console.warn('[scheduling-book] HubSpot sync failed', safeLogContext(e, 'hubspot_sync_failed')));

    return res.status(200).json(appointment);
  } catch (err) {
    console.error('[scheduling-book] appointment creation failed', safeLogContext(err, 'scheduling_book_failed'));
    return res.status(err.status || 500).json({
      error: 'Could not create scheduling appointment',
      code: safeErrorCode(err, 'scheduling_book_failed'),
    });
  }
}
