import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import type { ThreadData, Message } from '../types';

export function useThread(threadId: string | null) {
  const [threadData, setThreadData] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(false);
  const { socket } = useSocket();

  const fetchThread = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    try {
      const { data } = await api.get<ThreadData>(`/threads/${threadId}`);
      setThreadData(data);
    } catch (err) {
      console.error('Failed to fetch thread:', err);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    if (threadId) {
      fetchThread();
    } else {
      setThreadData(null);
    }
  }, [threadId, fetchThread]);

  // Socket listeners for thread
  useEffect(() => {
    if (!socket || !threadId) return;

    socket.emit('join_thread', { threadId });

    const handleThreadReply = (data: { message: Message; threadId: string }) => {
      if (data.threadId === threadId) {
        setThreadData((prev) => {
          if (!prev) return prev;
          if (prev.messages.some((m) => m.id === data.message.id)) return prev;
          return {
            ...prev,
            messages: [...prev.messages, data.message],
          };
        });
      }
    };

    socket.on('thread_reply', handleThreadReply);

    return () => {
      socket.emit('leave_thread', { threadId });
      socket.off('thread_reply', handleThreadReply);
    };
  }, [socket, threadId]);

  const sendReply = useCallback(async (content: string) => {
    if (!threadId) return;
    const { data } = await api.post<Message>(`/threads/${threadId}/messages`, { content });
    return data;
  }, [threadId]);

  return { threadData, loading, sendReply, refetch: fetchThread };
}
