"""Foundit (formerly Monster India) job scraper."""

from __future__ import annotations

import logging
from typing import List

from app.services.job_discovery.base_scraper import BaseJobScraper, RawJobListing, JobDescription

logger = logging.getLogger(__name__)


class FounditScraper(BaseJobScraper):
    name = "foundit"

    async def search(self, query: str, location: str, experience_years: float, limit: int = 50) -> List[RawJobListing]:
        logger.info(f"[Foundit] Searching: {query} in {location}")
        return []

    async def get_job_details(self, job_url: str) -> JobDescription:
        return JobDescription(
            title="", company="", location=None, description="",
            requirements=[], skills=[], experience_min=None, experience_max=None,
            salary_min_lpa=None, salary_max_lpa=None, posted_date=None, apply_url=job_url,
        )
