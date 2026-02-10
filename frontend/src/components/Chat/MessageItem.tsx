import React from 'react';
import type { Message } from '../../types';

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

function renderContent(content: string): React.ReactNode {
  // Simple markdown: bold, code, inline code
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*|>[^\n]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const code = part.slice(3, -3).replace(/^\w+\n/, '');
      return <pre key={i} className="bg-slate-950 rounded p-3 my-2 text-sm overflow-x-auto"><code>{code}</code></pre>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-slate-950 px-1.5 py-0.5 rounded text-sm text-pink-400">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('>')) {
      return <blockquote key={i} className="border-l-4 border-slate-600 pl-3 my-1 text-slate-400">{part.slice(1).trim()}</blockquote>;
    }
    // Highlight @mentions
    return part.split(/(@\w+)/g).map((seg, j) =>
      seg.startsWith('@') ? (
        <span key={`${i}-${j}`} className="bg-indigo-900/50 text-indigo-300 px-1 rounded">{seg}</span>
      ) : seg
    );
  });
}

export function MessageItem({ message, onThreadClick }: MessageItemProps) {
  return (
    <div className="group flex gap-3 px-4 py-2 hover:bg-slate-800/50 transition-colors">
      {/* Avatar */}
      <div className="shrink-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${
          message.author?.is_bot ? 'bg-emerald-600' : 'bg-indigo-600'
        }`}>
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
          {message.edited_at && (
            <span className="text-xs text-slate-500">(edited)</span>
          )}
        </div>
        <div className="text-sm text-slate-200 mt-0.5 break-words whitespace-pre-wrap">
          {renderContent(message.content)}
        </div>

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
      <div className="hidden group-hover:flex items-start gap-1 shrink-0">
        <button
          onClick={() => onThreadClick(message.id)}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          title="Reply in thread"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
