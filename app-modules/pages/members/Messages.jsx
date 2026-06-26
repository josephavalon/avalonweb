import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';
import {
  ArrowLeft,
  ArrowRight,
  LogOut,
  MessageCircle,
  Send,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { supabase, hasSupabase } from '@/lib/supabase';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import MemberSectionNav from './MemberSectionNav.jsx';

// --- B/W tokens (mirrors Dashboard.jsx) ----------------------------------
const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const BAD = 'hsl(0 70% 62%)';

// --- Helpers --------------------------------------------------------------

function initialsFor(name) {
  if (!name) return 'SN';
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || 'SN';
}

function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${Math.max(1, s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 4) return `${w}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function hourBucket(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // group label by date + hour (so we print a divider when the hour rolls)
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
  });
}

function truncate(s, n = 80) {
  const str = String(s || '');
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

// --- Shell ----------------------------------------------------------------

function MessagesShell({ children, onSignOut }) {
  return (
    <main
      className="min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body"
      style={{ background: BG, color: TEXT }}
    >
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/members/dashboard" className="inline-flex items-center">
            <AvalonMark className="h-[22px] w-[14px] text-foreground" />
          </Link>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>
            Messages
          </p>
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.7} />
            </button>
          ) : (
            <span className="h-11 w-11" aria-hidden />
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pt-5 md:px-6 md:pt-7">
        <MemberSectionNav />
      </div>

      <section className="mx-auto max-w-3xl px-4 pt-4 md:px-6">{children}</section>

      <MemberBottomNav />
    </main>
  );
}

// --- Demo-mode empty state ------------------------------------------------

function DemoMessages() {
  return (
    <MessagesShell>
      <div className="mb-4">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>
          Inbox
        </p>
        <h1 className="mt-1 font-heading text-4xl uppercase leading-none md:text-5xl">Messages</h1>
      </div>
      <div
        className="rounded-[24px] p-6 text-center"
        style={{ background: CARD, border: `1px solid ${BORDER}` }}
      >
        <MessageCircle className="mx-auto h-7 w-7" strokeWidth={1.6} style={{ color: DIM }} />
        <h2 className="mt-4 font-heading text-2xl uppercase leading-none">Messages need a live account</h2>
        <p className="mx-auto mt-3 max-w-sm font-body text-[12px] leading-snug" style={{ color: MUTED }}>
          You're previewing the portal in demo mode. Sign in with your Avalon account to message your care team.
        </p>
        <Link
          to="/login"
          className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 font-body text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ background: TEXT, color: INVERT }}
        >
          Sign in <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </MessagesShell>
  );
}

// --- Live Messages --------------------------------------------------------

function LiveMessages() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeThreadId = searchParams.get('thread') || '';

  // threads: [{ id, counterpartyName, lastBody, lastAt, unread, lastReadAt }]
  const [threadsState, setThreadsState] = useState({ loading: true, error: '', threads: [] });
  // messages for active thread
  const [threadState, setThreadState] = useState({ loading: false, error: '', messages: [] });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const scrollerRef = useRef(null);

  const userId = user?.id || null;

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  // -- Load threads --------------------------------------------------------
  const loadThreads = useCallback(async () => {
    if (!supabase || !userId) {
      setThreadsState({ loading: false, error: '', threads: [] });
      return;
    }
    setThreadsState((s) => ({ ...s, loading: true, error: '' }));
    try {
      // 1) The conversations this user belongs to + their last_read_at.
      const { data: myParts, error: mpErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at, conversations:conversation_id(id, subject, updated_at)')
        .eq('user_id', userId);
      if (mpErr) throw mpErr;
      const convoIds = (myParts || []).map((r) => r.conversation_id).filter(Boolean);
      if (!convoIds.length) {
        setThreadsState({ loading: false, error: '', threads: [] });
        return;
      }

      // 2) Counterparty profiles (other participants in those conversations).
      const { data: otherParts, error: opErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, role, profiles:user_id(id, full_name, role)')
        .in('conversation_id', convoIds)
        .neq('user_id', userId);
      if (opErr) throw opErr;

      // 3) Latest message body per conversation (fetch recent slice; pick latest per id).
      const { data: recentMessages, error: rmErr } = await supabase
        .from('messages')
        .select('id, conversation_id, body, created_at, sender_id')
        .in('conversation_id', convoIds)
        .order('created_at', { ascending: false })
        .limit(200);
      if (rmErr) throw rmErr;

      const latestByConvo = new Map();
      const allByConvo = new Map();
      for (const m of recentMessages || []) {
        if (!latestByConvo.has(m.conversation_id)) latestByConvo.set(m.conversation_id, m);
        if (!allByConvo.has(m.conversation_id)) allByConvo.set(m.conversation_id, []);
        allByConvo.get(m.conversation_id).push(m);
      }

      // Build thread rows.
      const otherByConvo = new Map();
      for (const p of otherParts || []) {
        if (!otherByConvo.has(p.conversation_id)) otherByConvo.set(p.conversation_id, []);
        otherByConvo.get(p.conversation_id).push(p);
      }

      const rows = (myParts || []).map((mp) => {
        const c = mp.conversations || {};
        const others = otherByConvo.get(mp.conversation_id) || [];
        const counterpartyName =
          others
            .map((o) => o.profiles?.full_name || (o.role ? `${o.role[0].toUpperCase()}${o.role.slice(1)}` : ''))
            .filter(Boolean)
            .join(', ') || c.subject || 'Snooches Care';
        const last = latestByConvo.get(mp.conversation_id) || null;
        const lastAt = last?.created_at || c.updated_at || null;
        const lastReadAt = mp.last_read_at || null;
        const unread =
          !!last &&
          last.sender_id !== userId &&
          (!lastReadAt || new Date(last.created_at).getTime() > new Date(lastReadAt).getTime());
        return {
          id: mp.conversation_id,
          counterpartyName,
          lastBody: last?.body || (c.subject ? '' : ''),
          lastAt,
          unread,
          lastReadAt,
        };
      });

      rows.sort((a, b) => {
        const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
        const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
        return tb - ta;
      });

      setThreadsState({ loading: false, error: '', threads: rows });
    } catch (err) {
      setThreadsState({ loading: false, error: err?.message || 'Could not load your messages.', threads: [] });
    }
  }, [userId]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // -- Load messages for the active thread ---------------------------------
  const loadThreadMessages = useCallback(async (conversationId) => {
    if (!supabase || !conversationId) return;
    setThreadState({ loading: true, error: '', messages: [] });
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setThreadState({ loading: false, error: '', messages: data || [] });

      // Mark read: update participant row's last_read_at to now.
      try {
        await supabase
          .from('conversation_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('user_id', userId);
        // Optimistically clear unread in the threads list.
        setThreadsState((s) => ({
          ...s,
          threads: s.threads.map((t) => (t.id === conversationId ? { ...t, unread: false } : t)),
        }));
      } catch {
        /* read receipts are best-effort — schema permits this update via RLS */
      }
    } catch (err) {
      setThreadState({ loading: false, error: err?.message || 'Could not load this conversation.', messages: [] });
    }
  }, [userId]);

  useEffect(() => {
    if (activeThreadId) loadThreadMessages(activeThreadId);
    else setThreadState({ loading: false, error: '', messages: [] });
  }, [activeThreadId, loadThreadMessages]);

  // -- Realtime: subscribe to inserts on the active thread -----------------
  useEffect(() => {
    if (!supabase || !activeThreadId) return undefined;
    const channel = supabase
      .channel(`messages-${activeThreadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeThreadId}` },
        (payload) => {
          setThreadState((s) => {
            if (s.messages.some((m) => m.id === payload.new.id)) return s;
            return { ...s, messages: [...s.messages, payload.new] };
          });
        },
      )
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch { /* noop */ } };
  }, [activeThreadId]);

  // -- Auto-scroll on new messages ----------------------------------------
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [threadState.messages.length, activeThreadId]);

  // -- Send a message ------------------------------------------------------
  const handleSend = async (e) => {
    e?.preventDefault?.();
    const body = draft.trim();
    if (!body || !activeThreadId || !supabase || !userId) return;
    setSending(true);
    setSendError('');
    const tempId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      conversation_id: activeThreadId,
      sender_id: userId,
      body,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setThreadState((s) => ({ ...s, messages: [...s.messages, optimistic] }));
    setDraft('');
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: activeThreadId, body, sender_id: userId })
        .select('id, conversation_id, sender_id, body, created_at')
        .single();
      if (error) throw error;
      setThreadState((s) => ({
        ...s,
        messages: s.messages.map((m) => (m.id === tempId ? data : m)),
      }));
      // Bump the thread preview locally.
      setThreadsState((s) => ({
        ...s,
        threads: s.threads.map((t) =>
          t.id === activeThreadId ? { ...t, lastBody: body, lastAt: data.created_at, unread: false } : t,
        ),
      }));
    } catch (err) {
      setSendError(err?.message || 'Could not send. Try again.');
      // Roll back the optimistic message.
      setThreadState((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== tempId) }));
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  // -- Computed bits -------------------------------------------------------
  const activeThread = useMemo(
    () => threadsState.threads.find((t) => t.id === activeThreadId) || null,
    [threadsState.threads, activeThreadId],
  );

  // SEO
  useSeo({
    title: 'Messages — Avalon Vitality',
    description: 'Message your Avalon care team — RNs, scheduling, and clinical follow-ups.',
    path: '/members/messages',
    robots: 'noindex, nofollow',
  });

  // ---------------- View: thread (when one is active) -------------------
  if (activeThreadId) {
    return (
      <MessagesShell onSignOut={handleSignOut}>
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchParams({}, { replace: true })}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 font-body text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Inbox
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-2xl uppercase leading-none md:text-3xl">
              {activeThread?.counterpartyName || 'Conversation'}
            </p>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="max-h-[58dvh] min-h-[42dvh] overflow-y-auto rounded-[24px] p-3 md:p-5"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          {threadState.loading ? (
            <p className="py-6 text-center font-body text-[12px]" style={{ color: MUTED }}>Loading messages…</p>
          ) : threadState.error ? (
            <p className="py-6 text-center font-body text-[12px]" style={{ color: BAD }}>{threadState.error}</p>
          ) : threadState.messages.length === 0 ? (
            <p className="py-6 text-center font-body text-[12px]" style={{ color: MUTED }}>
              No messages in this thread yet. Say hello.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {threadState.messages.map((m, i) => {
                const prev = threadState.messages[i - 1];
                const showBucket = !prev || hourBucket(prev.created_at) !== hourBucket(m.created_at);
                const mine = m.sender_id === userId;
                return (
                  <li key={m.id} className="flex flex-col">
                    {showBucket ? (
                      <p
                        className="my-2 self-center font-body text-[10px] font-bold uppercase tracking-[0.18em]"
                        style={{ color: DIM }}
                      >
                        {hourBucket(m.created_at)}
                      </p>
                    ) : null}
                    <div
                      className="max-w-[82%] rounded-2xl px-3.5 py-2.5 font-body text-[13px] leading-snug"
                      style={
                        mine
                          ? { alignSelf: 'flex-end', background: TEXT, color: INVERT, opacity: m._optimistic ? 0.7 : 1 }
                          : { alignSelf: 'flex-start', background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }
                      }
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p
                        className="mt-1 font-body text-[10px]"
                        style={{ color: mine ? 'hsl(var(--background) / 0.6)' : DIM, textAlign: mine ? 'right' : 'left' }}
                      >
                        {relativeTime(m.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="mt-3 rounded-2xl p-2"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          <label className="sr-only" htmlFor="message-draft">Write a message</label>
          <textarea
            id="message-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message…"
            rows={2}
            className="block w-full resize-none rounded-xl bg-transparent px-3 py-2 font-body text-[13px] leading-snug outline-none"
            style={{ color: TEXT }}
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="font-body text-[10px]" style={{ color: sendError ? BAD : DIM }}>
              {sendError || 'Enter to send · Shift+Enter for newline'}
            </p>
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 font-body text-[10px] font-bold uppercase tracking-[0.18em] disabled:opacity-50"
              style={{ background: TEXT, color: INVERT }}
            >
              {sending ? 'Sending…' : 'Send'} <Send className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </form>
      </MessagesShell>
    );
  }

  // ---------------- View: thread list ------------------------------------
  const { loading, error, threads } = threadsState;
  return (
    <MessagesShell onSignOut={handleSignOut}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>
            Inbox
          </p>
          <h1 className="mt-1 font-heading text-4xl uppercase leading-none md:text-5xl">Messages</h1>
        </div>
        <p className="font-body text-[10px]" style={{ color: MUTED }}>
          {loading ? '—' : `${threads.filter((t) => t.unread).length} unread`}
        </p>
      </div>

      {loading ? (
        <div
          className="rounded-[24px] p-6 text-center"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          <p className="font-body text-[12px]" style={{ color: MUTED }}>Loading your inbox…</p>
        </div>
      ) : error ? (
        <div
          className="rounded-[24px] p-6 text-center"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          <p className="font-body text-[12px]" style={{ color: BAD }}>{error}</p>
        </div>
      ) : threads.length === 0 ? (
        <div
          className="rounded-[24px] p-6 text-center"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          <MessageCircle className="mx-auto h-7 w-7" strokeWidth={1.6} style={{ color: DIM }} />
          <h2 className="mt-4 font-heading text-2xl uppercase leading-none">Message your care team</h2>
          <p className="mx-auto mt-3 max-w-sm font-body text-[12px] leading-snug" style={{ color: MUTED }}>
            Your inbox is empty. Your Avalon RN will start a thread before your next visit.
          </p>
          <button
            type="button"
            disabled
            className="mt-5 inline-flex min-h-[44px] cursor-not-allowed items-center justify-center gap-2 rounded-xl px-5 font-body text-[10px] font-bold uppercase tracking-[0.18em] opacity-50"
            style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
          >
            New conversation
            <span
              className="ml-1 rounded-full px-2 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.14em]"
              style={{ background: 'hsl(var(--foreground) / 0.12)', color: TEXT }}
            >
              Coming soon
            </span>
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {threads.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSearchParams({ thread: t.id })}
                className="grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors"
                style={{
                  background: t.unread ? CARD_STRONG : CARD,
                  border: `1px solid ${t.unread ? 'hsl(var(--foreground) / 0.22)' : BORDER}`,
                }}
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full font-heading text-sm uppercase"
                  style={{ background: 'hsl(var(--foreground) / 0.12)', color: TEXT }}
                >
                  {initialsFor(t.counterpartyName)}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-body text-[13px] font-semibold" style={{ color: TEXT }}>
                      {t.counterpartyName}
                    </p>
                    {t.unread ? (
                      <span
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: TEXT }}
                        aria-label="Unread"
                      />
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate font-body text-[11px]" style={{ color: t.unread ? MUTED : DIM }}>
                    {truncate(t.lastBody || 'No messages yet.', 80)}
                  </p>
                </div>
                <span className="shrink-0 font-body text-[10px]" style={{ color: DIM }}>
                  {relativeTime(t.lastAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </MessagesShell>
  );
}

// --- Default export ------------------------------------------------------

export default function MemberMessages() {
  const { authBackend } = useAuthStore();
  if (authBackend === 'supabase' && hasSupabase) return <LiveMessages />;
  return <DemoMessages />;
}
