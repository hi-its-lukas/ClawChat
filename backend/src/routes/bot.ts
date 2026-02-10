import { Router, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest, botAuthMiddleware } from '../middleware/auth';

const router = Router();

// All bot routes require API key auth
router.use(botAuthMiddleware);

// GET /api/bot/channels - List channels bot has access to
router.get('/channels', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.* FROM channels c
       INNER JOIN channel_members cm ON cm.channel_id = c.id
       WHERE cm.user_id = $1
       ORDER BY c.name`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Bot channels error:', err);
    res.status(500).json({ error: 'Failed to list channels' });
  }
});

// POST /api/bot/messages - Bot sends a message
router.post('/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { channel_id, content, thread_id, reply_to, metadata } = req.body;

    if (!channel_id || !content) {
      return res.status(400).json({ error: 'channel_id and content are required' });
    }

    const result = await query(
      `INSERT INTO messages (channel_id, author_id, content, thread_id, reply_to)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [channel_id, req.user!.id, content, thread_id || null, reply_to || null]
    );

    const message = result.rows[0];
    message.author = {
      id: req.user!.id,
      username: req.user!.username,
      is_bot: true,
    };
    message.metadata = metadata;

    // Update thread if reply
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
        [channel_id, thread_id, req.user!.id]
      );
    }

    // Emit via socket.io
    const io = req.app.get('io');
    if (io) {
      if (thread_id) {
        io.to(`thread:${thread_id}`).emit('thread_reply', { message, threadId: thread_id });
      }
      io.to(`channel:${channel_id}`).emit('new_message', { message, channelId: channel_id });
    }

    res.status(201).json(message);
  } catch (err) {
    console.error('Bot message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/bot/messages/:channelId - Poll for new messages
router.get('/messages/:channelId', async (req: AuthRequest, res: Response) => {
  try {
    const since = req.query.since as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    let sql = `
      SELECT m.*,
        json_build_object('id', u.id, 'username', u.username, 'is_bot', u.is_bot) as author
      FROM messages m
      LEFT JOIN users u ON u.id = m.author_id
      WHERE m.channel_id = $1
    `;
    const params: unknown[] = [req.params.channelId];

    if (since) {
      sql += ` AND m.created_at > $2`;
      params.push(since);
    }

    sql += ` ORDER BY m.created_at ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);

    // Enrich with channel name
    const channelResult = await query('SELECT name FROM channels WHERE id = $1', [req.params.channelId]);
    const channelName = channelResult.rows[0]?.name || 'unknown';

    const messages = result.rows.map((m: Record<string, unknown>) => ({
      ...m,
      metadata: { channel_name: channelName },
    }));

    res.json(messages);
  } catch (err) {
    console.error('Bot poll error:', err);
    res.status(500).json({ error: 'Failed to poll messages' });
  }
});

export default router;
