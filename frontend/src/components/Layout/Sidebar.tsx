import React, { useState, useEffect } from 'react';
import { useChannels } from '../../contexts/ChannelContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import api from '../../services/api';
import type { User, Channel } from '../../types';

interface SidebarProps {
  onOpenSettings?: () => void;
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const { channels, currentChannel, setCurrentChannel, fetchChannels, createChannel } = useChannels();
  const { user, logout } = useAuth();
  const { connected, onlineUsers } = useSocket();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [dmChannels, setDmChannels] = useState<(Channel & { other_users?: User[] })[]>([]);
  const [showDmModal, setShowDmModal] = useState(false);
  const [dmUsers, setDmUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchChannels();
    fetchDms();
  }, [fetchChannels]);

  const fetchDms = async () => {
    try {
      const { data } = await api.get('/dm');
      setDmChannels(data);
    } catch {
      // ignore
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      const channel = await createChannel(newChannelName, newChannelDesc);
      setCurrentChannel(channel);
      setShowCreateModal(false);
      setNewChannelName('');
      setNewChannelDesc('');
    } catch (err) {
      console.error('Failed to create channel:', err);
    }
  };

  const openDmModal = async () => {
    try {
      const { data } = await api.get('/dm/users');
      setDmUsers(data);
      setShowDmModal(true);
    } catch {
      // ignore
    }
  };

  const handleCreateDm = async (userId: string) => {
    try {
      const { data } = await api.post('/dm', { user_id: userId });
      setShowDmModal(false);
      await fetchDms();
      await fetchChannels();
      setCurrentChannel(data);
    } catch (err) {
      console.error('Failed to create DM:', err);
    }
  };

  const regularChannels = channels.filter((c) => c.type !== 'direct');

  const getDmDisplayName = (dm: Channel & { other_users?: User[] }) => {
    if (dm.other_users && dm.other_users.length > 0) {
      return dm.other_users[0].username;
    }
    return dm.name.replace('dm-', '');
  };

  const getDmUserId = (dm: Channel & { other_users?: User[] }) => {
    return dm.other_users?.[0]?.id;
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 w-64 border-r border-slate-700">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">&#128062;</span> ClawChat
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-slate-400">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Channels Section */}
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Channels</span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-slate-400 hover:text-white transition-colors"
            title="Create channel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {regularChannels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => setCurrentChannel(channel)}
            className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${
              currentChannel?.id === channel.id
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span className="text-slate-400">
              {channel.type === 'private' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                '#'
              )}
            </span>
            <span className={channel.unread_count && channel.unread_count > 0 ? 'font-bold text-white' : ''}>
              {channel.name}
            </span>
            {channel.unread_count && channel.unread_count > 0 ? (
              <span className="ml-auto bg-indigo-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {channel.unread_count}
              </span>
            ) : null}
          </button>
        ))}

        {/* Direct Messages Section */}
        <div className="flex items-center justify-between px-2 mb-2 mt-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Direct Messages</span>
          <button
            onClick={openDmModal}
            className="text-slate-400 hover:text-white transition-colors"
            title="New message"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {dmChannels.map((dm) => {
          const otherUserId = getDmUserId(dm);
          const isOnline = otherUserId ? onlineUsers.includes(otherUserId) : false;
          return (
            <button
              key={dm.id}
              onClick={() => setCurrentChannel(dm)}
              className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 ${
                currentChannel?.id === dm.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="relative">
                <span className={`w-2 h-2 rounded-full inline-block ${isOnline ? 'bg-green-500' : 'bg-slate-500'}`} />
              </span>
              <span>{getDmDisplayName(dm)}</span>
            </button>
          );
        })}

        {dmChannels.length === 0 && (
          <p className="text-xs text-slate-500 px-3 py-1">No direct messages yet</p>
        )}
      </div>

      {/* User section */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.username}</p>
            <p className="text-xs text-slate-400">{user?.role}</p>
          </div>
          <button onClick={onOpenSettings} className="text-slate-400 hover:text-white transition-colors" title="Settings">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={logout} className="text-slate-400 hover:text-white transition-colors" title="Logout">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Create Channel Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Channel">
        <form onSubmit={handleCreateChannel}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-1">Channel name</label>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="new-channel"
              className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-1">Description (optional)</label>
            <input
              type="text"
              value={newChannelDesc}
              onChange={(e) => setNewChannelDesc(e.target.value)}
              placeholder="What's this channel about?"
              className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newChannelName.trim()}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* New DM Modal */}
      <Modal isOpen={showDmModal} onClose={() => setShowDmModal(false)} title="New Direct Message">
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {dmUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => handleCreateDm(u.id)}
              className="w-full text-left px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-3 transition-colors"
            >
              <div className="relative">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-800 ${
                    onlineUsers.includes(u.id) ? 'bg-green-500' : 'bg-slate-500'
                  }`}
                />
              </div>
              <span>{u.username}</span>
              {onlineUsers.includes(u.id) && (
                <span className="text-xs text-green-400 ml-auto">online</span>
              )}
            </button>
          ))}
          {dmUsers.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No users available</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
