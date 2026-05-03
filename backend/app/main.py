from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.routers import (
    analytics,
    applications,
    auth,
    cover_letters,
    credentials,
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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
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
