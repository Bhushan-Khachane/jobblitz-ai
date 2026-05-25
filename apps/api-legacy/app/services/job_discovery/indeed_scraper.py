"""Indeed India job scraper."""

from __future__ import annotations

import logging
from typing import List

from app.services.job_discovery.base_scraper import BaseJobScraper, RawJobListing, JobDescription

logger = logging.getLogger(__name__)

_UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
]


class IndeedScraper(BaseJobScraper):
    name = "indeed"

    async def search(self, query: str, location: str, experience_years: float, limit: int = 50) -> List[RawJobListing]:
        logger.info(f"[Indeed] Searching: {query} in {location}")
        # Stub: return empty list. Implement with Playwright in Phase 2.
        return []

    async def get_job_details(self, job_url: str) -> JobDescription:
        logger.info(f"[Indeed] Fetching details: {job_url}")
        return JobDescription(
            title="", company="", location=None, description="",
            requirements=[], skills=[], experience_min=None, experience_max=None,
            salary_min_lpa=None, salary_max_lpa=None, posted_date=None, apply_url=job_url,
        )
