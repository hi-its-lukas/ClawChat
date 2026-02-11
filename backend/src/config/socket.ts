import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, AuthUser } from '../middleware/auth';
import { query } from './database';

interface AuthSocket extends Socket {
  user?: AuthUser;
}

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map<string, Set<string>>();

export function getOnlineUserIds(): string[] {
  return Array.from(onlineUsers.keys());
}

export function setupSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
  });

  // Authentication middleware
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const apiKey = socket.handshake.query?.api_key;

    if (token) {
      try {
        const user = verifyToken(token as string);
        socket.user = user;
        return next();
      } catch {
        return next(new Error('Invalid token'));
      }
    }

    if (apiKey) {
      verifyBotApiKey(apiKey as string)
        .then((user) => {
          if (user) {
            socket.user = user;
            next();
          } else {
            next(new Error('Invalid API key'));
          }
        })
        .catch(() => next(new Error('Authentication failed')));
      return;
    }

    next(new Error('No authentication provided'));
  });

  io.on('connection', (socket: AuthSocket) => {
    const user = socket.user!;

    // Track online status
    if (!onlineUsers.has(user.id)) {
      onlineUsers.set(user.id, new Set());
    }
    onlineUsers.get(user.id)!.add(socket.id);

    // Broadcast online status to all
    io.emit('user_online', { userId: user.id, username: user.username });
    // Send current online list to this client
    socket.emit('online_users', getOnlineUserIds());

    // Update user's last_seen
    query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]).catch(console.error);

    socket.on('join_channel', (data: { channelId: string }) => {
      socket.join(`channel:${data.channelId}`);
    });

    socket.on('leave_channel', (data: { channelId: string }) => {
      socket.leave(`channel:${data.channelId}`);
    });

    socket.on('join_thread', (data: { threadId: string }) => {
      socket.join(`thread:${data.threadId}`);
    });

    socket.on('leave_thread', (data: { threadId: string }) => {
      socket.leave(`thread:${data.threadId}`);
    });

    socket.on('typing', (data: { channelId: string; threadId?: string }) => {
      const target = data.threadId ? `thread:${data.threadId}` : `channel:${data.channelId}`;
      socket.to(target).emit('user_typing', {
        user: { id: user.id, username: user.username },
        channelId: data.channelId,
        threadId: data.threadId,
      });
    });

    socket.on('disconnect', () => {
      query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]).catch(console.error);

      const sockets = onlineUsers.get(user.id);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(user.id);
          io.emit('user_offline', { userId: user.id });
        }
      }
    });
  });

  return io;
}

async function verifyBotApiKey(apiKey: string): Promise<AuthUser | null> {
  const result = await query(
    'SELECT id, username, role, is_bot, api_key FROM users WHERE is_bot = true',
    []
  );

  const bcrypt = await import('bcrypt');
  for (const bot of result.rows) {
    if (bot.api_key && await bcrypt.default.compare(apiKey, bot.api_key)) {
      return {
        id: bot.id,
        username: bot.username,
        role: bot.role,
        is_bot: true,
      };
    }
  }

  return null;
}
