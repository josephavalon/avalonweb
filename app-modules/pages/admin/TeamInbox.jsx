/**
 * TeamInbox — /admin/team-inbox  ("My inbox")
 *
 * Internal staff messenger: admin <-> admin and staff <-> staff. This is the
 * personal inbox, distinct from the client comms surfaces (/admin/messages,
 * /admin/inbox) which talk to patients. It rides the in-app messaging tables
 * (conversations / conversation_participants / messages) via the realtime
 * useMessages() hook — no new endpoints needed. The recipient picker is the
 * staff/admin roster from /api/admin/team/list.
 *
 * Left: conversation list. Right: the thread with bubbles + a composer.
 * New delivery arrives live over Supabase Realtime; opening a thread marks it
 * read (clears the unread badge in the profile dropdown).
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Send, Loader2, ArrowLeft, PenSquare, Inbox as InboxIcon, Search, X } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { useAuthStore } from '@/lib/useAuthStore';
import { useMessages } from '@/hooks/useMessages';
import { teamClient } from '@/lib/teamClient';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.4)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.08)';
const BORDER = 'hsl(var(--foreground) / 0.1)';
const ACCENT = 'hsl(150 60% 42%)';

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

function ConversationRow({ title, preview, time, unread, active, onClick }) {
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
          <span className="shrink-0 font-body text-[10px]" style={{ color: DIM }}>{time}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className="truncate font-body text-xs" style={{ color: unread ? TEXT : DIM }}>{preview || 'No messages yet'}</span>
          {unread ? <span className="ml-auto h-2 w-2 shrink-0 rounded-full" style={{ background: ACCENT }} /> : null}
        </span>
      </span>
    </button>
  );
}

function Bubble({ msg, mine, senderName }) {
  return (
    <div className="flex flex-col" style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
      {!mine && senderName ? (
        <span className="mb-0.5 px-1 font-body text-[10px]" style={{ color: DIM }}>{senderName}</span>
      ) : null}
      <div
        className="max-w-[76%] rounded-2xl px-3.5 py-2 font-body text-sm leading-snug"
        style={mine
          ? { background: ACCENT, color: '#fff', borderBottomRightRadius: 6 }
          : { background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}`, borderBottomLeftRadius: 6 }}
      >
        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.body}</span>
        <span className="mt-1 block text-right font-body text-[9px]" style={{ color: mine ? 'rgba(255,255,255,0.7)' : DIM }}>{fmtTime(msg.created_at)}</span>
      </div>
    </div>
  );
}

export default function TeamInbox() {
  const { user, authBackend } = useAuthStore();
  const isDemo = authBackend !== 'supabase';
  const userId = user?.id;

  const [activeId, setActiveId] = useState(null);
  const {
    conversations,
    messages,
    loading,
    sendMessage,
    markRead,
    startConversation,
  } = useMessages(activeId);

  const [roster, setRoster] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [mobileView, setMobileView] = useState('list'); // list | thread
  const [composing, setComposing] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const scrollRef = useRef(null);

  // Staff/admin roster — recipient picker + name resolution for bubbles.
  useEffect(() => {
    let alive = true;
    teamClient.list(isDemo)
      .then((data) => { if (alive) setRoster(Array.isArray(data?.members) ? data.members : []); })
      .catch(() => { /* roster optional; picker just shows empty */ });
    return () => { alive = false; };
  }, [isDemo]);

  const rosterById = useMemo(() => {
    const m = {};
    roster.forEach((r) => { m[r.id] = r; });
    return m;
  }, [roster]);

  const nameFor = useCallback((id) => {
    if (id === userId) return 'You';
    return rosterById[id]?.full_name || rosterById[id]?.email || 'Teammate';
  }, [rosterById, userId]);

  // Mark the active thread read once its messages are in view.
  useEffect(() => {
    if (activeId && messages.length) markRead();
  }, [activeId, messages.length, markRead]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const view = useMemo(() => conversations.map((c) => {
    const others = (c.conversation_participants || []).filter((p) => p.user_id !== userId);
    const title = c.subject || others.map((p) => nameFor(p.user_id)).join(', ') || 'Conversation';
    const mine = (c.conversation_participants || []).find((p) => p.user_id === userId);
    const unread = !mine?.last_read_at || (c.updated_at && new Date(c.updated_at) > new Date(mine.last_read_at));
    return { id: c.id, title, time: fmtTime(c.updated_at), unread };
  }), [conversations, userId, nameFor]);

  const activeConvo = conversations.find((c) => c.id === activeId) || null;
  const activeTitle = activeConvo
    ? (activeConvo.subject
      || (activeConvo.conversation_participants || []).filter((p) => p.user_id !== userId).map((p) => nameFor(p.user_id)).join(', ')
      || 'Conversation')
    : '';

  const openConversation = (id) => {
    setActiveId(id);
    setComposing(false);
    setMobileView('thread');
    setError('');
  };

  // Reuse an existing 1:1 thread with this teammate instead of stacking dupes.
  const findDirectWith = useCallback((otherId) => conversations.find((c) => {
    const ids = (c.conversation_participants || []).map((p) => p.user_id).sort();
    return c.type === 'direct' && ids.length === 2 && ids.includes(userId) && ids.includes(otherId);
  }), [conversations, userId]);

  const startWith = async (member) => {
    setError('');
    const existing = findDirectWith(member.id);
    if (existing) { openConversation(existing.id); return; }
    try {
      const id = await startConversation({ participants: [{ user_id: member.id, role: member.role || 'staff' }] });
      if (id) openConversation(id);
    } catch {
      setError('Could not start that conversation.');
    }
  };

  const send = useCallback(async () => {
    const text = reply.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setError('');
    try {
      await sendMessage(text);
      setReply('');
      markRead();
    } catch {
      setError('Could not send.');
    } finally {
      setSending(false);
    }
  }, [reply, activeId, sending, sendMessage, markRead]);

  const pickList = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return roster
      .filter((m) => m.id !== userId && m.status !== 'inactive')
      .filter((m) => !q || (m.full_name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q));
  }, [roster, pickerQuery, userId]);

  return (
    <AdminShell title="My inbox" fullBleed>
      <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-7 md:py-7">
        <div className="flex h-[74vh] min-h-0 overflow-hidden rounded-2xl border" style={{ background: BG, color: TEXT, borderColor: BORDER }}>
          {/* Conversation list */}
          <aside
            className={`${mobileView === 'thread' ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r md:w-80`}
            style={{ borderColor: BORDER }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BORDER }}>
              <span className="font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Team</span>
              <button
                type="button"
                onClick={() => { setComposing(true); setMobileView('thread'); setActiveId(null); }}
                className="inline-flex items-center gap-1.5 font-body text-xs font-semibold transition-opacity hover:opacity-70"
                style={{ color: TEXT }}
              >
                <PenSquare className="h-4 w-4" strokeWidth={1.9} /> New
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!loading && view.length === 0 ? (
                <div className="px-4 py-16 text-center">
                  <InboxIcon className="mx-auto mb-3 h-6 w-6" strokeWidth={1.5} style={{ color: DIM }} />
                  <p className="font-body text-sm" style={{ color: MUTED }}>No conversations yet.</p>
                  <p className="mt-1 font-body text-xs" style={{ color: DIM }}>Hit “New” to message a teammate.</p>
                </div>
              ) : null}
              {view.map((c) => (
                <ConversationRow
                  key={c.id}
                  title={c.title}
                  time={c.time}
                  unread={c.unread}
                  active={c.id === activeId}
                  onClick={() => openConversation(c.id)}
                />
              ))}
            </div>
          </aside>

          {/* Thread / composer */}
          <section className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} min-h-0 min-w-0 flex-1 flex-col`}>
            {composing ? (
              <>
                <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: BORDER }}>
                  <button type="button" onClick={() => { setComposing(false); setMobileView('list'); }} className="text-foreground/60 md:hidden" aria-label="Back">
                    <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <p className="font-body text-sm font-semibold">New message</p>
                  <button type="button" onClick={() => setComposing(false)} className="ml-auto text-foreground/50 hover:text-foreground" aria-label="Close">
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: BORDER }}>
                  <Search className="h-4 w-4" strokeWidth={1.8} style={{ color: DIM }} />
                  <input
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search teammates…"
                    className="w-full bg-transparent font-body text-sm outline-none"
                    style={{ color: TEXT }}
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {pickList.length === 0 ? (
                    <p className="px-4 py-10 text-center font-body text-sm" style={{ color: DIM }}>
                      {isDemo ? 'Team inbox needs a Supabase sign-in.' : 'No teammates found.'}
                    </p>
                  ) : pickList.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => startWith(m)}
                      className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-foreground/[0.04]"
                      style={{ borderColor: BORDER }}
                    >
                      <Avatar name={m.full_name || m.email} />
                      <span className="min-w-0">
                        <span className="block truncate font-body text-sm font-semibold" style={{ color: TEXT }}>{m.full_name || m.email}</span>
                        <span className="block truncate font-body text-[11px] uppercase tracking-[0.12em]" style={{ color: DIM }}>{m.role}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : activeConvo ? (
              <>
                <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: BORDER }}>
                  <button type="button" onClick={() => setMobileView('list')} className="text-foreground/60 md:hidden" aria-label="Back">
                    <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <Avatar name={activeTitle} size={30} />
                  <p className="truncate font-body text-sm font-semibold">{activeTitle}</p>
                </div>

                <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
                  {messages.map((m) => (
                    <Bubble key={m.id} msg={m} mine={m.sender_id === userId} senderName={nameFor(m.sender_id)} />
                  ))}
                </div>

                <div className="border-t px-3 py-3" style={{ borderColor: BORDER }}>
                  {error ? <p className="mb-2 font-body text-xs" style={{ color: 'hsl(0 70% 62%)' }}>{error}</p> : null}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                      rows={1}
                      placeholder="Message your team…"
                      className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl px-3.5 py-2.5 font-body text-sm outline-none"
                      style={{ background: BG, color: TEXT, border: `1px solid hsl(var(--foreground) / 0.16)` }}
                    />
                    <button
                      type="button"
                      onClick={send}
                      disabled={!reply.trim() || sending}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
                      style={{ background: TEXT, color: INVERT }}
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
