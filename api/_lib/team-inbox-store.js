/**
 * team-inbox-store — service-role persistence for the INTERNAL team inbox
 * (admin <-> admin, staff <-> staff). NEVER patients.
 *
 * Mirrors comm-store.js: every helper goes through the service-role client
 * (RLS-bypassing, server-only) and scopes every query by tenant_id in JS. The
 * team_threads / team_thread_participants / team_messages tables (migration 021)
 * have RLS enabled with no policies, so access is enforced here, not by the DB.
 *
 * Recipients always come from the staff/admin roster (team-core). There is no
 * patient path through this module.
 */
import { getServiceClient, getAuthedUser } from './supabase-auth.js';
import { getTeamMember } from './team-core.js';

function preview(body) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

/** A future timestamp string, or null. Used to decide scheduled vs immediate. */
function futureIso(sendAt) {
  if (!sendAt) return null;
  const t = Date.parse(sendAt);
  if (Number.isNaN(t)) return null;
  return t > Date.now() ? new Date(t).toISOString() : null;
}

/**
 * Resolve the authenticated operator into an actor we can attribute messages to.
 * Returns { db, profileId, email, name, tenantId, role } or null if the request
 * is not an authenticated admin/staff with a tenant.
 */
export async function resolveActor(req) {
  const authed = await getAuthedUser(req);
  if (!authed) return null;
  if (authed.role !== 'admin' && authed.role !== 'staff') return null;
  if (!authed.tenantId) return null;
  let name = (authed.email || '').split('@')[0] || 'Teammate';
  try {
    const { data } = await authed.db
      .from('profiles')
      .select('full_name')
      .eq('id', authed.user.id)
      .maybeSingle();
    if (data?.full_name) name = data.full_name;
  } catch { /* fall back to email local-part */ }
  return {
    db: authed.db,
    profileId: authed.user.id,
    email: (authed.email || '').trim().toLowerCase(),
    name,
    tenantId: authed.tenantId,
    role: authed.role,
  };
}

/**
 * Mark the participant rows for the actor (matched by profile id OR email) so
 * that a thread the actor was addressed-to before finishing signup still links.
 * Returns the set of thread ids the actor participates in.
 */
async function actorThreadIds(db, actor) {
  const ors = [`member_profile_id.eq.${actor.profileId}`];
  if (actor.email) ors.push(`member_email.eq.${actor.email}`);
  const { data, error } = await db
    .from('team_thread_participants')
    .select('thread_id')
    .eq('tenant_id', actor.tenantId)
    .or(ors.join(','));
  if (error) throw error;
  return [...new Set((data || []).map((r) => r.thread_id))];
}

/**
 * List the actor's threads, newest activity first. Each entry carries a title
 * built from the OTHER participants, the last preview, and an unread count
 * (messages sent after the actor's last_read_at, excluding the actor's own).
 */
export async function listThreadsForMember(actor) {
  const db = actor.db;
  const ids = await actorThreadIds(db, actor);
  if (!ids.length) return [];

  const { data: threads, error: tErr } = await db
    .from('team_threads')
    .select('id, subject, created_by, last_message_at, last_preview, created_at')
    .eq('tenant_id', actor.tenantId)
    .in('id', ids)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(500);
  if (tErr) throw tErr;

  const { data: parts, error: pErr } = await db
    .from('team_thread_participants')
    .select('thread_id, member_profile_id, member_email, member_name, last_read_at')
    .eq('tenant_id', actor.tenantId)
    .in('thread_id', ids);
  if (pErr) throw pErr;

  const partsByThread = new Map();
  const myReadByThread = new Map();
  for (const p of parts || []) {
    if (!partsByThread.has(p.thread_id)) partsByThread.set(p.thread_id, []);
    partsByThread.get(p.thread_id).push(p);
    const isMe = (p.member_profile_id && p.member_profile_id === actor.profileId)
      || (p.member_email && p.member_email === actor.email);
    if (isMe) myReadByThread.set(p.thread_id, p.last_read_at || null);
  }

  // Unread = sent messages (not mine) created after my last_read_at, per thread.
  const { data: msgs, error: mErr } = await db
    .from('team_messages')
    .select('thread_id, sender_profile_id, status, created_at')
    .eq('tenant_id', actor.tenantId)
    .eq('status', 'sent')
    .in('thread_id', ids)
    .limit(5000);
  if (mErr) throw mErr;

  const unreadByThread = new Map();
  for (const m of msgs || []) {
    if (m.sender_profile_id === actor.profileId) continue;
    const readAt = myReadByThread.get(m.thread_id);
    if (readAt && Date.parse(m.created_at) <= Date.parse(readAt)) continue;
    unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) || 0) + 1);
  }

  return (threads || []).map((t) => {
    const others = (partsByThread.get(t.id) || []).filter((p) =>
      !((p.member_profile_id && p.member_profile_id === actor.profileId)
        || (p.member_email && p.member_email === actor.email)));
    const names = others.map((p) => p.member_name || p.member_email).filter(Boolean);
    const title = t.subject || (names.length ? names.join(', ') : 'Direct message');
    const unread = unreadByThread.get(t.id) || 0;
    return {
      id: t.id,
      title,
      subject: t.subject || null,
      last_preview: t.last_preview || null,
      last_message_at: t.last_message_at || null,
      participants: others.map((p) => ({ profileId: p.member_profile_id, email: p.member_email, name: p.member_name })),
      unread: unread > 0,
      unreadCount: unread,
    };
  });
}

