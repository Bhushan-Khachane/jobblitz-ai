# JobBlitz AI 🚀

> Automated job application platform for Indian job seekers — applies to LinkedIn and Naukri automatically using AI

## Quick Start

### Prerequisites

- Docker & Docker Compose installed
- OpenRouter API key (for AI features)

### Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/Bhushan-Khachane/jobblitz-ai.git
   cd jobblitz-ai
   ```

2. **Configure backend**

   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env and fill in:
   # - SECRET_KEY (generate: python3 -c "import secrets; print(secrets.token_hex(32))")
   # - FERNET_KEY (generate: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
   # - OPENROUTER_API_KEY
   ```

3. **Configure frontend**

   ```bash
   echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > frontend/.env
   ```

4. **Start everything**

   ```bash
   chmod +x scripts/start.sh
   ./scripts/start.sh
   ```

### Services

| Service          | URL                            | Description            |
| ---------------- | ------------------------------ | ---------------------- |
| Frontend         | http://localhost:3000           | Next.js UI             |
| Backend API      | http://localhost:8000           | FastAPI                 |
| API Docs         | http://localhost:8000/docs      | Swagger UI              |
| Flower Monitor   | http://localhost:5555           | Celery task monitor     |
| Health Check     | http://localhost:8000/health/detailed | System health    |

## Architecture

- **Frontend**: Next.js 14 + TypeScript + Tailwind + shadcn/ui
- **Backend**: FastAPI + SQLAlchemy async + PostgreSQL
- **Workers**: Celery + Redis (auto-apply every 30 min, discover jobs every 2 hours)
- **AI**: OpenRouter API (cover letters, form Q&A, resume tailoring)
- **Automation**: Playwright + stealth (LinkedIn & Naukri)

## How It Works

1. Register → upload resume → set job preferences → add LinkedIn/Naukri credentials
2. Create job searches (keywords, location, platform)
3. Celery discovers jobs every 2 hours automatically
4. Celery auto-applies to discovered jobs every 30 minutes
5. Track applications in Kanban dashboard

## Project Structure

```
├── backend/               # FastAPI + Celery + Playwright
│   ├── app/
│   │   ├── routers/       # API endpoints
│   │   ├── models.py      # SQLAlchemy models
│   │   ├── schemas.py     # Pydantic schemas
│   │   ├── config.py      # Settings (env-based)
│   │   ├── workers/       # Celery tasks & beat schedule
│   │   └── services/      # Business logic (scraper, AI, apply)
│   └── alembic/           # Database migrations
├── frontend/              # Next.js 14 + Tailwind + shadcn/ui
│   ├── app/               # App router pages
│   ├── components/        # UI components
│   ├── hooks/             # React hooks (useAuth context)
│   └── lib/               # Utilities & API client
├── docker-compose.yml     # All services orchestrated
└── scripts/               # Startup & utility scripts
```

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for all required and optional variables.

**Required** (app won't start without these):
- `DATABASE_URL` — PostgreSQL async connection string
- `SECRET_KEY` — JWT signing secret (32+ chars)
- `FERNET_KEY` — Encryption key for stored credentials

## License

MIT
