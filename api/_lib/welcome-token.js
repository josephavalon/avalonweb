/**
 * Welcome-link token: HMAC-signed, self-contained, 1-hour TTL, single scope
 * (`welcome`). Used by the post-signup magic-link CTA so a brand-new client
 * can tap once and land signed-in at /members/dashboard without typing a
 * password.
 *
 * Design notes:
 *   - Self-contained. No DB lookup; the signature itself is the proof of
 *     legitimacy. Lets us issue tokens during email send without a write
 *     round-trip.
 *   - Scope is hard-coded to `welcome`. We do not parameterize scope —
 *     widening it would make the token a general-purpose session forger.
 *   - Issued tokens carry the user_id only. Recipient identity lookup
 *     happens at redemption against Supabase, so a stolen token cannot
 *     reveal the email it was issued for.
 *   - Expiry is server-clock based. We do not trust a client-supplied
 *     `iat`; only `exp` is encoded, and it is checked relative to the
 *     server's `Date.now()`.
 *
 * Format: `<userIdBase64url>.<expSec>.<sigBase64url>`
 *
 * Env: WELCOME_LINK_SECRET (string, ≥32 bytes recommended). Rotating the
 * secret invalidates every outstanding welcome link in flight; that is the
 * kill switch.
 */
import crypto from 'crypto';

const SCOPE = 'welcome';
const SECRET_VAR = 'WELCOME_LINK_SECRET';
const DEFAULT_TTL_SEC = 3600; // 1 hour

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function getSecret() {
  const raw = String(process.env[SECRET_VAR] || '').trim();
  if (!raw) {
    if (isProductionRuntime()) {
      throw Object.assign(new Error(`${SECRET_VAR} is required in production`), {
        code: 'welcome_link_secret_missing',
      });
    }
    // Dev-only fallback. Loud but functional so local previews work without
    // forcing every contributor to set a secret. Never fires in prod.
    return 'avalon-dev-only-welcome-link-secret-do-not-use-in-prod';
  }
  return raw;
}

function b64urlEncode(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function b64urlDecode(str) {
  return Buffer.from(String(str || ''), 'base64url');
}

function computeSignature({ uidPart, expPart, secret }) {
  const payload = `${SCOPE}.${uidPart}.${expPart}`;
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('base64url');
}

function constantTimeEqualB64Url(a, b) {
  const bufA = b64urlDecode(a);
  const bufB = b64urlDecode(b);
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Sign a fresh welcome token for `userId`. TTL defaults to 1 hour.
 *
 * @returns {string} `<uid>.<exp>.<sig>`
 */
export function signWelcomeToken({ userId, ttlSec = DEFAULT_TTL_SEC, now = Date.now() } = {}) {
  const clean = String(userId || '').trim();
  if (!clean) {
    throw Object.assign(new Error('userId is required to sign welcome token'), {
      code: 'welcome_link_user_missing',
    });
  }
  const ttl = Number.isFinite(ttlSec) && ttlSec > 0 ? Math.floor(ttlSec) : DEFAULT_TTL_SEC;
  const exp = Math.floor(now / 1000) + ttl;
  const uidPart = b64urlEncode(clean);
  const expPart = String(exp);
  const sig = computeSignature({ uidPart, expPart, secret: getSecret() });
  return `${uidPart}.${expPart}.${sig}`;
}

/**
 * Verify a welcome token. Returns `{ userId }` on success or throws with a
 * stable `code` so callers can branch on the reason.
 *
 * Codes:
 *   - welcome_link_token_missing
 *   - welcome_link_token_malformed
 *   - welcome_link_token_expired
 *   - welcome_link_token_signature_invalid
 */
export function verifyWelcomeToken(token, { now = Date.now() } = {}) {
  const raw = String(token || '').trim();
  if (!raw) {
    throw Object.assign(new Error('Welcome token missing'), { code: 'welcome_link_token_missing' });
  }
  const parts = raw.split('.');
  if (parts.length !== 3) {
    throw Object.assign(new Error('Welcome token malformed'), { code: 'welcome_link_token_malformed' });
  }
  const [uidPart, expPart, sigPart] = parts;
  const exp = Number(expPart);
  if (!Number.isFinite(exp) || exp <= 0) {
    throw Object.assign(new Error('Welcome token malformed (exp)'), { code: 'welcome_link_token_malformed' });
  }
  const expected = computeSignature({ uidPart, expPart, secret: getSecret() });
  if (!constantTimeEqualB64Url(expected, sigPart)) {
    throw Object.assign(new Error('Welcome token signature invalid'), { code: 'welcome_link_token_signature_invalid' });
  }
  if (exp * 1000 < now) {
    throw Object.assign(new Error('Welcome token expired'), { code: 'welcome_link_token_expired' });
  }
  let userId;
  try {
    userId = b64urlDecode(uidPart).toString('utf8');
  } catch {
    throw Object.assign(new Error('Welcome token malformed (uid)'), { code: 'welcome_link_token_malformed' });
  }
  if (!userId) {
    throw Object.assign(new Error('Welcome token malformed (uid)'), { code: 'welcome_link_token_malformed' });
  }
  return { userId, scope: SCOPE, exp };
}

export function isMagicLinkWelcomeEnabled() {
  const flag = String(process.env.MAGIC_LINK_WELCOME_ENABLED || '').trim().toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

export const WELCOME_LINK_SCOPE = SCOPE;
