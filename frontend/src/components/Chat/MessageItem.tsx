import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { EmojiPicker } from './EmojiPicker';
import { renderContent, formatFileSize } from '../../utils/markdown';
import type { Message, Reaction } from '../../types';

interface MessageItemProps {
  message: Message;
  onThreadClick: (messageId: string) => void;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

export function MessageItem({ message, onThreadClick }: MessageItemProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const isOwn = user?.id === message.author_id;
  const reactions: Reaction[] = message.reactions || [];

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmojiPicker]);

  const handleEdit = () => {
    setEditContent(message.content);
    setIsEditing(true);
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await api.put(`/messages/${message.id}`, { content: editContent.trim() });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to edit:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this message?')) return;
    try {
      await api.delete(`/messages/${message.id}`);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleReaction = async (emoji: string) => {
    setShowEmojiPicker(false);
    const existing = reactions.find((r) => r.emoji === emoji && r.me);
    try {
      if (existing) {
        await api.delete(`/reactions/${message.id}/${encodeURIComponent(emoji)}`);
      } else {
        await api.post(`/reactions/${message.id}`, { emoji });
      }
    } catch (err) {
      console.error('Reaction error:', err);
    }
  };

  return (
    <div className="group flex gap-3 px-4 py-2 hover:bg-slate-800/50 transition-colors">
      {/* Avatar */}
      <div className="shrink-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${
            message.author?.is_bot ? 'bg-emerald-600' : 'bg-indigo-600'
          }`}
        >
          {message.author?.is_bot ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ) : (
            message.author?.username?.charAt(0).toUpperCase() || '?'
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`font-semibold text-sm ${message.author?.is_bot ? 'text-emerald-400' : 'text-white'}`}>
            {message.author?.username || 'Unknown'}
          </span>
          {message.author?.is_bot && (
            <span className="bg-emerald-900 text-emerald-300 text-xs px-1.5 py-0.5 rounded font-medium">BOT</span>
          )}
          <span className="text-xs text-slate-500" title={new Date(message.created_at).toLocaleString()}>
            {formatDate(message.created_at)} {formatTime(message.created_at)}
          </span>
          {message.edited_at && <span className="text-xs text-slate-500">(edited)</span>}
        </div>

        {/* Edit mode or content */}
        {isEditing ? (
          <div className="mt-1">
            <textarea
              ref={editRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="w-full bg-slate-700 text-white text-sm rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
            />
            <div className="flex gap-2 mt-1">
              <button onClick={handleSaveEdit} className="text-xs text-indigo-400 hover:text-indigo-300">Save</button>
              <button onClick={() => setIsEditing(false)} className="text-xs text-slate-400 hover:text-slate-300">Cancel</button>
              <span className="text-xs text-slate-500">Esc to cancel, Enter to save</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-200 mt-0.5 break-words whitespace-pre-wrap">
            {renderContent(message.content)}
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att) =>
              att.mime_type?.startsWith('image/') ? (
                <a key={att.id} href={`/api/upload/${att.id}`} target="_blank" rel="noopener noreferrer">
                  <img
                    src={`/api/upload/${att.id}`}
                    alt={att.filename}
                    className="max-w-xs max-h-48 rounded border border-slate-700"
                  />
                </a>
              ) : (
                <a
                  key={att.id}
                  href={`/api/upload/${att.id}`}
                  className="flex items-center gap-2 bg-slate-700 rounded px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 transition-colors"
                  download
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {att.filename} ({formatFileSize(att.file_size)})
                </a>
              )
            )}
          </div>
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => handleReaction(r.emoji)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                  r.me
                    ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300'
                    : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
                }`}
                title={r.users.map((u) => u.username).join(', ')}
              >
                <span>{r.emoji}</span>
                <span>{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Thread indicator */}
        {message.reply_count && message.reply_count > 0 ? (
          <button
            onClick={() => onThreadClick(message.id)}
            className="mt-1 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : null}
      </div>

      {/* Hover actions */}
      <div className="hidden group-hover:flex items-start gap-1 shrink-0 relative">
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          title="Add reaction"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button
          onClick={() => onThreadClick(message.id)}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          title="Reply in thread"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        {isOwn && (
          <>
            <button
              onClick={handleEdit}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}

        {/* Emoji picker popup */}
        {showEmojiPicker && (
          <div ref={emojiRef} className="absolute right-0 top-8 z-50">
            <EmojiPicker onSelect={handleReaction} />
          </div>
        )}
      </div>
    </div>
  );
}
