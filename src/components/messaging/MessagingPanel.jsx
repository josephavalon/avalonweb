/**
 * MessagingPanel
 *
 * Self-contained inbox + thread UI. Drop it into any page with:
 *   <MessagingPanel />
 *
 * Layout:
 *   Mobile  — conversation list → tap → full-screen thread (back button)
 *   Desktop — split: inbox left, thread right
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import { ArrowLeft, Send, MessageSquare, Plus, X } from 'lucide-react';
import { useMessages } from '@/hooks/useMessages';
import { useAuthStore } from '@/lib/useAuthStore';
import { supabase } from '@/lib/supabase';

const EASE = [0.16, 1, 0.3, 1];

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, role, size = 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-[9px]' : 'w-9 h-9 text-[10px]';
  const roleColor = {
    admin: 'bg-accent/20 text-accent border-accent/30',
    provider: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    nurse: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    client: 'bg-foreground/10 text-foreground/60 border-foreground/15',
    staff: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  }[role] ?? 'bg-foreground/10 text-foreground/60 border-foreground/15';

  return (
    <div
      className={`${sz} ${roleColor} rounded-full border flex items-center justify-center font-body font-semibold shrink-0`}
    >
      {initials(name || role)}
    </div>
  );
}

// ─── ConversationRow ──────────────────────────────────────────────────────────

function ConversationRow({ convo, myUserId, isActive, onClick }) {
  const others = (convo.conversation_participants ?? []).filter(
    (p) => p.user_id !== myUserId
  );
  const title =
    convo.subject ||
    others.map((p) => p.display_name || p.role).join(', ') ||
    'Conversation';
  const otherRole = others[0]?.role ?? 'client';

  const myLastRead = convo.myLastRead ? new Date(convo.myLastRead) : null;
  const updatedAt = convo.updated_at ? new Date(convo.updated_at) : null;
  const hasUnread = updatedAt && (!myLastRead || updatedAt > myLastRead);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors rounded-xl ${
        isActive
          ? 'bg-foreground/[0.08]'
          : 'hover:bg-foreground/[0.04]'
      }`}
    >
      <Avatar name={title} role={otherRole} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p
            className={`font-body text-xs truncate ${
              hasUnread ? 'text-foreground font-semibold' : 'text-foreground/70'
            }`}
          >
            {title}
          </p>
          <span className="font-body text-[9px] text-foreground/35 shrink-0">
            {formatTime(convo.updated_at)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="font-body text-[10px] text-foreground/40 truncate flex-1">
            {otherRole}
          </p>
          {hasUnread && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
          )}
        </div>
      </div>
    </button>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, isMine }) {
  return (
    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl ${
          isMine
            ? 'bg-foreground text-background rounded-br-sm'
            : 'bg-foreground/[0.08] text-foreground rounded-bl-sm'
        }`}
      >
        <p className="font-body text-sm leading-relaxed">{msg.body}</p>
        <p
          className={`font-body text-[9px] mt-1 ${
            isMine ? 'text-background/50 text-right' : 'text-foreground/35'
          }`}
        >
          {formatTime(msg.created_at)}
        </p>
      </div>
    </div>
  );
}

// ─── Thread ───────────────────────────────────────────────────────────────────

function Thread({ convo, onBack, myUserId }) {
  const { messages, sendMessage, markRead } = useMessages(convo?.id);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const others = (convo?.conversation_participants ?? []).filter(
    (p) => p.user_id !== myUserId
  );
  const title =
    convo?.subject ||
    others.map((p) => p.display_name || p.role).join(', ') ||
    'Conversation';

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark read when thread opens
  useEffect(() => {
    if (convo?.id) markRead();
  }, [convo?.id, markRead]);

  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(draft);
      setDraft('');
    } finally {
      setSending(false);
    }
  }, [draft, sending, sendMessage]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!convo) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="w-8 h-8 text-foreground/20 mx-auto mb-3" strokeWidth={1.5} />
          <p className="font-body text-sm text-foreground/35">Select a conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-foreground/[0.08] shrink-0">
        {onBack && (
          <button onClick={onBack} className="text-foreground/50 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <Avatar name={title} role={others[0]?.role} size="sm" />
        <div className="min-w-0">
          <p className="font-body text-xs font-semibold text-foreground truncate">{title}</p>
          {others[0]?.role && (
            <p className="font-body text-[9px] text-foreground/40 uppercase tracking-[0.12em]">
              {others[0].role}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="font-body text-xs text-foreground/30 text-center pt-8">
            No messages yet. Say hello.
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isMine={msg.sender_id === myUserId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="px-4 py-3 border-t border-foreground/[0.08] shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 resize-none bg-foreground/[0.05] border border-foreground/[0.10] rounded-xl px-3.5 py-2.5 font-body text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/25 transition-colors max-h-28 overflow-y-auto"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center disabled:opacity-30 transition-opacity shrink-0"
          >
            <Send className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NewConversationModal ─────────────────────────────────────────────────────

function NewConversationModal({ onClose, onCreated, myRole }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const { startConversation } = useMessages();

  // Load contactable users based on current role
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const targetRoles =
        myRole === 'client'
          ? ['admin', 'provider']
          : myRole === 'admin'
          ? ['client', 'provider', 'nurse', 'staff']
          : ['admin', 'client'];

      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, role, email')
        .in('role', targetRoles)
        .order('display_name');

      setUsers(data ?? []);
    })();
  }, [myRole]);

  const handleCreate = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const id = await startConversation({
        participants: [{ user_id: selected.id, role: selected.role }],
        subject: subject.trim() || null,
      });
      onCreated(id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 md:pb-0" role="dialog" aria-modal="true" aria-label="New message">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="av-glass-card w-full max-w-md rounded-2xl border p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-body text-sm font-semibold text-foreground">New Message</p>
          <button type="button" onClick={onClose} aria-label="Close new message" className="text-foreground/40 hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.2em] text-foreground/40 mb-1.5">To</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {users.length === 0 && (
                <p className="font-body text-xs text-foreground/30 py-2">No contacts available.</p>
              )}
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors ${
                    selected?.id === u.id
                      ? 'bg-foreground/10 border border-foreground/15'
                      : 'hover:bg-foreground/[0.04]'
                  }`}
                >
                  <Avatar name={u.display_name || u.email} role={u.role} size="sm" />
                  <div>
                    <p className="font-body text-xs text-foreground">{u.display_name || u.email}</p>
                    <p className="font-body text-[9px] text-foreground/40 uppercase tracking-[0.1em]">{u.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.2em] text-foreground/40 mb-1.5">
              Subject <span className="normal-case tracking-normal opacity-50">(optional)</span>
            </p>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Pre-visit question"
              className="w-full bg-foreground/[0.05] border border-foreground/[0.10] rounded-xl px-3.5 py-2.5 font-body text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/25 transition-colors"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={!selected || loading}
            className="w-full min-h-[44px] bg-foreground text-background rounded-xl font-body text-[10px] uppercase tracking-[0.18em] font-semibold disabled:opacity-30 transition-opacity"
          >
            {loading ? 'Starting…' : 'Start Conversation'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── MessagingPanel (main export) ─────────────────────────────────────────────

export default function MessagingPanel() {
  const { user } = useAuthStore();
  const userId = user?.id;
  const myRole = user?.role;

  const [activeConvoId, setActiveConvoId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'thread'

  const { conversations, loading } = useMessages(activeConvoId);

  const activeConvo = conversations.find((c) => c.id === activeConvoId) ?? null;

  const selectConvo = (id) => {
    setActiveConvoId(id);
    setMobileView('thread');
  };

  const handleBack = () => {
    setMobileView('list');
    setActiveConvoId(null);
  };

  const handleNewCreated = (id) => {
    setShowNew(false);
    selectConvo(id);
  };

  return (
    <div className="flex h-full w-full overflow-hidden rounded-[1.35rem] border border-foreground/[0.08] bg-background">

      {/* Inbox sidebar */}
      <div
        className={`flex flex-col w-full md:w-72 lg:w-80 border-r border-foreground/[0.08] shrink-0 ${
          mobileView === 'thread' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Inbox header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/[0.08]">
          <p className="font-body text-xs font-semibold text-foreground uppercase tracking-[0.16em]">
            Messages
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="w-7 h-7 rounded-lg bg-foreground/[0.07] hover:bg-foreground/[0.12] flex items-center justify-center transition-colors"
            title="New conversation"
          >
            <Plus className="w-3.5 h-3.5 text-foreground/60" strokeWidth={2} />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
          {loading && (
            <p className="font-body text-xs text-foreground/30 text-center py-8">Loading…</p>
          )}
          {!loading && conversations.length === 0 && (
            <div className="text-center py-10">
              <MessageSquare className="w-6 h-6 text-foreground/20 mx-auto mb-2" strokeWidth={1.5} />
              <p className="font-body text-xs text-foreground/30">No messages yet</p>
              <button
                onClick={() => setShowNew(true)}
                className="mt-3 font-body text-[10px] uppercase tracking-[0.14em] text-accent hover:text-accent/80 transition-colors"
              >
                Start a conversation
              </button>
            </div>
          )}
          {conversations.map((convo) => (
            <ConversationRow
              key={convo.id}
              convo={convo}
              myUserId={userId}
              isActive={convo.id === activeConvoId}
              onClick={() => selectConvo(convo.id)}
            />
          ))}
        </div>
      </div>

      {/* Thread panel */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <Thread
          convo={activeConvo}
          onBack={handleBack}
          myUserId={userId}
        />
      </div>

      {/* New conversation modal */}
      <AnimatePresence>
        {showNew && (
          <NewConversationModal
            onClose={() => setShowNew(false)}
            onCreated={handleNewCreated}
            myRole={myRole}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
