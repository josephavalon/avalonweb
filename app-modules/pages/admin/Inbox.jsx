/**
 * Inbox — /admin/inbox
 *
 * iMessage-style hub for client conversations. Threads come from the live
 * comm_threads store (outbound texts/emails you send + inbound replies via the
 * Quo webhook). Left: conversation list. Right: the thread with message bubbles
 * and a reply box. Replies go through the same guarded send endpoints, so they
 * stay PHI-free. Polls for new inbound while open.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Loader2, RefreshCw, MessageSquare, Mail, ArrowLeft, Inbox as InboxIcon } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet, apiPost } from '@/lib/apiClient';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.4)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.08)';
const BORDER = 'hsl(var(--foreground) / 0.1)';
const ACCENT = 'hsl(150 60% 42%)'; // outbound bubble (iMessage green-ish for SMS)

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

function ThreadRow({ thread, active, onClick }) {
  const Icon = thread.channel === 'email' ? Mail : MessageSquare;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors"
      style={{ borderColor: BORDER, background: active ? CARD_STRONG : 'transparent' }}
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
        <Icon className="h-4 w-4" strokeWidth={1.8} style={{ color: MUTED }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-body text-sm font-semibold" style={{ color: TEXT }}>{thread.customer_name || thread.contact}</span>
          <span className="shrink-0 font-body text-[10px]" style={{ color: DIM }}>{fmtTime(thread.last_message_at)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className="truncate font-body text-xs" style={{ color: thread.unread_count ? TEXT : DIM }}>
            {thread.last_direction === 'outbound' ? 'You: ' : ''}{thread.last_message_preview || '…'}
          </span>
          {thread.unread_count ? (
            <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 font-body text-[10px] font-bold" style={{ background: ACCENT, color: '#fff' }}>{thread.unread_count}</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function Bubble({ msg }) {
  const mine = msg.direction === 'outbound';
  return (
    <div className="flex" style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}>
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

export default function Inbox() {
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [mobileView, setMobileView] = useState('list'); // list | thread
  const scrollRef = useRef(null);

  const loadThreads = useCallback(async () => {
    try {
      const data = await apiGet('/api/admin/communications/threads');
      setThreads(Array.isArray(data?.threads) ? data.threads : []);
    } catch {
      setError('Could not load conversations.');
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const loadThread = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await apiGet(`/api/admin/communications/thread?threadId=${encodeURIComponent(id)}`);
      setActiveThread(data?.thread || null);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch {
      setError('Could not load this conversation.');
    }
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Poll: thread list always, active thread when open.
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

  const openThread = (thread) => {
    setActiveId(thread.id);
    setActiveThread(thread);
    setMobileView('thread');
    setError('');
    loadThread(thread.id);
    // optimistic unread clear
    setThreads((list) => list.map((t) => t.id === thread.id ? { ...t, unread_count: 0 } : t));
  };

  const sendReply = useCallback(async () => {
    const text = reply.trim();
    if (!text || !activeThread || sending) return;
    setSending(true);
    setError('');
    const endpoint = activeThread.channel === 'email' ? '/api/admin/communications/send-email' : '/api/admin/communications/send-sms';
    try {
      const res = await apiPost(endpoint, { to: activeThread.contact, body: text, name: activeThread.customer_name || undefined });
      if (res?.ok) {
        setReply('');
        // optimistic append; the poll/refetch will reconcile
        setMessages((m) => [...m, { id: `tmp-${m.length}`, direction: 'outbound', channel: activeThread.channel, body: text, created_at: new Date().toISOString() }]);
        loadThread(activeThread.id);
        loadThreads();
      } else {
        setError(res?.error || 'Could not send.');
      }
    } catch (err) {
      setError(err?.body?.error || 'Could not send.');
    } finally {
      setSending(false);
    }
  }, [reply, activeThread, sending, loadThread, loadThreads]);

  const isEmail = activeThread?.channel === 'email';

  return (
    <AdminShell title="Inbox" fullBleed>
      <div className="flex min-h-0 flex-1 md:h-full" style={{ background: BG, color: TEXT }}>
        {/* Thread list */}
        <aside
          className={`${mobileView === 'thread' ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r md:w-80`}
          style={{ borderColor: BORDER }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BORDER }}>
            <span className="font-body text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Conversations</span>
            <button type="button" onClick={loadThreads} className="text-foreground/50 hover:text-foreground" aria-label="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${loadingThreads ? 'animate-spin' : ''}`} strokeWidth={2} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!loadingThreads && threads.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <InboxIcon className="mx-auto mb-3 h-6 w-6" strokeWidth={1.5} style={{ color: DIM }} />
                <p className="font-body text-sm" style={{ color: MUTED }}>No conversations yet.</p>
                <p className="mt-1 font-body text-xs" style={{ color: DIM }}>Texts you send and client replies will appear here.</p>
              </div>
            ) : null}
            {threads.map((t) => (
              <ThreadRow key={t.id} thread={t} active={t.id === activeId} onClick={() => openThread(t)} />
            ))}
          </div>
        </aside>

        {/* Thread view */}
        <section className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} min-h-0 min-w-0 flex-1 flex-col`}>
          {activeThread ? (
            <>
              <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: BORDER }}>
                <button type="button" onClick={() => setMobileView('list')} className="text-foreground/60 md:hidden" aria-label="Back">
                  <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                </button>
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-semibold">{activeThread.customer_name || activeThread.contact}</p>
                  <p className="truncate font-body text-[11px]" style={{ color: DIM }}>
                    {isEmail ? <Mail className="mr-1 inline h-3 w-3" strokeWidth={1.8} /> : <MessageSquare className="mr-1 inline h-3 w-3" strokeWidth={1.8} />}
                    {activeThread.contact}
                  </p>
                </div>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
                {messages.map((m) => <Bubble key={m.id} msg={m} />)}
              </div>

              <div className="border-t px-3 py-3" style={{ borderColor: BORDER }}>
                {error ? <p className="mb-2 font-body text-xs" style={{ color: 'hsl(0 70% 62%)' }}>{error}</p> : null}
                <div className="flex items-end gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    rows={1}
                    placeholder={isEmail ? 'Reply by email (non-clinical)…' : 'Reply by text (non-clinical)…'}
                    className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl px-3.5 py-2.5 font-body text-sm outline-none"
                    style={{ background: BG, color: TEXT, border: `1px solid hsl(var(--foreground) / 0.16)` }}
                  />
                  <button
                    type="button"
                    onClick={sendReply}
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
              <p className="font-body text-sm" style={{ color: DIM }}>Select a conversation</p>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
