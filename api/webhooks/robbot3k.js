import crypto from 'crypto';
import { getDefaultTenantId } from '../_supabase-server.js';
import { getServiceClient } from '../_lib/supabase-auth.js';
import {
  findRobBotProspectForSignal,
  markRobBotBooked,
  markRobBotReply,
  suppressRobBotProspect,
} from '../_lib/robbot3k-core.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

const STOP_EVENTS = new Set(['reply', 'replied', 'booking', 'booked', 'bounce', 'bounced', 'unsubscribe', 'unsubscribed', 'complaint']);
const PROVIDER_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,79}$/;
const EVENT_ALIASES = new Map([
  ['reply', 'reply'],
  ['replied', 'reply'],
  ['inbound', 'reply'],
  ['inbound_email', 'reply'],
  ['email.reply', 'reply'],
  ['booking', 'booked'],
  ['booked', 'booked'],
  ['meeting_booked', 'booked'],
  ['invitee.created', 'booked'],
  ['bounce', 'bounce'],
  ['bounced', 'bounce'],
  ['email.bounced', 'bounce'],
  ['unsubscribe', 'unsubscribe'],
  ['unsubscribed', 'unsubscribe'],
  ['email.unsubscribed', 'unsubscribe'],
  ['complaint', 'complaint'],
  ['spam_complaint', 'complaint'],
]);

function genericRelayEnabled() {
  return ['true', '1', 'yes'].includes(String(process.env.ROBBOT3K_GENERIC_WEBHOOK_ENABLED || '').trim().toLowerCase());
}

function constantEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function authorized(req) {
  const expected = process.env.ROBBOT3K_WEBHOOK_SECRET;
  if (!expected) return false;
  const authorization = String(req.headers?.authorization || '');
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const header = String(req.headers?.['x-robbot3k-secret'] || '');
  return constantEqual(bearer, expected) || constantEqual(header, expected);
}

function eventKind(payload) {
  const raw = String(payload.event || payload.type || payload.eventType || '').trim().toLowerCase();
  // Exact aliases only. Substring matching could mistake events such as
  // `booking.cancelled` or `bounce_recovered` for fresh stop signals.
  return EVENT_ALIASES.get(raw) || raw;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  // This endpoint is only for a trusted Avalon-owned relay. Direct provider
  // activation requires a separate endpoint with that provider's native raw-
  // body signature, timestamp window, replay protection, and fixed identity.
  if (!genericRelayEnabled() || !process.env.ROBBOT3K_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Webhook relay is not configured.' });
  }
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 256 * 1024) return res.status(413).json({ error: 'Payload too large' });
  const kind = eventKind(payload);
  if (!STOP_EVENTS.has(kind)) return res.status(200).json({ ok: true, skipped: kind || 'unknown' });

  try {
    const db = await getServiceClient();
    if (!db) return res.status(503).json({ error: 'Supabase service role is not configured.' });
    const tenantId = await getDefaultTenantId(db);
    if (!tenantId) return res.status(503).json({ error: 'Avalon tenant is not configured.' });
    const provider = String(payload.provider || '').trim().toLowerCase().slice(0, 80);
    if (!PROVIDER_PATTERN.test(provider)) {
      return res.status(400).json({ error: 'A valid provider identifier is required.', code: 'webhook_provider_required' });
    }
    const providerMessageId = String(payload.providerMessageId || payload.messageId || payload.emailId || '').slice(0, 300);
    const externalId = String(payload.externalId || payload.bookingId || payload.eventId || '').slice(0, 300);
    const prospectId = String(payload.prospectId || payload.metadata?.prospectId || '').slice(0, 100);
    if (!prospectId && !providerMessageId) {
      return res.status(400).json({
        error: 'A signed prospect ID or provider message ID is required.',
        code: 'webhook_signal_identifier_required',
      });
    }
    if (!externalId) {
      return res.status(400).json({
        error: 'A stable relay event ID is required.',
        code: 'webhook_event_id_required',
      });
    }
    const prospect = await findRobBotProspectForSignal(db, tenantId, {
      prospectId,
      provider,
      providerMessageId,
    });

    if (kind === 'reply') {
      await markRobBotReply(db, tenantId, null, prospect.id, {
        message: payload.message || payload.text || '',
        provider,
        providerMessageId,
        eventId: externalId ? `webhook:${provider}:${externalId}` : '',
      });
    } else if (kind === 'booked') {
      await markRobBotBooked(db, tenantId, null, prospect.id, {
        scheduledAt: payload.scheduledAt || payload.startTime,
        externalId,
        bookingUrl: payload.bookingUrl || payload.url,
        provider,
        metadata: { webhook: true },
      });
    } else {
      await suppressRobBotProspect(db, tenantId, null, prospect.id, {
        email: payload.email || payload.recipient || prospect.contact_email,
        reason: kind === 'unsubscribe' ? 'unsubscribe' : kind === 'complaint' ? 'complaint' : 'bounce',
        source: `webhook:${provider}`,
        details: { providerEventIdPresent: Boolean(externalId) },
      });
    }
    return res.status(200).json({ ok: true, stopped: kind, prospectId: prospect.id });
  } catch (error) {
    console.warn('[webhooks/robbot3k] failed', safeLogContext(error, 'robbot3k_webhook_failed'));
    const status = Number(error?.status) >= 400 && Number(error?.status) < 600 ? Number(error.status) : 500;
    return res.status(status).json({
      error: status >= 500 ? 'RobBot3K webhook could not be processed.' : String(error?.message || 'Webhook rejected.'),
      code: safeErrorCode(error, 'robbot3k_webhook_failed'),
    });
  }
}
