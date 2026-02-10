import { Router, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { validateRequired } from '../middleware/validation';

const router = Router();

// GET /api/channels - List channels for current user
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, cm.joined_at, cm.last_read,
        (SELECT COUNT(*) FROM messages m
         WHERE m.channel_id = c.id
         AND m.created_at > COALESCE(cm.last_read, '1970-01-01')
         AND m.author_id != $1
        ) as unread_count
       FROM channels c
       INNER JOIN channel_members cm ON cm.channel_id = c.id
       WHERE cm.user_id = $1
       ORDER BY c.name`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List channels error:', err);
    res.status(500).json({ error: 'Failed to list channels' });
  }
});

// GET /api/channels/available - List all public channels
router.get('/available', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) as member_count
       FROM channels c WHERE c.type = 'public' ORDER BY c.name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Available channels error:', err);
    res.status(500).json({ error: 'Failed to list channels' });
  }
});

// POST /api/channels - Create channel
router.post('/', authMiddleware, validateRequired('name'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, type } = req.body;

    const channelName = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (channelName.length < 2 || channelName.length > 100) {
      return res.status(400).json({ error: 'Channel name must be 2-100 characters' });
    }

    const existing = await query('SELECT id FROM channels WHERE name = $1', [channelName]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Channel name already taken' });
    }

    const result = await query(
      'INSERT INTO channels (name, description, type, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [channelName, description || null, type || 'public', req.user!.id]
    );

    const channel = result.rows[0];

    // Auto-join creator
    await query(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)',
      [channel.id, req.user!.id]
    );

    res.status(201).json(channel);
  } catch (err) {
    console.error('Create channel error:', err);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// GET /api/channels/:id - Get channel details
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*,
        (SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'is_bot', u.is_bot, 'avatar_url', u.avatar_url))
         FROM channel_members cm2 JOIN users u ON u.id = cm2.user_id WHERE cm2.channel_id = c.id) as members
       FROM channels c WHERE c.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get channel error:', err);
    res.status(500).json({ error: 'Failed to get channel' });
  }
});

// GET /api/channels/:id/messages - List messages in channel
router.get('/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string;

    let sql = `
      SELECT m.*,
        json_build_object('id', u.id, 'username', u.username, 'is_bot', u.is_bot, 'avatar_url', u.avatar_url) as author,
        (SELECT COUNT(*) FROM messages r WHERE r.thread_id = m.id) as reply_count,
        (SELECT MAX(r2.created_at) FROM messages r2 WHERE r2.thread_id = m.id) as last_reply_at
      FROM messages m
      LEFT JOIN users u ON u.id = m.author_id
      WHERE m.channel_id = $1 AND m.thread_id IS NULL
    `;
    const params: unknown[] = [req.params.id];

    if (before) {
      sql += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = $${params.length + 1})`;
      params.push(before);
    }

    sql += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);

    // Update last_read
    await query(
      `UPDATE channel_members SET last_read = NOW() WHERE channel_id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );

    res.json(result.rows.reverse());
  } catch (err) {
    console.error('List messages error:', err);
    res.status(500).json({ error: 'Failed to list messages' });
  }
});

// POST /api/channels/:id/messages - Send message to channel
router.post('/:id/messages', authMiddleware, validateRequired('content'), async (req: AuthRequest, res: Response) => {
  try {
    const { content, thread_id, reply_to } = req.body;

    if (content.length > 10000) {
      return res.status(400).json({ error: 'Message too long (max 10000 characters)' });
    }

    const result = await query(
      `INSERT INTO messages (channel_id, author_id, content, thread_id, reply_to)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, req.user!.id, content, thread_id || null, reply_to || null]
    );

    const message = result.rows[0];

    // Get author info
    const authorResult = await query(
      'SELECT id, username, is_bot, avatar_url FROM users WHERE id = $1',
      [req.user!.id]
    );
    message.author = authorResult.rows[0];

    // If this is a thread reply, update thread metadata
    if (thread_id) {
      await query(
        `INSERT INTO threads (id, channel_id, root_message_id, reply_count, last_reply_at, participants)
         VALUES (gen_random_uuid(), $1, $2, 1, NOW(), ARRAY[$3]::uuid[])
         ON CONFLICT (root_message_id) DO UPDATE SET
           reply_count = threads.reply_count + 1,
           last_reply_at = NOW(),
           participants = CASE
             WHEN $3 = ANY(threads.participants) THEN threads.participants
             ELSE array_append(threads.participants, $3)
           END`,
        [req.params.id, thread_id, req.user!.id]
      );
    }

    // Emit via socket.io (handled by the socket module)
    const io = req.app.get('io');
    if (io) {
      if (thread_id) {
        io.to(`thread:${thread_id}`).emit('thread_reply', { message, threadId: thread_id });
      }
      io.to(`channel:${req.params.id}`).emit('new_message', { message, channelId: req.params.id });
    }

    // Check for bot mentions
    const mentionPattern = /@(openclaw|bot|claw|niels)\b/gi;
    const mentions = content.match(mentionPattern);
    if (mentions && io) {
      io.emit('mention', {
        message,
        channelId: req.params.id,
        threadId: thread_id,
        mentionedBots: mentions.map((m: string) => m.substring(1).toLowerCase()),
      });
    }

    res.status(201).json(message);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/channels/:id/join
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, req.user!.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Join channel error:', err);
    res.status(500).json({ error: 'Failed to join channel' });
  }
});

// POST /api/channels/:id/leave
router.post('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Leave channel error:', err);
    res.status(500).json({ error: 'Failed to leave channel' });
  }
});

export default router;
