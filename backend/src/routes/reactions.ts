import { Router, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/reactions/:messageId - Get reactions for a message
router.get('/:messageId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT r.emoji, COUNT(*) as count,
        json_agg(json_build_object('id', u.id, 'username', u.username)) as users,
        bool_or(r.user_id = $2) as me
       FROM reactions r
       JOIN users u ON u.id = r.user_id
       WHERE r.message_id = $1
       GROUP BY r.emoji
       ORDER BY MIN(r.created_at)`,
      [req.params.messageId, req.user!.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get reactions error:', err);
    res.status(500).json({ error: 'Failed to get reactions' });
  }
});

// POST /api/reactions/:messageId - Add reaction
router.post('/:messageId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { emoji } = req.body;
    if (!emoji) {
      return res.status(400).json({ error: 'emoji is required' });
    }

    await query(
      `INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
      [req.params.messageId, req.user!.id, emoji]
    );

    // Get message channel for socket broadcast
    const msgResult = await query('SELECT channel_id FROM messages WHERE id = $1', [req.params.messageId]);
    const channelId = msgResult.rows[0]?.channel_id;

    if (channelId) {
      const io = req.app.get('io');
      if (io) {
        io.to(`channel:${channelId}`).emit('reaction_added', {
          message_id: req.params.messageId,
          emoji,
          user: { id: req.user!.id, username: req.user!.username },
        });
      }
    }

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Add reaction error:', err);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// DELETE /api/reactions/:messageId/:emoji - Remove reaction
router.delete('/:messageId/:emoji', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [req.params.messageId, req.user!.id, req.params.emoji]
    );

    const msgResult = await query('SELECT channel_id FROM messages WHERE id = $1', [req.params.messageId]);
    const channelId = msgResult.rows[0]?.channel_id;

    if (channelId) {
      const io = req.app.get('io');
      if (io) {
        io.to(`channel:${channelId}`).emit('reaction_removed', {
          message_id: req.params.messageId,
          emoji: req.params.emoji,
          user_id: req.user!.id,
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Remove reaction error:', err);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

export default router;
