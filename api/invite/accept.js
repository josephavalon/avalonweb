/**
 * POST /api/invite/accept  (PUBLIC — invitee is not signed in)
 *
 * Re-validates the invite, creates (or upgrades) the auth user with the chosen
 * password, sets their profile role/status from the invitation, and marks the
 * invitation accepted. The user then signs in at /admin/login with email +
 * password.
 *
 * Body: { token?: string, email?: string, code?: string, password: string, fullName?: string }
 */
import { getServiceClient } from '../_lib/supabase-auth.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';
import { writeAuditEvent } from '../_lib/audit-events.js';
import { safeErrorCode } from '../_lib/safe-error.js';
import { resolveInvite } from './validate.js';

const INVALID = { error: 'This invite is invalid or has expired.', code: 'invite_invalid' };

async function findExistingProfileByEmail(db, email) {
  // profiles.id mirrors auth.users.id; cheaper than paging admin.listUsers.
  const { data } = await db.from('profiles')
    .select('id, tenant_id, status, role')
    .eq('email', email)
    .maybeSingle();
  return data || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const limit = await checkRateLimit({ key: `invite-accept:${clientIp(req)}`, windowMs: 60 * 1000, max: 15 });
  if (!limit.ok) return res.status(429).json({ error: 'Too many attempts. Try again shortly.' });

  const db = await getServiceClient();
  if (!db) return res.status(503).json({ error: 'Sign-up is not configured.' });

  const token = String(req.body?.token || '').trim();
  const email = String(req.body?.email || '').trim();
  const code = String(req.body?.code || '').trim();
  const password = String(req.body?.password || '');
  const fullName = String(req.body?.fullName || '').trim() || null;

  if (!token && !(email && code)) return res.status(400).json({ error: 'A token or email + code is required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.', code: 'weak_password' });

  let invite;
  try {
    invite = await resolveInvite(db, { token, email, code });
  } catch {
    return res.status(404).json(INVALID);
  }
  if (!invite) return res.status(404).json(INVALID);

  try {
    // Create the auth user, or upgrade an existing account (e.g. a former client
    // who proved possession of this email via the token/code).
    let userId = null;
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: fullName || invite.full_name ? { full_name: fullName || invite.full_name } : undefined,
    });
    if (createErr) {
      const existing = await findExistingProfileByEmail(db, invite.email);
      if (!existing) throw createErr;

      // Refuse to silently reset another tenant's user, or to overwrite an
      // already-active team member, just because we hold a matching invite.
      // Without these checks, anyone who can issue/leak an invite for a known
      // email can hijack the account: updateUserById would reset the password
      // and the profile patch below would rewrite role + tenant_id, moving the
      // victim's admin seat into the attacker's tenant.
      if (existing.tenant_id && existing.tenant_id !== invite.tenant_id) {
        return res.status(409).json({
          error: 'This email is already registered to another workspace. Sign in with that account first.',
          code: 'email_already_registered',
        });
      }
      if (existing.status === 'active' && existing.role !== 'client') {
        return res.status(409).json({
          error: 'This email already has an active team account. Sign in instead.',
          code: 'email_already_active_team',
        });
      }

      const { error: updErr } = await db.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
      if (updErr) throw updErr;
      userId = existing.id;
    } else {
      userId = created?.user?.id || null;
    }
    if (!userId) throw new Error('No user id after provisioning');

    // The auth trigger normally seeds a profiles row (role=client), but the
    // invite accept contract must not silently succeed if the trigger is delayed
    // or absent. Upsert the promoted profile keyed by auth user id.
    const { error: profErr } = await db.from('profiles').upsert({
      id: userId,
      email: invite.email,
      role: invite.invited_role,
      status: 'active',
      tenant_id: invite.tenant_id,
      full_name: fullName || invite.full_name || null,
      must_change_password: false,
      invited_by: null,
      deactivated_at: null,
      deactivation_reason: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (profErr) throw profErr;

    const { error: invErr } = await db.from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', invite.id);
    if (invErr) throw invErr;

    await writeAuditEvent(db, {
      tenantId: invite.tenant_id,
      actorProfileId: userId,
      action: 'team_invite_accepted',
      entityType: 'invitation',
      entityId: invite.id,
      payload: { email: invite.email, role: invite.invited_role },
    });

    return res.status(200).json({ ok: true, email: invite.email, role: invite.invited_role });
  } catch (err) {
    return res.status(500).json({ error: 'Could not finish setting up your account.', code: safeErrorCode(err, 'invite_accept_failed') });
  }
}
