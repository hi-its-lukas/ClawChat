import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ChannelProvider, useChannels } from './contexts/ChannelContext';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { ChatView } from './components/Chat/ChatView';
import { ThreadPanel } from './components/Thread/ThreadPanel';
import { BotSettingsPanel } from './components/Chat/BotSettingsPanel';
import { LoginPage } from './components/Auth/LoginPage';

function AppLayout() {
  const { currentChannel } = useChannels();
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBotSettings, setShowBotSettings] = useState(false);

  const handleToggleBotSettings = () => {
    if (!showBotSettings) {
      setActiveThread(null); // Close thread panel when opening bot settings
    }
    setShowBotSettings(!showBotSettings);
  };

  const handleThreadClick = (id: string) => {
    setShowBotSettings(false); // Close bot settings when opening thread
    setActiveThread(id);
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-auto transform transition-transform duration-200 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <Sidebar />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleBotSettings={handleToggleBotSettings}
        />
        <div className="flex-1 flex overflow-hidden">
          <ChatView onThreadClick={handleThreadClick} />
          {activeThread && (
            <ThreadPanel threadId={activeThread} onClose={() => setActiveThread(null)} />
          )}
          {showBotSettings && currentChannel && (
            <BotSettingsPanel
              channelId={currentChannel.id}
              onClose={() => setShowBotSettings(false)}
            />
          )}
        </div>
      </div>
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
