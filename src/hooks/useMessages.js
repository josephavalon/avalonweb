/**
 * useMessages — Supabase Realtime messaging hook
 *
 * Provides:
 *   conversations  — list of conversations the current user is in
 *   messages       — messages for the active conversation
 *   sendMessage    — post a new message
 *   markRead       — update last_read_at for the current user
 *   startConversation — create a new direct conversation (admin/provider only)
 *   unreadCount    — total unread across all conversations
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/useAuthStore';


// ─── helpers ──────────────────────────────────────────────────────────────────

async function fetchConversations(userId) {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select(`
      last_read_at,
      conversations (
        id,
        type,
        subject,
        updated_at,
        conversation_participants (
          user_id,
          role,
          last_read_at
        )
      )
    `)
    .eq('user_id', userId)
    .order('updated_at', { foreignTable: 'conversations', ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row.conversations,
    myLastRead: row.last_read_at,
  }));
}

async function fetchMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useMessages(activeConversationId = null) {
  const { user } = useAuthStore();
  const userId = user?.id;

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const channelRef = useRef(null);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    if (!userId || !supabase) return;
    try {
      const data = await fetchConversations(userId);
      setConversations(data);
    } catch (err) {
      setError(err.message);
    }
  }, [userId]);

  // Load messages for active conversation
  const loadMessages = useCallback(async () => {
    if (!activeConversationId || !supabase) {
      setMessages([]);
      return;
    }
    try {
      const data = await fetchMessages(activeConversationId);
      setMessages(data);
    } catch (err) {
      setError(err.message);
    }
  }, [activeConversationId]);

  // Initial load
  useEffect(() => {
    if (!userId || !supabase) { setLoading(false); return; }
    setLoading(true);
    Promise.all([loadConversations(), loadMessages()]).finally(() =>
      setLoading(false)
    );
  }, [userId, loadConversations, loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!userId || !supabase) return;

    // Unsubscribe previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`avalon-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          // If we have an active conversation, filter to it; otherwise listen broadly
          ...(activeConversationId
            ? { filter: `conversation_id=eq.${activeConversationId}` }
            : {}),
        },
        (payload) => {
          if (activeConversationId && payload.new.conversation_id === activeConversationId) {
            setMessages((prev) => {
              // Deduplicate by id
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
          // Refresh conversation list to update updated_at / unread counts
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        () => loadConversations()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, activeConversationId, loadConversations]);

  // ─── actions ────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (body) => {
      if (!activeConversationId || !userId || !body.trim() || !supabase) return;
      const { error } = await supabase.from('messages').insert({
        conversation_id: activeConversationId,
        sender_id: userId,
        body: body.trim(),
      });
      if (error) throw error;
      // Optimistic insert happens via Realtime; no manual state update needed
    },
    [activeConversationId, userId]
  );

  const markRead = useCallback(async () => {
    if (!activeConversationId || !userId || !supabase) return;
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', activeConversationId)
      .eq('user_id', userId);
  }, [activeConversationId, userId]);

  /**
   * startConversation — create a new direct conversation between current user
   * and one or more other users (by userId + role).
   *
   * participants: [{ user_id, role }]
   * subject: optional string
   */
  const startConversation = useCallback(
    async ({ participants, subject = null } = {}) => {
      if (!userId || !participants?.length || !supabase) return null;

      const { data: convo, error: convoError } = await supabase
        .from('conversations')
        .insert({ type: 'direct', subject })
        .select()
        .single();

      if (convoError) throw convoError;

      const allParticipants = [
        { conversation_id: convo.id, user_id: userId, role: user?.role ?? 'client' },
        ...participants.map((p) => ({ conversation_id: convo.id, ...p })),
      ];

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(allParticipants);

      if (partError) throw partError;

      await loadConversations();
      return convo.id;
    },
    [userId, user?.role, loadConversations]
  );

  // ─── derived ────────────────────────────────────────────────────────────────

  const unreadCount = conversations.reduce((sum, convo) => {
    const myParticipant = convo.conversation_participants?.find(
      (p) => p.user_id === userId
    );
    if (!myParticipant?.last_read_at) return sum + 1; // never read = unread
    if (!convo.updated_at) return sum;
    return new Date(convo.updated_at) > new Date(myParticipant.last_read_at)
      ? sum + 1
      : sum;
  }, 0);

  return {
    conversations,
    messages,
    loading,
    error,
    unreadCount,
    sendMessage,
    markRead,
    startConversation,
    reload: loadConversations,
  };
}
