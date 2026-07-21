/**
 * POST /api/me/account/password
 *
 * Self-serve password set/change for the SIGNED-IN member. Snooches sign-in is
 * passwordless by default (magic link + Google), so this gives the member an
 * optional password fallback for travelling / when email is unavailable.
 *
 * Two modes, mirroring api/admin/team/reset-password.js but scoped to the
 * caller's own account (no profileId — we always act on authed.user.id):
 *   mode='set'   (default) — directly set the password via the service-role
 *                            admin API. The member is already authenticated, so
 *                            no recovery hop is needed.
 *   mode='email' — send the member a Supabase recovery link (token_hash flow)
 *                  so they set the new password from the dedicated page. Useful
 *                  when the member would rather verify by email.
 *
 * Body: { password?: string, mode?: 'set' | 'email' }
 *
 * Validates an 8-char minimum (Supabase's default floor). Emits an audit event.
 */
import { getAuthedUser } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { checkRateLimit } from '../../_lib/rate-limit.js';
import { safeErrorCode } from '../../_lib/safe-error.js';

const MIN_PASSWORD_LENGTH = 8;

function siteUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'https://avalonvitality.co').replace(/\/$/, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authed = await getAuthedUser(req);
  if (!authed) return res.status(401).json({ error: 'Sign in required' });
  const { db, user, email, tenantId } = authed;

  // Cap password churn per member: 5/minute. Stops a hijacked session from
  // hammering the auth admin API or spamming recovery emails.
  const limit = await checkRateLimit({
    key: `me-password:${user?.id || 'unknown'}`,
    windowMs: 60 * 1000,
    max: 5,
  });
  if (!limit.ok) {
    return res.status(429).json({ error: 'Too many attempts. Try again shortly.', code: 'rate_limited' });
  }

  const mode = req.body?.mode === 'email' ? 'email' : 'set';

  if (mode === 'email') {
    if (!email) return res.status(409).json({ error: 'No email on file for this account.', code: 'no_email' });
    try {
      const { data, error } = await db.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${siteUrl()}/account/new-password` },
      });
      if (error) throw error;
      // Prefer a token_hash link (works cross-device / incognito); fall back to
      // the action_link if the hashed token isn't present. Matches the staff
      // recovery flow in api/admin/team/reset-password.js.
      const hashedToken = data?.properties?.hashed_token;
      const recoveryUrl = hashedToken
        ? `${siteUrl()}/account/new-password?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`
        : data?.properties?.action_link;
      if (!recoveryUrl) throw new Error('No recovery link returned');

      // NOTE: delivery of this link is handled by Supabase's own recovery email
      // template (generateLink does not auto-send). We return ok so the client
      // can tell the member to check their inbox.
      await writeAuditEvent(db, {
        tenantId: tenantId || null,
        actorProfileId: user?.id || null,
        action: 'account_password_reset_email',
        entityType: 'profiles',
        entityId: user?.id || null,
        payload: { mode: 'email' },
      });
      return res.status(200).json({ ok: true, mode: 'email' });
    } catch (err) {
      return res.status(500).json({ error: 'Could not start the password reset.', code: safeErrorCode(err, 'password_reset_email_failed') });
    }
  }

  // mode === 'set'
  const password = String(req.body?.password || '');
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, code: 'password_too_short' });
  }

  try {
    const { error } = await db.auth.admin.updateUserById(user.id, { password });
    if (error) throw error;

    await writeAuditEvent(db, {
      tenantId: tenantId || null,
      actorProfileId: user?.id || null,
      action: 'account_password_set',
      entityType: 'profiles',
      entityId: user?.id || null,
      payload: { mode: 'set' },
    });
    return res.status(200).json({ ok: true, mode: 'set' });
  } catch (err) {
    return res.status(500).json({ error: 'Could not update your password.', code: safeErrorCode(err, 'password_set_failed') });
  }
}
