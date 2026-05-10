import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Auth ──────────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    phone: str | None = None
    location: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── User ──────────────────────────────────────────────────────────────────────
class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    location: str | None
    is_active: bool
    application_mode: str
    daily_apply_limit: int
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    location: str | None = None
    application_mode: str | None = Field(None, pattern="^(manual|assisted|auto)$")
    daily_apply_limit: int | None = Field(None, ge=1, le=500)


# ── Profile ───────────────────────────────────────────────────────────────────
class ProfileCreate(BaseModel):
    headline: str | None = None
    summary: str | None = None
    skills: list[str] | None = None
    experience: list[dict] | dict | None = None
    education: list[str] | dict | None = None
    certifications: list[str] | dict | None = None
    preferred_job_titles: list[str] | None = None
    preferred_locations: list[str] | None = None
    expected_salary_lpa: float | None = None
    notice_period_days: int | None = None


class ProfileResponse(ProfileCreate):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Credentials ───────────────────────────────────────────────────────────────
class CredentialCreate(BaseModel):
    platform: str = Field(pattern="^(linkedin|naukri)$")
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=500)


class CredentialUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    is_active: bool | None = None


class CredentialResponse(BaseModel):
    id: uuid.UUID
    platform: str
    username: str
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Resume ────────────────────────────────────────────────────────────────────
class ResumeResponse(BaseModel):
    id: uuid.UUID
    title: str
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ResumeUpdate(BaseModel):
    title: str | None = None
    is_default: bool | None = None


class ResumeTailorRequest(BaseModel):
    job_description: str = Field(min_length=10)
    job_title: str | None = None
    company_name: str | None = None


class ResumeTailorResponse(BaseModel):
    tailored_text: str
    tailored_pdf_path: str


# ── Job Search ────────────────────────────────────────────────────────────────
class JobSearchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    platform: str = Field(pattern="^(linkedin|naukri|both)$")
    keywords: str = Field(min_length=1, max_length=500)
    location: str | None = None
    experience_level: str | None = None
    job_type: str | None = None
    remote_only: bool = False
    salary_min_lpa: float | None = None
    salary_max_lpa: float | None = None
    extra_filters: dict | None = None
    auto_match: bool = False

    @field_validator("salary_min_lpa", "salary_max_lpa", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v


class JobSearchUpdate(BaseModel):
    name: str | None = None
    keywords: str | None = None
    location: str | None = None
    experience_level: str | None = None
    job_type: str | None = None
    remote_only: bool | None = None
    salary_min_lpa: float | None = None
    salary_max_lpa: float | None = None
    extra_filters: dict | None = None
    is_active: bool | None = None
    auto_match: bool | None = None

    @field_validator("salary_min_lpa", "salary_max_lpa", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v


class JobSearchResponse(JobSearchCreate):
    id: uuid.UUID
    user_id: uuid.UUID
    is_active: bool
    auto_match: bool
    last_run_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Job Listing ───────────────────────────────────────────────────────────────
class JobListingResponse(BaseModel):
    id: uuid.UUID
    platform: str
    external_job_id: str | None
    title: str
    company: str
    location: str | None
    description: str | None
    apply_url: str | None
    salary_info: str | None
    posted_date: str | None
    status: str
    match_score: float | None
    match_explanation: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class JobListingFilter(BaseModel):
    platform: str | None = None
    status: str | None = None
    company: str | None = None
    keyword: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


# ── Application ──────────────────────────────────────────────────────────────
class ApplicationResponse(BaseModel):
    id: uuid.UUID
    job_listing_id: uuid.UUID
    resume_id: uuid.UUID | None
    status: str
    approval_status: str | None
    cover_letter: str | None
    error_message: str | None
    screenshot_path: str | None
    retry_count: int
    applied_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplicationStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|approved|submitted|failed|interview|rejected|accepted|skipped)$")


class ApplyRequest(BaseModel):
    resume_id: uuid.UUID | None = None
    auto_tailor: bool = True


# ── Cover Letter ─────────────────────────────────────────────────────────────
class CoverLetterRequest(BaseModel):
    job_description: str = Field(min_length=10)
    company_name: str = Field(min_length=1)
    job_title: str | None = None


class CoverLetterResponse(BaseModel):
    cover_letter: str


# ── Analytics ────────────────────────────────────────────────────────────────
class StatusCount(BaseModel):
    status: str
    count: int


class OverviewResponse(BaseModel):
    total_applications: int
    total_jobs_discovered: int
    counts_by_status: list[StatusCount]
    success_rate: float


class DailyStat(BaseModel):
    date: str
    applications: int
    discoveries: int


class DailyStatsResponse(BaseModel):
    stats: list[DailyStat]
