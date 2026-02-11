import { getClient } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

const schema = `
-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(20) DEFAULT 'user',
    is_bot BOOLEAN DEFAULT false,
    api_key VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP
);

-- Channels
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'public',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Channel Members
CREATE TABLE IF NOT EXISTS channel_members (
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    last_read TIMESTAMP,
    PRIMARY KEY (channel_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    thread_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    reply_to UUID REFERENCES messages(id) ON DELETE SET NULL,
    edited_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    has_attachments BOOLEAN DEFAULT false
);

-- Threads
CREATE TABLE IF NOT EXISTS threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id),
    root_message_id UUID UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
    reply_count INTEGER DEFAULT 0,
    last_reply_at TIMESTAMP,
    participants UUID[]
);

-- Attachments
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Thread read tracking
CREATE TABLE IF NOT EXISTS thread_read (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES messages(id),
    read_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, thread_id)
);

-- Channel Bot Settings (per-channel bot configuration)
CREATE TABLE IF NOT EXISTS channel_bot_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    bot_id UUID REFERENCES users(id) ON DELETE CASCADE,
    response_mode VARCHAR(20) DEFAULT 'mention',
    system_prompt TEXT,
    max_response_length INTEGER DEFAULT 2000,
    allowed_users UUID[],
    enable_threads BOOLEAN DEFAULT true,
    enable_reactions BOOLEAN DEFAULT false,
    enable_file_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(channel_id, bot_id)
);

-- Reactions
CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_channel_bot_settings_channel ON channel_bot_settings(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_bot_settings_bot ON channel_bot_settings(bot_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_author ON messages(author_id);
CREATE INDEX IF NOT EXISTS idx_thread_read_user ON thread_read(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_content_fts ON messages USING gin(to_tsvector('english', content));

-- Fix FK constraints for existing databases that might lack ON DELETE behavior.
-- CREATE TABLE IF NOT EXISTS does not update constraints on existing tables.
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Find all FK constraints referencing users(id) that use NO ACTION (restrict)
  FOR r IN
    SELECT con.conname, cl.relname as table_name
    FROM pg_constraint con
    JOIN pg_class cl ON con.conrelid = cl.oid
    JOIN pg_class ref ON con.confrelid = ref.oid
    WHERE ref.relname = 'users'
      AND con.contype = 'f'
      AND con.confdeltype = 'a'
  LOOP
    -- Determine correct ON DELETE behavior based on table
    IF r.table_name IN ('channel_members', 'thread_read', 'channel_bot_settings', 'reactions') THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.conname);
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES users(id) ON DELETE CASCADE',
        r.table_name, r.conname,
        CASE r.table_name
          WHEN 'channel_bot_settings' THEN 'bot_id'
          ELSE 'user_id'
        END);
    ELSIF r.table_name IN ('channels') THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.conname);
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL',
        r.table_name, r.conname);
    ELSIF r.table_name IN ('messages') THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.conname);
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL',
        r.table_name, r.conname);
    END IF;
  END LOOP;
END $$;
`;

async function runMigrations() {
  const client = await getClient();
  try {
    console.log('Running database migrations...');
    await client.query(schema);
    console.log('Migrations completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

export default runMigrations;

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
