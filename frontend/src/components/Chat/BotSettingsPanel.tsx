import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { Button } from '../UI/Button';
import type { ChannelBotSettings } from '../../types';

interface BotSettingsPanelProps {
  channelId: string;
  onClose: () => void;
}

export function BotSettingsPanel({ channelId, onClose }: BotSettingsPanelProps) {
  const [settings, setSettings] = useState<ChannelBotSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editable fields for the first bot (most common case)
  const [responseMode, setResponseMode] = useState<'mention' | 'always' | 'muted'>('mention');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [maxResponseLength, setMaxResponseLength] = useState(2000);
  const [enableThreads, setEnableThreads] = useState(true);
  const [enableReactions, setEnableReactions] = useState(false);
  const [enableFileRead, setEnableFileRead] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<ChannelBotSettings[]>(`/channels/${channelId}/bot-settings`);
      setSettings(data);
      if (data.length > 0) {
        const s = data[0];
        setResponseMode(s.response_mode);
        setSystemPrompt(s.system_prompt || '');
        setMaxResponseLength(s.max_response_length);
        setEnableThreads(s.enable_threads);
        setEnableReactions(s.enable_reactions);
        setEnableFileRead(s.enable_file_read);
      }
    } catch {
      setError('Failed to load bot settings');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (settings.length === 0) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.put(`/channels/${channelId}/bot-settings`, {
        bot_id: settings[0].bot_id,
        response_mode: responseMode,
        system_prompt: systemPrompt || null,
        max_response_length: maxResponseLength,
        enable_threads: enableThreads,
        enable_reactions: enableReactions,
        enable_file_read: enableFileRead,
      });
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col h-full">
        <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4 shrink-0">
          <h3 className="font-semibold text-white">Bot Settings</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (settings.length === 0) {
    return (
      <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col h-full">
        <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4 shrink-0">
          <h3 className="font-semibold text-white">Bot Settings</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-500 p-4 text-center">
          <div>
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p>No bot configured for this channel.</p>
            <p className="text-sm mt-1">Add a bot to configure its behavior.</p>
          </div>
        </div>
      </div>
    );
  }

  const botName = settings[0].bot?.username || 'Bot';

  return (
    <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4 shrink-0">
        <h3 className="font-semibold text-white">Bot Settings</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Bot name */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">{botName}</p>
              <p className="text-xs text-slate-400">Bot Configuration</p>
            </div>
          </div>
        </div>

        {/* Response Mode */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Response Mode</label>
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-2 rounded hover:bg-slate-700/50 cursor-pointer transition-colors">
              <input
                type="radio"
                name="responseMode"
                value="muted"
                checked={responseMode === 'muted'}
                onChange={() => setResponseMode('muted')}
                className="mt-1 accent-indigo-500"
              />
              <div>
                <p className="text-sm text-white">Disabled (muted)</p>
                <p className="text-xs text-slate-400">Bot will not respond to any messages</p>
              </div>
            </label>
            <label className="flex items-start gap-3 p-2 rounded hover:bg-slate-700/50 cursor-pointer transition-colors">
              <input
                type="radio"
                name="responseMode"
                value="mention"
                checked={responseMode === 'mention'}
                onChange={() => setResponseMode('mention')}
                className="mt-1 accent-indigo-500"
              />
              <div>
                <p className="text-sm text-white">Only on @mention</p>
                <p className="text-xs text-slate-400">Bot responds when mentioned (@{botName})</p>
              </div>
            </label>
            <label className="flex items-start gap-3 p-2 rounded hover:bg-slate-700/50 cursor-pointer transition-colors">
              <input
                type="radio"
                name="responseMode"
                value="always"
                checked={responseMode === 'always'}
                onChange={() => setResponseMode('always')}
                className="mt-1 accent-indigo-500"
              />
              <div>
                <p className="text-sm text-white">Always respond</p>
                <p className="text-xs text-slate-400">Bot responds to all messages in this channel</p>
              </div>
            </label>
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Advanced Settings
        </button>

        {showAdvanced && (
          <div className="space-y-4 pl-2 border-l-2 border-slate-700">
            {/* System Prompt */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">System Prompt (optional)</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Custom instructions for the bot in this channel..."
                rows={3}
                className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">Overrides the bot's default behavior for this channel</p>
            </div>

            {/* Max Response Length */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Max Response Length</label>
              <input
                type="number"
                value={maxResponseLength}
                onChange={(e) => setMaxResponseLength(Math.max(100, Math.min(10000, parseInt(e.target.value) || 2000)))}
                min={100}
                max={10000}
                className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-500 mt-1">Maximum characters per bot response (100-10000)</p>
            </div>

            {/* Feature Toggles */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableThreads}
                  onChange={(e) => setEnableThreads(e.target.checked)}
                  className="accent-indigo-500"
                />
                <div>
                  <p className="text-sm text-white">Enable Threads</p>
                  <p className="text-xs text-slate-400">Bot can respond in threads</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableReactions}
                  onChange={(e) => setEnableReactions(e.target.checked)}
                  className="accent-indigo-500"
                />
                <div>
                  <p className="text-sm text-white">Enable Reactions</p>
                  <p className="text-xs text-slate-400">Bot can add emoji reactions</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableFileRead}
                  onChange={(e) => setEnableFileRead(e.target.checked)}
                  className="accent-indigo-500"
                />
                <div>
                  <p className="text-sm text-white">Enable File Reading</p>
                  <p className="text-xs text-slate-400">Bot can read uploaded files</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm rounded px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-900/50 border border-emerald-700 text-emerald-300 text-sm rounded px-3 py-2">
            {success}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="p-4 border-t border-slate-700">
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
