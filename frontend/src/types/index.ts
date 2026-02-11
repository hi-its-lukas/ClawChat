export interface User {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  role: string;
  is_bot: boolean;
  created_at?: string;
  last_seen?: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'direct';
  created_by?: string;
  created_at: string;
  unread_count?: number;
  members?: User[];
}

export interface Reaction {
  emoji: string;
  count: number;
  users: { id: string; username: string }[];
  me: boolean;
}

export interface SearchResult {
  id: string;
  channel_id: string;
  content: string;
  created_at: string;
  author: User;
  channel_name: string;
  rank: number;
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  thread_id?: string;
  reply_to?: string;
  edited_at?: string;
  created_at: string;
  has_attachments: boolean;
  author: User;
  reply_count?: number;
  last_reply_at?: string;
  attachments?: Attachment[];
  reactions?: Reaction[];
}

export interface Thread {
  id: string;
  channel_id: string;
  root_message_id: string;
  reply_count: number;
  last_reply_at: string;
  participants: string[];
}

export interface ThreadData {
  thread: Thread | null;
  rootMessage: Message;
  messages: Message[];
  participants: User[];
}

export interface Attachment {
  id: string;
  message_id: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface TypingUser {
  id: string;
  username: string;
}

export interface ChannelBotSettings {
  id: string;
  channel_id: string;
  bot_id: string;
  response_mode: 'mention' | 'always' | 'muted';
  system_prompt: string | null;
  max_response_length: number;
  allowed_users: string[] | null;
  enable_threads: boolean;
  enable_reactions: boolean;
  enable_file_read: boolean;
  created_at: string;
  updated_at: string;
  bot?: User;
}
