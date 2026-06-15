/**
 * POST /api/admin/team/deactivate
 *
 * Admin-only. Deactivates ("removes") a team member: sets status='inactive',
 * stamps deactivated_at/reason, and bans their auth sign-in. We keep the row
 * for audit rather than hard-deleting. Refuses to remove the last active admin.
 * Also supports reactivation.
 *
 * Body: { profileId: string, reason?: string, reactivate?: boolean }
 */
import { requireAdmin } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode } from '../../_lib/safe-error.js';
import { getTeamMember, wouldDropLastAdmin } from '../../_lib/team-core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireAdmin(req, res);
  if (!authed) return;

  const { db, tenantId } = authed;
  const profileId = String(req.body?.profileId || '').trim();
  const reason = String(req.body?.reason || '').trim() || null;
  const reactivate = Boolean(req.body?.reactivate);
  if (!profileId) return res.status(400).json({ error: 'profileId is required.' });
  if (profileId === authed.user?.id && !reactivate) {
    return res.status(409).json({ error: "You can't deactivate your own account.", code: 'self_deactivate' });
  }

  try {
    const target = await getTeamMember(db, tenantId, profileId);
    if (!target) return res.status(404).json({ error: 'Team member not found.' });

    const nextStatus = reactivate ? 'active' : 'inactive';
    if (!reactivate && await wouldDropLastAdmin(db, tenantId, target, { nextStatus })) {
      return res.status(409).json({ error: "You can't remove the last admin.", code: 'last_admin' });
    }

    const update = reactivate
      ? { status: 'active', deactivated_at: null, deactivation_reason: null, updated_at: new Date().toISOString() }
      : { status: 'inactive', deactivated_at: new Date().toISOString(), deactivation_reason: reason, updated_at: new Date().toISOString() };
    const { error } = await db.from('profiles').update(update).eq('id', profileId);
    if (error) throw error;

    // Ban/unban the auth user so an inactive member can't sign in. On
    // deactivate, also revoke ALL outstanding refresh tokens so any existing
    // session stops working immediately, not just at JWT exp. (The getAuthedUser
    // status check is the belt; signOut is the suspenders.)
    try {
      await db.auth.admin.updateUserById(profileId, { ban_duration: reactivate ? 'none' : '876000h' });
    } catch (banErr) {
      console.warn('[team/deactivate] auth ban toggle failed', safeErrorCode(banErr, 'auth_ban_failed'));
    }
    if (!reactivate) {
      try {
        await db.auth.admin.signOut(profileId, 'global');
      } catch (signOutErr) {
        console.warn('[team/deactivate] auth signOut failed', safeErrorCode(signOutErr, 'auth_signout_failed'));
      }
    }

    await writeAuditEvent(db, {
      tenantId, actorProfileId: authed.user?.id || null,
      action: reactivate ? 'team_member_reactivated' : 'team_member_deactivated',
      entityType: 'profile', entityId: profileId,
      payload: { email: target.email, role: target.role, reason },
    });
    return res.status(200).json({ ok: true, status: nextStatus });
  } catch (err) {
    return res.status(500).json({ error: 'Could not update the member.', code: safeErrorCode(err, 'deactivate_failed') });
  }
}
