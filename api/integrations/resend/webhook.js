/**
 * POST /api/integrations/resend/webhook
 *
 * Resend delivery webhook. Verifies the Svix signature, then writes one
 * audit_events row per delivery event. We key on `welcome_email_sent` rows
 * (entity_id = profile.id) by matching on message_id stored in the original
 * payload, so we can compute a per-1h fail rate without joining tables.
 *
 * Event types we care about:
 *   - email.sent / email.delivered  → noop (welcome_email_sent already exists from /api/auth/welcome-email)
 *   - email.bounced / email.delivery_delayed / email.failed → audit `welcome_email_delivery_failed`
 *   - email.complained              → audit `welcome_email_complained` (treat as fail)
 *   - email.opened / email.clicked  → noop (we don't engagement-track for privacy)
 *
 * Failure-rate alert: configure your APM (Datadog, Sentry, Better Stack)
 * to alert when count(welcome_email_delivery_failed) / count(welcome_email_sent)
 * over the last 1h exceeds 5%. See docs/PHI_DATA_FLOW.md for the alert pattern.
 */
import crypto from 'crypto';
import { getServiceClient } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

const ENTITY_TYPE = 'profiles';
const ACTION_SENT = 'welcome_email_sent';
const ACTION_DELIVERY_FAILED = 'welcome_email_delivery_failed';
const ACTION_COMPLAINED = 'welcome_email_complained';
const ACTION_DELIVERED = 'welcome_email_delivered';

const FAILURE_TYPES = new Set(['email.bounced', 'email.delivery_delayed', 'email.failed']);

async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return JSON.stringify(req.body);
  }
  return await new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    const limit = 1024 * 1024; // 1 MB cap
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > limit) {
        reject(Object.assign(new Error('Resend webhook payload too large'), { code: 'resend_webhook_body_too_large', status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function constantTimeEqual(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Svix signature verification (the protocol Resend uses for webhooks).
// Header: svix-signature: "v1,<base64sig> v1,<another>"
// Signed payload: `${svix_id}.${svix_timestamp}.${rawBody}` HMAC-SHA256 with
// the webhook secret (base64-decoded after the `whsec_` prefix).
function verifySvixSignature({ rawBody, headers, secret }) {
  if (!secret) return false;
  const svixId = headers['svix-id'] || headers['Svix-Id'];
  const svixTimestamp = headers['svix-timestamp'] || headers['Svix-Timestamp'];
  const svixSignature = headers['svix-signature'] || headers['Svix-Signature'];
  if (!svixId || !svixTimestamp || !svixSignature) return false;
  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const cleanSecret = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let key;
  try {
    key = Buffer.from(cleanSecret, 'base64');
  } catch {
    return false;
  }
  const expected = crypto.createHmac('sha256', key).update(signedPayload, 'utf8').digest('base64');
  const candidates = String(svixSignature).split(/\s+/).filter(Boolean);
  for (const candidate of candidates) {
    const [, sig] = candidate.split(',');
    if (sig && constantTimeEqual(expected, sig.trim())) return true;
  }
  return false;
}

async function findProfileIdForMessage(db, messageId) {
  if (!db || !messageId) return null;
  try {
    // payload column is jsonb; match on the nested message_id we wrote when
    // the welcome email originally sent. Coercion via ->> is safe.
    const { data } = await db
      .from('audit_events')
      .select('actor_profile_id, entity_id, tenant_id')
      .eq('action', ACTION_SENT)
      .filter('payload->>message_id', 'eq', messageId)
      .limit(1);
    if (!Array.isArray(data) || !data.length) return null;
    return data[0];
  } catch (err) {
    console.warn('[resend/webhook] profile lookup failed', safeLogContext(err, 'resend_webhook_profile_lookup_failed'));
    return null;
  }
}

function actionFor(eventType) {
  if (eventType === 'email.complained') return ACTION_COMPLAINED;
  if (eventType === 'email.delivered') return ACTION_DELIVERED;
  if (FAILURE_TYPES.has(eventType)) return ACTION_DELIVERY_FAILED;
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    return res.status(err.status || 400).json({ error: 'Invalid payload' });
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed in production; in dev, log loud but accept (lets local
    // forwarders work without setting up Svix keys).
    if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
      console.warn('[resend/webhook] RESEND_WEBHOOK_SECRET is required in production');
      return res.status(503).json({ error: 'Webhook receiver not configured' });
    }
  } else if (!verifySvixSignature({ rawBody, headers: req.headers || {}, secret })) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Malformed JSON' });
  }

  const eventType = String(event?.type || '');
  const action = actionFor(eventType);
  if (!action) {
    // No-op events (sent/opened/clicked etc) — ack 200 so Resend stops retrying.
    return res.status(200).json({ ok: true, skipped: eventType || 'unknown' });
  }

  const messageId = event?.data?.email_id || event?.data?.id || null;
  const recipient = Array.isArray(event?.data?.to) ? event.data.to[0] : event?.data?.to;

  const db = await getServiceClient();
  if (!db) {
    return res.status(503).json({ error: 'Audit store not configured' });
  }

  const origin = messageId ? await findProfileIdForMessage(db, messageId) : null;

  await writeAuditEvent(db, {
    tenantId: origin?.tenant_id || null,
    actorProfileId: origin?.actor_profile_id || null,
    action,
    entityType: ENTITY_TYPE,
    entityId: origin?.entity_id || null,
    phiTouched: false,
    payload: {
      provider: 'resend',
      event_type: eventType,
      message_id: messageId,
      recipient_present: Boolean(recipient),
      reason: event?.data?.reason || event?.data?.bounce_type || null,
    },
  });

  return res.status(200).json({ ok: true, recorded: action });
}
