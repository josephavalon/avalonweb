/**
 * Invite token + code generation and verification. We never store the raw
 * token or code — only their SHA-256 hashes — so a leaked `invitations` row
 * can't be used to accept an invite. Pure functions: easy to unit-test.
 */
import crypto from 'crypto';

export const INVITE_TIERS = ['staff', 'admin', 'promoter'];

/** URL-safe random token for the email magic-link (carries no PII). */
export function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/** 6-digit numeric code for the SMS path (cryptographically uniform 0–999999). */
export function generateCode() {
  // randomInt is unbiased; pad to 6 digits.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

/** Codes are scoped to the email so two pending invites can't collide. */
export function hashCode(email, code) {
  const normalized = `${String(email || '').trim().toLowerCase()}:${String(code || '').trim()}`;
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/** Constant-time compare of two hex digests. */
export function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a || ''), 'hex');
  const bufB = Buffer.from(String(b || ''), 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** An invitation is acceptable only if pending and not past expiry. */
export function isInviteLive(invite, now = Date.now()) {
  if (!invite) return false;
  if (invite.status !== 'pending') return false;
  const expires = invite.expires_at ? new Date(invite.expires_at).getTime() : 0;
  return Number.isFinite(expires) && expires > now;
}

export function isValidTier(role) {
  return INVITE_TIERS.includes(role);
}
