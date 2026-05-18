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
    import logging
    logger = logging.getLogger(__name__)

    context = await scraper_browser.get_context("linkedin", data_dir)

    page: Page = await context.new_page()
    try:
        await stealth_async(page)
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await _random_delay(2, 4)

        # Try 2026 selectors first, then fall back to legacy selectors
        cards = await page.query_selector_all("li.jobs-search-results__list-item")
        if not cards:
            cards = await page.query_selector_all(".job-card-container")
        if not cards:
            cards = await page.query_selector_all(".job-search-card")
        if not cards:
            try:
                await page.screenshot(path="/tmp/linkedin_debug.png", full_page=True)
                page_html = await page.content()
                logger.warning(f"LinkedIn scraper: 0 cards found. URL={url}")
                logger.warning(f"LinkedIn page title: {await page.title()}")
                logger.warning(f"LinkedIn page HTML snippet: {page_html[:2000]}")
            except Exception:
                pass
            return results

        for card in cards[:max_results]:
            try:
                # Try 2026 selectors first, then legacy
                title_el = (
                    await card.query_selector(".job-card-list__title")
                    or await card.query_selector(".job-card-container__link span[aria-hidden='true']")
                    or await card.query_selector(".base-search-card__title")
                )
                company_el = (
                    await card.query_selector(".job-card-container__primary-description")
                    or await card.query_selector(".base-search-card__subtitle a")
                )
                location_el = (
                    await card.query_selector(".job-card-container__metadata-wrapper li")
                    or await card.query_selector(".job-search-card__location")
                )
                link_el = (
                    await card.query_selector("a.job-card-container__link")
                    or await card.query_selector("a.job-card-list__title")
                    or await card.query_selector("a.base-card__full-link")
                )
                date_el = await card.query_selector("time")
                salary_el = (
                    await card.query_selector(".job-card-container__metadata-wrapper li")
                    or await card.query_selector("[class*='salary']")
                    or await card.query_selector(".salary")
                )

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

                # Experience & salary from metadata wrapper
                exp_el = (
                    await card.query_selector(".job-card-container__metadata-wrapper li")
                    or await card.query_selector("[class*='experience']")
                )
                experience_text = ""
                salary_text = ""
                if exp_el:
                    li_text = (await exp_el.inner_text()).strip()
                    # LinkedIn metadata lists often contain "·" separators
                    parts = [p.strip() for p in li_text.replace("·", "|").split("|")]
                    for part in parts:
                        if any(kw in part.lower() for kw in ("year", "month", "exp")):
                            experience_text = part
                        if any(kw in part.lower() for kw in ("salary", "₹", "$", "€", "pay", "compensation")):
                            salary_text = part

                results.append({
                    "title": title,
                    "company": company,
                    "location": loc,
                    "experience": experience_text,
                    "description": "",
                    "apply_url": href or "",
                    "external_job_id": ext_id,
                    "posted_date": posted,
                    "salary_info": salary_text,
                    "platform": "linkedin",
                })
            except Exception:
                continue
    finally:
        await page.close()

    return results


import logging
logger = logging.getLogger(__name__)

CARD_SELECTORS = [
    ".srp-jobtuple-wrapper",
    "article.jobTuple",
    ".cust-job-tuple",
    "[data-job-id]",
    ".job-container",
]


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
    loc_slug = re.sub(r"[^a-z0-9-]", "", (location or "").replace(" ", "-").lower())
    exp_map = {"fresher": "0", "1": "1", "2": "2", "3": "3", "5": "5", "7": "7", "10": "10"}
    exp = exp_map.get(experience_level or "", "0")

    url = f"https://www.naukri.com/{slug}-jobs"
    if loc_slug:
        url = f"https://www.naukri.com/{slug}-jobs-in-{loc_slug}"
    url += f"?k={first_kw.replace(' ', '+')}"
    if loc_slug:
        url += f"&l={location.replace(' ', '+')}"
    url += f"&experience={exp}"

    data_dir = str(user_data_dir) if user_data_dir else str(Path(settings.UPLOAD_DIR) / ".naukri_ctx")

    from app.services.scraper_browser import scraper_browser
    context = await scraper_browser.get_context("naukri", data_dir)

    page: Page = await context.new_page()
    try:
        await page.goto(url, wait_until="networkidle", timeout=30000)
        try:
            await page.wait_for_selector(
                ".srp-jobtuple-wrapper, article.jobTuple, .cust-job-tuple, [data-job-id]",
                timeout=8000,
            )
        except Exception:
            pass
        await _random_delay(1, 2)

        cards = []
        for sel in CARD_SELECTORS:
            cards = await page.query_selector_all(sel)
            if cards:
                logger.info(f"Naukri: found {len(cards)} cards with selector '{sel}'")
                break

        if not cards:
            try:
                await page.screenshot(path="/tmp/naukri_debug.png", full_page=True)
                page_html = await page.content()
                logger.warning(f"Naukri scraper: 0 cards found. URL={url}")
                logger.warning(f"Naukri page title: {await page.title()}")
                logger.warning(f"Naukri page HTML snippet: {page_html[:2000]}")
            except Exception:
                pass
            return results

        for card in cards[:max_results]:
            try:
                title_el = (
                    await card.query_selector("a.title")
                    or await card.query_selector("a[data-type='jobTitle']")
                    or await card.query_selector(".jobTitle a")
                    or await card.query_selector("h2 a")
                    or await card.query_selector(".row1 a")
                )
                company_el = (
                    await card.query_selector("a.comp-name")
                    or await card.query_selector("a[data-type='company']")
                    or await card.query_selector(".companyInfo a")
                    or await card.query_selector(".subTitle .company-name")
                )
                location_el = (
                    await card.query_selector("span.locWdth")
                    or await card.query_selector(".locWdth")
                    or await card.query_selector("[class*='location']")
                    or await card.query_selector(".location")
                )
                exp_el = (
                    await card.query_selector(".expwdth")
                    or await card.query_selector("[class*='experience']")
                    or await card.query_selector(".exp")
                )
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

                experience_text = ""
                if exp_el:
                    experience_text = (await exp_el.inner_text()).strip()

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
                    "experience": experience_text,
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

    # Fetch full description for top jobs by visiting detail pages
    if results:
        for result in results[:10]:
            if not result.get("apply_url"):
                continue
            try:
                detail_page = await context.new_page()
                await detail_page.goto(result["apply_url"], wait_until="domcontentloaded", timeout=15000)
                await _random_delay(0.5, 1.5)
                desc_el = (
                    await detail_page.query_selector(".styles_job-desc-cont__Y0bHB")
                    or await detail_page.query_selector(".jd-desc")
                    or await detail_page.query_selector(".job-description")
                )
                if desc_el:
                    full_desc = (await desc_el.inner_text()).strip()[:2000]
                    if full_desc and len(full_desc) > len(result.get("description", "")):
                        result["description"] = full_desc
                await detail_page.close()
            except Exception:
                try:
                    await detail_page.close()
                except Exception:
                    pass

    return results