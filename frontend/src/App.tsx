import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ChannelProvider } from './contexts/ChannelContext';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { ChatView } from './components/Chat/ChatView';
import { ThreadPanel } from './components/Thread/ThreadPanel';
import { LoginPage } from './components/Auth/LoginPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
            <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
            <div className="flex-1 flex overflow-hidden">
              <ChatView onThreadClick={(id) => setActiveThread(id)} />
              {activeThread && (
                <ThreadPanel threadId={activeThread} onClose={() => setActiveThread(null)} />
              )}
            </div>
          </div>
        </div>
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
