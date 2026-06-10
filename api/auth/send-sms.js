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

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
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
      secretPrefix: String(secret).slice(0, 8),
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

  const rawBody = await readRawBody(req);

  const secret = process.env.SEND_SMS_HOOK_SECRET;
  if (!secret) return hookError(res, 503, 'SMS hook is not configured');
  if (!verifySignature(rawBody, req.headers, secret)) {
    return res.status(401).json({ error: { http_code: 401, message: 'Invalid signature' } });
  }

  let payload;
  try { payload = JSON.parse(rawBody.toString('utf8')); } catch { return hookError(res, 400, 'Malformed payload'); }

  const phone = payload?.user?.phone;
  const otp = payload?.sms?.otp;
  if (!phone || !otp) return hookError(res, 400, 'Missing phone or otp in hook payload');

  const apiKey = process.env.QUO_API_KEY;
  const from = process.env.QUO_FROM_NUMBER;
  if (!apiKey || !from) return hookError(res, 503, 'Quo SMS is not configured');

  const to = String(phone).startsWith('+') ? String(phone) : `+${phone}`;
  try {
    const resp = await fetch('https://api.quo.com/v1/messages', {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `Your Avalon Vitality code is ${otp}. It expires shortly — don't share it.`,
        from,
        to: [to],
      }),
    });
    if (!resp.ok) {
      const detail = (await resp.text()).slice(0, 300);
      return hookError(res, 502, `Quo send failed (${resp.status}): ${detail}`);
    }
    return res.status(200).json({}); // Supabase treats 2xx as delivered
  } catch (err) {
    return hookError(res, 502, `Quo request error: ${err.message}`);
  }
}
