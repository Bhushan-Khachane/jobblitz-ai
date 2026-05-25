"""
Pluggable ATS adapter pattern for detecting and routing job applications.

Each adapter:
- Detects if a job URL belongs to its ATS
- Extracts job details from the ATS page
- Determines if the ATS is supported for auto-apply or needs assisted/manual mode
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum


class ATSSupport(Enum):
    """Level of support for a given ATS."""
    FULL = "full"          # Auto-apply supported
    ASSISTED = "assisted"  # Can prepare, user must submit
    MANUAL = "manual"      # User must apply themselves
    UNSUPPORTED = "unsupported"  # Cannot interact with this ATS


@dataclass
class ATSDetection:
    """Result of detecting which ATS a job URL belongs to."""
    ats_name: str
    support_level: ATSSupport
    confidence: float  # 0-1
    job_id: str | None = None
    company_slug: str | None = None
    redirect_url: str | None = None


@dataclass
class ATSAdapter:
    """Base adapter for an Applicant Tracking System."""
    name: str
    domain_patterns: list[str]
    api_url_template: str | None
    support_level: ATSSupport

    def detect(self, url: str) -> ATSDetection | None:
        """Check if this URL belongs to this ATS. Returns detection info or None."""
        url_lower = url.lower()
        for pattern in self.domain_patterns:
            if pattern in url_lower:
                return ATSDetection(
                    ats_name=self.name,
                    support_level=self.support_level,
                    confidence=0.9,
                    job_id=self._extract_job_id(url),
                    company_slug=self._extract_company_slug(url),
                    redirect_url=url,
                )
        return None

    def _extract_job_id(self, url: str) -> str | None:
        """Override in subclasses to extract the job ID from a URL."""
        return None

    def _extract_company_slug(self, url: str) -> str | None:
        """Override in subclasses to extract the company slug from a URL."""
        return None


class GreenhouseAdapter(ATSAdapter):
    def __init__(self):
        super().__init__(
            name="greenhouse",
            domain_patterns=["boards.greenhouse.io", "job-boards.greenhouse.io", "boards-api.greenhouse.io"],
            api_url_template="https://boards-api.greenhouse.io/v1/boards/{company}/jobs",
            support_level=ATSSupport.FULL,
        )

    def _extract_job_id(self, url: str) -> str | None:
        m = re.search(r"/jobs/(\d+)", url)
        return m.group(1) if m else None

    def _extract_company_slug(self, url: str) -> str | None:
        m = re.search(r"boards(?:-api)?\.greenhouse\.io/([^/]+)", url)
        return m.group(1) if m else None


class LeverAdapter(ATSAdapter):
    def __init__(self):
        super().__init__(
            name="lever",
            domain_patterns=["jobs.lever.co", "api.lever.co"],
            api_url_template="https://api.lever.co/v0/postings/{company}",
            support_level=ATSSupport.FULL,
        )

    def _extract_job_id(self, url: str) -> str | None:
        m = re.search(r"/([a-f0-9-]{8,})", url)
        return m.group(1) if m else None

    def _extract_company_slug(self, url: str) -> str | None:
        m = re.search(r"jobs\.lever\.co/([^/]+)", url)
        return m.group(1) if m else None


class AshbyAdapter(ATSAdapter):
    def __init__(self):
        super().__init__(
            name="ashby",
            domain_patterns=["jobs.ashbyhq.com"],
            api_url_template=None,  # Uses GraphQL
            support_level=ATSSupport.ASSISTED,
        )

    def _extract_job_id(self, url: str) -> str | None:
        m = re.search(r"/([a-f0-9-]{8,})", url)
        return m.group(1) if m else None

    def _extract_company_slug(self, url: str) -> str | None:
        m = re.search(r"jobs\.ashbyhq\.com/([^/]+)", url)
        return m.group(1) if m else None


class WorkdayAdapter(ATSAdapter):
    def __init__(self):
        super().__init__(
            name="workday",
            domain_patterns=["myworkdayjobs.com", "workday.com"],
            api_url_template=None,
            support_level=ATSSupport.MANUAL,
        )


class ICIMSAdapter(ATSAdapter):
    def __init__(self):
        super().__init__(
            name="icims",
            domain_patterns=["icims.com", "careers-icims.com"],
            api_url_template=None,
            support_level=ATSSupport.MANUAL,
        )


class NaukriAdapter(ATSAdapter):
    def __init__(self):
        super().__init__(
            name="naukri",
            domain_patterns=["naukri.com", "naukri.com/jobapi", "www.naukri.com"],
            api_url_template=None,
            support_level=ATSSupport.ASSISTED,  # Can auto-apply for direct Naukri jobs, not external
        )

    def _extract_job_id(self, url: str) -> str | None:
        m = re.search(r"[-/](\d{6,})(?:\?|$)", url)
        return m.group(1) if m else None


class LinkedInAdapter(ATSAdapter):
    def __init__(self):
        super().__init__(
            name="linkedin",
            domain_patterns=["linkedin.com/jobs", "linkedin.com/jobs/view", "www.linkedin.com/jobs"],
            api_url_template=None,
            support_level=ATSSupport.ASSISTED,  # Easy Apply is possible but risky
        )

    def _extract_job_id(self, url: str) -> str | None:
        m = re.search(r"/view/[^/]*-(\d+)", url)
        return m.group(1) if m else None


class InstahyreAdapter(ATSAdapter):
    def __init__(self):
        super().__init__(
            name="instahyre",
            domain_patterns=["instahyre.com"],
            api_url_template=None,
            support_level=ATSSupport.MANUAL,
        )


class CutshortAdapter(ATSAdapter):
    def __init__(self):
        super().__init__(
            name="cutshort",
            domain_patterns=["cutshort.io"],
            api_url_template=None,
            support_level=ATSSupport.MANUAL,
        )


class WellfoundAdapter(ATSAdapter):
    def __init__(self):
        super().__init__(
            name="wellfound",
            domain_patterns=["wellfound.com", "angel.co"],
            api_url_template=None,
            support_level=ATSSupport.MANUAL,
        )


# ── ATS Router ─────────────────────────────────────────────────────────────────

# Order matters: more specific patterns first
ADAPTERS: list[ATSAdapter] = [
    GreenhouseAdapter(),
    LeverAdapter(),
    AshbyAdapter(),
    WorkdayAdapter(),
    ICIMSAdapter(),
    NaukriAdapter(),
    LinkedInAdapter(),
    InstahyreAdapter(),
    CutshortAdapter(),
    WellfoundAdapter(),
]


def detect_ats(url: str) -> ATSDetection | None:
    """Detect which ATS a job URL belongs to. Returns the best match or None."""
    for adapter in ADAPTERS:
        detection = adapter.detect(url)
        if detection:
            return detection
    return None


def get_apply_mode_for_url(url: str, user_application_mode: str) -> str:
    """
    Determine the effective apply mode for a job URL.
    The most restrictive mode wins:
    - If ATS is MANUAL, the user must apply manually regardless of their setting.
    - If ATS is ASSISTED, the user can at most approve (no blind auto-apply).
    - If ATS is FULL and user is in AUTO, full auto-apply is allowed.
    """
    detection = detect_ats(url)

    if detection is None:
        # Unknown ATS — safest is assisted
        ats_support = ATSSupport.ASSISTED
    else:
        ats_support = detection.support_level

    # Map support levels to effective modes
    ats_mode_map = {
        ATSSupport.FULL: "auto",
        ATSSupport.ASSISTED: "assisted",
        ATSSupport.MANUAL: "manual",
        ATSSupport.UNSUPPORTED: "manual",
    }

    ats_mode = ats_mode_map[ats_support]

    # Most restrictive wins
    mode_restrictiveness = {"manual": 3, "assisted": 2, "auto": 1}
    effective = max(user_application_mode, ats_mode, key=lambda m: mode_restrictiveness.get(m, 2))

    return effective