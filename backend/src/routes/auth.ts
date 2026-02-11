import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { AuthRequest, authMiddleware, generateToken } from '../middleware/auth';
import { loginLimiter } from '../middleware/rateLimit';
import { validateRequired } from '../middleware/validation';

const router = Router();

// POST /api/auth/login
router.post('/login', loginLimiter, validateRequired('username', 'password'), async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    const result = await query(
      'SELECT id, username, password_hash, role, is_bot FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await query('UPDATE users SET last_seen = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
      is_bot: user.is_bot,
    });

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
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
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
