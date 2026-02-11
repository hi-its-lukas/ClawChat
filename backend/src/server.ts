import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { setupSocket } from './config/socket';
import { generalLimiter } from './middleware/rateLimit';
import { sanitizeInput } from './middleware/validation';
import authRoutes from './routes/auth';
import channelRoutes from './routes/channels';
import messageRoutes from './routes/messages';
import threadRoutes from './routes/threads';
import botRoutes from './routes/bot';
import uploadRoutes from './routes/upload';
import botSettingsRoutes from './routes/botSettings';
import profileRoutes from './routes/profile';
import adminRoutes from './routes/admin';
import searchRoutes from './routes/search';
import reactionRoutes from './routes/reactions';
import dmRoutes from './routes/dm';
import runMigrations from './migrations/run';
import { seedDatabase } from './migrations/seed';

const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = setupSocket(server);
app.set('io', io);

// Middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInput);
app.use('/api', generalLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/channels', botSettingsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/dm', dmRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start() {
  try {
    // Run migrations
    await runMigrations();

    // Seed default data
    await seedDatabase();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`ClawChat server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
