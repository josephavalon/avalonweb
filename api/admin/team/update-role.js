/**
 * POST /api/admin/team/update-role
 *
 * Admin-only. Changes a team member's tier between 'staff' and 'admin'.
 * Refuses to demote the last active admin.
 * Body: { profileId: string, role: 'staff' | 'admin' }
 */
import { requireAdmin } from '../../_lib/supabase-auth.js';
import { writeAuditEvent } from '../../_lib/audit-events.js';
import { safeErrorCode } from '../../_lib/safe-error.js';
import { getTeamMember, wouldDropLastAdmin, TEAM_ROLES } from '../../_lib/team-core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireAdmin(req, res);
  if (!authed) return;

  const { db, tenantId } = authed;
  const profileId = String(req.body?.profileId || '').trim();
  const role = String(req.body?.role || '').trim();
  if (!profileId) return res.status(400).json({ error: 'profileId is required.' });
  if (!TEAM_ROLES.includes(role)) return res.status(400).json({ error: "Role must be 'staff' or 'admin'." });

  try {
    const target = await getTeamMember(db, tenantId, profileId);
    if (!target) return res.status(404).json({ error: 'Team member not found.' });
    if (target.role === role) return res.status(200).json({ ok: true, unchanged: true });

    if (await wouldDropLastAdmin(db, tenantId, target, { nextRole: role })) {
      return res.status(409).json({ error: "You can't demote the last admin.", code: 'last_admin' });
    }

    const { error } = await db.from('profiles')
      .update({ role, updated_at: new Date().toISOString() }).eq('id', profileId);
    if (error) throw error;

    await writeAuditEvent(db, {
      tenantId, actorProfileId: authed.user?.id || null,
      action: 'team_role_changed', entityType: 'profile', entityId: profileId,
      payload: { from: target.role, to: role, email: target.email },
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Could not update the role.', code: safeErrorCode(err, 'role_update_failed') });
  }
}
