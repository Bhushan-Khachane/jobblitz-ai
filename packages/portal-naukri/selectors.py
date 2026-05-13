"""Naukri-specific CSS selectors and form field mappings."""

from typing import Any

# ── Search page selectors ────────────────────────────────────────────────────
SEARCH_INPUT = "input[placeholder*='Search jobs']"
SEARCH_BUTTON = "button[type='submit']"

# ── Job listing selectors ────────────────────────────────────────────────────
JOB_CARD = ".jobTuple"
JOB_TITLE = ".title a"
JOB_COMPANY = ".companyInfo .subTitle"
JOB_LOCATION = ".companyInfo .locWdth"
JOB_POSTED = ".jobTupleFooter .postedDate"
JOB_EXPERIENCE = ".experience"
JOB_SALARY = ".salary"

# ── Application form selectors ───────────────────────────────────────────────
APPLY_BUTTON = "button#apply-button, a[*='apply']"
EASY_APPLY_BUTTON = "button:has-text('Apply')"

# Form fields on Naukri apply page
FORM_FIELDS: dict[str, dict[str, Any]] = {
    "name": {"label_patterns": ["Name", "Full Name"], "type": "fill"},
    "email": {"label_patterns": ["Email", "Email ID"], "type": "fill"},
    "phone": {"label_patterns": ["Phone", "Mobile", "Contact Number"], "type": "fill"},
    "experience_years": {"label_patterns": ["Experience", "Years of Experience"], "type": "fill"},
    "current_ctc": {"label_patterns": ["Current CTC", "Current Salary"], "type": "fill"},
    "expected_ctc": {"label_patterns": ["Expected CTC", "Expected Salary"], "type": "fill"},
    "notice_period": {"label_patterns": ["Notice Period", "Joining Time"], "type": "select"},
    "resume_upload": {"label_patterns": ["Resume", "Upload Resume"], "type": "upload"},
    "cover_letter": {"label_patterns": ["Cover Letter", "Message to Hiring Manager"], "type": "fill"},
}

# ── Success signals ──────────────────────────────────────────────────────────
SUCCESS_SIGNALS = [
    "successfully applied",
    "application submitted",
    "applied successfully",
    "thank you for applying",
    "your application has been sent",
]

# ── Error signals ────────────────────────────────────────────────────────────
ERROR_SIGNALS = [
    "already applied",
    "application limit reached",
    "something went wrong",
    "please try again later",
    "error",
]


def get_field_selector(field_name: str) -> str:
    """Return a gstack-style ref selector for a known Naukri field."""
    mapping = {
        "name": "label=Name",
        "email": "label=Email",
        "phone": "label=Phone",
        "experience_years": "label=Experience",
        "current_ctc": "label=Current CTC",
        "expected_ctc": "label=Expected CTC",
        "notice_period": "label=Notice Period",
        "resume_upload": "label=Resume",
        "cover_letter": "label=Cover Letter",
    }
    return mapping.get(field_name, f"label={field_name}")


def build_naukri_search_url(keywords: str, location: str = "") -> str:
    q = keywords.replace(" ", "-")
    l = location.replace(" ", "-") if location else ""
    return f"https://www.naukri.com/{q}-jobs-in-{l}" if l else f"https://www.naukri.com/{q}-jobs"
