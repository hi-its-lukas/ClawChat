import { Router, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/channels/:id/bot-settings - Get bot settings for a channel
router.get('/:id/bot-settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT cbs.*,
        json_build_object('id', u.id, 'username', u.username, 'is_bot', u.is_bot) as bot
       FROM channel_bot_settings cbs
       JOIN users u ON u.id = cbs.bot_id
       WHERE cbs.channel_id = $1`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get bot settings error:', err);
    res.status(500).json({ error: 'Failed to get bot settings' });
  }
});

// PUT /api/channels/:id/bot-settings - Update bot settings (admin only)
router.put('/:id/bot-settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Check admin or channel creator
    if (req.user!.role !== 'admin') {
      const channel = await query('SELECT created_by FROM channels WHERE id = $1', [req.params.id]);
      if (channel.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
      }
      if (channel.rows[0].created_by !== req.user!.id) {
        return res.status(403).json({ error: 'Only admins or channel creator can update bot settings' });
      }
    }

    const {
      bot_id,
      response_mode,
      system_prompt,
      max_response_length,
      allowed_users,
      enable_threads,
      enable_reactions,
      enable_file_read,
    } = req.body;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    // Validate response_mode
    if (response_mode && !['mention', 'always', 'muted'].includes(response_mode)) {
      return res.status(400).json({ error: 'response_mode must be mention, always, or muted' });
    }

    const result = await query(
      `INSERT INTO channel_bot_settings (channel_id, bot_id, response_mode, system_prompt, max_response_length, allowed_users, enable_threads, enable_reactions, enable_file_read, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (channel_id, bot_id) DO UPDATE SET
         response_mode = COALESCE($3, channel_bot_settings.response_mode),
         system_prompt = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE channel_bot_settings.system_prompt END,
         max_response_length = COALESCE($5, channel_bot_settings.max_response_length),
         allowed_users = CASE WHEN $6::uuid[] IS NOT NULL THEN $6 ELSE channel_bot_settings.allowed_users END,
         enable_threads = COALESCE($7, channel_bot_settings.enable_threads),
         enable_reactions = COALESCE($8, channel_bot_settings.enable_reactions),
         enable_file_read = COALESCE($9, channel_bot_settings.enable_file_read),
         updated_at = NOW()
       RETURNING *`,
      [
        req.params.id,
        bot_id,
        response_mode || 'mention',
        system_prompt !== undefined ? system_prompt : null,
        max_response_length || 2000,
        allowed_users || null,
        enable_threads !== undefined ? enable_threads : true,
        enable_reactions !== undefined ? enable_reactions : false,
        enable_file_read !== undefined ? enable_file_read : false,
      ]
    );

    const settings = result.rows[0];

    // Notify bot via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.emit('bot_settings_updated', {
        channel_id: req.params.id,
        new_settings: settings,
      });
    }

    res.json(settings);
  } catch (err) {
    console.error('Update bot settings error:', err);
    res.status(500).json({ error: 'Failed to update bot settings' });
  }
});

// POST /api/channels/:id/bots - Add bot to channel
router.post('/:id/bots', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      const channel = await query('SELECT created_by FROM channels WHERE id = $1', [req.params.id]);
      if (channel.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });
      if (channel.rows[0].created_by !== req.user!.id) {
        return res.status(403).json({ error: 'Only admins or channel creator can add bots' });
      }
    }

    const { bot_id } = req.body;
    if (!bot_id) return res.status(400).json({ error: 'bot_id is required' });

    // Verify it's a bot user
    const botUser = await query('SELECT id FROM users WHERE id = $1 AND is_bot = true', [bot_id]);
    if (botUser.rows.length === 0) return res.status(404).json({ error: 'Bot user not found' });

    // Add bot as channel member
    await query(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, bot_id]
    );

    // Create default settings
    await query(
      `INSERT INTO channel_bot_settings (channel_id, bot_id, response_mode)
       VALUES ($1, $2, 'mention')
       ON CONFLICT (channel_id, bot_id) DO NOTHING`,
      [req.params.id, bot_id]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Add bot error:', err);
    res.status(500).json({ error: 'Failed to add bot to channel' });
  }
});

// DELETE /api/channels/:id/bots/:botId - Remove bot from channel
router.delete('/:id/bots/:botId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      const channel = await query('SELECT created_by FROM channels WHERE id = $1', [req.params.id]);
      if (channel.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });
      if (channel.rows[0].created_by !== req.user!.id) {
        return res.status(403).json({ error: 'Only admins or channel creator can remove bots' });
      }
    }

    await query('DELETE FROM channel_bot_settings WHERE channel_id = $1 AND bot_id = $2', [req.params.id, req.params.botId]);
    await query('DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2', [req.params.id, req.params.botId]);

    res.json({ success: true });
  } catch (err) {
    console.error('Remove bot error:', err);
    res.status(500).json({ error: 'Failed to remove bot from channel' });
  }
});

export default router;
