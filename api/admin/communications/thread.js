/**
 * GET /api/admin/communications/thread?threadId=...
 *
 * Staff/admin: full message history for one conversation, oldest first, and
 * clears its unread count (opening a thread marks it read).
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireStaff(req, res);
  if (!authed) return;
  const { db } = authed;

  const threadId = String(req.query?.threadId || '').trim();
  if (!threadId) return res.status(400).json({ error: 'threadId is required', code: 'thread_id_required' });

  const { data: threads, error: tErr } = await db
    .from('comm_threads')
    .select('id, channel, contact, customer_name, unread_count')
    .eq('id', threadId)
    .limit(1);
  if (tErr) {
    console.warn('[admin/thread] thread query failed', safeLogContext(tErr, 'admin_thread_query_failed'));
    return res.status(500).json({ error: 'Could not load conversation.', code: safeErrorCode(tErr, 'admin_thread_query_failed') });
  }
  const thread = threads?.[0];
  if (!thread) return res.status(404).json({ error: 'Conversation not found.', code: 'thread_not_found' });

  const { data: messages, error: mErr } = await db
    .from('comm_messages')
    .select('id, direction, channel, body, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(1000);
  if (mErr) {
    console.warn('[admin/thread] messages query failed', safeLogContext(mErr, 'admin_thread_messages_failed'));
    return res.status(500).json({ error: 'Could not load messages.', code: safeErrorCode(mErr, 'admin_thread_messages_failed') });
  }

  if (thread.unread_count) {
    await db.from('comm_threads').update({ unread_count: 0 }).eq('id', threadId);
  }

  return res.status(200).json({ thread, messages: messages || [] });
}
