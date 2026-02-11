import { Router, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/dm/users - List users available for DM
router.get('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, username, avatar_url, is_bot, last_seen FROM users WHERE id != $1 AND is_bot = false ORDER BY username',
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List DM users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// POST /api/dm - Create or get existing DM channel
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    if (user_id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot create DM with yourself' });
    }

    // Check target user exists
    const targetUser = await query('SELECT id, username FROM users WHERE id = $1', [user_id]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if DM channel already exists between these two users
    const existing = await query(
      `SELECT c.id FROM channels c
       WHERE c.type = 'direct'
       AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = $1)
       AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = c.id AND user_id = $2)
       AND (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) = 2`,
      [req.user!.id, user_id]
    );

    if (existing.rows.length > 0) {
      const channel = await query('SELECT * FROM channels WHERE id = $1', [existing.rows[0].id]);
      return res.json(channel.rows[0]);
    }

    // Create new DM channel
    const dmName = `dm-${req.user!.username}-${targetUser.rows[0].username}`;
    const result = await query(
      `INSERT INTO channels (name, type, created_by)
       VALUES ($1, 'direct', $2) RETURNING *`,
      [dmName, req.user!.id]
    );

    const channel = result.rows[0];

    // Add both users
    await query(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2), ($1, $3)',
      [channel.id, req.user!.id, user_id]
    );

    res.status(201).json(channel);
  } catch (err) {
    console.error('Create DM error:', err);
    res.status(500).json({ error: 'Failed to create DM' });
  }
});

// GET /api/dm - List DM channels for current user
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*,
        (SELECT json_agg(json_build_object('id', u.id, 'username', u.username, 'is_bot', u.is_bot, 'avatar_url', u.avatar_url, 'last_seen', u.last_seen))
         FROM channel_members cm2 JOIN users u ON u.id = cm2.user_id
         WHERE cm2.channel_id = c.id AND u.id != $1) as other_users
       FROM channels c
       INNER JOIN channel_members cm ON cm.channel_id = c.id
       WHERE cm.user_id = $1 AND c.type = 'direct'
       ORDER BY c.created_at DESC`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List DMs error:', err);
    res.status(500).json({ error: 'Failed to list DMs' });
  }
});

export default router;
