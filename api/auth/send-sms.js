/**
 * POST /api/auth/send-sms  — Supabase "Send SMS" auth hook.
 *
 * Supabase calls this to deliver phone-OTP codes; we relay them through Quo
 * (formerly OpenPhone). Configure in Supabase: Auth → Hooks → "Send SMS hook"
 * → HTTPS → https://<site>/api/auth/send-sms. Supabase signs every request
 * (Standard Webhooks), which we verify with SEND_SMS_HOOK_SECRET so the
 * endpoint can't be abused to send texts on our dime.
 *
 * Env:
 *   SEND_SMS_HOOK_SECRET  the hook secret Supabase generates (v1,whsec_…)
 *   QUO_API_KEY           Quo API key (raw, used as the Authorization header)
 *   QUO_FROM_NUMBER       sending number, E.164 (e.g. +14155550199) or a PN… id
 */

import crypto from 'crypto';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { sendSms } from '../_lib/send-sms.js';
import { safeLogContext } from '../_lib/safe-error.js';

export const config = { api: { bodyParser: false } };

const SEND_SMS_MAX_BODY_BYTES = Number.parseInt(process.env.SEND_SMS_MAX_BODY_BYTES || String(16 * 1024), 10);
const SEND_SMS_RATE_LIMIT = {
  windowMs: 60 * 1000,
  max: 30,
};
// Per-phone caps to bound SMS toll-fraud / pumping attacks. These are tighter
// than the per-IP bucket above because Supabase auth retries can multiplex
// many IPs against the same phone.
const SEND_SMS_PER_PHONE_HOUR = { windowMs: 60 * 60 * 1000, max: 5 };
const SEND_SMS_PER_PHONE_DAY = { windowMs: 24 * 60 * 60 * 1000, max: 20 };
// Country-code allowlist for the destination phone. Defaults to US/CA E.164
// prefixes — premium-rate / international destinations are the most expensive
// pumping vectors. Override with SEND_SMS_ALLOWED_COUNTRY_PREFIXES env var
// (comma-separated, e.g. "+1,+44").
const ALLOWED_COUNTRY_PREFIXES = String(process.env.SEND_SMS_ALLOWED_COUNTRY_PREFIXES || '+1')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedDestination(phone) {
  const e164 = String(phone || '').trim();
  if (!/^\+[1-9]\d{6,14}$/.test(e164)) return false; // strict E.164
  return ALLOWED_COUNTRY_PREFIXES.some((prefix) => e164.startsWith(prefix));
}

function hookHttpError(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

function readRawBody(req, maxBytes = SEND_SMS_MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      const buffer = Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) {
        settled = true;
        reject(hookHttpError('SMS hook payload too large', 413, 'send_sms_body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

// Standard Webhooks verification (the scheme Supabase auth hooks use).
function verifySignature(rawBody, headers, secret) {
  const id = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const sigHeader = headers['webhook-signature'];
  if (!id || !timestamp || !sigHeader) {
    console.warn('[send-sms] missing webhook headers', { hasId: !!id, hasTs: !!timestamp, hasSig: !!sigHeader });
    return false;
  }

  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) {
    console.warn('[send-sms] timestamp out of tolerance', { ts, now, delta: now - ts });
    return false;
  }

  // Secret is "v1,whsec_<base64>"; the signing key is the base64-decoded part after whsec_.
  const base64Secret = String(secret).trim().replace(/^v1,/, '').replace(/^whsec_/, '');
  let key;
  try { key = Buffer.from(base64Secret, 'base64'); } catch { console.warn('[send-sms] bad secret base64'); return false; }

  const signedContent = `${id}.${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest(); // raw bytes

  // webhook-signature is space-separated "v1,<base64sig>" pairs. Compare DECODED
  // bytes so base64 padding / url-safe differences don't cause false mismatches.
  const decode = (b64) => {
    try { return Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); } catch { return null; }
  };
  const sigs = sigHeader.split(' ').map((part) => (part.includes(',') ? part.slice(part.indexOf(',') + 1) : part));
  const ok = sigs.some((s) => {
    const buf = decode(s);
    return buf && buf.length === expected.length && crypto.timingSafeEqual(buf, expected);
  });
  if (!ok) {
    console.warn('[send-sms] signature mismatch', {
      keyLen: key.length,
      bodyLen: rawBody.length,
      expectedLen: expected.length,
      providedLens: sigs.map((s) => { const b = decode(s); return b ? b.length : -1; }),
    });
  }
  return ok;
}

function hookError(res, httpCode, message) {
  return res.status(httpCode).json({ error: { http_code: httpCode, message } });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const limit = await checkRateLimit({
    key: `send-sms:${clientIp(req)}`,
    windowMs: SEND_SMS_RATE_LIMIT.windowMs,
    max: SEND_SMS_RATE_LIMIT.max,
  });
  if (!limit.ok) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000)));
    return hookError(res, 429, 'Too many SMS hook attempts. Try again shortly.');
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    if (err?.status === 413) return hookError(res, 413, 'SMS hook payload is too large');
    return hookError(res, 400, 'Could not read SMS hook payload');
  }

  const secret = process.env.SEND_SMS_HOOK_SECRET;
  if (!secret) return hookError(res, 503, 'SMS hook is not configured');
  if (!verifySignature(rawBody, req.headers, secret)) {
    return res.status(401).json({ error: { http_code: 401, message: 'Invalid signature' } });
  }

  let payload;
  try { payload = JSON.parse(rawBody.toString('utf8')); } catch { return hookError(res, 400, 'Malformed payload'); }

  const phone = String(payload?.user?.phone || '').trim();
  const otp = String(payload?.sms?.otp || '').trim();
  if (!phone || !otp) return hookError(res, 400, 'Missing phone or otp in hook payload');
  if (phone.length > 32 || otp.length > 16) return hookError(res, 400, 'Invalid phone or otp in hook payload');

  if (!isAllowedDestination(phone)) {
    console.warn('[send-sms] destination blocked by country allowlist', { prefix: phone.slice(0, 4) });
    return hookError(res, 400, 'Destination is not allowed');
  }

  const phoneHour = await checkRateLimit({
    key: `send-sms:phone-hour:${phone}`,
    windowMs: SEND_SMS_PER_PHONE_HOUR.windowMs,
    max: SEND_SMS_PER_PHONE_HOUR.max,
  });
  if (!phoneHour.ok) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((phoneHour.reset - Date.now()) / 1000)));
    return hookError(res, 429, 'Too many SMS to this number. Try again later.');
  }
  const phoneDay = await checkRateLimit({
    key: `send-sms:phone-day:${phone}`,
    windowMs: SEND_SMS_PER_PHONE_DAY.windowMs,
    max: SEND_SMS_PER_PHONE_DAY.max,
  });
  if (!phoneDay.ok) {
    res.setHeader('Retry-After', Math.max(1, Math.ceil((phoneDay.reset - Date.now()) / 1000)));
    return hookError(res, 429, 'Daily SMS limit reached for this number.');
  }

  const sent = await sendSms({
    to: phone,
    body: `Your Avalon Vitality code is ${otp}. It expires shortly — don't share it.`,
  });
  if (!sent.ok) {
    const resp = sent;
    console.warn('[send-sms] SMS provider send failed', {
      status: resp.status,
      context: safeLogContext(resp, 'sms_provider_send_failed'),
    });
    const httpCode = sent.code === 'sms_not_configured' ? 503 : 502;
    return hookError(res, httpCode, sent.code === 'sms_not_configured' ? 'Quo SMS is not configured' : 'SMS provider send failed');
  }
  return res.status(200).json({}); // Supabase treats 2xx as delivered
}
