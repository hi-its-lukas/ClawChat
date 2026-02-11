import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { Button } from '../UI/Button';
import { Modal } from '../UI/Modal';
import type { User } from '../../types';

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetPwModal, setShowResetPwModal] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<User | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState<{ users: number; channels: number; messages: number; bots: number } | null>(null);

  // Create user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newIsBot, setNewIsBot] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);

  // Reset password
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get<User[]>('/admin/users'),
        api.get('/admin/stats'),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch {
      setMsg({ type: 'error', text: 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMsg(null);
    setCreatedApiKey(null);

    try {
      const { data } = await api.post<{ user: User; api_key?: string }>('/admin/users', {
        username: newUsername,
        password: newPassword,
        email: newEmail || undefined,
        role: newRole,
        is_bot: newIsBot,
      });
      if (data.api_key) {
        setCreatedApiKey(data.api_key);
      } else {
        setShowCreateModal(false);
        setMsg({ type: 'success', text: `User "${data.user.username}" created` });
      }
      setNewUsername('');
      setNewPassword('');
      setNewEmail('');
      setNewRole('user');
      setNewIsBot(false);
      fetchUsers();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to create user' });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleRole = async (user: User) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await api.put(`/admin/users/${user.id}`, { role: newRole });
      fetchUsers();
      setMsg({ type: 'success', text: `${user.username} is now ${newRole}` });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update role' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showResetPwModal) return;
    setResetting(true);
    try {
      await api.put(`/admin/users/${showResetPwModal.id}/password`, { new_password: resetPassword });
      setShowResetPwModal(null);
      setResetPassword('');
      setMsg({ type: 'success', text: `Password reset for ${showResetPwModal.username}` });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to reset password' });
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteModal) return;
    try {
      await api.delete(`/admin/users/${showDeleteModal.id}`);
      setShowDeleteModal(null);
      setMsg({ type: 'success', text: `User "${showDeleteModal.username}" deleted` });
      fetchUsers();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to delete user' });
    }
  };

  const handleRegenerateApiKey = async (user: User) => {
    try {
      const { data } = await api.post<{ api_key: string }>(`/admin/users/${user.id}/regenerate-api-key`);
      setMsg({ type: 'success', text: `New API key for ${user.username}: ${data.api_key}` });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to regenerate API key' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Users', value: stats.users },
            { label: 'Channels', value: stats.channels },
            { label: 'Messages', value: stats.messages },
            { label: 'Bots', value: stats.bots },
          ].map((s) => (
            <div key={s.label} className="bg-slate-700/50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      {msg && (
        <div className={`text-sm rounded px-3 py-2 break-all ${
          msg.type === 'success'
            ? 'bg-emerald-900/50 border border-emerald-700 text-emerald-300'
            : 'bg-red-900/50 border border-red-700 text-red-300'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Header + Create button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Users</h3>
        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          + New User
        </Button>
      </div>

      {/* User List */}
      <div className="space-y-2">
        {users.map((user) => (
          <div key={user.id} className="bg-slate-700/50 rounded-lg p-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 ${
              user.is_bot ? 'bg-emerald-600' : user.role === 'admin' ? 'bg-amber-600' : 'bg-indigo-600'
            }`}>
              {user.is_bot ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              ) : (
                user.username.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate">{user.username}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  user.is_bot
                    ? 'bg-emerald-900 text-emerald-300'
                    : user.role === 'admin'
                    ? 'bg-amber-900 text-amber-300'
                    : 'bg-slate-600 text-slate-300'
                }`}>
                  {user.is_bot ? 'BOT' : user.role.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                {user.email || 'No email'} &middot; {user.last_seen ? `Seen ${new Date(user.last_seen).toLocaleDateString()}` : 'Never seen'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!user.is_bot && (
                <button
                  onClick={() => handleToggleRole(user)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                  title={user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </button>
              )}
              {user.is_bot && (
                <button
                  onClick={() => handleRegenerateApiKey(user)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                  title="Regenerate API Key"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setShowResetPwModal(user)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                title="Reset password"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </button>
              <button
                onClick={() => setShowDeleteModal(user)}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
                title="Delete user"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create User Modal */}
      <Modal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); setCreatedApiKey(null); }} title="Create User">
        {createdApiKey ? (
          <div>
            <p className="text-sm text-slate-300 mb-2">Bot created successfully! Save this API key - it won't be shown again:</p>
            <div className="bg-slate-900 rounded p-3 font-mono text-sm text-emerald-400 break-all select-all">
              {createdApiKey}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => { setShowCreateModal(false); setCreatedApiKey(null); }}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email (optional)</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="userType"
                  checked={!newIsBot}
                  onChange={() => { setNewIsBot(false); setNewRole('user'); }}
                  className="accent-indigo-500"
                />
                <span className="text-sm text-slate-300">Human User</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="userType"
                  checked={newIsBot}
                  onChange={() => { setNewIsBot(true); setNewRole('bot'); }}
                  className="accent-indigo-500"
                />
                <span className="text-sm text-slate-300">Bot</span>
              </label>
            </div>
            {!newIsBot && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !newUsername || !newPassword}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!showResetPwModal}
        onClose={() => { setShowResetPwModal(null); setResetPassword(''); }}
        title={`Reset Password: ${showResetPwModal?.username}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
              minLength={6}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => { setShowResetPwModal(null); setResetPassword(''); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={resetting || resetPassword.length < 6}>
              {resetting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        title="Delete User"
      >
        <p className="text-sm text-slate-300 mb-4">
          Are you sure you want to delete <strong className="text-white">{showDeleteModal?.username}</strong>?
          This will remove all their data and cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowDeleteModal(null)}>Cancel</Button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium rounded bg-red-600 hover:bg-red-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Delete User
          </button>
        </div>
      </Modal>
    </div>
  );
}
