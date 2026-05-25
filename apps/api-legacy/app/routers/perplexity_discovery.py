"""
Perplexity-powered real-time job discovery router.

  POST /perplexity-discovery/search          — profile-based job search
  POST /perplexity-discovery/search-query    — free-text job search
  GET  /perplexity-discovery/salary-intel    — real-time salary benchmark
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.services.perplexity_service import perplexity_service

router = APIRouter(prefix="/perplexity-discovery", tags=["perplexity-discovery"])


class ProfileSearchRequest(BaseModel):
    skills: list[str] = Field(default_factory=list)
    target_roles: list[str] = Field(default_factory=list)
    years_experience: int = 0
    location: str = "India"
    work_type: str = "any"
    salary_range: str = ""
    max_results: int = Field(default=20, ge=1, le=50)
    extra_filters: str = ""


class QuerySearchRequest(BaseModel):
    query: str
    location: str = ""
    max_results: int = Field(default=20, ge=1, le=50)


@router.post("/search", summary="Profile-based real-time job discovery via Perplexity Sonar")
async def search_by_profile(
    req: ProfileSearchRequest,
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    return await perplexity_service.search_jobs(
        user_summary=req.model_dump(exclude={"max_results", "extra_filters"}),
        max_results=req.max_results,
        extra_filters=req.extra_filters,
    )


@router.post("/search-query", summary="Free-text real-time job search via Perplexity Sonar")
async def search_by_query(
    req: QuerySearchRequest,
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    return await perplexity_service.search_jobs_by_query(
        query=req.query,
        location=req.location,
        max_results=req.max_results,
    )


@router.get("/salary-intel", summary="Real-time salary benchmarks via Perplexity Sonar")
async def salary_intel(
    role: str = Query(...),
    location: str = Query(default="India"),
    years_experience: int = Query(default=3),
    current_user: Any = Depends(get_current_user),
) -> dict[str, Any]:
    return await perplexity_service.get_salary_intel(
        role=role,
        loca