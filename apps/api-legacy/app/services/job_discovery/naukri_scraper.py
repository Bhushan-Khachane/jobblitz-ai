"""Naukri.com job scraper — wraps existing scraper_service."""

from __future__ import annotations

import logging
from typing import List

from app.services.job_discovery.base_scraper import BaseJobScraper, RawJobListing, JobDescription
from app.services.scraper_service import scrape_naukri_jobs

logger = logging.getLogger(__name__)


class NaukriScraper(BaseJobScraper):
    name = "naukri"

    async def search(self, query: str, location: str, experience_years: float, limit: int = 50) -> List[RawJobListing]:
        logger.info(f"[Naukri] Searching: {query} in {location}")
        try:
            raw = await scrape_naukri_jobs(
                keywords=query,
                location=location or None,
                max_results=min(limit, 25),
            )
            results = []
            for item in raw:
                results.append(RawJobListing(
                    job_id=item.get("external_job_id") or item.get("url", ""),
                    title=item.get("title", ""),
                    company=item.get("company", ""),
                    location=item.get("location"),
                    description=item.get("description"),
                    apply_url=item.get("apply_url") or item.get("url", ""),
                    posted_date=item.get("posted_date"),
                    salary_raw=item.get("salary"),
                    experience_raw=item.get("experience"),
                    job_type=item.get("job_type"),
                    source_portal="naukri",
                ))
            return results
        except Exception as e:
            logger.error(f"[Naukri] Scrape failed: {e}")
            return []

    async def get_job_details(self, job_url: str) -> JobDescription:
        return JobDescription(
            title="", company="", location=None, description="",
            requirements=[], skills=[], experience_min=None, experience_max=None,
            salary_min_lpa=None, salary_max_lpa=None, posted_date=None, apply_url=job_url,
        )
