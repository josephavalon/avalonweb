/**
 * GET /api/acuity-appointments
 *
 * Fetches recent Acuity appointments for the admin booking intake view.
 *
 * Query params:
 *   max        number   — max results (default 50)
 *   minDate    string   — YYYY-MM-DD start (default today)
 *   direction  string   — 'asc' | 'desc' (default 'asc')
 *
 * Returns array of appointment objects.
 */

import { acuityFetch } from './_acuity.js';

const TZ = 'America/Los_Angeles';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    max = '50',
    minDate,
    direction = 'asc',
  } = req.query || {};

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

  try {
    const params = new URLSearchParams({
      max: String(Math.min(Number(max) || 50, 200)),
      minDate: minDate || today,
      direction,
    });

    const appointments = await acuityFetch(`/appointments?${params}`);
    return res.status(200).json(appointments);
  } catch (err) {
    console.error('[acuity-appointments]', err.message);
    return res.status(err.status || 500).json({ error: err.message });
  }
}
