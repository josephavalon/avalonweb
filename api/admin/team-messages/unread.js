/**
 * GET /api/admin/team-messages/unread
 *
 * Internal team inbox: total unread message count for the actor across all their
 * threads, for the profile-dropdown / nav badge. Flushes due scheduled messages
 * first so a just-arrived scheduled message counts. Service-role; tenant-scoped.
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { resolveActor, countUnreadForMember, flushDueScheduled } from '../../_lib/team-inbox-store.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireStaff(req, res);
  if (!authed) return;

  try {
    const actor = await resolveActor(req);
    if (!actor) return res.status(403).json({ error: 'Insufficient access', code: 'no_actor' });

    await flushDueScheduled(actor.tenantId);
    const unread = await countUnreadForMember(actor);

    return res.status(200).json({ unread });
  } catch (err) {
    console.warn('[team-messages/unread] failed', safeLogContext(err, 'team_unread_failed'));
    return res.status(500).json({ error: 'Could not load unread count.', code: safeErrorCode(err, 'team_unread_failed') });
  }
}
