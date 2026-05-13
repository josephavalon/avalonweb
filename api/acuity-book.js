/**
 * POST /api/acuity-book
 *
 * Body:
 *   appointmentTypeID  number     — Acuity service type
 *   datetime           string     — ISO 8601 slot time (from availability response)
 *   firstName          string
 *   lastName           string
 *   email              string
 *   phone              string
 *   notes              string     — address + any special requests
 *   fields             object[]   — optional Acuity custom fields [{ id, value }]
 *
 * Returns: created Acuity appointment object
 */

import { acuityFetch } from './_acuity.js';

const ATTIO_API = 'https://api.attio.com/v2';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    // Sync to Attio CRM — non-blocking, never fails the booking
    syncToAttio({
      firstName,
      lastName,
      email,
      phone,
      appointment,
    }).catch((e) => console.warn('[acuity-book] Attio sync failed:', e.message));

    return res.status(200).json(appointment);
  } catch (err) {
    console.error('[acuity-book]', err.message, err.body);
    return res.status(err.status || 500).json({ error: err.message });
  }
}

/**
 * Upsert person in Attio matched on email.
 * On first booking: creates the record.
 * On repeat booking: updates it in place (phone/name refresh).
 * Also logs a note on the person with appointment details.
 */
async function syncToAttio({ firstName, lastName, email, phone, appointment }) {
  const apiKey = process.env.ATTIO_API_KEY;
  if (!apiKey) {
    console.warn('[attio] ATTIO_API_KEY not set — skipping sync');
    return;
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // 1. Upsert person record (matched on email address)
  const personPayload = {
    matching_attribute: 'email_addresses',
    data: {
      values: {
        name: [{ first_name: firstName || '', last_name: lastName || '' }],
        email_addresses: [{ email_address: email }],
        ...(phone ? { phone_numbers: [{ phone_number: phone }] } : {}),
      },
    },
  };

  const personRes = await fetch(`${ATTIO_API}/objects/people/records`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(personPayload),
  });

  if (!personRes.ok) {
    const body = await personRes.text();
    throw new Error(`Attio upsert failed (${personRes.status}): ${body}`);
  }

  const { data: person } = await personRes.json();
  const recordId = person?.id?.record_id;
  if (!recordId) return;

  // 2. Log a note on the person record with booking details
  const apptDate = appointment?.datetime
    ? new Date(appointment.datetime).toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'unknown date';

  const noteText = [
    `📅 Acuity booking confirmed`,
    `Service: ${appointment?.type || 'IV Therapy'}`,
    `Date: ${apptDate}`,
    `Confirmation #: ${appointment?.id || 'N/A'}`,
    ...(appointment?.location ? [`Location: ${appointment.location}`] : []),
    `Source: avalonvitality.co`,
  ].join('\n');

  await fetch(`${ATTIO_API}/notes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: {
        parent_object: 'people',
        parent_record_id: recordId,
        title: `Acuity booking — ${apptDate}`,
        content: noteText,
      },
    }),
  }).catch((e) => console.warn('[attio] note creation failed:', e.message));
}
