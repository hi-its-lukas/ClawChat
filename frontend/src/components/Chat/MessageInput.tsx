import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { renderContent } from '../../utils/markdown';
import api from '../../services/api';
import type { Message } from '../../types';

interface MessageInputProps {
  channelId: string;
  onSend: (content: string) => Promise<Message | undefined | void>;
  placeholder?: string;
}

export function MessageInput({ channelId, onSend, placeholder }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocket();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    textareaRef.current?.focus();
  }, [channelId]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
    if (socket) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.emit('typing', { channelId });
      typingTimeoutRef.current = setTimeout(() => {}, 2000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if ((!trimmed && pendingFiles.length === 0) || sending) return;

    setSending(true);
    try {
      const msgContent = trimmed || '(file)';
      const result = await onSend(msgContent);

      // Upload pending files if we got a message back
      if (result && 'id' in result && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('message_id', result.id);
          await api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      setContent('');
      setPendingFiles([]);
      setShowPreview(false);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err) {
      console.error('Failed to send:', err);
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
      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingFiles.map((file, i) => (
            <div key={i} className="flex items-center gap-2 bg-slate-700 rounded px-3 py-1.5 text-sm text-slate-300">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button onClick={() => removePendingFile(i)} className="text-slate-400 hover:text-red-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-slate-700 rounded-lg">
        {/* Markdown preview */}
        {showPreview && content.trim() ? (
          <div className="min-h-[40px] max-h-[200px] overflow-y-auto text-white text-sm px-4 py-3 border-b border-slate-600">
            <div className="text-xs text-slate-400 mb-1">Preview</div>
            <div className="break-words whitespace-pre-wrap">{renderContent(content)}</div>
          </div>
        ) : null}

        <div className="flex items-end">
          {/* File upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-slate-400 hover:text-white transition-colors"
            title="Attach file"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.md,.zip"
          />

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Type a message...'}
            rows={1}
            className="flex-1 bg-transparent text-white text-sm py-3 resize-none focus:outline-none placeholder-slate-400"
            disabled={sending}
          />

          {/* Preview toggle */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`p-3 transition-colors ${showPreview ? 'text-indigo-400' : 'text-slate-400 hover:text-white'}`}
            title="Toggle preview"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={(!content.trim() && pendingFiles.length === 0) || sending}
            className="p-3 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-1 px-1">
        <kbd className="bg-slate-700 px-1 rounded">Enter</kbd> to send,{' '}
        <kbd className="bg-slate-700 px-1 rounded">Shift+Enter</kbd> for newline
      </p>
    </div>
  );
}
