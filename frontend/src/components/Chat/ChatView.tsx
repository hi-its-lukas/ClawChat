import React from 'react';
import { useMessages } from '../../hooks/useMessages';
import { useChannels } from '../../contexts/ChannelContext';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';

interface ChatViewProps {
  onThreadClick: (messageId: string) => void;
}

export function ChatView({ onThreadClick }: ChatViewProps) {
  const { currentChannel } = useChannels();
  const { messages, loading, hasMore, sendMessage, loadMore } = useMessages(currentChannel?.id || null);

  if (!currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-900">
        <div className="text-center text-slate-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <h3 className="text-lg font-medium text-slate-400">Welcome to ClawChat</h3>
          <p className="mt-1">Select a channel from the sidebar to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-900">
      <MessageList
        messages={messages}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onThreadClick={onThreadClick}
      />
      <TypingIndicator channelId={currentChannel.id} />
      <MessageInput
        channelId={currentChannel.id}
        onSend={(content) => sendMessage(content)}
        placeholder={`Message #${currentChannel.name}`}
      />
    </div>
  );
}
