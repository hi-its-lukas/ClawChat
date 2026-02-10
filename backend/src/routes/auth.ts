import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { AuthRequest, authMiddleware, generateToken } from '../middleware/auth';
import { loginLimiter } from '../middleware/rateLimit';
import { validateRequired } from '../middleware/validation';

const router = Router();
const SALT_ROUNDS = 12;

// POST /api/auth/register
router.post('/register', validateRequired('username', 'password'), async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, email } = req.body;

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
    const result = await query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, role, is_bot',
      [username, passwordHash, email || null]
    );

    const user = result.rows[0];

    // Auto-join default channels
    const channels = await query("SELECT id FROM channels WHERE name IN ('general', 'random')");
    for (const ch of channels.rows) {
      await query(
        'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [ch.id, user.id]
      );
    }

    const token = generateToken(user);
    res.status(201).json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

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
