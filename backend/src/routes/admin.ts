import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();
const SALT_ROUNDS = 12;

// Admin check middleware
function requireAdmin(req: AuthRequest, res: Response, next: () => void) {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.use(authMiddleware);
router.use(requireAdmin);

// GET /api/admin/users - List all users
router.get('/users', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, username, email, avatar_url, role, is_bot, created_at, last_seen
       FROM users ORDER BY created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// POST /api/admin/users - Create a new user
router.post('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, email, role, is_bot } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    if (username.length < 2 || username.length > 50) {
      return res.status(400).json({ error: 'Username must be 2-50 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userRole = role === 'admin' ? 'admin' : (is_bot ? 'bot' : 'user');

    // If bot, generate API key
    let apiKeyHash: string | null = null;
    let apiKeyPlain: string | undefined;
    if (is_bot) {
      apiKeyPlain = crypto.randomBytes(32).toString('hex');
      apiKeyHash = await bcrypt.hash(apiKeyPlain, SALT_ROUNDS);
    }

    const result = await query(
      `INSERT INTO users (username, password_hash, email, role, is_bot, api_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, avatar_url, role, is_bot, created_at`,
      [username, passwordHash, email || null, userRole, !!is_bot, apiKeyHash]
    );

    const user = result.rows[0];

    // Auto-join default channels for non-bot users
    if (!is_bot) {
      const channels = await query("SELECT id FROM channels WHERE name IN ('general', 'random')");
      for (const ch of channels.rows) {
        await query(
          'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [ch.id, user.id]
        );
      }
    }

    res.status(201).json({
      user,
      api_key: apiKeyPlain, // Only returned on creation, never stored in plain
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/admin/users/:id - Update user (role, email)
router.put('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { role, email, username } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (role !== undefined) {
      if (!['user', 'admin', 'bot'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be user, admin, or bot' });
      }
      updates.push(`role = $${idx++}`);
      values.push(role);
    }

    if (email !== undefined) {
      updates.push(`email = $${idx++}`);
      values.push(email || null);
    }

    if (username !== undefined) {
      if (username.length < 2 || username.length > 50) {
        return res.status(400).json({ error: 'Username must be 2-50 characters' });
      }
      const existing = await query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, req.params.id]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      updates.push(`username = $${idx++}`);
      values.push(username);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, username, email, avatar_url, role, is_bot, created_at, last_seen`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// PUT /api/admin/users/:id/password - Reset user password
router.put('/users/:id/password', async (req: AuthRequest, res: Response) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'new_password must be at least 6 characters' });
    }

    const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    const result = await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, username',
      [hash, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// POST /api/admin/users/:id/regenerate-api-key - Regenerate bot API key
router.post('/users/:id/regenerate-api-key', async (req: AuthRequest, res: Response) => {
  try {
    // Verify it's a bot
    const botResult = await query('SELECT id, is_bot FROM users WHERE id = $1', [req.params.id]);
    if (botResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!botResult.rows[0].is_bot) {
      return res.status(400).json({ error: 'User is not a bot' });
    }

    const newApiKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = await bcrypt.hash(newApiKey, SALT_ROUNDS);

    await query('UPDATE users SET api_key = $1 WHERE id = $2', [apiKeyHash, req.params.id]);

    res.json({ api_key: newApiKey });
  } catch (err) {
    console.error('Regenerate API key error:', err);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if we're deleting an admin - ensure at least one admin remains
    const targetUser = await query('SELECT id, username, role FROM users WHERE id = $1', [req.params.id]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.rows[0].role === 'admin') {
      const adminCount = await query("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin. Promote another user to admin first.' });
      }
    }

    const userId = req.params.id;

    // Explicitly remove ALL foreign key references before deleting the user.
    // This is necessary because CREATE TABLE IF NOT EXISTS does not update
    // ON DELETE behavior on existing tables.
    await query('DELETE FROM reactions WHERE user_id = $1', [userId]);
    await query('DELETE FROM thread_read WHERE user_id = $1', [userId]);
    await query('DELETE FROM channel_bot_settings WHERE bot_id = $1', [userId]);
    await query('DELETE FROM channel_members WHERE user_id = $1', [userId]);
    await query('UPDATE messages SET author_id = NULL WHERE author_id = $1', [userId]);
    await query('UPDATE channels SET created_by = NULL WHERE created_by = $1', [userId]);

    // Now safe to delete the user
    await query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ success: true, deleted: targetUser.rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Delete user error:', err);
    res.status(500).json({ error: `Failed to delete user: ${msg}` });
  }
});

// GET /api/admin/stats - Basic system stats
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [users, channels, messages, bots] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users WHERE is_bot = false'),
      query('SELECT COUNT(*) as count FROM channels'),
      query('SELECT COUNT(*) as count FROM messages'),
      query('SELECT COUNT(*) as count FROM users WHERE is_bot = true'),
    ]);

    res.json({
      users: parseInt(users.rows[0].count),
      channels: parseInt(channels.rows[0].count),
      messages: parseInt(messages.rows[0].count),
      bots: parseInt(bots.rows[0].count),
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
