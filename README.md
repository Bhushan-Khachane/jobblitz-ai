# JobBlitz AI

AI-powered job application automation platform for Indian job seekers. Auto-apply to LinkedIn and Naukri with AI-tailored resumes.

## Project Structure

```
├── backend/          # FastAPI + Celery + Playwright
├── frontend/         # Next.js 14 + Tailwind + shadcn/ui
├── docker-compose.yml
└── README.md
```

## Quick Start

```bash
# 1. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your keys

# 2. Launch
docker compose up --build -d

# 3. Run migrations
docker compose exec backend alembic upgrade head

# 4. Open
# Frontend: http://localhost:3000
# API docs: http://localhost:8000/docs
```

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy 2.0 (async), Celery, Playwright, OpenRouter AI
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Recharts
- **Infra**: PostgreSQL, Redis, Docker Compose
