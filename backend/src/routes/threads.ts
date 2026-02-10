import { Router, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/threads/:id - Get thread with all messages
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Get root message
    const rootResult = await query(
      `SELECT m.*,
        json_build_object('id', u.id, 'username', u.username, 'is_bot', u.is_bot, 'avatar_url', u.avatar_url) as author
       FROM messages m
       LEFT JOIN users u ON u.id = m.author_id
       WHERE m.id = $1`,
      [req.params.id]
    );

    if (rootResult.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const rootMessage = rootResult.rows[0];

    // Get all replies
    const repliesResult = await query(
      `SELECT m.*,
        json_build_object('id', u.id, 'username', u.username, 'is_bot', u.is_bot, 'avatar_url', u.avatar_url) as author
       FROM messages m
       LEFT JOIN users u ON u.id = m.author_id
       WHERE m.thread_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.id]
    );

    // Get thread metadata
    const threadResult = await query(
      'SELECT * FROM threads WHERE root_message_id = $1',
      [req.params.id]
    );

    // Get participants
    const participantIds = threadResult.rows[0]?.participants || [];
    let participants: unknown[] = [];
    if (participantIds.length > 0) {
      const participantsResult = await query(
        'SELECT id, username, is_bot, avatar_url FROM users WHERE id = ANY($1)',
        [participantIds]
      );
      participants = participantsResult.rows;
    }

    res.json({
      thread: threadResult.rows[0] || null,
      rootMessage,
      messages: repliesResult.rows,
      participants,
    });
  } catch (err) {
    console.error('Get thread error:', err);
    res.status(500).json({ error: 'Failed to get thread' });
  }
});

// POST /api/threads/:id/messages - Reply in thread
router.post('/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Get root message to find channel
    const rootResult = await query('SELECT channel_id FROM messages WHERE id = $1', [req.params.id]);
    if (rootResult.rows.length === 0) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const channelId = rootResult.rows[0].channel_id;

    const result = await query(
      `INSERT INTO messages (channel_id, author_id, content, thread_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [channelId, req.user!.id, content, req.params.id]
    );

    const message = result.rows[0];

    // Get author info
    const authorResult = await query(
      'SELECT id, username, is_bot, avatar_url FROM users WHERE id = $1',
      [req.user!.id]
    );
    message.author = authorResult.rows[0];

    // Update thread metadata
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
      [channelId, req.params.id, req.user!.id]
    );

    // Emit via socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`thread:${req.params.id}`).emit('thread_reply', { message, threadId: req.params.id });
      io.to(`channel:${channelId}`).emit('new_message', { message, channelId });
    }

    res.status(201).json(message);
  } catch (err) {
    console.error('Thread reply error:', err);
    res.status(500).json({ error: 'Failed to reply in thread' });
  }
});

// GET /api/threads/unread - Get threads with unread messages
router.get('/unread/list', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT t.*,
        m.content as root_content,
        json_build_object('id', u.id, 'username', u.username) as root_author
       FROM threads t
       JOIN messages m ON m.id = t.root_message_id
       LEFT JOIN users u ON u.id = m.author_id
       WHERE $1 = ANY(t.participants)
       AND (
         NOT EXISTS (SELECT 1 FROM thread_read tr WHERE tr.thread_id = t.id AND tr.user_id = $1)
         OR t.last_reply_at > (SELECT tr2.read_at FROM thread_read tr2 WHERE tr2.thread_id = t.id AND tr2.user_id = $1)
       )
       ORDER BY t.last_reply_at DESC`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Unread threads error:', err);
    res.status(500).json({ error: 'Failed to get unread threads' });
  }
});

// POST /api/threads/:id/mark-read
router.post('/:id/mark-read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `INSERT INTO thread_read (user_id, thread_id, read_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, thread_id) DO UPDATE SET read_at = NOW()`,
      [req.user!.id, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark thread as read' });
  }
});

export default router;
