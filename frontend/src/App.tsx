import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ChannelProvider, useChannels } from './contexts/ChannelContext';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { ChatView } from './components/Chat/ChatView';
import { ThreadPanel } from './components/Thread/ThreadPanel';
import { BotSettingsPanel } from './components/Chat/BotSettingsPanel';
import { SearchPanel } from './components/Chat/SearchPanel';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { LoginPage } from './components/Auth/LoginPage';

function AppLayout() {
  const { currentChannel } = useChannels();
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBotSettings, setShowBotSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleToggleBotSettings = () => {
    if (!showBotSettings) {
      setActiveThread(null);
      setShowSearch(false);
    }
    setShowBotSettings(!showBotSettings);
  };

  const handleToggleSearch = () => {
    if (!showSearch) {
      setActiveThread(null);
      setShowBotSettings(false);
    }
    setShowSearch(!showSearch);
  };

  const handleThreadClick = (id: string) => {
    setShowBotSettings(false);
    setShowSearch(false);
    setActiveThread(id);
  };

  // Keyboard shortcut: Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleToggleSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-auto transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar onOpenSettings={() => setShowSettings(true)} />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleBotSettings={handleToggleBotSettings}
          onToggleSearch={handleToggleSearch}
        />
        <div className="flex-1 flex overflow-hidden">
          <ChatView onThreadClick={handleThreadClick} />
          {activeThread && <ThreadPanel threadId={activeThread} onClose={() => setActiveThread(null)} />}
          {showBotSettings && currentChannel && (
            <BotSettingsPanel channelId={currentChannel.id} onClose={() => setShowBotSettings(false)} />
          )}
          {showSearch && <SearchPanel onClose={() => setShowSearch(false)} />}
        </div>
      </div>

      {/* Settings overlay */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <SocketProvider>
      <ChannelProvider>
        <AppLayout />
      </ChannelProvider>
    </SocketProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
