from __future__ import annotations

import asyncio
import random
import re
from pathlib import Path

from playwright.async_api import BrowserContext, Page
from playwright_stealth import stealth_async

from app.config import settings


async def _random_delay(low: float = 1.0, high: float = 3.0) -> None:
    await asyncio.sleep(random.uniform(low, high))


async def scrape_linkedin_jobs(
    keywords: str,
    location: str | None = None,
    experience_level: str | None = None,
    job_type: str | None = None,
    remote_only: bool = False,
    max_results: int = 25,
    user_data_dir: str | Path | None = None,
) -> list[dict]:
    """Scrape LinkedIn jobs (public guest search — no login required)."""
    results: list[dict] = []
    base_url = "https://www.linkedin.com/jobs/search/"
    params = f"?keywords={keywords.replace(' ', '%20')}"
    if location:
        params += f"&location={location.replace(' ', '%20')}"
    if remote_only:
        params += "&f_WT=2"
    if experience_level:
        level_map = {"internship": "1", "entry": "2", "mid": "3", "senior": "4", "director": "5"}
        f_e = level_map.get(experience_level.lower(), "")
        if f_e:
            params += f"&f_E={f_e}"

    url = base_url + params
    data_dir = str(user_data_dir) if user_data_dir else str(Path(settings.UPLOAD_DIR) / ".linkedin_ctx")

    from app.services.scraper_browser import scraper_browser
    context = await scraper_browser.get_context("linkedin", data_dir)

    page: Page = await context.new_page()
    try:
        await stealth_async(page)
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await _random_delay(2, 4)

        cards = await page.query_selector_all(".job-search-card")
        for card in cards[:max_results]:
            try:
                title_el = await card.query_selector(".base-search-card__title")
                company_el = await card.query_selector(".base-search-card__subtitle a")
                location_el = await card.query_selector(".job-search-card__location")
                link_el = await card.query_selector("a.base-card__full-link")
                date_el = await card.query_selector("time")

                title = (await title_el.inner_text()).strip() if title_el else ""
                company = (await company_el.inner_text()).strip() if company_el else ""
                loc = (await location_el.inner_text()).strip() if location_el else ""
                href = await link_el.get_attribute("href") if link_el else ""
                posted = (await date_el.get_attribute("datetime")) if date_el else ""
                ext_id = ""
                if href:
                    m = re.search(r"/view/[^/]*-(\d+)", href)
                    if m:
                        ext_id = m.group(1)

                results.append({
                    "title": title,
                    "company": company,
                    "location": loc,
                    "description": "",
                    "apply_url": href or "",
                    "external_job_id": ext_id,
                    "posted_date": posted,
                    "platform": "linkedin",
                })
            except Exception:
                continue
    finally:
        await page.close()

    return results


async def scrape_naukri_jobs(
    keywords: str,
    location: str | None = None,
    experience_level: str | None = None,
    max_results: int = 25,
    user_data_dir: str | Path | None = None,
) -> list[dict]:
    """Scrape Naukri job listings via public search page using Firefox."""
    results: list[dict] = []
    # Naukri URL slugs only support a single keyword phrase; use the first one
    first_kw = keywords.split(",")[0].strip()
    slug = re.sub(r"[^a-z0-9-]", "", first_kw.replace(" ", "-").lower())
    loc_slug = (location or "").replace(" ", "-").lower()
    exp_map = {"fresher": "0", "1": "1", "2": "2", "3": "3", "5": "5", "7": "7", "10": "10"}
    exp = exp_map.get(experience_level or "", "0")

    url = f"https://www.naukri.com/{slug}-jobs"
    if loc_slug:
        url = f"https://www.naukri.com/{slug}-jobs-in-{loc_slug}"
    url += f"?experience={exp}"

    data_dir = str(user_data_dir) if user_data_dir else str(Path(settings.UPLOAD_DIR) / ".naukri_ctx")

    from app.services.scraper_browser import scraper_browser
    context = await scraper_browser.get_context("naukri", data_dir)

    page: Page = await context.new_page()
    try:
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await _random_delay(2, 4)

        cards = await page.query_selector_all(".srp-jobtuple-wrapper")
        for card in cards[:max_results]:
            try:
                title_el = await card.query_selector("a.title")
                company_el = await card.query_selector("a.comp-name")
                location_el = await card.query_selector("span.locWdth")
                desc_el = await card.query_selector(".job-desc")
                salary_el = await card.query_selector(".sal")
                posted_el = await card.query_selector(".job-post-day")

                title = ""
                href = ""
                if title_el:
                    title = (await title_el.get_attribute("title")) or (await title_el.inner_text())
                    title = title.strip()
                    href = await title_el.get_attribute("href") or ""

                company = ""
                if company_el:
                    company = (await company_el.get_attribute("title")) or (await company_el.inner_text())
                    company = company.strip()

                loc = (await location_el.get_attribute("title")) if location_el else ""
                if not loc and location_el:
                    loc = (await location_el.inner_text()).strip()

                desc = (await desc_el.inner_text()).strip() if desc_el else ""
                salary = (await salary_el.inner_text()).strip() if salary_el else ""
                posted = (await posted_el.inner_text()).strip() if posted_el else ""

                ext_id = ""
                if href:
                    m = re.search(r"[-/](\d{6,})(?:\?|$)", href)
                    if m:
                        ext_id = m.group(1)

                results.append({
                    "title": title,
                    "company": company,
                    "location": loc,
                    "description": desc,
                    "apply_url": href if href.startswith("http") else f"https://www.naukri.com{href}",
                    "external_job_id": ext_id,
                    "posted_date": posted,
                    "salary_info": salary,
                    "platform": "naukri",
                })
            except Exception:
                continue
    finally:
        await page.close()

    return results