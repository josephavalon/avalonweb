/**
 * Scheduling API client.
 * Docs: https://developers.acuityscheduling.com/
 *
 * Auth: HTTP Basic — ACUITY_USER_ID : ACUITY_API_KEY
 * Base: https://acuityscheduling.com/api/v1
 *
 * IMPORTANT: Never import this in frontend code.
 * All scheduling API calls must go through Vercel serverless functions.
 */

const BASE = 'https://acuityscheduling.com/api/v1';
let appointmentTypesCache = null;

function authHeader() {
  const userId = process.env.ACUITY_USER_ID;
  const apiKey = process.env.ACUITY_API_KEY;
  if (!userId || !apiKey) throw new Error('Scheduling credentials not configured');
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
    const msg = data?.message || data?.error || `Scheduling error ${res.status}`;
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

function normalizeTypeToken(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function appointmentTypeText(type = {}) {
  return normalizeTypeToken([
    type.name,
    type.category,
    type.description,
    type.calendarIDs ? 'calendar' : '',
  ].filter(Boolean).join(' '));
}

function candidateTokens(cartItems = [], membership = null) {
  if (membership) return ['membership', 'subscription'];
  const tokens = [];
  for (const item of cartItems || []) {
    const key = normalizeTypeToken(item.cartKey || item.key || '');
    const label = normalizeTypeToken(item.label || '');
    if (key) tokens.push(key);
    if (label) tokens.push(label);
    if (item.type === 'iv') tokens.push('iv');
    if (item.type === 'im') tokens.push('im shot', 'injection');
    if (`${key} ${label}`.includes('nad')) tokens.push('nad');
    if (`${key} ${label}`.includes('cbd')) tokens.push('cbd');
  }
  return [...new Set(tokens.filter(Boolean))];
}

async function cachedAppointmentTypes() {
  if (appointmentTypesCache) return appointmentTypesCache;
  const types = await getAppointmentTypes();
  appointmentTypesCache = Array.isArray(types) ? types : [];
  return appointmentTypesCache;
}

/**
 * Last-resort resolver for deployments where ACUITY_TYPE_* env vars are not
 * present. Prefer explicit env IDs, but do not let a missing mapping block paid
 * checkout fulfillment when Acuity exposes a clear matching service.
 */
export async function resolveAppointmentTypeIdFromLive(cartItems = [], membership = null) {
  const types = (await cachedAppointmentTypes()).filter((type) => type && type.active !== false);
  if (!types.length) return 0;

  const tokens = candidateTokens(cartItems, membership);
  for (const token of tokens) {
    const match = types.find((type) => appointmentTypeText(type).includes(token));
    if (match?.id) return Number(match.id);
  }

  const ivFallback = types.find((type) => /\biv\b|hydration|vitamin|drip/.test(appointmentTypeText(type)));
  if (ivFallback?.id) return Number(ivFallback.id);

  console.warn('[acuity] no explicit appointment type match; using first active Acuity type');
  return Number(types[0]?.id || 0);
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
 * Map a cart item key to a scheduling appointment type ID.
 * Add your real scheduling type IDs here once you create them in your dashboard.
 *
 * Scheduling dashboard → Services → each service has a numeric ID in the URL.
 * You can also set ACUITY_DEFAULT_TYPE_ID in .env as a catch-all.
 */
export function resolveAppointmentTypeId(cartItems = [], membership = null) {
  const defaultId = parseInt(process.env.ACUITY_DEFAULT_TYPE_ID || '0', 10);
  const ivVitaminsId = parseInt(process.env.ACUITY_TYPE_IV_VITAMINS || defaultId, 10);
  const ivNadId = parseInt(process.env.ACUITY_TYPE_IV_NAD || defaultId, 10);
  const ivCbdId = parseInt(process.env.ACUITY_TYPE_IV_CBD || defaultId, 10);
  const imShotsId = parseInt(process.env.ACUITY_TYPE_IM_SHOTS || defaultId, 10);
  const membershipId = parseInt(process.env.ACUITY_TYPE_MEMBERSHIP || defaultId, 10);

  const TYPE_MAP = {
    // membership tiers
    'membership-starter':  membershipId,
    'membership-premium':  membershipId,
    'membership-vip':      membershipId,
    // one-time IV drips
    'iv-vitamins':         ivVitaminsId,
    'iv-nad':              ivNadId,
    'iv-cbd':              ivCbdId,
    hydration:             parseInt(process.env.ACUITY_TYPE_HYDRATION || defaultId, 10),
    energy:                parseInt(process.env.ACUITY_TYPE_ENERGY || ivVitaminsId, 10),
    immunity:              parseInt(process.env.ACUITY_TYPE_IMMUNITY || ivVitaminsId, 10),
    beauty:                parseInt(process.env.ACUITY_TYPE_BEAUTY || ivVitaminsId, 10),
    recovery:              parseInt(process.env.ACUITY_TYPE_RECOVERY || ivVitaminsId, 10),
    jetlag:                parseInt(process.env.ACUITY_TYPE_JETLAG || ivVitaminsId, 10),
    myers:                 parseInt(process.env.ACUITY_TYPE_MYERS || ivVitaminsId, 10),
    postnight:             parseInt(process.env.ACUITY_TYPE_HANGOVER || ivVitaminsId, 10),
    nad_session:           ivNadId,
    // IM shots
    'im-B12':              imShotsId,
    'im-Glutathione':      imShotsId,
    'im-MIC':              imShotsId,
    'im-NAD+_Shot':        imShotsId,
  };

  // Membership takes precedence
  if (membership) {
    const key = `membership-${membership.name?.toLowerCase()}`;
    return TYPE_MAP[key] || defaultId;
  }

  for (const item of cartItems) {
    const itemKey = item.cartKey || item.key || '';
    const label = item.label || '';
    const normalizedKey = itemKey.toLowerCase();
    const normalizedLabel = label.toLowerCase();
    const id = TYPE_MAP[itemKey] || TYPE_MAP[normalizedKey];
    if (id) return id;
    if (item.type === 'im' || normalizedKey.startsWith('im-')) return imShotsId || defaultId;
    if (normalizedKey.includes('nad') || normalizedLabel.includes('nad')) return ivNadId || defaultId;
    if (normalizedKey.includes('cbd') || normalizedLabel.includes('cbd')) return ivCbdId || defaultId;
    if (item.type === 'iv' || normalizedKey.startsWith('pkg-')) return ivVitaminsId || defaultId;
  }

  return defaultId;
}