/** Confirm the actor is a participant of the thread (by id or email). */
async function assertParticipant(db, actor, threadId) {
  const ors = [`member_profile_id.eq.${actor.profileId}`];
  if (actor.email) ors.push(`member_email.eq.${actor.email}`);
  const { data, error } = await db
    .from('team_thread_participants')
    .select('id')
    .eq('tenant_id', actor.tenantId)
    .eq('thread_id', threadId)
    .or(ors.join(','))
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

/**
 * Messages for one thread: all SENT messages, plus the actor's OWN drafts and
 * scheduled messages (other people's drafts/scheduled stay private). Oldest
 * first. Also returns the thread's participants. Returns null if the actor is
 * not a participant (caller maps to 403/404).
 */
export async function getThreadMessages(threadId, actor) {
  const db = actor.db;
  const ok = await assertParticipant(db, actor, threadId);
  if (!ok) return null;

  const { data: thread, error: tErr } = await db
    .from('team_threads')
    .select('id, subject, created_by, last_message_at, last_preview, created_at')
    .eq('tenant_id', actor.tenantId)
    .eq('id', threadId)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!thread) return null;

  const { data: parts, error: pErr } = await db
    .from('team_thread_participants')
    .select('member_profile_id, member_email, member_name, last_read_at')
    .eq('tenant_id', actor.tenantId)
    .eq('thread_id', threadId);
  if (pErr) throw pErr;

  // sent (everyone's) OR (the actor's own drafts/scheduled).
  const { data: rows, error: mErr } = await db
    .from('team_messages')
    .select('id, thread_id, sender_profile_id, sender_name, body, attachments, status, send_at, edited_at, deleted_at, created_at')
    .eq('tenant_id', actor.tenantId)
    .eq('thread_id', threadId)
    .or(`status.eq.sent,and(sender_profile_id.eq.${actor.profileId},status.in.(draft,scheduled))`)
    .order('created_at', { ascending: true })
    .limit(2000);
  if (mErr) throw mErr;

  // Delete-for-me: which of these messages has the actor hidden?
  const rowIds = (rows || []).map((m) => m.id);
  const hiddenIds = new Set();
  if (rowIds.length) {
    const { data: hidden, error: hErr } = await db
      .from('team_message_hidden')
      .select('message_id')
      .eq('tenant_id', actor.tenantId)
      .eq('member_profile_id', actor.profileId)
      .in('message_id', rowIds);
    if (hErr) throw hErr;
    for (const h of hidden || []) hiddenIds.add(h.message_id);
  }

  const messages = (rows || [])
    .filter((m) => !hiddenIds.has(m.id)) // hidden-for-me → omit entirely
    .map((m) => {
      // Delete-for-everyone → tombstone shape; body + attachments suppressed.
      if (m.deleted_at) {
        return {
          id: m.id,
          threadId: m.thread_id,
          senderProfileId: m.sender_profile_id,
          senderName: m.sender_name,
          deleted: true,
          createdAt: m.created_at,
          mine: m.sender_profile_id === actor.profileId,
        };
      }
      return {
        id: m.id,
        threadId: m.thread_id,
        senderProfileId: m.sender_profile_id,
        senderName: m.sender_name,
        body: m.body,
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
        status: m.status,
        sendAt: m.send_at || null,
        editedAt: m.edited_at || null,
        createdAt: m.created_at,
        mine: m.sender_profile_id === actor.profileId,
      };
    });

  return {
    thread: {
      id: thread.id,
      subject: thread.subject || null,
      lastMessageAt: thread.last_message_at || null,
      lastPreview: thread.last_preview || null,
      createdAt: thread.created_at,
    },
    participants: (parts || []).map((p) => ({
      profileId: p.member_profile_id,
      email: p.member_email,
      name: p.member_name,
      lastReadAt: p.last_read_at || null,
    })),
    messages,
  };
}

