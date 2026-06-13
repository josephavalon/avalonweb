import crypto from 'crypto';
import { getDefaultTenantId, getSupabaseServiceClient } from './_supabase-server.js';
import { safeLogContext } from './_lib/safe-error.js';

const MAX_PAYLOAD_BYTES = 16_384;

function eventHash(event = {}) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(event))
    .digest('hex');
}

function safeString(value, max = 160) {
  return String(value || '').slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const rawEvent = req.body?.event || req.body || {};
  const name = safeString(rawEvent.name);
  if (!name) return res.status(400).json({ ok: false, error: 'Missing event name' });

  const event = {
    name,
    props: rawEvent.props && typeof rawEvent.props === 'object' ? rawEvent.props : {},
    context: rawEvent.context && typeof rawEvent.context === 'object' ? rawEvent.context : {},
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
