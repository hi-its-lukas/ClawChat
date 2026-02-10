import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';

interface MessageInputProps {
  channelId: string;
  onSend: (content: string) => Promise<void>;
  placeholder?: string;
}

export function MessageInput({ channelId, onSend, placeholder }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { socket } = useSocket();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    textareaRef.current?.focus();
  }, [channelId]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    // Auto-resize
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }

    // Typing indicator
    if (socket) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.emit('typing', { channelId });
      typingTimeoutRef.current = setTimeout(() => {}, 2000);
    }
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="px-4 pb-4">
      <div className="bg-slate-700 rounded-lg flex items-end">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Type a message...'}
          rows={1}
          className="flex-1 bg-transparent text-white text-sm px-4 py-3 resize-none focus:outline-none placeholder-slate-400"
          disabled={sending}
        />
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || sending}
          className="p-3 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-1 px-1">
        <kbd className="bg-slate-700 px-1 rounded">Enter</kbd> to send, <kbd className="bg-slate-700 px-1 rounded">Shift+Enter</kbd> for newline
      </p>
    </div>
  );
}
