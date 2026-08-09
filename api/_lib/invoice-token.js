/**
 * Short-lived bearer token for the nurse invoice page (/invoice).
 *
 * Shape mirrors api/_lib/summary-token.js, with a version prefix added so the
 * signing scheme can be rotated later without a flag day: verify rejects any
 * token whose first segment isn't a known version.
 *
 *   av1.<base64url payload>.<base64url HMAC-SHA256>
 *
 * IMPORTANT: this token authenticates the DOOR, not the nurse. /invoice is
 * gated by one shared credential, so the nurse's identity is self-asserted from
 * the roster picker. That is fine for an internal pay form that emails three
 * people who know the roster — but never treat a valid token as proof of who
 * submitted it.
 */
import crypto from 'crypto';

const TOKEN_VERSION = 'av1';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2h — a pay period on a phone takes a while

function secret() {
  return process.env.AVALON_INVOICE_TOKEN_SECRET || '';
}

export function isInvoiceTokenConfigured() {
  return Boolean(secret());
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createInvoiceToken({ ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!secret()) return '';
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      iat: now,
      exp: now + ttlMs,
      jti: crypto.randomBytes(12).toString('base64url'),
    }),
  ).toString('base64url');
  return `${TOKEN_VERSION}.${payload}.${sign(payload)}`;
}

/** Returns { ok: true } or { ok: false, reason } — never throws. */
export function verifyInvoiceToken(token = '') {
  if (!secret()) return { ok: false, reason: 'not_configured' };

  const parts = String(token || '').split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };

  const [version, payload, signature] = parts;
  if (version !== TOKEN_VERSION) return { ok: false, reason: 'unsupported_version' };
  if (!payload || !signature) return { ok: false, reason: 'malformed' };

  // timingSafeEqual throws on a length mismatch, so pre-check the length.
  const supplied = Buffer.from(signature);
  const expected = Buffer.from(sign(payload));
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (!parsed?.exp || Date.now() > Number(parsed.exp)) return { ok: false, reason: 'expired' };
  return { ok: true };
}

/**
 * Compare two secrets without leaking length or early-exit timing. Hashing both
 * sides first guarantees equal-length buffers, so timingSafeEqual can't throw.
 */
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? ''), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b ?? ''), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}
