import { Router, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// PUT /api/messages/:id - Edit message
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Content is required' });
    }

    const existing = await query('SELECT * FROM messages WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (existing.rows[0].author_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to edit this message' });
    }

    const result = await query(
      'UPDATE messages SET content = $1, edited_at = NOW() WHERE id = $2 RETURNING *',
      [content, req.params.id]
    );

    const message = result.rows[0];

    // Emit edit via socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${message.channel_id}`).emit('message_edited', { message });
      if (message.thread_id) {
        io.to(`thread:${message.thread_id}`).emit('message_edited', { message });
      }
    }

    res.json(message);
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// DELETE /api/messages/:id - Delete message
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await query('SELECT * FROM messages WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (existing.rows[0].author_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    await query('DELETE FROM messages WHERE id = $1', [req.params.id]);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${existing.rows[0].channel_id}`).emit('message_deleted', {
        messageId: req.params.id,
        channelId: existing.rows[0].channel_id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
