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
import { hashToken, hashCode, safeEqualHex, isInviteLive } from '../_lib/invite-token.js';

const INVALID = { error: 'This invite is invalid or has expired.', code: 'invite_invalid' };

export async function resolveInvite(db, { token, email, code }) {
  if (token) {
    const { data, error } = await db.from('invitations')
      .select('id, tenant_id, email, full_name, invited_role, status, expires_at, token_hash')
      .eq('token_hash', hashToken(token)).maybeSingle();
    if (error) throw error;
    if (!data || !isInviteLive(data)) return null;
    return data;
  }
  if (email && code) {
    const normEmail = String(email).trim().toLowerCase();
    const { data, error } = await db.from('invitations')
      .select('id, tenant_id, email, full_name, invited_role, status, expires_at, code_hash')
      .eq('email', normEmail).eq('status', 'pending');
    if (error) throw error;
    const want = hashCode(normEmail, String(code).trim());
    const match = (data || []).find((row) => isInviteLive(row) && safeEqualHex(row.code_hash, want));
    return match || null;
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
  if (!token && !(email && code)) return res.status(400).json({ error: 'A token or email + code is required.' });

  try {
    const invite = await resolveInvite(db, { token, email, code });
    if (!invite) return res.status(404).json(INVALID);
    return res.status(200).json({ ok: true, email: invite.email, role: invite.invited_role, fullName: invite.full_name || null });
  } catch {
    return res.status(404).json(INVALID);
  }
}
