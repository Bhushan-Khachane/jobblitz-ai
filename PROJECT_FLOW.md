# JobBlitz AI - Project Flow Documentation

## Overview

JobBlitz AI is an automated job discovery and application platform. It scrapes job listings from LinkedIn and Naukri, matches them against a user's resume, and auto-applies to high-matching jobs using stored credentials.

---

## System Architecture

```
Frontend (Next.js)  <->  Backend (FastAPI)  <->  PostgreSQL + Redis
                                    |
                                    v
                           Celery Worker + Beat
                                    |
                                    v
                              Playwright Scraper
```

### Services

| Service | Technology | Port | Role |
|---------|-----------|------|------|
| Frontend | Next.js | 3001 | User dashboard, resume upload, job search config |
| Backend | FastAPI | 8000 | API server, authentication, business logic |
| PostgreSQL | Postgres 15 | 5432 | Primary database |
| Redis | Redis 7 | 6379 | Celery broker + result backend |
| Celery Worker | Python/Celery | — | Background task execution |
| Celery Beat | Python/Celery | — | Scheduled task dispatcher |
| Flower | Flower | 5556 | Celery monitoring UI |

---

## Resume-Driven Job Matching Flow

### 1. Resume Upload & Profile Extraction

**Trigger:** User uploads a PDF resume via `POST /resumes/upload`

**Flow:**
```
User uploads resume PDF
        |
        v
Backend saves file to /uploads/{user_id}/{filename}
        |
        v
PDF text extraction (parse_pdf)
        |
        v
AI extraction (extract_resume_profile via OpenRouter LLM)
        |
        v
Upsert Profile model with:
  - skills[]
  - preferred_job_titles[]
  - headline
  - summary
  - experience
  - education
```

**AI Prompt:** Extracts structured JSON from raw resume text using `gpt-4o-mini` via OpenRouter.

**Endpoint:** `POST /resumes/{id}/analyze` — re-runs extraction on existing resumes.

---

### 2. Job Search Configuration

**Model:** `JobSearch`

| Field | Purpose |
|-------|---------|
| `keywords` | Base search terms (e.g., "data engineer") |
| `platform` | linkedin / naukri / both |
| `location` | City or region filter |
| `experience_level` | fresher / 1 / 2 / 3 / 5 / 7 / 10 |
| `auto_match` | **NEW** When true, merges resume profile data into keywords |
| `is_active` | Enables/disables scheduled discovery |

**When `auto_match=True`:**
```python
keywords = "data engineer, Senior Data Engineer, Azure Data Engineer, Azure Data Factory, Azure Databricks, Microsoft Fabric"
```
The base keywords are preserved, and profile job titles + top 3 short skills are appended.

---

### 3. Scheduled Job Discovery

**Celery Beat Schedule:** Every 2 hours

**Task:** `discover_jobs_task`

**Flow:**
```
For each active JobSearch:
    |
    v
If auto_match=True:
    Load user's default Resume
    Load user's Profile
    Build merged keywords
Else:
    Use JobSearch.keywords
    |
    v
Scrape platform(s):
  - LinkedIn: public guest search (no login needed)
  - Naukri: Firefox browser to bypass bot detection
    |
    v
For each scraped job:
    Skip if duplicate (external_job_id + platform)
    |
    v
Score against resume (match_job_to_resume)
    |
    v
Skip if match_score < MIN_MATCH_SCORE_TO_SAVE (0.2)
    |
    v
Save to JobListing with match_score
```

**Scraper Details:**
- **LinkedIn:** Uses Chromium with stealth. Public search URL, no authentication needed.
- **Naukri:** Uses Firefox (avoids Akamai bot detection). Extracts job cards from `.srp-jobtuple-wrapper`.

---

### 4. Job-Resume Matching Algorithm

**File:** `app/services/matching_service.py`

**Function:** `match_job_to_resume(job_title, job_description, resume_text, profile_skills, profile_job_titles)`

**How it works:**

1. **Tokenize** both job text and resume text (lowercase, strip punctuation, remove short words)
2. **Extract bigrams** (2-word phrases) from both sides
3. **Score components:**
   - **Skills overlap (50%):** Fraction of job tokens that match the candidate's skills
   - **Title overlap (25%):** Best match between job title and any profile job title
   - **Description overlap (25%):** Coverage of job tokens in the resume
