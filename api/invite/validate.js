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

async function bumpFailedAttempts(db, invitationIds) {
  if (!invitationIds.length) return;
  // Fetch current counters, increment, lock+revoke any that crossed the line.
  const { data } = await db.from('invitations')
    .select('id, failed_attempts')
    .in('id', invitationIds);
  for (const row of data || []) {
    const next = (Number(row.failed_attempts) || 0) + 1;
    if (next >= INVITE_CODE_MAX_ATTEMPTS) {
      await db.from('invitations').update({
        failed_attempts: next,
        locked_at: new Date().toISOString(),
        status: 'revoked',
        updated_at: new Date().toISOString(),
      }).eq('id', row.id);
    } else {
      await db.from('invitations').update({
        failed_attempts: next,
        updated_at: new Date().toISOString(),
      }).eq('id', row.id);
    }
  }
}

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
