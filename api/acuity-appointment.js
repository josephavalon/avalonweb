/**
 * GET /api/acuity-appointment?id=<appointmentId>
 *
 * Fetches a single Acuity appointment by ID.
 * Used by the confirmation page to display real booking details.
 *
 * Returns the Acuity appointment object:
 *   { id, type, datetime, duration, location, firstName, lastName,
 *     email, phone, notes, price, forms, ... }
 */

import { acuityFetch } from './_acuity.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query || {};

  if (!id) {
    return res.status(400).json({ error: 'id query parameter is required' });
  }

  try {
    const appointment = await acuityFetch(`/appointments/${encodeURIComponent(id)}`);
    return res.status(200).json(appointment);
  } catch (err) {
    console.error('[acuity-appointment]', err.message);
    return res.status(err.status || 500).json({ error: err.message });
  }
}
