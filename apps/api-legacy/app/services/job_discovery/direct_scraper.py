"""Generic direct company career page scraper.

For companies like Accenture, PwC, Deloitte, etc.
"""

from __future__ import annotations

import logging
from typing import List

from app.services.job_discovery.base_scraper import BaseJobScraper, RawJobListing, JobDescription

logger = logging.getLogger(__name__)

# Career page URL patterns per company
_CAREER_URLS = {
    "accenture": "https://www.accenture.com/in-en/careers/jobsearch",
    "deloitte": "https://jobs2.deloitte.com/ui/en",
    "pwc": "https://www.pwc.com/gx/en/careers/experienced-jobs.html",
    "tcs": "https://www.tcs.com/careers",
    "infosys": "https://www.infosys.com/careers.html",
    "wipro": "https://careers.wipro.com/",
    "ibm": "https://www.ibm.com/careers",
    "microsoft": "https://careers.microsoft.com/",
    "google": "https://careers.google.com/",
    "amazon": "https://www.amazon.jobs/",
}


class DirectScraper(BaseJobScraper):
    name = "direct"

    async def search(self, query: str, location: str, experience_years: float, limit: int = 50) -> List[RawJobListing]:
        logger.info(f"[Direct] Searching company career pages for: {query}")
        return []

    async def get_job_details(self, job_url: str) -> JobDescription:
        return JobDescription(
            title="", company="", location=None, description="",
            requirements=[], skills=[], experience_min=None, experience_max=None,
            salary_min_lpa=None, salary_max_lpa=None, posted_date=None, apply_url=job_url,
        )
