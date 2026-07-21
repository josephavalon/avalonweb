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

  let actor;
  try {
    actor = await resolveActor(req);
  } catch (err) {
    console.warn('[team-messages/threads] resolveActor failed', safeLogContext(err, 'team_actor_failed'));
    return res.status(500).json({
      error: 'Could not load your inbox.',
      code: safeErrorCode(err, 'team_actor_failed'),
      detail: String(err?.message || err || ''),
    });
  }
  if (!actor) return res.status(403).json({ error: 'Insufficient access', code: 'no_actor' });

  // Threads / scheduled-flush queries depend on tables shipped by migration
  // 021_team_messaging.sql. If those aren't applied yet, the picker should
  // still work — we just degrade to an empty thread list and surface a
  // signal the UI can read. Same logic for the roster query, but the roster
  // lives in the `profiles` table which existed long before 021.
  let threads = [];
  let threadsError = null;
  try {
    await flushDueScheduled(actor.tenantId);
    threads = await listThreadsForMember(actor);
  } catch (err) {
    console.warn('[team-messages/threads] threads load failed', safeLogContext(err, 'team_threads_failed'));
    threadsError = {
      code: safeErrorCode(err, 'team_threads_failed'),
      detail: String(err?.message || err || ''),
    };
  }

  let members = [];
  let rosterError = null;
  try {
    members = await listTeamMembers(actor.db, actor.tenantId);
  } catch (err) {
    console.warn('[team-messages/threads] roster load failed', safeLogContext(err, 'team_roster_failed'));
    rosterError = {
      code: safeErrorCode(err, 'team_roster_failed'),
      detail: String(err?.message || err || ''),
    };
  }

  // Roster for the composer — exclude the actor and only active teammates.
  // Emit BOTH `id` and `profileId` so the React composer (which keys on
  // `id` like every other React list) and any legacy consumer that expects
  // `profileId` both work.
  const roster = (members || [])
    .filter((m) => m.status === 'active' && m.id !== actor.profileId)
    .map((m) => ({
      id: m.id,
      profileId: m.id,
      email: m.email,
      name: m.full_name || m.email,
      full_name: m.full_name || m.email,
      role: m.role,
    }));

  return res.status(200).json({
    threads,
    roster,
    me: {
      id: actor.profileId,
      profileId: actor.profileId,
      email: actor.email,
      name: actor.name,
      full_name: actor.name,
    },
    diagnostics: {
      tenantId: actor.tenantId,
      memberCount: (members || []).length,
      rosterCount: roster.length,
      threadsError,
      rosterError,
    },
  });
}
