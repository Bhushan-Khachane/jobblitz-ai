from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.gzip import GZipMiddleware

# TODO: add slowapi rate limiter for /auth routes in production

from app.config import settings
from app.database import engine
from app.routers import (
    analytics,
    applications,
    auth,
    cover_letters,
    credentials,
    health,
    job_listings,
    job_searches,
    resumes,
    users,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.SCREENSHOT_DIR).mkdir(parents=True, exist_ok=True)
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="JobBlitz AI",
    description="Automated job application platform for Indian job seekers",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Security middleware (outermost first) ────────────────────────────────────

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])  # tighten in prod

# ── CORS ─────────────────────────────────────────────────────────────────────

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ── Routers ──────────────────────────────────────────────────────────────────

app.include_router(health.router)  # no /api/v1 prefix for health
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(resumes.router, prefix="/api/v1")
app.include_router(credentials.router, prefix="/api/v1")
app.include_router(job_searches.router, prefix="/api/v1")
app.include_router(job_listings.router, prefix="/api/v1")
app.include_router(applications.router, prefix="/api/v1")
app.include_router(cover_letters.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
