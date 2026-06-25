/**
 * POST /api/admin/team/reset-password
 *
 * Admin-only. Two modes (D3):
 *   mode='email' — send the member a password-reset link (Supabase recovery
 *                  link delivered via Resend).
 *   mode='temp'  — force-set a temporary password; the member must change it on
 *                  next login (profiles.must_change_password = true). If no
 *                  password is supplied we generate one and return it once so
 *                  the admin can relay it.
 *
 * Body: { profileId: string, mode: 'email' | 'temp', tempPassword?: string }
 */
import crypto from 'crypto';
import { requireAdmin } from '../../_lib/supabase-auth.js';
import { checkRateLimit } from '../../_lib/rate-limit.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode } from '../../_lib/safe-error.js';
import { sendStaffRecoveryEmail } from '../../_lib/invite-email.js';
import { getTeamMember } from '../../_lib/team-core.js';

function siteUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'https://avalonvitality.co').replace(/\/$/, '');
}

// Readable-ish temp password: enough entropy, no ambiguous chars.
function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 14; i += 1) out += alphabet[crypto.randomInt(0, alphabet.length)];
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireAdmin(req, res);
  if (!authed) return;

  const { db, tenantId } = authed;
  const profileId = String(req.body?.profileId || '').trim();
  const mode = req.body?.mode === 'temp' ? 'temp' : 'email';
  if (!profileId) return res.status(400).json({ error: 'profileId is required.' });

  // Cap an admin's reset sweep: at most 3 resets/minute against a single target,
  // and 10 resets/minute total per admin. Prevents a compromised admin session
  // from cycling through every other team member's account back to back.
  const targetLimit = await checkRateLimit({
    key: `team-reset:${authed.user?.id || 'unknown'}:${profileId}`,
    windowMs: 60 * 1000,
    max: 3,
  });
  if (!targetLimit.ok) return res.status(429).json({ error: 'Too many resets for this member. Try again shortly.', code: 'rate_limited' });
  const actorLimit = await checkRateLimit({
    key: `team-reset-actor:${authed.user?.id || 'unknown'}`,
    windowMs: 60 * 1000,
    max: 10,
  });
  if (!actorLimit.ok) return res.status(429).json({ error: 'Too many password resets. Try again shortly.', code: 'rate_limited' });

  let target;
  try {
    target = await getTeamMember(db, tenantId, profileId);
  } catch (err) {
    return res.status(500).json({ error: 'Could not load the member.', code: safeErrorCode(err, 'member_lookup_failed') });
  }
  if (!target) return res.status(404).json({ error: 'Team member not found.' });
  if (!target.email) return res.status(409).json({ error: 'That member has no email on file.', code: 'no_email' });

  if (mode === 'email') {
    try {
      const { data, error } = await db.auth.admin.generateLink({
        type: 'recovery',
        // Must land on the page that PROCESSES the recovery token and lets the
        // user set a new password. /admin/login is just the sign-in form — it
        // can't consume a recovery session, so the link dead-ends there.
        email: target.email,
        options: { redirectTo: `${siteUrl()}/account/new-password` },
      });
      if (error) throw error;
      const recoveryUrl = data?.properties?.action_link;
      if (!recoveryUrl) throw new Error('No recovery link returned');
      await sendStaffRecoveryEmail({ to: target.email, recoveryUrl });

      await writeAuditEvent(db, {
        tenantId, actorProfileId: authed.user?.id || null,
        action: 'team_password_reset_email', entityType: 'profile', entityId: profileId,
        payload: { email: target.email },
      });
      return res.status(200).json({ ok: true, mode: 'email' });
    } catch (err) {
      return res.status(500).json({ error: 'Could not send the reset email.', code: safeErrorCode(err, 'reset_email_failed') });
    }
  }

  // mode === 'temp'
  const tempPassword = String(req.body?.tempPassword || '').trim() || generateTempPassword();
  if (tempPassword.length < 8) return res.status(400).json({ error: 'Temporary password must be at least 8 characters.' });
  try {
    const { error: authErr } = await db.auth.admin.updateUserById(profileId, { password: tempPassword });
    if (authErr) throw authErr;
    const { error: profErr } = await db.from('profiles')
      .update({ must_change_password: true, updated_at: new Date().toISOString() }).eq('id', profileId);
    if (profErr) throw profErr;

    await writeAuditEvent(db, {
      tenantId, actorProfileId: authed.user?.id || null,
      action: 'team_password_force_set', entityType: 'profile', entityId: profileId,
      payload: { email: target.email },
    });
    // Return the temp password once so the admin can relay it. Not stored anywhere.
    return res.status(200).json({ ok: true, mode: 'temp', tempPassword, mustChange: true });
  } catch (err) {
    return res.status(500).json({ error: 'Could not set the temporary password.', code: safeErrorCode(err, 'temp_password_failed') });
  }
}
