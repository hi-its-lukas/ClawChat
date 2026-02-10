import React from 'react';
import { useThread } from '../../hooks/useThread';
import { MessageItem } from '../Chat/MessageItem';
import { MessageInput } from '../Chat/MessageInput';

interface ThreadPanelProps {
  threadId: string | null;
  onClose: () => void;
}

export function ThreadPanel({ threadId, onClose }: ThreadPanelProps) {
  const { threadData, loading, sendReply } = useThread(threadId);

  if (!threadId) return null;

  return (
    <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4 shrink-0">
        <h3 className="font-semibold text-white">Thread</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      ) : threadData ? (
        <>
          {/* Root message */}
          <div className="border-b border-slate-700">
            <MessageItem message={threadData.rootMessage} onThreadClick={() => {}} />
          </div>

          {/* Reply count */}
          {threadData.messages.length > 0 && (
            <div className="px-4 py-2 border-b border-slate-700">
              <span className="text-xs text-slate-400">
                {threadData.messages.length} {threadData.messages.length === 1 ? 'reply' : 'replies'}
              </span>
            </div>
          )}

          {/* Replies */}
          <div className="flex-1 overflow-y-auto">
            {threadData.messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} onThreadClick={() => {}} />
            ))}
          </div>

          {/* Reply input */}
          <MessageInput
            channelId={threadData.rootMessage.channel_id}
            onSend={async (content) => {
              await sendReply(content);
            }}
            placeholder="Reply in thread..."
          />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Thread not found
        </div>
      )}
    </div>
  );
}
