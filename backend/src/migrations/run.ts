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
    created_by UUID REFERENCES users(id),
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_author ON messages(author_id);
CREATE INDEX IF NOT EXISTS idx_thread_read_user ON thread_read(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);
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
