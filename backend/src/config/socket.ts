import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, AuthUser } from '../middleware/auth';
import { query } from './database';

interface AuthSocket extends Socket {
  user?: AuthUser;
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
      // Bot authentication via API key handled separately
      // For simplicity, we verify the API key asynchronously
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
    console.log(`User connected: ${user.username} (${user.id})`);

    // Update user's last_seen
    query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]).catch(console.error);

    // Join channel room
    socket.on('join_channel', (data: { channelId: string }) => {
      socket.join(`channel:${data.channelId}`);
      console.log(`${user.username} joined channel:${data.channelId}`);
    });

    // Leave channel room
    socket.on('leave_channel', (data: { channelId: string }) => {
      socket.leave(`channel:${data.channelId}`);
    });

    // Join thread room
    socket.on('join_thread', (data: { threadId: string }) => {
      socket.join(`thread:${data.threadId}`);
    });

    // Leave thread room
    socket.on('leave_thread', (data: { threadId: string }) => {
      socket.leave(`thread:${data.threadId}`);
    });

    // Typing indicator
    socket.on('typing', (data: { channelId: string; threadId?: string }) => {
      const target = data.threadId ? `thread:${data.threadId}` : `channel:${data.channelId}`;
      socket.to(target).emit('user_typing', {
        user: { id: user.id, username: user.username },
        channelId: data.channelId,
        threadId: data.threadId,
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user.username}`);
      query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]).catch(console.error);
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
