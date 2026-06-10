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
  if (!id || !timestamp || !sigHeader) return false;

  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false; // 5-min replay window

  const base64Secret = String(secret).replace(/^v1,/, '').replace(/^whsec_/, '');
  let key;
  try { key = Buffer.from(base64Secret, 'base64'); } catch { return false; }

  const signedContent = `${id}.${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64');

  // Header is space-separated "version,signature" pairs (e.g. "v1,abc v1,def").
  const provided = sigHeader.split(' ').map((part) => part.split(',')[1]).filter(Boolean);
  const expectedBuf = Buffer.from(expected);
  return provided.some((sig) => {
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
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
