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

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in v):
            raise ValueError("Password must contain at least one special character")
        return v


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
    plan: str = "free"
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
    education: list[dict] | dict | None = None
    certifications: list[dict] | dict | None = None
    preferred_job_titles: list[str] | None = None
    preferred_locations: list[str] | None = None
    expected_salary_lpa: float | None = None
    salary_min_lpa: float | None = None
    salary_max_lpa: float | None = None
    experience_level: str | None = Field(None, pattern="^(entry|mid|senior|lead)$")
    remote_only: bool | None = None
    target_portals: list[str] | None = None
    notice_period_days: int | None = None
    # Salary
    current_ctc_lpa: float | None = None
    current_fixed_lpa: float | None = None
    current_variable_lpa: float | None = None
    # Languages & links
    languages: list[str] | None = None
    job_type: str | None = Field(None, pattern="^(full-time|contract|internship|part-time|freelance)$")
    work_mode: str | None = Field(None, pattern="^(remote|hybrid|onsite)$")
    portfolio_url: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    ai_summary: str | None = None
    onboarding_step: int | None = None


class ProfileResponse(ProfileCreate):
    ai_summary_updated_at: datetime | None = None
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Credentials ───────────────────────────────────────────────────────────────
class CredentialCreate(BaseModel):
    platform: str = Field(pattern="^(linkedin|naukri|shine|unstop|wellfound|internshala)$")
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
    platform: str = Field(pattern="^(linkedin|naukri|shine|unstop|wellfound|internshala)$")
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
    idempotency_key: str | None
    cover_letter: str | None
    error_message: str | None
    screenshot_path: str | None
    retry_count: int
    applied_at: datetime | None
    created_at: datetime
    # Enriched job details (populated from join)
    job_title: str | None = None
    company: str | None = None
    location: str | None = None
    apply_url: str | None = None
    fit_score: float | None = None
    gap_notes: str | None = None
    portal: str | None = None
    answers_used: dict | None = None

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
    platform_counts: list[dict] = []


class DailyStat(BaseModel):
    date: str
    applications: int
    discoveries: int


class DailyStatsResponse(BaseModel):
    stats: list[DailyStat]


# ── 3-Plane Architecture — New Schemas ──────────────────────────────────────────

class PortalSessionCreate(BaseModel):
    portal: str = Field(pattern="^(naukri|linkedin|indeed)$")


class PortalSessionResponse(BaseModel):
    id: uuid.UUID
    session_id: str
    portal: str
    status: str
    manual_login_url: str | None
    login_method: str = "cookie"
    verified: bool = False
    last_verified_at: datetime | None
    expires_at: datetime | None
    evidence: dict | None = None
    error: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PortalSessionListResponse(BaseModel):
    sessions: list[PortalSessionResponse]

    model_config = {"from_attributes": True}


class PortalVerifyResponse(BaseModel):
    verified: bool
    reason: str | None
    url: str | None
    screenshot_url: str | None
    page_text_excerpt: str | None
    status: str
    error: str | None = None


class JobSearchProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    keywords: str = Field(min_length=1, max_length=500)
    locations: list[str] | None = None
    experience_level: str | None = None
    job_type: str | None = None
    remote_only: bool = False
    salary_min_lpa: float | None = None
    salary_max_lpa: float | None = None
    portals: list[str] | None = None
    extra_filters: dict | None = None
    years_experience: int | None = 2
    job_age_days: int | None = 7


class JobSearchProfileResponse(JobSearchProfileCreate):
    id: uuid.UUID
    user_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JobLeadResponse(BaseModel):
    id: uuid.UUID
    portal: str
    url: str
    title: str
    company: str
    location: str | None
    jd_text: str | None
    posted_at: str | None
    experience: str | None = None
    salary: str | None = None
    fit_score: float | None = None
    decision: str | None = None
    processed: bool
    discovered_at: datetime

    model_config = {"from_attributes": True}


class JobScoreResponse(BaseModel):
    id: uuid.UUID
    job_lead_id: uuid.UUID
    fit_score: float
    must_have_match: dict | None
    gap_notes: str | None
    decision: str
    scored_at: datetime

    model_config = {"from_attributes": True}


class ApplicationPlanResponse(BaseModel):
    id: uuid.UUID
    job_lead_id: uuid.UUID
    fields: dict
    resume_variant: str | None
    cover_letter: str | None
    requires_approval: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplicationRunResponse(BaseModel):
    id: uuid.UUID
    job_lead_id: uuid.UUID
    plan_id: uuid.UUID | None
    status: str
    error_message: str | None
    retry_count: int
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplicationStepEventResponse(BaseModel):
    id: uuid.UUID
    run_id: uuid.UUID
    step_name: str
    tool_name: str
    tool_args: dict | None
    tool_output: dict | None
    success: bool
    dry_run: bool = False
    planned_action: dict | None = None
    error_message: str | None
    screenshot_url: str | None
    diff_text: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApprovalRequestResponse(BaseModel):
    id: uuid.UUID
    job_lead_id: uuid.UUID
    fit_score: float | None
    reason: str
    status: str
    reviewed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PortalInboxEventResponse(BaseModel):
    id: uuid.UUID
    portal: str
    event_type: str
    job_title: str | None
    company: str | None
    event_data: dict | None
    read: bool
    occurred_at: datetime | None
    synced_at: datetime

    model_config = {"from_attributes": True}


class StandardRunResponse(BaseModel):
    run_id: str
    status: str
    events: list[dict] = []
    error: str | None = None


# ── Notification Preferences ──────────────────────────────────────────────────
class NotificationPreferenceCreate(BaseModel):
    email_notifications: bool | None = True
    digest_frequency: str | None = Field(None, pattern="^(daily|weekly|none)$")
    follow_up_enabled: bool | None = True
    application_updates: bool | None = True
    marketing: bool | None = False


class NotificationPreferenceResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email_notifications: bool
    digest_frequency: str
    follow_up_enabled: bool
    application_updates: bool
    marketing: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
