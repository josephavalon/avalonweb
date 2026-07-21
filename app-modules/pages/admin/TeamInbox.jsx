/**
 * TeamInbox — /admin/team-inbox  ("My inbox")
 *
 * Internal staff messenger: admin <-> admin and staff <-> staff. This is the
 * personal inbox, distinct from the client comms surfaces (/admin/messages,
 * /admin/inbox) which talk to patients. It rides the NEW service-role team-
 * messages API (replacing the old Supabase-realtime useMessages() path):
 *
 *   GET  /api/admin/team-messages/threads
 *   GET  /api/admin/team-messages/thread?threadId=
 *   POST /api/admin/team-messages/send     (new thread / reply / draft / schedule)
 *   POST /api/admin/team-messages/update   (edit a message body)
 *   POST /api/admin/team-messages/delete   (scope: me | everyone)
 *   POST /api/admin/team-messages/upload   (image data URL -> hosted attachment)
 *
 * Left: thread list (polled ~9s while open). Right: the thread with iMessage
 * bubbles + a composer. "New" opens a recipient picker (1 = direct, 2+ = group
 * with an optional group name). Messages support image attachments, edit,
 * delete (me / everyone), drafts, and scheduled send.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  ImagePlus,
  Inbox as InboxIcon,
  Loader2,
  MoreHorizontal,
  PenSquare,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet, apiPost } from '@/lib/apiClient';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.4)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.08)';
const BORDER = 'hsl(var(--foreground) / 0.1)';
const ACCENT = 'hsl(211 100% 52%)'; // iMessage blue (sent bubble + send button)
const DANGER = 'hsl(0 70% 62%)';

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtSchedule(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function Avatar({ name, size = 36 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-body font-semibold"
      style={{ width: size, height: size, background: CARD_STRONG, border: `1px solid ${BORDER}`, color: MUTED, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

function threadTitle(t) {
  if (!t) return 'Conversation';
  if (t.title) return t.title;
  const names = (t.participants || []).map((p) => p.full_name || p.name || p.email).filter(Boolean);
  return names.join(', ') || 'Conversation';
}

function ThreadRow({ thread, active, onClick }) {
  const title = threadTitle(thread);
  const unread = Boolean(thread.unread || thread.unreadCount);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors"
      style={{ borderColor: BORDER, background: active ? CARD_STRONG : 'transparent' }}
    >
      <Avatar name={title} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-body text-sm font-semibold" style={{ color: TEXT }}>{title}</span>
          <span className="shrink-0 font-body text-[10px]" style={{ color: DIM }}>{fmtTime(thread.last_message_at)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className="truncate font-body text-xs" style={{ color: unread ? TEXT : DIM }}>{thread.last_preview || 'No messages yet'}</span>
          {unread ? (
            thread.unreadCount > 1
              ? <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 font-body text-[10px] font-bold" style={{ background: ACCENT, color: '#fff' }}>{thread.unreadCount}</span>
              : <span className="ml-auto h-2 w-2 shrink-0 rounded-full" style={{ background: ACCENT }} />
          ) : null}
        </span>
      </span>
    </button>
  );
}

// One image attachment inside a bubble.
function AttachmentImg({ att }) {
  if (!att?.url) return null;
  return (
    <a href={att.url} target="_blank" rel="noreferrer" className="block">
      <img
        src={att.url}
        alt={att.name || 'attachment'}
        className="max-h-60 max-w-full rounded-xl object-cover"
        style={{ border: `1px solid ${BORDER}` }}
      />
    </a>
  );
}

function Bubble({
  msg,
  senderName,
  onStartEdit,
  onDeleteMe,
  onDeleteEveryone,
  editing,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
  onPromoteDraft,
  savingEdit,
}) {
  const mine = msg.mine;
  const [menu, setMenu] = useState(false);
  const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;
  const isScheduled = msg.status === 'scheduled' && msg.sendAt;
  const isDraft = msg.status === 'draft';

  if (msg.deleted) {
    return (
      <div className="flex flex-col" style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <div
          className="max-w-[76%] rounded-2xl px-3.5 py-2 font-body text-xs italic"
          style={{ background: 'transparent', color: DIM, border: `1px dashed ${BORDER}` }}
        >
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col" style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
      {!mine && senderName ? (
        <span className="mb-0.5 px-1 font-body text-[10px]" style={{ color: DIM }}>{senderName}</span>
      ) : null}

      {(isDraft || isScheduled) ? (
        <span className="mb-0.5 px-1 font-body text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: isScheduled ? ACCENT : DIM }}>
          {isDraft ? 'Draft' : `Scheduled · ${fmtSchedule(msg.sendAt)}`}
        </span>
      ) : null}

      <div className="flex max-w-[82%] items-end gap-1.5" style={{ flexDirection: mine ? 'row-reverse' : 'row' }}>
        <div
          className="min-w-0 rounded-2xl px-3.5 py-2 font-body text-sm leading-snug"
          style={mine
            ? { background: ACCENT, color: '#fff', borderBottomRightRadius: 6 }
            : { background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}`, borderBottomLeftRadius: 6 }}
        >
          {editing ? (
            <div className="flex flex-col gap-2" style={{ minWidth: 180 }}>
              <textarea
                value={editValue}
                onChange={(e) => onEditChange(e.target.value)}
                rows={2}
                className="resize-none rounded-lg px-2 py-1 font-body text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.15)', color: mine ? '#fff' : TEXT }}
              />
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={onEditCancel} className="font-body text-[11px] underline opacity-80">Cancel</button>
                <button
                  type="button"
                  onClick={onEditSave}
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-body text-[11px] font-semibold"
                  style={{ background: mine ? 'rgba(255,255,255,0.22)' : ACCENT, color: '#fff' }}
                >
                  {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : <Check className="h-3 w-3" strokeWidth={2.4} />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {hasAttachments ? (
                <div className="mb-1 flex flex-col gap-1.5">
                  {msg.attachments.map((att, i) => <AttachmentImg key={att.url || i} att={att} />)}
                </div>
              ) : null}
              {msg.body ? (
                <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.body}</span>
              ) : null}
              <span className="mt-1 block text-right font-body text-[9px]" style={{ color: mine ? 'rgba(255,255,255,0.7)' : DIM }}>
                {msg.editedAt ? 'edited · ' : ''}{fmtTime(msg.createdAt || msg.sendAt)}
              </span>
            </>
          )}
        </div>

        {/* Per-message action menu */}
        {!editing ? (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenu((m) => !m)}
              className="flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 hover:bg-foreground/10"
              style={{ color: DIM }}
              aria-label="Message actions"
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
            {menu ? (
              <>
                <button type="button" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} aria-label="Close menu" />
                <div
                  className="absolute z-20 mt-1 w-44 overflow-hidden rounded-xl border shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
                  style={{ background: BG, borderColor: BORDER, [mine ? 'right' : 'left']: 0 }}
                >
                  {isDraft && mine ? (
                    <button type="button" onClick={() => { setMenu(false); onPromoteDraft(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-xs hover:bg-foreground/[0.05]" style={{ color: TEXT }}>
                      <Send className="h-3.5 w-3.5" strokeWidth={1.9} /> Send now
                    </button>
                  ) : null}
                  {mine ? (
                    <button type="button" onClick={() => { setMenu(false); onStartEdit(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-xs hover:bg-foreground/[0.05]" style={{ color: TEXT }}>
                      <PenSquare className="h-3.5 w-3.5" strokeWidth={1.9} /> Edit
                    </button>
                  ) : null}
                  <button type="button" onClick={() => { setMenu(false); onDeleteMe(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-xs hover:bg-foreground/[0.05]" style={{ color: TEXT }}>
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} /> Delete for me
                  </button>
                  {mine ? (
                    <button type="button" onClick={() => { setMenu(false); onDeleteEveryone(); }} className="flex w-full items-center gap-2 border-t px-3 py-2 text-left font-body text-xs hover:bg-foreground/[0.05]" style={{ color: DANGER, borderColor: BORDER }}>
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} /> Delete for everyone
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Composer for a NEW message (recipient picker + group name + body + attachments
// + send/draft/schedule). Lives at the top of the thread pane when "New" is hit.
function NewComposer({ roster, me, onSent, onCancel }) {
  const [query, setQuery] = useState('');
  const [recipients, setRecipients] = useState([]); // array of roster entries
  const [groupName, setGroupName] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]); // [{url,name,type}]
  const [scheduleAt, setScheduleAt] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const isGroup = recipients.length >= 2;

  // Helper: roster entries may carry `name` (current API), `full_name`
  // (legacy), or just `email`. Normalize once so both search + display
  // work whichever shape the API emits.
  const displayName = (m) => m?.name || m?.full_name || m?.email || '';

  const pickList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chosen = new Set(recipients.map((r) => r.id));
    return (roster || [])
      .filter((m) => m.id !== me?.id && !chosen.has(m.id))
      .filter((m) => !q || displayName(m).toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q));
  }, [roster, query, recipients, me]);

  const addRecipient = (m) => { setRecipients((r) => [...r, m]); setQuery(''); };
  const removeRecipient = (id) => setRecipients((r) => r.filter((x) => x.id !== id));

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(f);
        });
        const res = await apiPost('/api/admin/team-messages/upload', { dataUrl, name: f.name });
        if (res?.url) setAttachments((a) => [...a, { url: res.url, name: res.name || f.name, type: res.type || f.type }]);
      } catch {
        setError('Could not upload image.');
      }
    }
  };

  const removeAttachment = (url) => setAttachments((a) => a.filter((x) => x.url !== url));

  const canSend = recipients.length > 0 && (body.trim() || attachments.length > 0);

  const submit = async (mode) => {
    setError('');
    if (recipients.length === 0) { setError('Pick at least one teammate.'); return; }
    if (mode === 'send' && !body.trim() && attachments.length === 0) { setError('Add a message or an image.'); return; }
    if (mode === 'schedule' && !scheduleAt) { setError('Pick a date & time.'); return; }
    setBusy(mode);
    const payload = {
      recipientProfileIds: recipients.map((r) => r.id),
      body: body.trim() || undefined,
      attachments: attachments.length ? attachments : undefined,
    };
    if (isGroup && groupName.trim()) payload.subject = groupName.trim();
    if (mode === 'draft') payload.saveDraft = true;
    if (mode === 'schedule') payload.sendAt = new Date(scheduleAt).toISOString();
    try {
      const res = await apiPost('/api/admin/team-messages/send', payload);
      onSent(res?.threadId || res?.thread?.id || null);
    } catch (err) {
      setError(err?.body?.error || 'Could not send.');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: BORDER }}>
        <button type="button" onClick={onCancel} className="text-foreground/60 md:hidden" aria-label="Back">
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <p className="font-body text-sm font-semibold">New message</p>
        <button type="button" onClick={onCancel} className="ml-auto text-foreground/50 hover:text-foreground" aria-label="Close">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Recipient chips + search */}
      <div className="border-b px-4 py-2.5" style={{ borderColor: BORDER }}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-body text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: DIM }}>To:</span>
          {recipients.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-xs" style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}>
              {displayName(r)}
              <button type="button" onClick={() => removeRecipient(r.id)} aria-label="Remove"><X className="h-3 w-3" strokeWidth={2.2} /></button>
            </span>
          ))}
          <span className="inline-flex min-w-[120px] flex-1 items-center gap-1">
            <Search className="h-3.5 w-3.5" strokeWidth={1.8} style={{ color: DIM }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teammates…"
              className="w-full bg-transparent font-body text-sm outline-none"
              style={{ color: TEXT }}
            />
          </span>
        </div>
      </div>

      {/* Dropdown of matches — auto-shows the full team roster as soon as
          the composer opens (no need to type first). Hidden only when the
          roster is empty or fully exhausted by current recipients. */}
      {pickList.length > 0 ? (
        <div className="max-h-44 overflow-y-auto border-b" style={{ borderColor: BORDER }}>
          {pickList.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => addRecipient(m)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-foreground/[0.04]"
            >
              <Avatar name={displayName(m)} size={28} />
              <span className="min-w-0">
                <span className="block truncate font-body text-sm font-semibold" style={{ color: TEXT }}>{displayName(m)}</span>
                <span className="block truncate font-body text-[10px] uppercase tracking-[0.12em]" style={{ color: DIM }}>{m.role}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        roster && roster.length > 0 ? (
          <div className="border-b px-4 py-3" style={{ borderColor: BORDER }}>
            <p className="font-body text-xs" style={{ color: DIM }}>No teammates match "{query}".</p>
          </div>
        ) : (
          <div className="border-b px-4 py-3" style={{ borderColor: BORDER }}>
            <p className="font-body text-xs" style={{ color: DIM }}>No other teammates on this account yet.</p>
          </div>
        )
      )}

      {/* Group name (only when 2+ recipients) */}
      {isGroup ? (
        <div className="border-b px-4 py-2.5" style={{ borderColor: BORDER }}>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name (optional)"
            className="w-full bg-transparent font-body text-sm outline-none"
            style={{ color: TEXT }}
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {recipients.length === 0 ? (
          <p className="py-10 text-center font-body text-sm" style={{ color: DIM }}>Add a teammate to start.</p>
        ) : null}
      </div>

      {/* Composer footer */}
      <div className="border-t px-3 py-3" style={{ borderColor: BORDER }}>
        {error ? <p className="mb-2 font-body text-xs" style={{ color: DANGER }}>{error}</p> : null}

        {attachments.length ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a) => (
              <span key={a.url} className="relative">
                <img src={a.url} alt={a.name} className="h-16 w-16 rounded-lg object-cover" style={{ border: `1px solid ${BORDER}` }} />
                <button type="button" onClick={() => removeAttachment(a.url)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT }} aria-label="Remove image">
                  <X className="h-3 w-3" strokeWidth={2.4} />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {showSchedule ? (
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" strokeWidth={1.8} style={{ color: DIM }} />
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="rounded-lg px-2 py-1 font-body text-xs outline-none"
              style={{ background: BG, color: TEXT, border: `1px solid ${BORDER}` }}
            />
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.06]" style={{ color: MUTED, border: `1px solid ${BORDER}` }} aria-label="Attach image">
            <ImagePlus className="h-4 w-4" strokeWidth={1.9} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={1}
            placeholder="Message your team…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl px-3.5 py-2.5 font-body text-sm outline-none"
            style={{ background: BG, color: TEXT, border: `1px solid hsl(var(--foreground) / 0.16)` }}
          />
          <button
            type="button"
            onClick={() => submit('send')}
            disabled={!canSend || Boolean(busy)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
            style={{ background: ACCENT, color: '#fff' }}
            aria-label="Send"
          >
            {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Send className="h-4 w-4" strokeWidth={2} />}
          </button>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => submit('draft')}
            disabled={recipients.length === 0 || Boolean(busy)}
            className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: MUTED }}
          >
            {busy === 'draft' ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => { if (showSchedule) submit('schedule'); else setShowSchedule(true); }}
            disabled={recipients.length === 0 || Boolean(busy)}
            className="inline-flex items-center gap-1 font-body text-[11px] font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: MUTED }}
          >
            <Clock className="h-3 w-3" strokeWidth={2} />
            {busy === 'schedule' ? 'Scheduling…' : (showSchedule ? 'Confirm schedule' : 'Schedule')}
          </button>
        </div>
      </div>
    </>
  );
}

export default function TeamInbox() {
  const [threads, setThreads] = useState([]);
  const [roster, setRoster] = useState([]);
  const [me, setMe] = useState(null);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const [activeId, setActiveId] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);

  const [composing, setComposing] = useState(false);
  const [mobileView, setMobileView] = useState('list'); // list | thread

  const [reply, setReply] = useState('');
  const [pending, setPending] = useState([]); // [{url,name,type}] reply attachments
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const scrollRef = useRef(null);
  const replyFileRef = useRef(null);

  const loadThreads = useCallback(async () => {
    try {
      const data = await apiGet('/api/admin/team-messages/threads');
      setThreads(Array.isArray(data?.threads) ? data.threads : []);
      if (Array.isArray(data?.roster)) setRoster(data.roster);
      if (data?.me) setMe(data.me);
    } catch {
      /* leave existing; empty state covers first load */
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const loadThread = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await apiGet(`/api/admin/team-messages/thread?threadId=${encodeURIComponent(id)}`);
      setActiveThread(data?.thread || null);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch {
      setError('Could not load this conversation.');
    }
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Poll: thread list always, active thread when open (~9s).
  useEffect(() => {
    const t = setInterval(() => {
      loadThreads();
      if (activeId) loadThread(activeId);
    }, 9000);
    return () => clearInterval(t);
  }, [activeId, loadThreads, loadThread]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const refreshAll = useCallback(() => {
    loadThreads();
    if (activeId) loadThread(activeId);
  }, [loadThreads, loadThread, activeId]);

  const openThread = (thread) => {
    setActiveId(thread.id);
    setActiveThread(thread);
    setComposing(false);
    setMobileView('thread');
    setError('');
    setEditingId(null);
    loadThread(thread.id);
    // optimistic unread clear
    setThreads((list) => list.map((t) => t.id === thread.id ? { ...t, unread: false, unreadCount: 0 } : t));
  };

  // Image attach for an inline reply (same flow as the new composer).
  const onReplyFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(f);
        });
        const res = await apiPost('/api/admin/team-messages/upload', { dataUrl, name: f.name });
        if (res?.url) setPending((a) => [...a, { url: res.url, name: res.name || f.name, type: res.type || f.type }]);
      } catch {
        setError('Could not upload image.');
      }
    }
  };

  const sendReply = useCallback(async () => {
    const text = reply.trim();
    if ((!text && pending.length === 0) || !activeId || sending) return;
    setSending(true);
    setError('');
    try {
      await apiPost('/api/admin/team-messages/send', {
        threadId: activeId,
        body: text || undefined,
        attachments: pending.length ? pending : undefined,
      });
      setReply('');
      setPending([]);
      refreshAll();
    } catch (err) {
      setError(err?.body?.error || 'Could not send.');
    } finally {
      setSending(false);
    }
  }, [reply, pending, activeId, sending, refreshAll]);

  const startEdit = (msg) => { setEditingId(msg.id); setEditValue(msg.body || ''); };
  const cancelEdit = () => { setEditingId(null); setEditValue(''); };
  const saveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    try {
      await apiPost('/api/admin/team-messages/update', { messageId: editingId, body: editValue });
      cancelEdit();
      refreshAll();
    } catch (err) {
      setError(err?.body?.error || 'Could not edit.');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteMsg = async (msg, scope) => {
    try {
      await apiPost('/api/admin/team-messages/delete', { messageId: msg.id, scope });
      refreshAll();
    } catch (err) {
      setError(err?.body?.error || 'Could not delete.');
    }
  };

  // Promote a draft to a real send (server clears the draft flag).
  const promoteDraft = async (msg) => {
    try {
      await apiPost('/api/admin/team-messages/send', {
        threadId: activeId,
        draftId: msg.id,
        body: msg.body || undefined,
        attachments: msg.attachments?.length ? msg.attachments : undefined,
      });
      refreshAll();
    } catch (err) {
      setError(err?.body?.error || 'Could not send draft.');
    }
  };

  const onNewSent = (threadId) => {
    setComposing(false);
    loadThreads();
    if (threadId) {
      setActiveId(threadId);
      setMobileView('thread');
      loadThread(threadId);
    } else {
      setMobileView('list');
    }
  };

  const activeTitle = threadTitle(activeThread);
  const canSendReply = Boolean(reply.trim() || pending.length);

  return (
    <AdminShell title="My inbox" fullBleed>
      <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-7 md:py-7">
        <div className="flex h-[74vh] min-h-0 overflow-hidden rounded-2xl border" style={{ background: BG, color: TEXT, borderColor: BORDER }}>
          {/* Thread list */}
          <aside
            className={`${mobileView === 'thread' ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r md:w-80`}
            style={{ borderColor: BORDER }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BORDER }}>
              <span className="font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Team</span>
              <button
                type="button"
                onClick={() => { setComposing(true); setMobileView('thread'); setActiveId(null); setActiveThread(null); setMessages([]); setError(''); }}
                className="inline-flex items-center gap-1.5 font-body text-xs font-semibold transition-opacity hover:opacity-70"
                style={{ color: TEXT }}
              >
                <PenSquare className="h-4 w-4" strokeWidth={1.9} /> New
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!loadingThreads && threads.length === 0 ? (
                <div className="px-4 py-16 text-center">
                  <InboxIcon className="mx-auto mb-3 h-6 w-6" strokeWidth={1.5} style={{ color: DIM }} />
                  <p className="font-body text-sm" style={{ color: MUTED }}>No conversations yet.</p>
                  <p className="mt-1 font-body text-xs" style={{ color: DIM }}>Hit “New” to message a teammate.</p>
                </div>
              ) : null}
              {threads.map((t) => (
                <ThreadRow key={t.id} thread={t} active={t.id === activeId} onClick={() => openThread(t)} />
              ))}
            </div>
          </aside>

          {/* Thread / composer */}
          <section className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} min-h-0 min-w-0 flex-1 flex-col`}>
            {composing ? (
              <NewComposer
                roster={roster}
                me={me}
                onSent={onNewSent}
                onCancel={() => { setComposing(false); setMobileView('list'); }}
              />
            ) : activeThread ? (
              <>
                <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: BORDER }}>
                  <button type="button" onClick={() => setMobileView('list')} className="text-foreground/60 md:hidden" aria-label="Back">
                    <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <Avatar name={activeTitle} size={30} />
                  <p className="truncate font-body text-sm font-semibold">{activeTitle}</p>
                </div>

                <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
                  {messages.length === 0 ? (
                    <p className="py-10 text-center font-body text-sm" style={{ color: DIM }}>No messages yet.</p>
                  ) : null}
                  {messages.map((m) => (
                    <Bubble
                      key={m.id}
                      msg={m}
                      senderName={m.senderName}
                      editing={editingId === m.id}
                      editValue={editValue}
                      onEditChange={setEditValue}
                      onEditSave={saveEdit}
                      onEditCancel={cancelEdit}
                      savingEdit={savingEdit}
                      onStartEdit={() => startEdit(m)}
                      onDeleteMe={() => deleteMsg(m, 'me')}
                      onDeleteEveryone={() => deleteMsg(m, 'everyone')}
                      onPromoteDraft={() => promoteDraft(m)}
                    />
                  ))}
                </div>

                <div className="border-t px-3 py-3" style={{ borderColor: BORDER }}>
                  {error ? <p className="mb-2 font-body text-xs" style={{ color: DANGER }}>{error}</p> : null}

                  {pending.length ? (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {pending.map((a) => (
                        <span key={a.url} className="relative">
                          <img src={a.url} alt={a.name} className="h-16 w-16 rounded-lg object-cover" style={{ border: `1px solid ${BORDER}` }} />
                          <button type="button" onClick={() => setPending((p) => p.filter((x) => x.url !== a.url))} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT }} aria-label="Remove image">
                            <X className="h-3 w-3" strokeWidth={2.4} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-end gap-2">
                    <button type="button" onClick={() => replyFileRef.current?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.06]" style={{ color: MUTED, border: `1px solid ${BORDER}` }} aria-label="Attach image">
                      <ImagePlus className="h-4 w-4" strokeWidth={1.9} />
                    </button>
                    <input ref={replyFileRef} type="file" accept="image/*" multiple className="hidden" onChange={onReplyFiles} />
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      rows={1}
                      placeholder="Message your team…"
                      className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl px-3.5 py-2.5 font-body text-sm outline-none"
                      style={{ background: BG, color: TEXT, border: `1px solid hsl(var(--foreground) / 0.16)` }}
                    />
                    <button
                      type="button"
                      onClick={sendReply}
                      disabled={!canSendReply || sending}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
                      style={{ background: ACCENT, color: '#fff' }}
                      aria-label="Send"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Send className="h-4 w-4" strokeWidth={2} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="hidden flex-1 items-center justify-center md:flex">
                <p className="font-body text-sm" style={{ color: DIM }}>Select a conversation, or start a new one.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