/** Dedupe recipients and drop the actor; returns [{ profileId, email, name }]. */
function normalizeRecipients(actor, recipients = []) {
  const recById = new Map();
  for (const r of recipients) {
    const pid = r?.profileId || null;
    const email = (r?.email || '').trim().toLowerCase() || null;
    if (pid && pid === actor.profileId) continue;
    if (email && email === actor.email) continue;
    const key = pid || email;
    if (!key) continue;
    if (!recById.has(key)) recById.set(key, { profileId: pid, email, name: r?.name || email || 'Teammate' });
  }
  return [...recById.values()];
}

/** Build the participant insert rows for a brand-new thread (actor + recipients). */
function buildParticipantRows(actor, threadId, recList, now) {
  return [
    { thread_id: threadId, tenant_id: actor.tenantId, member_profile_id: actor.profileId, member_email: actor.email, member_name: actor.name, last_read_at: now },
    ...recList.map((r) => ({
      thread_id: threadId,
      tenant_id: actor.tenantId,
      member_profile_id: r.profileId || null,
      member_email: r.email || null,
      member_name: r.name || null,
    })),
  ];
}

/**
 * Create OR find a thread for a compose action. The shape decides the behaviour:
 *
 *   - 1:1  (exactly one recipient AND no subject)  → find-or-create-direct dedupe:
 *           re-composing to the same teammate returns the existing direct thread.
 *   - GROUP (2+ recipients OR a non-empty subject) → ALWAYS create a new thread
 *           with the subject and all participants. Group threads are never deduped.
 *
 * `recipients` is an array of { profileId, email, name } drawn from the
 * staff/admin roster (team-core). Returns the thread id.
 */
export async function createThread(actor, { recipients = [], subject = null } = {}) {
  const db = actor.db;
  const subj = String(subject || '').trim() || null;
  const recList = normalizeRecipients(actor, recipients);
  if (!recList.length) throw new Error('no_valid_recipients');

  const isGroup = recList.length >= 2 || Boolean(subj);
  const now = new Date().toISOString();

  // 1:1 with no subject → reuse the existing direct thread if one exists.
  if (!isGroup) {
    const ids = await actorThreadIds(db, actor);
    if (ids.length) {
      const { data: parts, error } = await db
        .from('team_thread_participants')
        .select('thread_id, member_profile_id, member_email')
        .eq('tenant_id', actor.tenantId)
        .in('thread_id', ids);
      if (error) throw error;
      // Only direct (no-subject) threads are eligible for dedupe.
      const { data: subjThreads } = await db
        .from('team_threads')
        .select('id, subject')
        .eq('tenant_id', actor.tenantId)
        .in('id', ids);
      const subjectById = new Map((subjThreads || []).map((t) => [t.id, t.subject]));
      const byThread = new Map();
      for (const p of parts || []) {
        if (!byThread.has(p.thread_id)) byThread.set(p.thread_id, new Set());
        byThread.get(p.thread_id).add(p.member_profile_id || `email:${p.member_email}`);
      }
      const wantKeys = new Set([
        actor.profileId,
        ...recList.map((r) => r.profileId || `email:${r.email}`),
      ]);
      for (const [tid, set] of byThread) {
        if (subjectById.get(tid)) continue; // skip group threads
        if (set.size === wantKeys.size && [...wantKeys].every((k) => set.has(k))) {
          return tid;
        }
      }
    }
  }

  // Create the thread (group always lands here; 1:1 lands here if no match).
  const { data: created, error: cErr } = await db
    .from('team_threads')
    .insert({ tenant_id: actor.tenantId, subject: subj, created_by: actor.profileId, created_at: now, updated_at: now })
    .select('id')
    .maybeSingle();
  if (cErr) throw cErr;
  const threadId = created?.id;
  if (!threadId) throw new Error('thread_create_failed');

  const { error: pErr } = await db
    .from('team_thread_participants')
    .insert(buildParticipantRows(actor, threadId, recList, now));
  if (pErr) throw pErr;
  return threadId;
}

/**
 * Back-compat shim. Equivalent to createThread with no subject. Kept so any
 * older caller keeps working; new code should call createThread directly.
 */
export async function createOrFindDirectThread(actor, recipients = []) {
  return createThread(actor, { recipients, subject: null });
}

/**
 * Insert a message. status:
 *   - 'draft'      → saved, only the sender sees it; thread NOT bumped.
 *   - 'scheduled'  → has a future send_at; only the sender sees it until flush.
 *   - 'sent'       → visible to all participants; bumps thread last_message.
 * Returns the inserted message row (normalized).
 */
