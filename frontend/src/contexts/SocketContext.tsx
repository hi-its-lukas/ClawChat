import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  onlineUsers: string[];
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false, onlineUsers: [] });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
        setOnlineUsers([]);
      }
      return;
    }

    const newSocket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));

    // Online/offline tracking
    newSocket.on('online_users', (userIds: string[]) => setOnlineUsers(userIds));
    newSocket.on('user_online', (data: { userId: string }) => {
      setOnlineUsers((prev) => (prev.includes(data.userId) ? prev : [...prev, data.userId]));
    });
    newSocket.on('user_offline', (data: { userId: string }) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== data.userId));
    });

    // Browser notifications for mentions
    newSocket.on('new_message', (data: { message: { content: string; author: { username: string } } }) => {
      if (document.hidden && user) {
        const mentionPattern = new RegExp(`@${user.username}\\b`, 'i');
        if (mentionPattern.test(data.message.content) && Notification.permission === 'granted') {
          new Notification(`${data.message.author.username} mentioned you`, {
            body: data.message.content.slice(0, 100),
            icon: '/vite.svg',
          });
        }
      }
    });

    setSocket(newSocket);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      newSocket.disconnect();
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SocketContext.Provider value={{ socket, connected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
