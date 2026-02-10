import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import type { Message } from '../types';

export function useMessages(channelId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { socket } = useSocket();

  const fetchMessages = useCallback(async (before?: string) => {
    if (!channelId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (before) params.set('before', before);

      const { data } = await api.get<Message[]>(`/channels/${channelId}/messages?${params}`);
      if (before) {
        setMessages((prev) => [...data, ...prev]);
      } else {
        setMessages(data);
      }
      setHasMore(data.length === 50);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  // Initial fetch
  useEffect(() => {
    if (channelId) {
      setMessages([]);
      setHasMore(true);
      fetchMessages();
    }
  }, [channelId, fetchMessages]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !channelId) return;

    socket.emit('join_channel', { channelId });

    const handleNewMessage = (data: { message: Message; channelId: string }) => {
      if (data.channelId === channelId && !data.message.thread_id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    };

    const handleMessageEdited = (data: { message: Message }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.message.id ? { ...m, ...data.message } : m))
      );
    };

    const handleMessageDeleted = (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      socket.emit('leave_channel', { channelId });
      socket.off('new_message', handleNewMessage);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [socket, channelId]);

  const sendMessage = useCallback(async (content: string, threadId?: string) => {
    if (!channelId) return;
    const { data } = await api.post<Message>(`/channels/${channelId}/messages`, {
      content,
      thread_id: threadId,
    });
    return data;
  }, [channelId]);

  const loadMore = useCallback(() => {
    if (messages.length > 0 && hasMore) {
      fetchMessages(messages[0].id);
    }
  }, [messages, hasMore, fetchMessages]);

  return { messages, loading, hasMore, sendMessage, loadMore };
}
