import crypto from 'crypto';
import { getDefaultTenantId, getSupabaseServiceClient } from './_supabase-server.js';
import { safeLogContext } from './_lib/safe-error.js';

const MAX_PAYLOAD_BYTES = 16_384;
const DROP_KEYS = [
  'email',
  'customeremail',
  'firstname',
  'lastname',
  'customername',
  'name',
  'phone',
  'customerphone',
  'password',
  'token',
  'summarytoken',
  'ssn',
  'dob',
  'dateofbirth',
  'birthdate',
  'address',
  'zip',
  'postalcode',
  'emergencycontact',
  'notes',
  'medicalnotes',
  'clinicalnotes',
  'clinicalreviewonfile',
  'gferequired',
  'diagnosis',
  'medications',
  'allergies',
];

function eventHash(event = {}) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(event))
    .digest('hex');
}

function safeString(value, max = 160) {
  return String(value || '').slice(0, max);
}

// The events client funnel, one stage per name (blueprint Step 9 + eng 8B).
const EVENTS_FUNNEL_EVENTS = new Set([
  'events.feed_viewed',
  'events.event_viewed',
  'events.tier_selected',
  'events.checkout_started',
  'events.order_completed',
  'events.rsvp_completed',
  'events.application_submitted',
  'events.gfe_link_opened',
  'events.trip_viewed',
  'events.kiosk_joined',
]);

function sensitiveAnalyticsKey(key = '') {
  const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  return DROP_KEYS.some((blocked) => normalized.includes(blocked));
}

function sanitizeAnalyticsValue(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === 'string') return value.slice(0, 512);
  if (['number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 32).map((item) => sanitizeAnalyticsValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth > 2) return {};
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !sensitiveAnalyticsKey(key))
      .map(([key, nested]) => [key, sanitizeAnalyticsValue(nested, depth + 1)]));
  }
  return undefined;
}

function sanitizeAnalyticsObject(value) {
  if (!value || typeof value !== 'object') return {};
  return sanitizeAnalyticsValue(value) || {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const rawEvent = req.body?.event || req.body || {};
  const name = safeString(rawEvent.name);
  if (!name) return res.status(400).json({ ok: false, error: 'Missing event name' });

  // events.* is ALLOWLISTED (eng review 8B): the funnel needs a stable,
  // junk-free namespace. Supplemental funnel color only — published TTF comes
  // from transition_event_visit() audit timestamps (T4), never this endpoint.
  if (name.startsWith('events.') && !EVENTS_FUNNEL_EVENTS.has(name)) {
    return res.status(400).json({ ok: false, error: 'Unknown events funnel event' });
  }

  const event = {
    name,
    props: sanitizeAnalyticsObject(rawEvent.props),
    context: sanitizeAnalyticsObject(rawEvent.context),
    timestamp: Number(rawEvent.timestamp || Date.now()),
    path: safeString(req.headers?.referer || '', 512),
    userAgent: safeString(req.headers?.['user-agent'] || '', 512),
  };

  const serialized = JSON.stringify(event);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
    return res.status(413).json({ ok: false, error: 'Event too large' });
  }

  try {
    const db = await getSupabaseServiceClient();
    if (!db) return res.status(202).json({ ok: true, persisted: false });

    const tenantId = await getDefaultTenantId(db);
    const payloadHash = eventHash(event);
    const idempotencyKey = `analytics:${name}:${payloadHash.slice(0, 32)}`;
    const { error } = await db.from('integration_events').insert({
      tenant_id: tenantId,
      provider: 'avalon_analytics',
      event_type: name,
      external_event_id: null,
      signature_valid: null,
      idempotency_key: idempotencyKey,
      payload_hash: payloadHash,
      payload: event,
      status: 'received',
    });

    if (error && error.code !== '23505') {
      console.warn('[analytics]', safeLogContext(error, 'analytics_persist_failed'));
      return res.status(202).json({ ok: true, persisted: false });
    }

    return res.status(202).json({ ok: true, persisted: true });
  } catch (err) {
    console.warn('[analytics]', safeLogContext(err, 'analytics_handler_failed'));
    return res.status(202).json({ ok: true, persisted: false });
  }
}
