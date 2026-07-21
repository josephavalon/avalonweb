/**
 * POST /api/webhooks/quo-inbound?secret=...
 *
 * Receives inbound SMS from Quo (formerly OpenPhone) and records them as inbound
 * messages so client replies show up in the admin inbox. Secured by a shared
 * secret in the query string (set QUO_WEBHOOK_SECRET and include it in the
 * webhook URL you paste into the Quo dashboard) — without it the endpoint
 * refuses, so it can't be used to inject fake threads.
 *
 * Quo/OpenPhone payload (defensively parsed): { type, data: { object: { id,
 * from, to, body|text, direction } } }. We only record incoming messages.
 */
import { recordInbound } from '../_lib/comm-store.js';

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.QUO_WEBHOOK_SECRET;
  if (!expected) return res.status(503).json({ error: 'Webhook not configured' });
  const provided = String(req.query?.secret || req.headers['x-webhook-secret'] || '');
  if (provided !== expected) return res.status(401).json({ error: 'Unauthorized' });

  const payload = req.body || {};
  const type = String(payload.type || payload.event || '').toLowerCase();
  const obj = payload.data?.object || payload.data || payload.message || payload;

  const direction = String(pick(obj, 'direction') || '').toLowerCase();
  const isInbound = type.includes('received') || direction === 'incoming' || direction === 'inbound';
  // Quietly ack everything else (delivery receipts, outbound echoes) so Quo
  // doesn't retry.
  if (!isInbound) return res.status(200).json({ ok: true, ignored: true });

  const from = String(pick(obj, 'from') || '').trim();
  const body = String(pick(obj, 'body', 'text', 'content') || '').trim();
  const providerMessageId = pick(obj, 'id', 'messageId') || null;
  if (!from || !body) return res.status(200).json({ ok: true, ignored: 'missing_from_or_body' });

  await recordInbound({ channel: 'sms', contact: from, body, providerMessageId });
  return res.status(200).json({ ok: true });
}
