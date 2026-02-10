import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

const SALT_ROUNDS = 12;

export async function seedDatabase() {
  console.log('Seeding database...');

  // Create admin user if not exists
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existingAdmin = await query('SELECT id FROM users WHERE username = $1', [adminUsername]);
  let adminId: string;

  if (existingAdmin.rows.length === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    const result = await query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
      [adminUsername, passwordHash, 'admin']
    );
    adminId = result.rows[0].id;
    console.log(`Admin user "${adminUsername}" created.`);
  } else {
    adminId = existingAdmin.rows[0].id;
    console.log('Admin user already exists.');
  }

  // Create bot user if not exists
  const botApiKey = process.env.BOT_API_KEY || crypto.randomBytes(32).toString('hex');
  const existingBot = await query('SELECT id FROM users WHERE username = $1', ['openclaw']);

  let botId: string;
  if (existingBot.rows.length === 0) {
    const botPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
    const apiKeyHash = await bcrypt.hash(botApiKey, SALT_ROUNDS);
    const result = await query(
      'INSERT INTO users (username, password_hash, role, is_bot, api_key) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      ['openclaw', botPasswordHash, 'bot', true, apiKeyHash]
    );
    botId = result.rows[0].id;
    console.log(`Bot user "openclaw" created. API Key: ${botApiKey}`);
  } else {
    botId = existingBot.rows[0].id;
    console.log('Bot user already exists.');
  }

  // Create default channels
  const defaultChannels = [
    { name: 'general', description: 'General discussion' },
    { name: 'random', description: 'Random chat and off-topic' },
  ];

  for (const ch of defaultChannels) {
    const existing = await query('SELECT id FROM channels WHERE name = $1', [ch.name]);
    if (existing.rows.length === 0) {
      const result = await query(
        'INSERT INTO channels (name, description, type, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
        [ch.name, ch.description, 'public', adminId]
      );
      const channelId = result.rows[0].id;

      // Add admin and bot to default channels
      await query(
        'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING',
        [channelId, adminId, botId]
      );
      console.log(`Channel "#${ch.name}" created.`);
    } else {
      console.log(`Channel "#${ch.name}" already exists.`);
    }
  }

  console.log('Seeding completed.');
}
