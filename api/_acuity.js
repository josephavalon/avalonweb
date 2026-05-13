/**
 * Acuity Scheduling API client.
 * Docs: https://developers.acuityscheduling.com/
 *
 * Auth: HTTP Basic — ACUITY_USER_ID : ACUITY_API_KEY
 * Base: https://acuityscheduling.com/api/v1
 *
 * IMPORTANT: Never import this in frontend code.
 * All Acuity API calls must go through Vercel serverless functions.
 */

const BASE = 'https://acuityscheduling.com/api/v1';

function authHeader() {
  const userId = process.env.ACUITY_USER_ID;
  const apiKey = process.env.ACUITY_API_KEY;
  if (!userId || !apiKey) throw new Error('Acuity credentials not configured');
  return 'Basic ' + Buffer.from(`${userId}:${apiKey}`).toString('base64');
}

/**
 * Core fetch wrapper.
 * @param {string} path   e.g. '/availability/times'
 * @param {object} [opts] fetch options (method, body, etc.)
 */
export async function acuityFetch(path, opts = {}) {
  const url = BASE + path;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.message || data?.error || `Acuity error ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, body: data });
  }

  return data;
}

// ── High-level client methods ──────────────────────────────────────────────

/**
 * GET /me — verify credentials + return account info
 */
export async function getMe() {
  return acuityFetch('/me');
}

/**
 * GET /appointments — list appointments
 * @param {object} params  e.g. { max: 50, minDate, maxDate, calendarID }
 */
export async function getAppointments(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return acuityFetch(`/appointments${qs ? '?' + qs : ''}`);
}

/**
 * GET /appointments/:id — single appointment
 */
export async function getAppointment(appointmentId) {
  return acuityFetch(`/appointments/${appointmentId}`);
}

/**
 * GET /appointment-types — all appointment types
 */
export async function getAppointmentTypes() {
  return acuityFetch('/appointment-types');
}

/**
 * GET /calendars — all calendars
 */
export async function getCalendars() {
  return acuityFetch('/calendars');
}

/**
 * GET /availability/times — available slots
 * @param {object} params  { date, appointmentTypeID, timezone? }
 */
export async function getAvailability(params = {}) {
  const qs = new URLSearchParams({
    timezone: 'America/Los_Angeles',
    ...params,
  }).toString();
  return acuityFetch(`/availability/times?${qs}`);
}

/**
 * DELETE /appointments/:id — cancel an appointment
 */
export async function cancelAppointment(appointmentId, reason = '') {
  return acuityFetch(`/appointments/${appointmentId}/cancel`, {
    method: 'PUT',
    body: JSON.stringify({ noShow: false, reason }),
  });
}

/**
 * PUT /appointments/:id/reschedule — reschedule
 */
export async function rescheduleAppointment(appointmentId, { datetime, calendarID } = {}) {
  return acuityFetch(`/appointments/${appointmentId}/reschedule`, {
    method: 'PUT',
    body: JSON.stringify({ datetime, calendarID }),
  });
}

// ── Appointment type → Avalon cart key resolver ────────────────────────────

/**
 * Map a cart item key to an Acuity appointment type ID.
 * Add your real Acuity type IDs here once you create them in your dashboard.
 *
 * Acuity dashboard → Services → each service has a numeric ID in the URL.
 * You can also set ACUITY_DEFAULT_TYPE_ID in .env as a catch-all.
 */
export function resolveAppointmentTypeId(cartItems = [], membership = null) {
  const defaultId = parseInt(process.env.ACUITY_DEFAULT_TYPE_ID || '0', 10);

  const TYPE_MAP = {
    // membership tiers
    'membership-starter':  parseInt(process.env.ACUITY_TYPE_MEMBERSHIP  || defaultId, 10),
    'membership-premium':  parseInt(process.env.ACUITY_TYPE_MEMBERSHIP  || defaultId, 10),
    'membership-vip':      parseInt(process.env.ACUITY_TYPE_MEMBERSHIP  || defaultId, 10),
    // one-time IV drips
    'iv-vitamins':         parseInt(process.env.ACUITY_TYPE_IV_VITAMINS || defaultId, 10),
    'iv-nad':              parseInt(process.env.ACUITY_TYPE_IV_NAD      || defaultId, 10),
    'iv-cbd':              parseInt(process.env.ACUITY_TYPE_IV_CBD      || defaultId, 10),
    // IM shots
    'im-B12':              parseInt(process.env.ACUITY_TYPE_IM_SHOTS    || defaultId, 10),
    'im-Glutathione':      parseInt(process.env.ACUITY_TYPE_IM_SHOTS    || defaultId, 10),
    'im-MIC':              parseInt(process.env.ACUITY_TYPE_IM_SHOTS    || defaultId, 10),
    'im-NAD+_Shot':        parseInt(process.env.ACUITY_TYPE_IM_SHOTS    || defaultId, 10),
  };

  // Membership takes precedence
  if (membership) {
    const key = `membership-${membership.name?.toLowerCase()}`;
    return TYPE_MAP[key] || defaultId;
  }

  for (const item of cartItems) {
    const id = TYPE_MAP[item.key];
    if (id) return id;
  }

  return defaultId;
}
