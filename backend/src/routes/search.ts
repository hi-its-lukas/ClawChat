import { Router, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/search?q=term&channel_id=optional
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query.q as string;
    const channelId = req.query.channel_id as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    // Build tsquery from search terms
    const tsquery = q.trim().split(/\s+/).map(t => t + ':*').join(' & ');

    let sql = `
      SELECT m.id, m.channel_id, m.content, m.created_at,
        json_build_object('id', u.id, 'username', u.username, 'is_bot', u.is_bot, 'avatar_url', u.avatar_url) as author,
        c.name as channel_name,
        ts_rank(to_tsvector('english', m.content), to_tsquery('english', $1)) as rank
      FROM messages m
      LEFT JOIN users u ON u.id = m.author_id
      LEFT JOIN channels c ON c.id = m.channel_id
      INNER JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = $2
      WHERE to_tsvector('english', m.content) @@ to_tsquery('english', $1)
    `;
    const params: unknown[] = [tsquery, req.user!.id];

    if (channelId) {
      sql += ` AND m.channel_id = $${params.length + 1}`;
      params.push(channelId);
    }

    sql += ` ORDER BY rank DESC, m.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Get total count
    let countSql = `
      SELECT COUNT(*) as total FROM messages m
      INNER JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = $2
      WHERE to_tsvector('english', m.content) @@ to_tsquery('english', $1)
    `;
    const countParams: unknown[] = [tsquery, req.user!.id];
    if (channelId) {
      countSql += ` AND m.channel_id = $3`;
      countParams.push(channelId);
    }
    const countResult = await query(countSql, countParams);

    res.json({
      results: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