4. **Short description boost:** When job description < 10 words, title weight increases to 45%

**Result:** Score between 0.0 and 1.0

---

### 5. Batch Auto-Apply

**Celery Beat Schedule:** Every 30 minutes

**Task:** `batch_auto_apply_task`

**Flow:**
```
Query JobListings where:
  status = "discovered"
  match_score >= MIN_MATCH_SCORE_TO_APPLY (0.3)
    |
    v
Group by user_id, check daily rate limit (default 100/day)
    |
    v
Verify active credentials exist for the platform
    |
    v
Dispatch auto_apply_task for each listing
```

**Individual Apply Task:**
```
Load user's credentials
Load user's profile
Load user's default resume
    |
    v
Launch Playwright browser:
  - Naukri: Firefox
  - LinkedIn: Chromium
    |
    v
Navigate to job apply_url
    |
    v
If login required:
  Perform platform login
  Return to job page
    |
    v
If Naukri + "Apply on company site":
  Skip — mark as "External apply"
    |
    v
Click Apply button
    |
    v
Fill any form fields (resume upload, standard fields, AI answers)
    |
    v
Click submit
    |
    v
Save screenshot + update Application status
```

---

## Database Schema

### Core Tables

**users**
- `id` (UUID PK)
- `email`, `hashed_password`, `full_name`, `phone`, `location`
- `is_active`

**profiles** (1:1 with users)
- `user_id` (FK)
- `headline`, `summary`
- `skills` (JSONB array)
- `preferred_job_titles` (JSONB array)
- `experience`, `education`, `certifications` (JSONB)
- `expected_salary_lpa`, `notice_period_days`

**resumes** (1:N with users)
- `user_id` (FK)
- `title`, `file_path`, `parsed_text`
- `is_default`

**credentials** (1:N with users)
- `user_id` (FK), `platform` (linkedin/naukri)
- `username`, `encrypted_password`
- `is_active`

**job_searches** (1:N with users)
- `user_id` (FK)
- `name`, `platform`, `keywords`
- `location`, `experience_level`
- `auto_match` (boolean)
- `is_active`

**job_listings** (N:1 with job_searches)
- `user_id` (FK), `job_search_id` (FK)
- `platform`, `external_job_id`
- `title`, `company`, `location`, `description`
- `apply_url`, `salary_info`, `posted_date`
- `status` (discovered/applied/failed/skipped)
- `match_score` (float)

**applications** (N:1 with job_listings)
- `user_id` (FK), `job_listing_id` (FK), `resume_id` (FK)
- `status` (pending/submitted/failed/interview/rejected/accepted)
- `error_message`, `screenshot_path`, `answers_used` (JSONB)
- `retry_count`

---

## Configuration

**File:** `app/config.py`

| Setting | Default | Purpose |
|---------|---------|---------|
| `MIN_MATCH_SCORE_TO_APPLY` | 0.3 | Jobs must score ≥ this to be auto-applied |
| `MIN_MATCH_SCORE_TO_SAVE` | 0.2 | Jobs must score ≥ this to be saved to DB |
| `MAX_APPLICATIONS_PER_DAY` | 100 | Global daily apply limit per user |
| `MAX_APPLICATIONS_PER_HOUR` | 20 | Hourly apply limit |
| `OPENROUTER_MODEL` | openai/gpt-4o-mini | LLM for resume parsing & QA |

---

## Key Implementation Details

### Bot Detection Bypass
- **Naukri scraper:** Firefox browser instead of Chromium. Akamai blocks Chromium headless.
- **Naukri apply:** Also uses Firefox. Chromium triggers 403/Access Denied.
- **Stealth:** `playwright_stealth` is applied to LinkedIn only. It breaks Naukri's Firefox pages.

### Async SQLAlchemy + Celery
- Celery workers use `asyncio.run()` to execute async coroutines.
- `engine.dispose()` is called at the start of each task to avoid "Event loop is closed" errors from forked workers.

