/**
 * POST /api/admin/team-messages/send
 *
 * Internal team inbox: send a message to teammates (admin<->admin, staff<->staff).
 *
 * Body:
 *   { threadId?, recipientProfileIds?: string[], subject?, body, attachments?,
 *     sendAt?, draftId?, saveDraft? }
 *   - threadId          reply into an existing thread (must be a participant).
 *   - recipientProfileIds  start a thread to these roster members. 1 recipient +
 *                       no subject → find-or-create direct; 2+ OR a subject →
 *                       always a new GROUP thread.
 *   - subject           group thread subject (forces a group thread).
 *   - body              0..4000 chars; required UNLESS attachments are present.
 *   - attachments       optional [{ url, name, type, width?, height? }] (images).
 *   - sendAt            ISO timestamp; if in the future → status 'scheduled'.
 *   - draftId           promote/update an existing draft of the actor's instead
 *                       of inserting a new message.
 *   - saveDraft         true → store as 'draft' (overrides sendAt/immediate).
 *
 * Status resolution: saveDraft → 'draft'; else future sendAt → 'scheduled';
 * else 'sent'. Service-role; recipients are validated against the staff/admin
 * roster (team-core) — never patients. Tenant-scoped.
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { getTeamMember } from '../../_lib/team-core.js';
import {
  resolveActor, createThread, insertMessage, updateMessage, futureIso,
} from '../../_lib/team-inbox-store.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireStaff(req, res);
  if (!authed) return;

  const body = String(req.body?.body || '').trim();
  const subject = String(req.body?.subject || '').trim() || null;
  const threadIdIn = String(req.body?.threadId || '').trim() || null;
  const draftId = String(req.body?.draftId || '').trim() || null;
  const saveDraft = req.body?.saveDraft === true;
  const sendAtRaw = req.body?.sendAt ? String(req.body.sendAt).trim() : null;
  const recipientProfileIds = Array.isArray(req.body?.recipientProfileIds)
    ? req.body.recipientProfileIds.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

  // Body is optional when attachments are present (e.g. an image-only message).
  if (!body && attachments.length === 0) {
    return res.status(400).json({ error: 'Message text is required.', code: 'body_required' });
  }
  if (body.length > 4000) return res.status(400).json({ error: 'Message is too long.', code: 'body_too_long' });
  if (!threadIdIn && !draftId && recipientProfileIds.length === 0) {
    return res.status(400).json({ error: 'Choose at least one teammate.', code: 'recipients_required' });
  }

  try {
    const actor = await resolveActor(req);
    if (!actor) return res.status(403).json({ error: 'Insufficient access', code: 'no_actor' });

    // Decide the target thread.
    let threadId = threadIdIn;
    if (!threadId && recipientProfileIds.length) {
      // Resolve each recipient against the staff/admin roster — never patients.
      const recipients = [];
      for (const pid of recipientProfileIds) {
        const member = await getTeamMember(actor.db, actor.tenantId, pid);
        if (!member) {
          return res.status(400).json({ error: 'One of the recipients is not a teammate.', code: 'invalid_recipient' });
        }
        recipients.push({ profileId: member.id, email: (member.email || '').toLowerCase() || null, name: member.full_name || member.email });
      }
      // 1 recipient + no subject → direct dedupe; 2+ OR subject → new group.
      threadId = await createThread(actor, { recipients, subject });
    }
    if (!threadId) {
      return res.status(400).json({ error: 'No conversation to send to.', code: 'no_thread' });
    }

    // Resolve status.
    const scheduledAt = saveDraft ? null : futureIso(sendAtRaw);
    const status = saveDraft ? 'draft' : (scheduledAt ? 'scheduled' : 'sent');

    let message;
    if (draftId) {
      // Editing an existing draft: update body, then (if not still a draft) promote.
      const updated = await updateMessage({ messageId: draftId, actor, body });
      if (!updated) return res.status(404).json({ error: 'Draft not found.', code: 'draft_not_found' });
      if (status === 'draft') {
        message = updated;
      } else {
        // Promote the draft to sent/scheduled by stamping the new status.
        const { data, error } = await actor.db
          .from('team_messages')
          .update({ status, send_at: status === 'scheduled' ? scheduledAt : null, created_at: new Date().toISOString() })
          .eq('tenant_id', actor.tenantId)
          .eq('id', draftId)
          .eq('sender_profile_id', actor.profileId)
          .select('*')
          .maybeSingle();
        if (error) throw error;
        message = data ? {
          id: data.id, threadId: data.thread_id, senderProfileId: data.sender_profile_id,
          senderName: data.sender_name, body: data.body,
          attachments: Array.isArray(data.attachments) ? data.attachments : [], status: data.status,
          sendAt: data.send_at || null, editedAt: data.edited_at || null, createdAt: data.created_at, mine: true,
        } : updated;
        // Bump the thread when the promoted message is actually sent now.
        if (status === 'sent') {
          await actor.db.from('team_threads')
            .update({ last_message_at: new Date().toISOString(), last_preview: body.slice(0, 140), updated_at: new Date().toISOString() })
            .eq('tenant_id', actor.tenantId).eq('id', threadId);
        }
      }
    } else {
      message = await insertMessage({ threadId, actor, body, status, sendAt: scheduledAt, attachments });
    }

    return res.status(200).json({ ok: true, threadId, message });
  } catch (err) {
    if (err?.message === 'no_valid_recipients') {
      return res.status(400).json({ error: 'Choose at least one teammate.', code: 'recipients_required' });
    }
    if (err?.message === 'body_required') {
      return res.status(400).json({ error: 'Add a message or an image.', code: 'body_required' });
    }
    if (err?.message === 'body_too_long') {
      return res.status(400).json({ error: 'Message is too long.', code: 'body_too_long' });
    }
    console.warn('[team-messages/send] failed', safeLogContext(err, 'team_send_failed'));
    return res.status(500).json({ error: 'Could not send your message.', code: safeErrorCode(err, 'team_send_failed') });
  }
}
