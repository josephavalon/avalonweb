/**
 * GET /api/admin/team-messages/threads
 *
 * Internal team inbox: list the actor's threads (admin<->admin, staff<->staff),
 * newest activity first, plus the staff/admin roster for the composer. Flushes
 * any due scheduled messages first so they appear as sent. Service-role; the
 * actor is derived from the Supabase session and every query is tenant-scoped.
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { listTeamMembers } from '../../_lib/team-core.js';
import { resolveActor, listThreadsForMember, flushDueScheduled } from '../../_lib/team-inbox-store.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireStaff(req, res);
  if (!authed) return;

  try {
    const actor = await resolveActor(req);
    if (!actor) return res.status(403).json({ error: 'Insufficient access', code: 'no_actor' });

    await flushDueScheduled(actor.tenantId);

    const [threads, members] = await Promise.all([
      listThreadsForMember(actor),
      listTeamMembers(actor.db, actor.tenantId),
    ]);

    // Roster for the composer — exclude the actor and only active teammates.
    const roster = (members || [])
      .filter((m) => m.status === 'active' && m.id !== actor.profileId)
      .map((m) => ({ profileId: m.id, email: m.email, name: m.full_name || m.email, role: m.role }));

    return res.status(200).json({ threads, roster, me: { profileId: actor.profileId, email: actor.email, name: actor.name } });
  } catch (err) {
    console.warn('[team-messages/threads] failed', safeLogContext(err, 'team_threads_failed'));
    return res.status(500).json({ error: 'Could not load your inbox.', code: safeErrorCode(err, 'team_threads_failed') });
  }
}
