/**
 * POST /api/admin/team-messages/delete
 *
 * Internal team inbox: delete a message.
 *   - scope:'me'       → hide the message for the actor only (delete-for-me).
 *                        Anyone is allowed; the message stays for everyone else.
 *   - scope:'everyone' → tombstone the message for all participants
 *                        (delete-for-everyone). SENDER-ONLY → 403 if not the
 *                        sender. The row is kept; reads render { deleted:true }.
 *
 * Body: { messageId, scope:'me'|'everyone' }
 * Returns: { ok:true, scope }
 *
 * Service-role + requireStaff; tenant-scoped.
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { resolveActor, deleteForEveryone, hideForMe } from '../../_lib/team-inbox-store.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireStaff(req, res);
  if (!authed) return;

  const messageId = String(req.body?.messageId || '').trim();
  const scope = String(req.body?.scope || '').trim().toLowerCase();
  if (!messageId) return res.status(400).json({ error: 'messageId is required', code: 'message_id_required' });
  if (scope !== 'me' && scope !== 'everyone') {
    return res.status(400).json({ error: "scope must be 'me' or 'everyone'", code: 'invalid_scope' });
  }

  try {
    const actor = await resolveActor(req);
    if (!actor) return res.status(403).json({ error: 'Insufficient access', code: 'no_actor' });

    if (scope === 'everyone') {
      const ok = await deleteForEveryone(messageId, actor);
      // null = not found OR not the sender. Sender-only is the load-bearing rule.
      if (!ok) return res.status(403).json({ error: 'You can only delete your own messages for everyone.', code: 'not_sender' });
      return res.status(200).json({ ok: true, scope: 'everyone' });
    }

    const hid = await hideForMe(messageId, actor);
    if (!hid) return res.status(404).json({ error: 'Message not found.', code: 'message_not_found' });
    return res.status(200).json({ ok: true, scope: 'me' });
  } catch (err) {
    console.warn('[team-messages/delete] failed', safeLogContext(err, 'team_delete_failed'));
    return res.status(500).json({ error: 'Could not delete the message.', code: safeErrorCode(err, 'team_delete_failed') });
  }
}
