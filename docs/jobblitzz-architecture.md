# JobBlitz 3-Plane Architecture

## 1. Overview Diagram

```
                              User
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Next.js Frontend    │
                    │   (Control Plane UI)  │
                    └──────────┬────────────┘
                               │ REST / SSE
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
    │   FastAPI     │ │  ADK         │ │  Browser     │
    │   Backend     │ │  Orchestrator│ │  Worker      │
    │   (Control)   │ │  (Intel)     │ │  (Execution) │
    │   Port 8000   │ │   Port 8001  │ │   Port 8002  │
    └───────┬───────┘ └──────┬───────┘ └──────┬───────┘
            │                │                │
            └────────────────┼────────────────┘
                             │
                    ┌────────┴────────┐
                    │   PostgreSQL    │
                    │      Redis      │
                    └─────────────────┘
```

## 2. Three Planes Explained

### Control Plane (existing)
- **FastAPI backend** (`backend/`): Auth, dashboard, job listings, applications, billing
- **Next.js frontend** (`frontend/`): User-facing UI, dashboards, approval queues
- **ARQ workers**: Background tasks for legacy auto-apply flow
- **Neko**: Cloud browser for legacy credential-based login

### Execution Plane (new)
- **Browser Worker** (`apps/browser-worker/`): Wraps gstack `browse` binary
- Provides HTTP API for all browser actions: goto, snapshot, fill, click, upload, screenshot
- Manages per-user session cookies in isolated Chromium contexts
- No credentials stored — only session cookies

### Intelligence Plane (new)
- **ADK Orchestrator** (`apps/adk-orchestrator/`): FastAPI service running Gemini ADK agents
- 6 specialized agents + 1 coordinator
- Communicates with Execution Plane via HTTP to drive browser actions

## 3. Agent Descriptions and Responsibilities

| Agent | Model | Tools | Responsibility |
|-------|-------|-------|----------------|
| discovery | gemini-2.0-flash | goto, snapshot, text, links | Discover job leads from portal search pages |
| screening | gemini-2.5-pro | none (LLM only) | Analyze JD vs resume, compute fit_score |
| planner | gemini-2.0-flash | snapshot | Read form structure, create field-by-field plan |
| apply | gemini-2.0-flash | goto, snapshot, fill, click, upload | Execute the application plan step by step |
| verification | gemini-2.0-flash | snapshot(diff), is_visible, console_errors | Confirm submission succeeded |
| status_sync | gemini-2.0-flash | goto, text, links, snapshot | Daily sync of portal inbox events |
| coordinator | gemini-2.0-flash | sub-agents as tools | Orchestrate the full workflow |

## 4. Browser Session Lifecycle

```
┌─────────────┐    ┌──────────────┐    ┌──────────┐    ┌──────────┐
│ pending_login│ → │   active     │ → │ expired  │ → │  error   │
└─────────────┘    └──────────────┘    └──────────┘    └──────────┘
       │                  │
       │ manual login      │ verified by agent
       │ in user's browser │
       ▼                  ▼
   user clicks      cookies imported
  "I have logged in"   into gstack
```

## 5. Application Execution Flow

```
1. Discovery Agent    → discovers job_leads
2. Screening Agent    → scores fit (fit_score, decision)
3. Approval Gate      → if decision != "auto", pause for human
4. Planner Agent      → reads form, creates application_plan
5. Approval Gate      → if plan.requires_approval, pause for human
6. Apply Agent        → executes plan step-by-step
7. Verification Agent → confirms success with screenshot + diff
8. Status Sync Agent  → (daily) checks portal inbox for updates
```

## 6. Verification Protocol

After every apply attempt, the verification agent performs:

1. **snapshot -D** → checks what changed on the page
2. **is_visible** → looks for success toast / confirmation text
3. **console_errors** → ensures no JavaScript errors occurred
4. **screenshot** → saved as proof artifact

If NOT verified:
- Mark run as failed
- Save reason + screenshot
- Trigger investigate sub-step
- Retry apply once
- After 3 total failures → mark as BLOCKED, notify user

## 7. Failure Handling and Retry Rules

| Failure Type | Retry | Final State | Action |
|--------------|-------|-------------|--------|
| Network timeout | 1 retry | failed | Log error + screenshot |
| Form field not found | 1 retry | failed | Log + diff |
| Verification failed | 1 retry | failed | Investigate + retry apply |
| 3 total failures | — | blocked | Notify user via WhatsApp |
| Session expired | — | requires_relogin | Redirect to /portals/connect |

## 8. Rate Limit Strategy

### Gemini Free Tier
- Gemini 2.5 Pro: 50 requests/day
- Gemini 2.0 Flash: 1,500 requests/day

### Usage Allocation
- **Pro**: JD analysis, resume tailoring, fit scoring (high quality, low volume)
- **Flash**: Discovery, form planning, step execution, verification, status sync (high volume, fast)

### Rotation Strategy
- Maintain up to 3 free-tier API keys
- Rotate per user to stay within daily limits
- For production, enable billing at https://console.cloud.google.com/billing

### Application Rate Limits
- Max 10 Naukri applications per user per hour
- Max 50 Naukri applications per user per day
- Enforced at the Control Plane API layer

## 9. Security Model

### No Credentials Stored
- `user_portal_accounts` table: no password, no token columns
- Users log in manually in their own browser session
- Only session cookies are captured, stored encrypted in `browser_sessions.cookies_path`
- Cookies are per-portal, per-user, and expire naturally

### Data Isolation
- Every browser action includes `session_id`
- One isolated Chromium context per user per portal
- Session state lives in `~/.gstack/sessions/` (Docker volume `gstack-sessions`)

### Audit Trail
- Every agent run logged in `agent_runs` with full `input_json`, `state_json`, `output_json`
- Every step event logged in `application_step_events` with screenshot + diff
- Compliance events in `audit_events`

## 10. Phased Rollout Plan

| Phase | Duration | Scope |
|-------|----------|-------|
| Phase 1 | 2 weeks | Naukri manual-login + discovery |
| Phase 2 | 2 weeks | Naukri screening + approval + apply |
| Phase 3 | 1 week | Naukri verification + status sync |
| Phase 4 | 2 weeks | LinkedIn adapter |
| Phase 5 | ongoing | Production hardening + multi-user scale |
