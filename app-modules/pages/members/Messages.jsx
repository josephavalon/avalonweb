import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  LogOut,
  MessageCircle,
  Plus,
  Send,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';
import { supabase, hasSupabase } from '@/lib/supabase';
import { apiPost } from '@/lib/apiClient';
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

// Storage bucket for member-uploaded message images. Must exist + carry the
// member-scoped policies from migration 022 (see REPORT). Mirrors team-inbox.
const MSG_IMAGE_BUCKET = 'member-messages';
// Max attachment size we'll accept client-side (bucket also enforces 10 MB).
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// --- Helpers --------------------------------------------------------------

// Normalize whatever the messages row carries for attachments into an array of
// { url, name } objects. Tolerates: a jsonb `attachments` array, or a single
// `image_url` text column — whichever the deployed schema actually has. Guards
// for legacy rows with neither (returns []).
function attachmentsFor(m) {
  if (!m) return [];
  const raw = m.attachments;
  if (Array.isArray(raw)) {
    return raw
      .map((a) => (typeof a === 'string' ? { url: a } : a))
      .filter((a) => a && a.url);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((a) => a && a.url);
    } catch {
      /* not JSON — fall through to image_url */
    }
  }
  if (m.image_url) return [{ url: m.image_url }];
  return [];
}

// Run a messages select that first tries to include the attachment columns
// (`attachments`, `image_url`) and transparently falls back to the base columns
// if the deployed schema doesn't have them yet (PostgREST 42703 / "column ...
// does not exist"). `build` receives the query and applies filters/order/limit.
// `baseCols` is the column list known to exist on every deploy.
async function selectMessages(build, baseCols) {
  const richCols = `${baseCols}, attachments, image_url`;
  let res = await build(supabase.from('messages').select(richCols));
  if (res.error) {
    const msg = String(res.error.message || '').toLowerCase();
    const missingCol =
      res.error.code === '42703' || msg.includes('column') || msg.includes('does not exist');
    if (!missingCol) throw res.error;
    // Retry with just the columns guaranteed to exist.
    res = await build(supabase.from('messages').select(baseCols));
    if (res.error) throw res.error;
  }
  return res.data || [];
}

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

// --- New-conversation composer (member → care team) -----------------------

