/**
 * GET /api/admin/team-messages/thread?threadId=...
 *
 * Internal team inbox: full message history for one thread — all SENT messages
 * plus the actor's OWN drafts/scheduled — ordered oldest first, with the thread's
 * participants. Flushes due scheduled messages and marks the thread read for the
 * actor. Service-role; tenant-scoped; 404 if the actor isn't a participant.
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { resolveActor, getThreadMessages, markThreadRead, flushDueScheduled } from '../../_lib/team-inbox-store.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireStaff(req, res);
  if (!authed) return;

  const threadId = String(req.query?.threadId || '').trim();
  if (!threadId) return res.status(400).json({ error: 'threadId is required', code: 'thread_id_required' });

  try {
    const actor = await resolveActor(req);
    if (!actor) return res.status(403).json({ error: 'Insufficient access', code: 'no_actor' });

    await flushDueScheduled(actor.tenantId);

    const result = await getThreadMessages(threadId, actor);
    if (!result) return res.status(404).json({ error: 'Conversation not found.', code: 'thread_not_found' });

    await markThreadRead(threadId, actor);

    return res.status(200).json(result);
  } catch (err) {
    console.warn('[team-messages/thread] failed', safeLogContext(err, 'team_thread_failed'));
    return res.status(500).json({ error: 'Could not load the conversation.', code: safeErrorCode(err, 'team_thread_failed') });
  }
}
