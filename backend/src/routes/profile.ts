import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { AuthRequest, authMiddleware, generateToken } from '../middleware/auth';

const router = Router();
const SALT_ROUNDS = 12;

// GET /api/profile - Get own profile (full details)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, username, email, avatar_url, role, is_bot, created_at, last_seen FROM users WHERE id = $1',
      [req.user!.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// PUT /api/profile - Update own profile
router.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, avatar_url } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (username !== undefined) {
      if (username.length < 2 || username.length > 50) {
        return res.status(400).json({ error: 'Username must be 2-50 characters' });
      }
      // Check uniqueness
      const existing = await query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, req.user!.id]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      updates.push(`username = $${idx++}`);
      values.push(username);
    }

    if (email !== undefined) {
      if (email && email.length > 0) {
        const existingEmail = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user!.id]);
        if (existingEmail.rows.length > 0) {
          return res.status(409).json({ error: 'Email already taken' });
        }
      }
      updates.push(`email = $${idx++}`);
      values.push(email || null);
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${idx++}`);
      values.push(avatar_url || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.user!.id);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, username, email, avatar_url, role, is_bot`,
      values
    );

    const user = result.rows[0];

    // If username changed, return new token
    let token: string | undefined;
    if (username && username !== req.user!.username) {
      token = generateToken({
        id: user.id,
        username: user.username,
        role: user.role,
        is_bot: user.is_bot,
      });
    }

    res.json({ user, token });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/profile/password - Change own password
router.put('/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Verify current password
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user!.id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
