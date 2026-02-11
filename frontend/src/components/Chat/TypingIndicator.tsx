import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import type { TypingUser } from '../../types';

interface TypingIndicatorProps {
  channelId: string;
}

export function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const { socket } = useSocket();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!socket) return;

    const handleTyping = (data: { user: TypingUser; channelId: string }) => {
      if (data.channelId !== channelId) return;

      setTypingUsers((prev) => {
        if (prev.some((u) => u.id === data.user.id)) return prev;
        return [...prev, data.user];
      });

      // Clear existing timeout for this user
      const existing = timeoutsRef.current.get(data.user.id);
      if (existing) clearTimeout(existing);

      // Auto-remove after 3 seconds
      const timeout = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.id !== data.user.id));
        timeoutsRef.current.delete(data.user.id);
      }, 3000);
      timeoutsRef.current.set(data.user.id, timeout);
    };

    socket.on('user_typing', handleTyping);
    return () => {
      socket.off('user_typing', handleTyping);
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, [socket, channelId]);

  // Reset when channel changes
  useEffect(() => {
    setTypingUsers([]);
  }, [channelId]);

  if (typingUsers.length === 0) return null;

  const names = typingUsers.map((u) => u.username);
  let text: string;
  if (names.length === 1) {
    text = `${names[0]} is typing`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing`;
  } else {
    text = `${names.length} people are typing`;
  }

  return (
    <div className="px-4 py-1 text-xs text-slate-400 flex items-center gap-1">
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </span>
      <span>{text}</span>
    </div>
  );
}
