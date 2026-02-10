# ClawChat

Private collaboration platform for human-AI teams (2-5 users). Structured conversations between humans and AI assistants across multiple projects/topics.

## Quick Start

### Prerequisites
- Docker Desktop (Apple Silicon / ARM64 compatible)
- Node.js 20+ (for local development)

### Production (Docker)

1. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
# Edit .env with your secrets
```

2. Start all services:
```bash
docker-compose up -d
```

3. Access at `http://localhost:3000`

Default admin credentials (configurable via `.env`):
- Username: `admin`
- Password: `admin123`

### Local Development

1. Start PostgreSQL (or use Docker):
```bash
docker-compose up db -d
```

2. Install dependencies:
```bash
cd backend && npm install
cd ../frontend && npm install
```

3. Create `.env` in `backend/`:
```bash
DATABASE_URL=postgresql://clawchat:changeme@localhost:5432/clawchat
JWT_SECRET=dev-secret-change-me-in-production
BOT_API_KEY=dev-bot-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

4. Start backend and frontend:
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

5. Access at `http://localhost:5173`

## Architecture

```
Backend:    Node.js 20 + Express 4 + Socket.io 4
Frontend:   React 18 + TypeScript + Tailwind CSS + Vite
Database:   PostgreSQL 15
Auth:       JWT + bcrypt
Realtime:   Socket.io (WebSocket + HTTP fallback)
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |

### Channels
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/channels` | List user's channels |
| GET | `/api/channels/available` | List all public channels |
| POST | `/api/channels` | Create channel |
| GET | `/api/channels/:id` | Get channel details |
| GET | `/api/channels/:id/messages` | List messages |
| POST | `/api/channels/:id/messages` | Send message |
| POST | `/api/channels/:id/join` | Join channel |
| POST | `/api/channels/:id/leave` | Leave channel |

### Threads
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/threads/:id` | Get thread with replies |
| POST | `/api/threads/:id/messages` | Reply in thread |
| GET | `/api/threads/unread/list` | Get unread threads |
| POST | `/api/threads/:id/mark-read` | Mark thread as read |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/messages/:id` | Edit message |
| DELETE | `/api/messages/:id` | Delete message |

### Bot API (OpenClaw Integration)
All bot routes require `X-API-Key` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bot/channels` | List bot's channels |
| POST | `/api/bot/messages` | Send message as bot |
| GET | `/api/bot/messages/:channelId` | Poll for messages |

### File Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload file |
| GET | `/api/upload/:id` | Download file |

### WebSocket Events

Connect: `ws://localhost:3000?token=<jwt>`

**Client -> Server:**
- `join_channel` / `leave_channel`
- `join_thread` / `leave_thread`
- `typing`

**Server -> Client:**
- `new_message`
- `thread_reply`
- `mention`
- `user_typing`
- `message_edited`
- `message_deleted`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PASSWORD` | PostgreSQL password | - |
| `JWT_SECRET` | JWT signing secret (32+ chars) | - |
| `BOT_API_KEY` | API key for bot authentication | - |
| `ADMIN_USERNAME` | Initial admin username | `admin` |
| `ADMIN_PASSWORD` | Initial admin password | `admin123` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `production` |

## OpenClaw Integration

1. Bot user `openclaw` is auto-created on first run
2. Use the `BOT_API_KEY` from `.env` to authenticate
3. Poll `GET /api/bot/messages/:channelId?since=<timestamp>` or connect via WebSocket
4. Send replies via `POST /api/bot/messages`
5. Bot mentions (`@openclaw`, `@bot`, `@claw`) trigger `mention` WebSocket events
