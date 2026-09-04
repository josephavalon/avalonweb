/**
 * POST /api/invite/validate  (PUBLIC — invitee is not signed in)
 *
 * Confirms an invite token (from the email link) or email+code (SMS path) and
 * returns the email + role to prefill the accept screen. Generic errors only,
 * so the endpoint can't be used to enumerate invites. Rate-limited.
 *
 * Body: { token: string } | { email: string, code: string }
 */
import { getServiceClient } from '../_lib/supabase-auth.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { hashToken, hashCode, safeEqualHex, isInviteLive, isValidTier } from '../_lib/invite-token.js';

const INVALID = { error: 'This invite is invalid or has expired.', code: 'invite_invalid' };

// After this many bad-code attempts on the same invitation, auto-revoke. Cheap
// brute-force defence — the legitimate user gets 9 misclicks before lockout.
const INVITE_CODE_MAX_ATTEMPTS = 10;

// Compare-and-swap retries. A caller only loses the swap when a concurrent
// guess bumped the same row, and every retry re-reads a higher counter, so the
// loop converges fast; the bound just stops a pathological storm from spinning.
const BUMP_CAS_MAX_RETRIES = 5;

/**
 * Increment one invitation's failed-attempt counter, locking it at the
 * threshold.
 *
 * This used to read every counter, add one in JS, and write the result back.
 * That is a read-then-write race: N guesses issued in parallel all read the
 * same value and all write value+1, so the counter advances by 1 instead of N
 * and the 10-attempt lockout can be outrun simply by guessing concurrently.
 * The per-IP rate limits bounded it, but the lockout itself did not hold.
 *
 * The update is now guarded on the counter it read (`.eq('failed_attempts',
 * current)`), which Postgres evaluates as part of the same statement. A racing
 * writer therefore matches zero rows and re-reads instead of clobbering. That
 * is an atomic increment without needing a migration or an RPC.
 */
async function bumpOneAttempt(db, invitationId, attempt = 0) {
  // Retries exhausted means many guesses are landing on ONE invite at once,
  // which is the attack signature itself — a real person fat-fingering a code
  // never produces contention. Returning here would silently drop the
  // increment, so an attacker could hold the counter down just by guessing in
  // parallel. Lock instead: the failure mode has to be safe, not quiet.
  if (attempt >= BUMP_CAS_MAX_RETRIES) {
    await db.from('invitations').update({
      locked_at: new Date().toISOString(),
      status: 'revoked',
      updated_at: new Date().toISOString(),
    }).eq('id', invitationId).eq('status', 'pending');
    return;
  }

  const { data: row } = await db.from('invitations')
    .select('id, failed_attempts, status')
    .eq('id', invitationId)
    .maybeSingle();
  // Already revoked/accepted by a concurrent bump — nothing left to count.
  if (!row || row.status !== 'pending') return;

  const current = row.failed_attempts === null || row.failed_attempts === undefined
    ? null
    : Number(row.failed_attempts);
  const next = (current || 0) + 1;

  const patch = { failed_attempts: next, updated_at: new Date().toISOString() };
  if (next >= INVITE_CODE_MAX_ATTEMPTS) {
    patch.locked_at = new Date().toISOString();
    patch.status = 'revoked';
  }

  // NULL needs `.is()`; PostgREST's `.eq()` will not match it.
  let q = db.from('invitations').update(patch).eq('id', invitationId);
  q = current === null ? q.is('failed_attempts', null) : q.eq('failed_attempts', current);

  const { data: updated } = await q.select('id');
  if (!updated || updated.length === 0) {
    // Lost the swap: another guess landed first. Re-read and try again.
    await bumpOneAttempt(db, invitationId, attempt + 1);
  }
}

async function bumpFailedAttempts(db, invitationIds) {
  if (!invitationIds.length) return;
  await Promise.all(invitationIds.map((id) => bumpOneAttempt(db, id)));
}

// Same convention as api/_lib/safe-stripe.js — exported for the concurrency
// test, not for production callers.
export const __testing = { bumpFailedAttempts, INVITE_CODE_MAX_ATTEMPTS };

export async function resolveInvite(db, { token, email, code, role }) {
  if (token) {
    const { data, error } = await db.from('invitations')
      .select('id, tenant_id, email, full_name, invited_role, invited_by, event_container_id, status, expires_at, token_hash, locked_at, failed_attempts')
      .eq('token_hash', hashToken(token)).maybeSingle();
    if (error) throw error;
    if (!data || data.locked_at || !isInviteLive(data)) return null;
    return data;
  }
  if (email && code) {
    const normEmail = String(email).trim().toLowerCase();
    let q = db.from('invitations')
      .select('id, tenant_id, email, full_name, invited_role, invited_by, event_container_id, status, expires_at, code_hash, locked_at, failed_attempts')
      .eq('email', normEmail).eq('status', 'pending').is('locked_at', null)
      // Newest invite wins — fixes the arbitrary-row race when multiple
      // pending invites coexist for the same (email, role).
      .order('created_at', { ascending: false });
    if (role && isValidTier(role)) q = q.eq('invited_role', role);
    const { data, error } = await q;
    if (error) throw error;
    const want = hashCode(normEmail, String(code).trim());
    const candidates = (data || []).filter((row) => isInviteLive(row));
    const match = candidates.find((row) => safeEqualHex(row.code_hash, want));
    if (match) return match;
    // Bad attempt: bump counters on every live invitation for this email so
    // an attacker rotating IPs can't keep guessing past the threshold.
    await bumpFailedAttempts(db, candidates.map((row) => row.id));
    return null;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const limit = await checkRateLimit({ key: `invite-validate:${clientIp(req)}`, windowMs: 60 * 1000, max: 30 });
  if (!limit.ok) return res.status(429).json({ error: 'Too many attempts. Try again shortly.' });

  const db = await getServiceClient();
  if (!db) return res.status(503).json({ error: 'Sign-up is not configured.' });

  const token = String(req.body?.token || '').trim();
  const email = String(req.body?.email || '').trim();
  const code = String(req.body?.code || '').trim();
  const role = String(req.body?.role || '').trim();
  if (!token && !(email && code)) return res.status(400).json({ error: 'A token or email + code is required.' });

  try {
    const invite = await resolveInvite(db, { token, email, code, role });
    if (!invite) return res.status(404).json(INVALID);
    return res.status(200).json({ ok: true, email: invite.email, role: invite.invited_role, fullName: invite.full_name || null });
  } catch {
    return res.status(404).json(INVALID);
  }
}
