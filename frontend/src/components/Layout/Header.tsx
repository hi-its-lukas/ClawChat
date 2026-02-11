import React from 'react';
import { useChannels } from '../../contexts/ChannelContext';

interface HeaderProps {
  onToggleSidebar?: () => void;
  onToggleBotSettings?: () => void;
}

export function Header({ onToggleSidebar, onToggleBotSettings }: HeaderProps) {
  const { currentChannel } = useChannels();

  return (
    <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 shrink-0">
      {/* Mobile menu button */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden mr-3 text-slate-400 hover:text-white transition-colors"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {currentChannel ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-slate-400 text-lg">#</span>
          <h2 className="text-white font-semibold">{currentChannel.name}</h2>
          {currentChannel.description && (
            <>
              <span className="text-slate-600 mx-2">|</span>
              <span className="text-slate-400 text-sm truncate">{currentChannel.description}</span>
            </>
          )}
        </div>
      ) : (
        <h2 className="text-slate-400 flex-1">Select a channel</h2>
      )}

      {/* Bot Settings button */}
      {currentChannel && (
        <button
          onClick={onToggleBotSettings}
          className="ml-2 p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          title="Bot Settings"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>
      )}
    </header>
  );
}
