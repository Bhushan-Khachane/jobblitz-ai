"""Shared enums for the 3-plane architecture."""

from enum import Enum


class BrowserSessionStatus(str, Enum):
    PENDING_LOGIN = "pending_login"
    ACTIVE = "active"
    EXPIRED = "expired"
    ERROR = "error"


class ApplicationRunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    BLOCKED = "blocked"
    SKIPPED = "skipped"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PortalInboxEventType(str, Enum):
    INTERVIEW_INVITE = "interview_invite"
    REJECTED = "rejected"
    VIEWED = "viewed"
    SHORTLISTED = "shortlisted"
    OFFER = "offer"


class Portal(str, Enum):
    NAUKRI = "naukri"
    LINKEDIN = "linkedin"
    INDEED = "indeed"
