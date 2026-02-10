import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';
import type { Channel } from '../types';

interface ChannelContextType {
  channels: Channel[];
  currentChannel: Channel | null;
  setCurrentChannel: (channel: Channel | null) => void;
  fetchChannels: () => Promise<void>;
  createChannel: (name: string, description?: string, type?: string) => Promise<Channel>;
  joinChannel: (channelId: string) => Promise<void>;
  leaveChannel: (channelId: string) => Promise<void>;
}

const ChannelContext = createContext<ChannelContextType | null>(null);

export function ChannelProvider({ children }: { children: React.ReactNode }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);

  const fetchChannels = useCallback(async () => {
    const { data } = await api.get<Channel[]>('/channels');
    setChannels(data);
  }, []);

  const createChannel = useCallback(async (name: string, description?: string, type?: string) => {
    const { data } = await api.post<Channel>('/channels', { name, description, type });
    setChannels((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  }, []);

  const joinChannel = useCallback(async (channelId: string) => {
    await api.post(`/channels/${channelId}/join`);
    await fetchChannels();
  }, [fetchChannels]);

  const leaveChannel = useCallback(async (channelId: string) => {
    await api.post(`/channels/${channelId}/leave`);
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
    if (currentChannel?.id === channelId) {
      setCurrentChannel(null);
    }
  }, [currentChannel]);

  return (
    <ChannelContext.Provider
      value={{ channels, currentChannel, setCurrentChannel, fetchChannels, createChannel, joinChannel, leaveChannel }}
    >
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannels() {
  const context = useContext(ChannelContext);
  if (!context) throw new Error('useChannels must be used within ChannelProvider');
  return context;
}