function NewConversationComposer({
  subject,
  body,
  starting,
  error,
  onSubject,
  onBody,
  onSubmit,
  onCancel,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 rounded-[24px] p-4 md:p-5"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>
            New message
          </p>
          <h2 className="mt-0.5 font-heading text-xl uppercase leading-none">Message your care team</h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: MUTED }}
          aria-label="Cancel new conversation"
        >
          <X className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>

      <label className="sr-only" htmlFor="new-subject">Subject (optional)</label>
      <input
        id="new-subject"
        type="text"
        value={subject}
        onChange={(e) => onSubject(e.target.value)}
        placeholder="Subject (optional)"
        maxLength={200}
        className="mb-2 block w-full rounded-xl px-3 py-2.5 font-body text-[13px] outline-none"
        style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: TEXT }}
      />

      <label className="sr-only" htmlFor="new-body">Message</label>
      <textarea
        id="new-body"
        value={body}
        onChange={(e) => onBody(e.target.value)}
        placeholder="What can your care team help with?"
        rows={4}
        maxLength={4000}
        className="block w-full resize-none rounded-xl px-3 py-2.5 font-body text-[13px] leading-snug outline-none"
        style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: TEXT }}
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="font-body text-[10px]" style={{ color: error ? BAD : DIM }}>
          {error || 'Your RN reviews every message — not for emergencies.'}
        </p>
        <button
          type="submit"
          disabled={starting || !body.trim()}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 font-body text-[10px] font-bold uppercase tracking-[0.18em] disabled:opacity-50"
          style={{ background: TEXT, color: INVERT }}
        >
          {starting ? 'Sending…' : 'Send'} <Send className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </form>
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

  // New-conversation composer (member → care team).
  const [composerOpen, setComposerOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  const userId = user?.id || null;

  // Care-team's read cursor for the active thread (the counterparty's
  // last_read_at). Drives the "Seen" receipt on the member's sent messages.
  const [otherReadAt, setOtherReadAt] = useState(null);
  // Pending image attachment for the next sent message: { url, name } | null.
  const [pendingImage, setPendingImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  // Whether the care team is currently typing (ephemeral, via Realtime).
  const [careTyping, setCareTyping] = useState(false);
  const fileRef = useRef(null);
  // Realtime channel + typing-broadcast throttle bookkeeping (refs so the
  // keystroke handler doesn't re-subscribe the channel).
  const presenceChannelRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const careTypingTimerRef = useRef(null);

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
      const recentMessages = await selectMessages((q) =>
        q.in('conversation_id', convoIds).order('created_at', { ascending: false }).limit(200),
        'id, conversation_id, body, created_at, sender_id',
      );

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
        const lastHasImage = last ? attachmentsFor(last).length > 0 : false;
        const lastPreview = last
          ? (last.body && last.body.trim() ? last.body : lastHasImage ? 'Sent an image' : '')
          : '';
        const unread =
          !!last &&
          last.sender_id !== userId &&
          (!lastReadAt || new Date(last.created_at).getTime() > new Date(lastReadAt).getTime());
        return {
          id: mp.conversation_id,
          counterpartyName,
          lastBody: lastPreview,
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
      const data = await selectMessages((q) =>
        q.eq('conversation_id', conversationId).order('created_at', { ascending: true }),
        'id, conversation_id, sender_id, body, created_at',
      );
      setThreadState({ loading: false, error: '', messages: data });

      // Read-receipt source: the care-team participant's last_read_at. Used to
      // render "Seen" on the member's own sent messages. Best-effort.
      try {
        const { data: others } = await supabase
          .from('conversation_participants')
          .select('user_id, last_read_at')
          .eq('conversation_id', conversationId)
          .neq('user_id', userId);
        const latest = (others || [])
          .map((o) => o.last_read_at)
          .filter(Boolean)
          .sort()
          .pop();
        setOtherReadAt(latest || null);
      } catch {
        setOtherReadAt(null);
      }

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
    setOtherReadAt(null);
    setCareTyping(false);
    if (activeThreadId) loadThreadMessages(activeThreadId);
    else setThreadState({ loading: false, error: '', messages: [] });
  }, [activeThreadId, loadThreadMessages]);

  // -- Realtime: inserts + the care team's read cursor on the active thread -
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
      // The care team marking the thread read bumps their participant row's
      // last_read_at — surface it live so "Seen" appears without a reload.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${activeThreadId}` },
        (payload) => {
          if (payload.new?.user_id === userId) return; // ignore my own cursor
          const next = payload.new?.last_read_at;
          if (!next) return;
          setOtherReadAt((prev) => (!prev || new Date(next) > new Date(prev) ? next : prev));
        },
      )
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch { /* noop */ } };
  }, [activeThreadId, userId]);

  // -- Realtime: ephemeral typing indicator (broadcast, NO DB writes) -------
  // A SEPARATE channel from the postgres_changes one above (unique name) to
  // avoid the "tried to subscribe multiple times" Supabase crash.
  useEffect(() => {
    if (!supabase || !activeThreadId) return undefined;
    const channel = supabase.channel(`typing-${activeThreadId}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        // Only react to the OTHER side typing.
        if (payload?.payload?.userId && payload.payload.userId === userId) return;
        setCareTyping(true);
        clearTimeout(careTypingTimerRef.current);
        // Auto-clear if no further keystroke broadcast arrives.
        careTypingTimerRef.current = setTimeout(() => setCareTyping(false), 4000);
      })
      .on('broadcast', { event: 'stop_typing' }, (payload) => {
        if (payload?.payload?.userId && payload.payload.userId === userId) return;
        clearTimeout(careTypingTimerRef.current);
        setCareTyping(false);
      })
      .subscribe();
    presenceChannelRef.current = channel;
    return () => {
      clearTimeout(careTypingTimerRef.current);
      presenceChannelRef.current = null;
      try { supabase.removeChannel(channel); } catch { /* noop */ }
    };
  }, [activeThreadId, userId]);

  // Broadcast that the member is typing (throttled to ~1/2s). Ephemeral only.
  const broadcastTyping = useCallback(() => {
    const channel = presenceChannelRef.current;
    if (!channel) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    try {
      channel.send({ type: 'broadcast', event: 'typing', payload: { userId } });
    } catch { /* noop */ }
  }, [userId]);

  // Tell the other side we stopped (composer blur / after send).
  const broadcastStopTyping = useCallback(() => {
    const channel = presenceChannelRef.current;
    if (!channel) return;
    lastTypingSentRef.current = 0;
    try {
      channel.send({ type: 'broadcast', event: 'stop_typing', payload: { userId } });
    } catch { /* noop */ }
  }, [userId]);

  // -- Auto-scroll on new messages ----------------------------------------
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [threadState.messages.length, activeThreadId]);

  // -- Attach an image: upload to member-scoped Storage, hold the URL -------
  const handlePickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file || !supabase || !userId) return;
    if (!file.type.startsWith('image/')) {
      setSendError('Only image files can be attached.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setSendError('Image is too large (max 10 MB).');
      return;
    }
    setUploading(true);
    setSendError('');
    try {
      // Member-scoped path: storage RLS (migration 022) restricts writes to a
      // folder named after the member's auth uid, so a member can only write
      // under their own prefix.
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${userId}/${activeThreadId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(MSG_IMAGE_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(MSG_IMAGE_BUCKET).getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error('Could not resolve image URL.');
      setPendingImage({ url: pub.publicUrl, name: file.name });
    } catch (err) {
      setSendError(err?.message || 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  // -- Send a message ------------------------------------------------------
  const handleSend = async (e) => {
    e?.preventDefault?.();
    const body = draft.trim();
    const image = pendingImage;
    // Allow a send when there's text OR an attached image.
    if ((!body && !image) || !activeThreadId || !supabase || !userId) return;
    setSending(true);
    setSendError('');
    broadcastStopTyping();
    const tempId = `tmp-${Date.now()}`;
    const attachments = image ? [{ url: image.url, name: image.name }] : [];
    const optimistic = {
      id: tempId,
      conversation_id: activeThreadId,
      sender_id: userId,
      body,
      attachments,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setThreadState((s) => ({ ...s, messages: [...s.messages, optimistic] }));
    setDraft('');
    setPendingImage(null);
    try {
      // The body column has a NOT NULL + 1..4000 check, so when only an image is
      // sent we store a single space as the body.
      const row = { conversation_id: activeThreadId, body: body || ' ', sender_id: userId };
      if (image) row.attachments = attachments; // dropped via retry if column absent (see below)
      let res = await supabase
        .from('messages')
        .insert(row)
        .select('id, conversation_id, sender_id, body, created_at, attachments, image_url')
        .single();
      // If the attachments/image_url columns aren't deployed yet, retry text-only
      // so sending never hard-breaks before migration 022 lands.
      if (res.error) {
        const msg = String(res.error.message || '').toLowerCase();
        const missingCol =
          res.error.code === '42703' || msg.includes('column') || msg.includes('does not exist');
        if (missingCol) {
          res = await supabase
            .from('messages')
            .insert({ conversation_id: activeThreadId, body: body || ' ', sender_id: userId })
            .select('id, conversation_id, sender_id, body, created_at')
            .single();
        }
      }
      if (res.error) throw res.error;
      const data = res.data;
      setThreadState((s) => ({
        ...s,
        messages: s.messages.map((m) => (m.id === tempId ? data : m)),
      }));
      // Bump the thread preview locally.
      const preview = body || (image ? 'Sent an image' : '');
      setThreadsState((s) => ({
        ...s,
        threads: s.threads.map((t) =>
          t.id === activeThreadId ? { ...t, lastBody: preview, lastAt: data.created_at, unread: false } : t,
        ),
      }));
    } catch (err) {
      setSendError(err?.message || 'Could not send. Try again.');
      // Roll back the optimistic message.
      setThreadState((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== tempId) }));
      setDraft(body);
      setPendingImage(image);
    } finally {
      setSending(false);
    }
  };

  // -- Start a new conversation with the care team -------------------------
  const handleStartConversation = async (e) => {
    e?.preventDefault?.();
    const body = newBody.trim();
    if (!body || starting) return;
    setStarting(true);
    setStartError('');
    try {
      const res = await apiPost('/api/me/conversations/create', {
        body,
        subject: newSubject.trim() || undefined,
      });
      const newId = res?.conversation?.id;
      // Reset + close the composer, refresh the inbox, then open the new thread.
      setComposerOpen(false);
      setNewSubject('');
      setNewBody('');
      await loadThreads();
      if (newId) setSearchParams({ thread: newId });
    } catch (err) {
      setStartError(err?.message || 'Could not start the conversation. Try again.');
    } finally {
      setStarting(false);
    }
  };

  const openComposer = () => {
    setStartError('');
    setComposerOpen(true);
  };

  // -- Computed bits -------------------------------------------------------
  const activeThread = useMemo(
    () => threadsState.threads.find((t) => t.id === activeThreadId) || null,
    [threadsState.threads, activeThreadId],
  );

  // "Seen" receipt: the id of the LAST message the member sent that the care
  // team's last_read_at is at/after. We show "Seen" only on that single bubble
  // (the latest read one), iMessage-style. Optimistic temp rows never qualify.
  const lastSeenMessageId = useMemo(() => {
    if (!otherReadAt) return null;
    const readMs = new Date(otherReadAt).getTime();
    if (Number.isNaN(readMs)) return null;
    let id = null;
    for (const m of threadState.messages) {
      if (m._optimistic) continue;
      if (m.sender_id !== userId) continue;
      if (new Date(m.created_at).getTime() <= readMs) id = m.id;
    }
    return id;
  }, [otherReadAt, threadState.messages, userId]);

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
                const atts = attachmentsFor(m);
                // Body may be a placeholder space for image-only messages.
                const hasText = m.body && m.body.trim();
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
                      className="max-w-[82%] overflow-hidden rounded-2xl px-3.5 py-2.5 font-body text-[13px] leading-snug"
                      style={
                        mine
                          ? { alignSelf: 'flex-end', background: TEXT, color: INVERT, opacity: m._optimistic ? 0.7 : 1 }
                          : { alignSelf: 'flex-start', background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }
                      }
                    >
                      {atts.length ? (
                        <div className="mb-1.5 flex flex-col gap-1.5">
                          {atts.map((att, ai) => (
                            <a
                              key={att.url || ai}
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              <img
                                src={att.url}
                                alt={att.name || 'attachment'}
                                className="max-h-60 max-w-full rounded-xl object-cover"
                                style={{ border: `1px solid ${BORDER}` }}
                              />
                            </a>
                          ))}
                        </div>
                      ) : null}
                      {hasText ? (
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      ) : null}
                      <p
                        className="mt-1 font-body text-[10px]"
                        style={{ color: mine ? 'hsl(var(--background) / 0.6)' : DIM, textAlign: mine ? 'right' : 'left' }}
                      >
                        {relativeTime(m.created_at)}
                      </p>
                    </div>
                    {mine && !m._optimistic && m.id === lastSeenMessageId ? (
                      <span
                        className="mt-0.5 inline-flex items-center gap-1 self-end font-body text-[10px] font-bold uppercase tracking-[0.14em]"
                        style={{ color: DIM }}
                      >
                        <Check className="h-3 w-3" strokeWidth={2.4} /> Seen
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Ephemeral typing indicator (broadcast-driven; never persisted). */}
        {careTyping ? (
          <p className="mt-2 px-1 font-body text-[11px] italic" style={{ color: MUTED }} aria-live="polite">
            Care team is typing…
          </p>
        ) : null}

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="mt-3 rounded-2xl p-2"
          style={{ background: CARD, border: `1px solid ${BORDER}` }}
        >
          {/* Pending image preview (clears after send). */}
          {pendingImage ? (
            <div className="mb-2 px-1">
              <span className="relative inline-block">
                <img
                  src={pendingImage.url}
                  alt={pendingImage.name || 'attachment'}
                  className="h-16 w-16 rounded-lg object-cover"
                  style={{ border: `1px solid ${BORDER}` }}
                />
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT }}
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" strokeWidth={2.4} />
                </button>
              </span>
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
              style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: MUTED }}
              aria-label="Attach image"
            >
              <ImagePlus className="h-4 w-4" strokeWidth={1.9} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickImage}
            />
            <label className="sr-only" htmlFor="message-draft">Write a message</label>
            <textarea
              id="message-draft"
              value={draft}
              onChange={(e) => { setDraft(e.target.value); broadcastTyping(); }}
              onBlur={broadcastStopTyping}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message…"
              rows={2}
              className="block w-full flex-1 resize-none rounded-xl bg-transparent px-3 py-2 font-body text-[13px] leading-snug outline-none"
              style={{ color: TEXT }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="font-body text-[10px]" style={{ color: sendError ? BAD : DIM }}>
              {uploading
                ? 'Uploading image…'
                : sendError || 'Enter to send · Shift+Enter for newline'}
            </p>
            <button
              type="submit"
              disabled={sending || uploading || (!draft.trim() && !pendingImage)}
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
        <div className="flex shrink-0 items-center gap-3">
          <p className="font-body text-[10px]" style={{ color: MUTED }}>
            {loading ? '—' : `${threads.filter((t) => t.unread).length} unread`}
          </p>
          {!composerOpen ? (
            <button
              type="button"
              onClick={openComposer}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 font-body text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ background: TEXT, color: INVERT }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.2} /> New
            </button>
          ) : null}
        </div>
      </div>

      {composerOpen ? (
        <NewConversationComposer
          subject={newSubject}
          body={newBody}
          starting={starting}
          error={startError}
          onSubject={setNewSubject}
          onBody={setNewBody}
          onSubmit={handleStartConversation}
          onCancel={() => {
            setComposerOpen(false);
            setStartError('');
          }}
        />
      ) : null}

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
            Your inbox is empty. Start a thread with your Avalon care team — your RN reviews every message.
          </p>
          <button
            type="button"
            onClick={openComposer}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 font-body text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ background: TEXT, color: INVERT }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} /> New conversation
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