### Naukri URL Construction
- Naukri only supports a single keyword phrase in its URL slug.
- The scraper uses only the first comma-separated keyword.
- Example: `"data engineer, Senior Data Engineer, Azure"` → slug = `data-engineer`

### External Apply Handling
- Most Naukri jobs now show "Apply on company site" which redirects to the employer's ATS.
- These are detected and marked as `skipped` (not a failure).
- Direct Naukri apply jobs are becoming rare.

---

## API Endpoints

### Authentication
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`

### Resumes
- `GET /resumes` — list user's resumes
- `POST /resumes/upload` — upload + auto-extract profile
- `POST /resumes/{id}/tailor` — tailor resume for a job description
- `POST /resumes/{id}/analyze` — re-run AI extraction
- `PUT /resumes/{id}` — update resume metadata
- `DELETE /resumes/{id}`

### Job Searches
- `GET /job-searches`
- `POST /job-searches` — create search (supports `auto_match`)
- `PUT /job-searches/{id}`
- `DELETE /job-searches/{id}`

### Job Listings
- `GET /job-listings` — discovered jobs with match scores
- `POST /job-listings/{id}/apply` — manual apply trigger

### Credentials
- `GET /credentials`
- `POST /credentials` — store platform credentials (encrypted)

---

## Scheduled Tasks (Celery Beat)

| Task | Schedule | Purpose |
|------|----------|---------|
| `discover_jobs_task` | Every 2 hours | Scrape new jobs for all active searches |
| `batch_auto_apply_task` | Every 30 min | Dispatch apply tasks for high-match jobs |
| `cleanup_old_listings_task` | Weekly (Sunday 2am) | Delete undiscovered listings older than 30 days |
| `check_application_statuses_task` | Daily 9am | Mark stale pending apps as failed |

---

## File Structure

```
backend/
├── app/
│   ├── config.py              # Settings
│   ├── models.py              # SQLAlchemy ORM models
│   ├── schemas.py             # Pydantic request/response schemas
│   ├── database.py            # Async engine + session
│   ├── dependencies.py        # Auth dependencies
│   ├── routers/
│   │   ├── auth.py
│   │   ├── resumes.py         # Upload, tailor, analyze
│   │   ├── job_searches.py
│   │   ├── job_listings.py
│   │   └── credentials.py
│   ├── services/
│   │   ├── ai_service.py      # OpenRouter LLM calls
│   │   ├── scraper_service.py # LinkedIn + Naukri scrapers
│   │   ├── apply_service.py   # Playwright auto-apply
│   │   ├── matching_service.py # Resume-job scoring
│   │   └── pdf_service.py     # PDF parsing + generation
│   ├── workers/
│   │   ├── celery_app.py
│   │   └── tasks.py           # Celery background tasks
│   └── utils/
│       └── encryption.py      # Fernet credential encryption
├── alembic/                   # Database migrations
└── Dockerfile
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Naukri returns 0 jobs | Chromium blocked by Akamai | Use Firefox for scraping |
| "No apply button found" | Stealth breaks Firefox pages | Skip stealth_async for Naukri |
| "Firefox already running" | Shared profile directory | Use unique profile dir per task |
| Match scores all low | Giant skill/title sets diluted scoring | Per-title best-match scoring |
| Jobs not saved despite found | Merged keywords too specific for Naukri URL | Use first keyword only for Naukri slug |
| Daily limit hit by failures | Failed attempts still create Application records | Clean up pending apps periodically |

---

## Deployment

```bash
# Start all services
docker compose up --build -d

# View logs
docker logs -f jobblitz-ai-celery_worker-1

# Monitor tasks
open http://localhost:5556  # Flower

# Run migrations
docker exec jobblitz-ai-backend-1 alembic upgrade head
```

---

## Future Improvements

1. **LinkedIn Apply:** Implement LinkedIn Easy Apply automation (currently only scrapes)
2. **Company Site Apply:** Add generic ATS form detection for external apply redirects
3. **Match Score Tuning:** Add user-configurable thresholds per search
4. **Job Description Enrichment:** Scrape full job description from detail pages (currently only search results)
5. **Duplicate Detection:** Improve cross-platform deduplication (same job posted on both LinkedIn and Naukri)
