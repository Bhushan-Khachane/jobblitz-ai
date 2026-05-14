import httpx, os
from typing import List, Dict

ADZUNA_APP_ID  = os.environ.get("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.environ.get("ADZUNA_APP_KEY", "")
JOOBLE_KEY     = os.environ.get("JOOBLE_API_KEY", "")


async def search_adzuna(keywords: str, location: str = "India",
                        count: int = 20) -> List[Dict]:
    if not ADZUNA_APP_ID:
        return []
    url = "https://api.adzuna.com/v1/api/jobs/in/search/1"
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get(url, params={
                "app_id": ADZUNA_APP_ID, "app_key": ADZUNA_APP_KEY,
                "what": keywords, "where": location,
                "results_per_page": count,
            })
            r.raise_for_status()
            return [_norm_adzuna(j) for j in r.json().get("results", [])]
        except Exception:
            return []


async def search_jooble(keywords: str, location: str = "India") -> List[Dict]:
    if not JOOBLE_KEY:
        return []
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.post(
                f"https://jooble.org/api/{JOOBLE_KEY}",
                json={"keywords": keywords, "location": location}
            )
            r.raise_for_status()
            return [_norm_jooble(j) for j in r.json().get("jobs", [])]
        except Exception:
            return []


async def search_remotive(keywords: str) -> List[Dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            r = await client.get("https://remotive.com/api/remote-jobs",
                                 params={"search": keywords, "limit": 20})
            r.raise_for_status()
            return [_norm_remotive(j) for j in r.json().get("jobs", [])]
        except Exception:
            return []


def _norm_adzuna(j: Dict) -> Dict:
    return {
        "title": j.get("title", ""),
        "company": j.get("company", {}).get("display_name", ""),
        "location": j.get("location", {}).get("display_name", ""),
        "description": j.get("description", ""),
        "url": j.get("redirect_url", ""),
        "salary": f"{j.get('salary_min','')}–{j.get('salary_max','')}",
        "source": "adzuna",
        "posted_at": j.get("created", ""),
    }


def _norm_jooble(j: Dict) -> Dict:
    return {
        "title": j.get("title", ""),
        "company": j.get("company", ""),
        "location": j.get("location", ""),
        "description": j.get("snippet", ""),
        "url": j.get("link", ""),
        "salary": j.get("salary", ""),
        "source": "jooble",
        "posted_at": j.get("updated", ""),
    }


def _norm_remotive(j: Dict) -> Dict:
    return {
        "title": j.get("title", ""),
        "company": j.get("company_name", ""),
        "location": j.get("candidate_required_location", "Remote"),
        "description": j.get("description", ""),
        "url": j.get("url", ""),
        "salary": j.get("salary", ""),
        "source": "remotive",
        "posted_at": j.get("publication_date", ""),
    }


async def search_all(keywords: str, location: str = "India", portal: str = "naukri") -> List[Dict]:
    from asyncio import gather
    results = await gather(
        search_adzuna(keywords, location),
        search_jooble(keywords, location),
        search_remotive(keywords),
        return_exceptions=True
    )
    jobs = []
    for r in results:
        if isinstance(r, list):
            jobs.extend(r)
    seen = set()
    unique = []
    for j in jobs:
        key = (j["title"].lower(), j["company"].lower())
        if key not in seen:
            seen.add(key)
            unique.append(j)
    return unique
