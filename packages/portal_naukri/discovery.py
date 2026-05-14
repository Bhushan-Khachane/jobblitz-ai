"""Naukri Discovery Engine — URL builder and job card parser."""

import re
from urllib.parse import quote_plus


def build_naukri_search_url(profile: dict) -> str:
    """
    Build Naukri job search URL from user search profile.
    Example: https://www.naukri.com/python-developer-jobs-in-nagpur?experience=2&jobAge=3
    """
    keywords = quote_plus(profile.get("keywords", "Python Developer"))
    location = quote_plus(profile.get("location", "Nagpur"))
    experience = profile.get("years_experience", 2)
    job_age = profile.get("job_age_days", 7)  # jobs posted in last N days
    return (
        f"https://www.naukri.com/{keywords.replace('+','-').lower()}"
        f"-jobs-in-{location.lower()}?"
        f"experience={experience}&jobAge={job_age}"
    )


def parse_naukri_job_cards(snapshot_text: str) -> list[dict]:
    """
    Parse job cards from Playwright page text output.
    Naukri job cards contain: title, company, experience, salary, location, posted.
    Returns list of dicts with normalized fields.
    """
    jobs = []
    lines = snapshot_text.split("\n")
    current = {}
    for line in lines:
        line = line.strip()
        if "[link]" in line and "jobs" in line.lower():
            if current:
                jobs.append(current)
            current = {"title": extract_text(line), "ref": extract_ref(line)}
        elif "[StaticText]" in line and current:
            text = extract_text(line)
            if is_company_name(text):
                current["company"] = text
            elif is_experience(text):
                current["experience"] = text
            elif is_salary(text):
                current["salary"] = text
            elif is_location(text):
                current["location"] = text
            elif "ago" in text.lower():
                current["posted"] = text
        elif "[button]" in line and current and "apply" in line.lower():
            current["apply_ref"] = extract_ref(line)
    if current:
        jobs.append(current)
    return jobs


def extract_ref(line: str) -> str:
    m = re.search(r'(@e\d+)', line)
    return m.group(1) if m else ""


def extract_text(line: str) -> str:
    m = re.search(r'"([^"]+)"', line)
    return m.group(1) if m else ""


def is_company_name(text: str) -> bool:
    skip = ["years", "lakh", "₹", "month", "ago", "apply", "save", "experience",
            "salary", "location", "job", "naukri", "reviews", "opening", "walk-in"]
    return len(text) > 2 and not any(s in text.lower() for s in skip)


def is_experience(text: str) -> bool:
    return "year" in text.lower() or "yrs" in text.lower() or "exp" in text.lower()


def is_salary(text: str) -> bool:
    return "lakh" in text.lower() or "₹" in text or "pa" in text.lower() or "month" in text.lower()


def is_location(text: str) -> bool:
    cities = [
        "bangalore", "mumbai", "delhi", "pune", "hyderabad",
        "nagpur", "chennai", "remote", "india", "noida", "gurgaon",
        "gurugram", "kolkata", "ahmedabad", "jaipur", "indore",
        "coimbatore", "kochi", "trivandrum", "bhubaneswar", "chandigarh",
    ]
    return any(c in text.lower() for c in cities)
