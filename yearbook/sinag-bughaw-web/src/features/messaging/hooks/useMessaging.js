import { useCallback, useEffect, useRef, useState } from 'react';
import echo, { refreshEchoAuthHeaders }  from '@/lib/echo';
import { messagesApi, presenceApi }      from '@/api/messaging.api';
import { useAuth }                       from '@/features/auth/hooks/useAuth';

const TYPING_DEBOUNCE_MS = 1500;

export function useMessaging(recipientId = null) {
  const { user }                            = useAuth();
  const [conversations, setConversations]   = useState([]);
  const [thread,        setThread]          = useState([]);
  const [loading,       setLoading]         = useState(false);
  const [error,         setError]           = useState(null);
  const [isTyping,      setIsTyping]        = useState(false);
  const [onlineUsers,   setOnlineUsers]     = useState(new Set());
  const [unreadTotal,   setUnreadTotal]     = useState(0);

  const typingTimerRef  = useRef(null);
  const iAmTypingRef    = useRef(false);
  const seenIdsRef      = useRef(new Set());
  const recipientRef    = useRef(recipientId);
  const loadedRecipientRef = useRef(null);
  const didInitialLoadRef = useRef(false);
  recipientRef.current = recipientId;
  const threadRef       = useRef([]);
  const loadedRecipientRef = useRef(null);
  const skeletonUsedRef = useRef(false);
  threadRef.current = thread;

  // Conversations

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await messagesApi.conversations();
      const next = Array.isArray(data) ? data : [];
      setConversations((prev) => {
        const signature = (list) => list.map((item) => `${item.id}:${item.unread_count ?? item.unread ?? 0}:${item.body ?? item.last_message ?? ''}:${item.updated_at ?? item.created_at ?? ''}`).join('|');
        return signature(prev) === signature(next) ? prev : next;
      });
    } catch (err) {
      setError(err);
    }
  }, []);

  // Thread

  const fetchThread = useCallback(async (id, { replace = false } = {}) => {
    if (!id) return;
    try {
      const { data } = await messagesApi.thread(id);
      if (String(recipientRef.current) !== String(id)) return;
      const msgs = Array.isArray(data) ? data : (data.data ?? []);
      setThread((prev) => {
        if (!replace) {
          const known = new Set(prev.map((message) => String(message.id)));
          const fresh = msgs.filter((message) => !known.has(String(message.id)));
          if (!fresh.length) return prev;
          fresh.forEach((message) => seenIdsRef.current.add(message.id));
          return [...prev, ...fresh];
        }
        const pending = prev.filter((message) => message._optimistic && !msgs.some((item) => String(item.id) === String(message.id)));
        const next = pending.length ? [...msgs, ...pending] : msgs;
        seenIdsRef.current = new Set(next.map((message) => message.id));
        return next;
      });
    } catch (err) {
      setError(err);
    }
  }, []);

  // Send

  const sendMessage = useCallback(async (receiverId, body, image = null) => {
    const tempId = `opt-${Date.now()}`;

    // Optimistic message
    const optimistic = {
      id:          tempId,
      sender_id:   user?.id,
      receiver_id: receiverId,
      body,
      image_url:   image ? URL.createObjectURL(image) : null,
      is_read:     false,
      created_at:  new Date().toISOString(),
      _optimistic: true,
    };
    setThread(prev => [...prev, optimistic]);

    try {
      const { data } = await messagesApi.send(receiverId, body, image);

      // Register the real ID so the WS event doesn't add it again
      seenIdsRef.current.add(data.id);

      // Replace optimistic with real message
      setThread(prev => prev.map(m => m.id === tempId ? data : m));

      fetchConversations();
      return data;
    } catch (err) {
      // Roll back
      setThread(prev => prev.filter(m => m.id !== tempId));
      throw err;
    }
  }, [user?.id, fetchConversations]);

  // Mark read

  const markRead = useCallback(async (id) => {
    await messagesApi.markRead(id);
    setThread(prev =>
      prev.map(m => m.id === id ? { ...m, is_read: true, read_at: new Date().toISOString() } : m)
    );
  }, []);

  // Unread count

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await messagesApi.unreadCount();
      setUnreadTotal(data.unread_count ?? 0);
    } catch {
      // Keep the UI stable if the unread badge refresh fails.
    }
  }, []);

  // Typing

  const onKeystroke = useCallback((receiverId) => {
    if (!iAmTypingRef.current) {
      iAmTypingRef.current = true;
      messagesApi.typing(receiverId, true).catch(() => {});
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      iAmTypingRef.current = false;
      messagesApi.typing(receiverId, false).catch(() => {});
    }, TYPING_DEBOUNCE_MS);
  }, []);

  // WebSocket: private chat channel

  useEffect(() => {
    if (!user?.id) return;

    refreshEchoAuthHeaders();
    const channel = echo.private(`chat.${user.id}`);

    channel.listen('.message.sent', (payload) => {
      // If we already have this message (sent by us + WS echo), skip it
      if (seenIdsRef.current.has(payload.id)) return;

      // Only append to thread if it's from the person we're currently viewing
      if (String(payload.sender_id) === String(recipientId)) {
        seenIdsRef.current.add(payload.id);
        setThread(prev => [...prev, payload]);
        messagesApi.markRead(payload.id).catch(() => {});
      }

      fetchConversations();
      fetchUnreadCount();
      window.dispatchEvent(new Event('messaging:unread-updated'));
    });

    channel.listen('.user.typing', (payload) => {
      if (String(payload.sender_id) === String(recipientId)) {
        setIsTyping(payload.is_typing);
        if (payload.is_typing) {
          clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setIsTyping(false), 3000);
        }
      }
    });

    return () => {
      echo.leave(`chat.${user.id}`);
    };
  }, [user?.id, recipientId, fetchConversations, fetchUnreadCount]);

  // WebSocket: presence channel

  useEffect(() => {
    if (!user?.id) return;

    refreshEchoAuthHeaders();
    echo.join('online-users')
      .here((members) => {
        setOnlineUsers(new Set(members.map(m => m.id)));
      })
      .joining((member) => {
        setOnlineUsers(prev => new Set([...prev, member.id]));
      })
      .leaving((member) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          next.delete(member.id);
          return next;
        });
      });

    presenceApi.update(true).catch(() => {});

    const handleUnload = () => presenceApi.update(false).catch(() => {});
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      echo.leave('online-users');
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [user?.id]);

  // Initial load

  useEffect(() => {
    queueMicrotask(() => {
      fetchConversations();
      fetchUnreadCount();
    });
  }, [fetchConversations, fetchUnreadCount]);

  // First load, and a one-time fetch when the open conversation changes.
  // This is the only path allowed to show a skeleton, and only while the thread is empty.
  useEffect(() => {
    let cancelled = false;
    const id = recipientId;

    if (!id) {
      loadedRecipientRef.current = null;
      return undefined;
    }

    if (loadedRecipientRef.current === String(id)) return undefined;

    const showSkeleton = !didInitialLoadRef.current;
    if (showSkeleton) setLoading(true);

    fetchThread(id, { replace: true }).finally(() => {
      if (cancelled) return;
      loadedRecipientRef.current = String(id);
      didInitialLoadRef.current = true;
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [recipientId, fetchThread]);

  // Background refresh. Never toggles loading and never replaces or clears the thread.
  useEffect(() => {
    const timer = setInterval(() => {
      fetchConversations();
      fetchUnreadCount();
      const id = recipientRef.current;
      if (id) fetchThread(id, { replace: false });
    }, 8000);

    return () => clearInterval(timer);
  }, [fetchConversations, fetchUnreadCount, fetchThread]);

  return {
    conversations,
    thread,
    loading,
    error,
    isTyping,
    onlineUsers,
    unreadTotal,
    sendMessage,
    markRead,
    onKeystroke,
    fetchConversations,
    fetchThread,
    fetchUnreadCount,
  };
}
