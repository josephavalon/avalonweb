/**
 * POST /api/reviews/submit
 *
 * Public, tokenized review submission for a customer who received the
 * post-visit survey email. No login required — the token IS the auth.
 *
 * Body: { token: string, score: number (0..10), text?: string, allow_public?: boolean }
 *
 * - Validates the token against public.reviews (no enumeration: the token IS
 *   crypto-secure 48-char hex; we look it up directly).
 * - Rejects an already-submitted review (`submitted_at IS NOT NULL`) so the
 *   public link is single-use for stamping the score.
 * - Stamps submitted_at + score + text + allow_public on the row.
 * - approved/hidden remain admin-controlled (set via /api/admin/reviews).
 *
 * Rate-limit: per-IP (10/min) AND per-token (5/min) to soak abusive retries
 * even before token validity is checked.
 *
 * IMPORTANT: this endpoint can NEVER be used to discover whether an email
 * received a survey — the 400/404 responses are intentionally the same.
 */

import { getServiceClient } from '../_lib/supabase-auth.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';

const TOKEN_PATTERN = /^[a-f0-9]{32,80}$/i;
const MAX_TEXT_LEN = 2000;

function trimText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LEN);
}

function badRequest(res, code = 'invalid_request') {
  // Single opaque rejection so callers can't probe token existence vs
  // payload-shape errors.
  return res.status(400).json({ error: 'We could not process this review.', code });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = clientIp(req);
  const ipRl = await checkRateLimit({ key: `reviews:submit:ip:${ip}`, windowMs: 60_000, max: 10 });
  if (!ipRl.ok) {
    return res.status(429).json({ error: 'Too many requests — please wait a minute.', code: 'rate_limited' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const token = String(body.token || '').trim();
  if (!TOKEN_PATTERN.test(token)) return badRequest(res, 'invalid_token');

  const tokenRl = await checkRateLimit({ key: `reviews:submit:token:${token}`, windowMs: 60_000, max: 5 });
  if (!tokenRl.ok) {
    return res.status(429).json({ error: 'Too many attempts on this link.', code: 'rate_limited' });
  }

  const scoreRaw = Number(body.score);
  if (!Number.isFinite(scoreRaw)) return badRequest(res, 'invalid_score');
  const score = Math.floor(scoreRaw);
  if (score < 0 || score > 10) return badRequest(res, 'invalid_score');

  const text = trimText(body.text);
  const allowPublic = body.allow_public === true || body.allow_public === 'true';

  const db = await getServiceClient();
  if (!db) return res.status(503).json({ error: 'Reviews are temporarily unavailable.', code: 'supabase_unconfigured' });

  let row;
  try {
    const { data, error } = await db
      .from('reviews')
      .select('id, tenant_id, appointment_id, submitted_at')
      .eq('token', token)
      .maybeSingle();
    if (error) throw error;
    row = data || null;
  } catch (err) {
    console.warn('[reviews/submit] lookup failed', safeLogContext(err, 'review_lookup_failed'));
    return res.status(500).json({ error: 'We could not process this review.', code: 'lookup_failed' });
  }
  if (!row) return badRequest(res, 'invalid_token');
  if (row.submitted_at) {
    return res.status(409).json({ error: 'This review has already been submitted.', code: 'already_submitted' });
  }

  try {
    const { error } = await db
      .from('reviews')
      .update({
        nps_score: score,
        text: text || null,
        allow_public: allowPublic,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .is('submitted_at', null); // optimistic guard against a concurrent submit
    if (error) throw error;
  } catch (err) {
    console.warn('[reviews/submit] update failed', safeLogContext(err, 'review_update_failed'));
    return res.status(500).json({ error: 'We could not process this review.', code: 'update_failed' });
  }

  await writeAuditEvent(db, {
    tenantId: row.tenant_id,
    actorProfileId: null,
    action: 'review_submitted',
    entityType: 'reviews',
    entityId: row.id,
    phiTouched: false,
    payload: {
      route: 'api/reviews/submit',
      score,
      hasText: Boolean(text),
      allowPublic,
    },
  });

  return res.status(200).json({ ok: true });
}
