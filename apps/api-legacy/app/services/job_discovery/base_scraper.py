"""Base scraper interface for all job portals."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import List


@dataclass
class RawJobListing:
    """Raw job data from any portal before scoring."""
    job_id: str
    title: str
    company: str
    location: str | None
    description: str | None
    apply_url: str
    posted_date: str | None
    salary_raw: str | None
    experience_raw: str | None
    job_type: str | None
    source_portal: str
    raw_html: str | None = None
    scraped_at: datetime | None = None


@dataclass
class JobDescription:
    """Detailed job description after fetching detail page."""
    title: str
    company: str
    location: str | None
    description: str
    requirements: list[str]
    skills: list[str]
    experience_min: int | None
    experience_max: int | None
    salary_min_lpa: float | None
    salary_max_lpa: float | None
    posted_date: str | None
    apply_url: str


class BaseJobScraper(ABC):
    """Abstract base class for all job portal scrapers."""

    name: str = "base"

    @abstractmethod
    async def search(
        self,
        query: str,
        location: str,
        experience_years: float,
        limit: int = 50,
    ) -> List[RawJobListing]:
        """Search for jobs on this portal."""
        ...

    @abstractmethod
    async def get_job_details(self, job_url: str) -> JobDescription:
        """Fetch full job description from detail page."""
        ...