export async function insertMessage({ threadId, actor, body, status = 'sent', sendAt = null, attachments = [] }) {
  const db = actor.db;
  const text = String(body || '').trim();
  const atts = sanitizeAttachments(attachments);
  // A message must carry text OR at least one attachment.
  if (!text && !atts.length) throw new Error('body_required');
  if (text.length > 4000) throw new Error('body_too_long');

  const now = new Date().toISOString();
  const row = {
    thread_id: threadId,
    tenant_id: actor.tenantId,
    sender_profile_id: actor.profileId,
    sender_name: actor.name,
    body: text,
    attachments: atts,
    status,
    send_at: status === 'scheduled' ? sendAt : null,
    created_at: now,
  };
  const { data, error } = await db.from('team_messages').insert(row).select('*').maybeSingle();
  if (error) throw error;

  if (status === 'sent') {
    await db.from('team_threads')
      .update({ last_message_at: now, last_preview: preview(text) || (atts.length ? '📷 Photo' : ''), updated_at: now })
      .eq('tenant_id', actor.tenantId).eq('id', threadId);
    // Sending also marks the thread read for the sender.
    await markThreadRead(threadId, actor);
  }

  return normalizeMessage(data, actor);
}

/** Coerce an attachments array into the stored shape; drop anything malformed. */
function sanitizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .map((a) => {
      const url = String(a?.url || '').trim();
      if (!url) return null;
      const out = { url, name: String(a?.name || 'image').slice(0, 200), type: String(a?.type || 'image/*').slice(0, 100) };
      if (Number.isFinite(a?.width)) out.width = Math.round(a.width);
      if (Number.isFinite(a?.height)) out.height = Math.round(a.height);
      return out;
    })
    .filter(Boolean)
    .slice(0, 10);
}

/**
 * Update the body of a message the actor owns. Sender-only; sets edited_at.
 * Works for sent messages and the actor's own drafts/scheduled. Returns the
 * updated row, or null if the message isn't found / isn't the actor's.
 */
export async function updateMessage({ messageId, actor, body }) {
  const db = actor.db;
  const text = String(body || '').trim();
  if (!text) throw new Error('body_required');
  if (text.length > 4000) throw new Error('body_too_long');

  const { data: existing, error: eErr } = await db
    .from('team_messages')
    .select('id, thread_id, sender_profile_id, status, deleted_at')
    .eq('tenant_id', actor.tenantId)
    .eq('id', messageId)
    .maybeSingle();
  if (eErr) throw eErr;
  if (!existing || existing.sender_profile_id !== actor.profileId) return null;
  if (existing.deleted_at) throw new Error('message_deleted');

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('team_messages')
    .update({ body: text, edited_at: now })
    .eq('tenant_id', actor.tenantId)
    .eq('id', messageId)
    .eq('sender_profile_id', actor.profileId)
    .select('*')
    .maybeSingle();
  if (error) throw error;

  // If the edited message is the thread's latest sent message, refresh preview.
  if (existing.status === 'sent') {
    const { data: latest } = await db
      .from('team_messages')
      .select('id, body')
      .eq('tenant_id', actor.tenantId)
      .eq('thread_id', existing.thread_id)
      .eq('status', 'sent')
      .order('created_at', { ascending: false })
      .limit(1);
    if (latest?.[0]?.id === messageId) {
      await db.from('team_threads')
        .update({ last_preview: preview(text), updated_at: now })
        .eq('tenant_id', actor.tenantId).eq('id', existing.thread_id);
    }
  }

  return normalizeMessage(data, actor);
}

/**
 * Delete-for-everyone (tombstone). Sender-only: the actor must be the message's
 * sender. The row is kept but stamped deleted_at, body cleared, attachments
 * dropped — getThreadMessages renders it as { deleted:true }. If this was the
 * thread's latest sent message, the preview is refreshed to the next live one.
 * Returns true on success, null if not found / not the sender.
 */
