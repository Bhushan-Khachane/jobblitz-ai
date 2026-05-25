"""Shared Pydantic types for the 3-plane architecture."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class JobLead(BaseModel):
    id: UUID
    user_id: UUID
    portal: str
    url: str
    title: str
    company: str
    location: str | None = None
    jd_text: str | None = None
    posted_at: str | None = None
    external_job_id: str | None = None
    raw_data: dict[str, Any] | None = None
    discovered_at: datetime
    processed: bool = False


class JobScore(BaseModel):
    id: UUID
    job_lead_id: UUID
    fit_score: float
    must_have_match: dict[str, Any] | None = None
    gap_notes: str | None = None
    decision: str
    scored_at: datetime


class ApplicationPlan(BaseModel):
    id: UUID
    job_lead_id: UUID
    fields: list[dict[str, Any]]
    resume_variant: str | None = None
    cover_letter: str | None = None
    requires_approval: bool = True


class ApplicationStepEvent(BaseModel):
    id: UUID
    run_id: UUID
    step_name: str
    tool_name: str
    tool_args: dict[str, Any] | None = None
    tool_output: str | None = None
    success: bool
    error_message: str | None = None
    screenshot_url: str | None = None
    diff_text: str | None = None
    created_at: datetime


class StandardRunResponse(BaseModel):
    run_id: str
    status: str
    events: list[dict[str, Any]] = []
    error: str | None = None
