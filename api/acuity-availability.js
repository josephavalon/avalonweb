/**
 * GET /api/acuity-availability
 *
 * Query params:
 *   date            YYYY-MM-DD        — day to fetch slots for
 *   appointmentTypeID  number         — Acuity appointment type
 *   timezone        string (optional) — defaults to America/Los_Angeles
 *
 * Returns: [{ time: ISO8601, slotsAvailable: number }]
 */

import { acuityFetch } from './_acuity.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date, appointmentTypeID, timezone = 'America/Los_Angeles' } = req.query;

  if (!date || !appointmentTypeID) {
    return res.status(400).json({ error: 'date and appointmentTypeID are required' });
  }

  try {
    const params = new URLSearchParams({
      date,
      appointmentTypeID,
      timezone,
    });

    const slots = await acuityFetch(`/availability/times?${params}`);

    // Normalize — Acuity returns an array of { time, slotsAvailable }
    const available = (slots || []).filter((s) => s.slotsAvailable > 0);

    return res.status(200).json(available);
  } catch (err) {
    console.error('[acuity-availability]', err.message);
    return res.status(err.status || 500).json({ error: err.message });
  }
}