export async function deleteForEveryone(messageId, actor) {
  const db = actor.db;
  const { data: existing, error: eErr } = await db
    .from('team_messages')
    .select('id, thread_id, sender_profile_id, status, deleted_at')
    .eq('tenant_id', actor.tenantId)
    .eq('id', messageId)
    .maybeSingle();
  if (eErr) throw eErr;
  if (!existing || existing.sender_profile_id !== actor.profileId) return null;
  if (existing.deleted_at) return true; // idempotent

  const now = new Date().toISOString();
  const { error } = await db
    .from('team_messages')
    .update({ deleted_at: now, body: '', attachments: [] })
    .eq('tenant_id', actor.tenantId)
    .eq('id', messageId)
    .eq('sender_profile_id', actor.profileId);
  if (error) throw error;

  // Refresh the thread preview from the newest non-deleted sent message.
  if (existing.status === 'sent') {
    const { data: latest } = await db
      .from('team_messages')
      .select('id, body, attachments')
      .eq('tenant_id', actor.tenantId)
      .eq('thread_id', existing.thread_id)
      .eq('status', 'sent')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    const next = latest?.[0];
    const nextPreview = next
      ? (preview(next.body) || (Array.isArray(next.attachments) && next.attachments.length ? '📷 Photo' : ''))
      : '';
    await db.from('team_threads')
      .update({ last_preview: nextPreview, updated_at: now })
      .eq('tenant_id', actor.tenantId).eq('id', existing.thread_id);
  }
  return true;
}

/**
 * Delete-for-me. Hides the message for the actor only (insert into
 * team_message_hidden). The message stays visible to everyone else. Idempotent
 * via the unique(message_id, member_profile_id) constraint. Returns true if the
 * actor can see the message (is a participant), null otherwise.
 */
export async function hideForMe(messageId, actor) {
  const db = actor.db;
  const { data: msg, error: mErr } = await db
    .from('team_messages')
    .select('id, thread_id')
    .eq('tenant_id', actor.tenantId)
    .eq('id', messageId)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!msg) return null;
  const ok = await assertParticipant(db, actor, msg.thread_id);
  if (!ok) return null;

  const { error } = await db
    .from('team_message_hidden')
    .upsert(
      { message_id: messageId, member_profile_id: actor.profileId, tenant_id: actor.tenantId },
      { onConflict: 'message_id,member_profile_id', ignoreDuplicates: true },
    );
  if (error) throw error;
  return true;
}

/** Stamp the actor's participant row(s) for a thread as read now. */
export async function markThreadRead(threadId, actor) {
  const db = actor.db;
  const now = new Date().toISOString();
  const ors = [`member_profile_id.eq.${actor.profileId}`];
  if (actor.email) ors.push(`member_email.eq.${actor.email}`);
  const { error } = await db
    .from('team_thread_participants')
    .update({ last_read_at: now })
    .eq('tenant_id', actor.tenantId)
    .eq('thread_id', threadId)
    .or(ors.join(','));
  if (error) throw error;
  return true;
}

/**
 * Promote any scheduled messages whose send_at has passed to 'sent', bumping
 * their thread's last_message_at/last_preview. Tenant-scoped; idempotent. Called
 * at the top of read routes so scheduled messages "arrive" without a cron.
 */
export async function flushDueScheduled(tenantId) {
  const db = await getServiceClient();
  if (!db || !tenantId) return 0;
  const now = new Date().toISOString();
  const { data: due, error } = await db
    .from('team_messages')
    .select('id, thread_id, body, send_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'scheduled')
    .lte('send_at', now)
    .limit(500);
  if (error || !due?.length) return 0;

  for (const m of due) {
    // Promote, guarding on status so two concurrent flushes don't double-bump.
    const { data: promoted } = await db
      .from('team_messages')
      .update({ status: 'sent', created_at: m.send_at || now })
      .eq('tenant_id', tenantId)
      .eq('id', m.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();
    if (!promoted) continue;
    await db.from('team_threads')
      .update({ last_message_at: m.send_at || now, last_preview: preview(m.body), updated_at: now })
      .eq('tenant_id', tenantId)
      .eq('id', m.thread_id);
  }
  return due.length;
}

/** Total unread (sent, not-mine, after last_read) across all the actor's threads. */
export async function countUnreadForMember(actor) {
  const threads = await listThreadsForMember(actor);
  return threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
}

function normalizeMessage(m, actor) {
  if (!m) return null;
  if (m.deleted_at) {
    return {
      id: m.id,
      threadId: m.thread_id,
      senderProfileId: m.sender_profile_id,
      senderName: m.sender_name,
      deleted: true,
      createdAt: m.created_at,
      mine: m.sender_profile_id === actor.profileId,
    };
  }
  return {
    id: m.id,
    threadId: m.thread_id,
    senderProfileId: m.sender_profile_id,
    senderName: m.sender_name,
    body: m.body,
    attachments: Array.isArray(m.attachments) ? m.attachments : [],
    status: m.status,
    sendAt: m.send_at || null,
    editedAt: m.edited_at || null,
    createdAt: m.created_at,
    mine: m.sender_profile_id === actor.profileId,
  };
}

export { futureIso, getTeamMember };
