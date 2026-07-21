/**
 * POST /api/admin/team-messages/update
 *
 * Internal team inbox: edit the body of a message the actor sent. Sender-only;
 * sets edited_at and refreshes the thread preview when it's the latest sent
 * message. Service-role; tenant-scoped.
 *
 * Body: { messageId, body }
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { resolveActor, updateMessage } from '../../_lib/team-inbox-store.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireStaff(req, res);
  if (!authed) return;

  const messageId = String(req.body?.messageId || '').trim();
  const body = String(req.body?.body || '').trim();
  if (!messageId) return res.status(400).json({ error: 'messageId is required', code: 'message_id_required' });
  if (!body) return res.status(400).json({ error: 'Message text is required.', code: 'body_required' });
  if (body.length > 4000) return res.status(400).json({ error: 'Message is too long.', code: 'body_too_long' });

  try {
    const actor = await resolveActor(req);
    if (!actor) return res.status(403).json({ error: 'Insufficient access', code: 'no_actor' });

    const message = await updateMessage({ messageId, actor, body });
    if (!message) return res.status(404).json({ error: 'Message not found or not yours.', code: 'message_not_found' });

    return res.status(200).json({ ok: true, message });
  } catch (err) {
    if (err?.message === 'message_deleted') {
      return res.status(409).json({ error: 'This message was deleted.', code: 'message_deleted' });
    }
    console.warn('[team-messages/update] failed', safeLogContext(err, 'team_update_failed'));
    return res.status(500).json({ error: 'Could not update your message.', code: safeErrorCode(err, 'team_update_failed') });
  }
}
