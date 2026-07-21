/**
 * GET /api/admin/team/list
 *
 * Staff/admin. Returns the staff/admin roster plus pending invites for the
 * caller's tenant, for the Team & User Settings screen.
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { listTeamMembers, listPendingInvites } from '../../_lib/team-core.js';
import { safeErrorCode } from '../../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireStaff(req, res);
  if (!authed) return;

  try {
    const [members, invites] = await Promise.all([
      listTeamMembers(authed.db, authed.tenantId),
      listPendingInvites(authed.db, authed.tenantId),
    ]);
    return res.status(200).json({ members, invites });
  } catch (err) {
    return res.status(500).json({ error: 'Could not load the team roster.', code: safeErrorCode(err, 'team_list_failed') });
  }
}
