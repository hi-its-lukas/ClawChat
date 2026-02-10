import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  is_bot: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, is_bot: user.is_bot },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = header.substring(7);
    const decoded = verifyToken(token);
    req.user = decoded;

    // Update last_seen
    await query('UPDATE users SET last_seen = NOW() WHERE id = $1', [decoded.id]);

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export async function botAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    return res.status(401).json({ error: 'No API key provided' });
  }

  try {
    const result = await query(
      'SELECT id, username, role, is_bot, api_key FROM users WHERE is_bot = true',
      []
    );

    const bcrypt = await import('bcrypt');
    for (const bot of result.rows) {
      if (bot.api_key && await bcrypt.default.compare(apiKey, bot.api_key)) {
        req.user = {
          id: bot.id,
          username: bot.username,
          role: bot.role,
          is_bot: true,
        };
        return next();
      }
    }

    return res.status(401).json({ error: 'Invalid API key' });
  } catch {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
