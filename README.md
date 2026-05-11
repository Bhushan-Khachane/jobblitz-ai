# JobBlitz AI 🚀

> Automated job application platform for Indian job seekers — applies to LinkedIn and Naukri automatically using AI

## Quick Start

### Prerequisites

- Docker & Docker Compose installed
- Gemini API key (for AI features) — free at [aistudio.google.com](https://aistudio.google.com)
- Supabase project (free tier works) — for Auth, Realtime, and Storage

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
   # - GEMINI_API_KEY  (primary AI — free at aistudio.google.com)
   # - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
   # - SUPABASE_JWT_SECRET
   ```

3. **Configure frontend**

   ```bash
   cp frontend/.env.example frontend/.env
   # Edit frontend/.env and fill in:
   # - NEXT_PUBLIC_SUPABASE_URL
   # - NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

4. **Start everything**

   ```bash
   chmod +x scripts/start.sh
   ./scripts/start.sh
   ```

### Services

| Service          | URL                                   | Description            |
| ---------------- | ------------------------------------- | ---------------------- |
| Frontend         | http://localhost:3001                  | Next.js UI             |
| Backend API      | http://localhost:8000                  | FastAPI                |
| API Docs         | http://localhost:8000/docs             | Swagger UI             |
| Health Check     | http://localhost:8000/health/           | System health          |
| Health (detailed)| http://localhost:8000/health/detailed  | DB + Redis + queue     |

## Architecture

- **Frontend**: Next.js 14 + TypeScript + Tailwind + shadcn/ui
- **Backend**: FastAPI + SQLAlchemy async + PostgreSQL
- **Workers**: ARQ (async Redis queue) — discovers jobs every 2 hours, auto-applies every 30 min
- **AI**: Google Gemini (primary) + OpenAI GPT-4o-mini (fallback) for cover letters, Q&A, resume tailoring
- **Automation**: Playwright + stealth (LinkedIn Easy Apply & Naukri direct apply)
- **Cloud Browser**: Neko — zero-password architecture, users log in via secure streaming browser

## How It Works

1. Upload your resume and set job preferences
2. Connect LinkedIn/Naukri via secure cloud browser (your password never touches our servers)
3. JobBlitz discovers matching jobs every 2 hours using AI scoring
4. In **Assisted mode**: review and approve applications before they're submitted
5. In **Auto mode**: applications submitted automatically with human-like behavior

## Project Structure

```
├── backend/               # FastAPI + ARQ + Playwright
│   ├── app/
│   │   ├── routers/       # API endpoints
│   │   ├── services/      # Scraper, apply, matching, AI services
│   │   ├── workers/       # ARQ tasks & cron schedule
│   │   └── models.py      # SQLAlchemy ORM models
│   ├── alembic/           # Database migrations
│   └── scripts/           # Smoke test & utilities
├── frontend/              # Next.js 14 app
│   ├── app/               # App Router pages
│   ├── components/        # Reusable UI components
│   └── hooks/             # React hooks (Supabase Realtime)
├── docker/                # Neko cloud browser Dockerfile
├── scripts/               # Startup scripts
└── docker-compose.yml     # Full stack orchestration
```

## Pricing

| Plan       | Price      | Daily Applies |
|------------|------------|---------------|
| Free       | ₹0         | 10/day        |
| Starter    | ₹499/mo    | 25/day        |
| Pro        | ₹999/mo    | 50/day        |
| Unlimited  | ₹1,999/mo  | 100/day       |

## License

MIT