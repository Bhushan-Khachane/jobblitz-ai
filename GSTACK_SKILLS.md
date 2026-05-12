# gstack Skills Guide for JobBlitz

This guide covers all available [gstack](https://github.com/garrytan/gstack) skills and the recommended order to run them for the JobBlitz AI project.

## Installation

Install gstack globally (one-time per machine):

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

After install, restart your AI coding tool (Claude Code / Cursor / etc.).

---

## Skill Execution Order

Run skills in this sequence. Each phase gates the next — do not skip ahead.

### 1. PLAN — Before writing any code

| Skill | When to use |
|-------|-------------|
| `/office-hours` | Product ideas, brainstorming, feature scoping |
| `/plan-ceo-review` | Strategy review, prioritization, go/no-go decisions |
| `/plan-eng-review` | Architecture decisions, tech stack, data model |
| `/plan-design-review` | UI/UX design system, component structure |
| `/autoplan` | Run all plan reviews at once (ceo + eng + design) |

**JobBlitz use case:** When adding a new feature like "auto-apply to jobs", run `/autoplan` first. It will check CEO strategy, engineering feasibility, and design consistency before a single line of code is written.

### 2. BUILD & DESIGN — During implementation

| Skill | When to use |
|-------|-------------|
| `/design-consultation` | Need help designing a UI component or flow |
| `/design-shotgun` | Generate multiple UI variations quickly |
| `/design-html` | Convert designs to HTML/CSS/JSX |
| `/design-review` | Polish pass — consistency, spacing, accessibility |

**JobBlitz use case:** Use `/design-review` after building the new auto-apply dashboard to catch dark-theme inconsistencies or mobile layout issues.

### 3. REVIEW — Before merging

| Skill | When to use |
|-------|-------------|
| `/review` | Pre-landing code review (SQL safety, race conditions, LLM trust boundaries, XSS, shell injection) |
| `/codex` | Cross-model review with OpenAI Codex (second opinion) |
| `/devex-review` | Developer experience — API ergonomics, docs, onboarding |

**JobBlitz use case:** Always run `/review` before merging. It catches issues that tests miss: N+1 queries, async/sync mixing, enum completeness, and security gaps in the CDP/browser integration.

### 4. TEST — Before shipping

| Skill | When to use |
|-------|-------------|
| `/qa` | Full QA workflow — test the feature, find bugs, verify fixes |
| `/qa-only` | Test without touching code (pure QA pass) |
| `/browse` | Research anything on the web (docs, competitors, libraries) |
| `/benchmark` | Performance and load testing |

**JobBlitz use case:** Run `/qa` after the cloud browser login fix to verify LinkedIn and Naukri login flows work end-to-end on both desktop and mobile.

### 5. SHIP — Merge and deploy

| Skill | When to use |
|-------|-------------|
| `/ship` | Create PR, run final checks, land code |
| `/land-and-deploy` | Deploy to production |
| `/canary` | Canary deployment with automatic rollback |
| `/document-release` | Update README, CHANGELOG, TODOS, version |

**JobBlitz use case:** After `/review` and `/qa` pass, run `/ship` to create the PR with a clean commit history and updated documentation.

### 6. REFLECT — After shipping

| Skill | When to use |
|-------|-------------|
| `/retro` | Post-ship retrospective — what worked, what did not |
| `/learn` | Capture learnings for future sessions |
| `/sync-gbrain` | Sync memory across machines (requires gbrain setup) |

**JobBlitz use case:** Run `/retro` after the cloud browser fix ships to document what went wrong (QEMU emulation, bot detection) so future sessions avoid the same traps.

---

## Utility Skills (use anytime)

| Skill | Purpose |
|-------|---------|
| `/investigate` | Deep bug investigation — traces through code, logs, and infra |
| `/context-save` | Save session state to resume later |
| `/context-restore` | Resume a previously saved session |

---

## JobBlitz-Specific Skill Routing

When working on JobBlitz, invoke skills based on what you are doing:

- **Bug in cloud browser login** → `/investigate` then `/qa`
- **New feature (e.g., auto-apply)** → `/autoplan` → build → `/review` → `/qa` → `/ship`
- **UI polish on dashboard** → `/design-review`
- **Performance issues** → `/benchmark`
- **Ready to merge** → `/review` → `/ship`
- **Deploy to prod** → `/land-and-deploy` or `/canary`

---

## Skill Routing Rules (from CLAUDE.md)

When a request matches an available skill, invoke it. When in doubt, invoke it.

- Product ideas/brainstorming → `/office-hours`
- Strategy/scope → `/plan-ceo-review`
- Architecture → `/plan-eng-review`
- Design system/plan review → `/design-consultation` or `/plan-design-review`
- Full review pipeline → `/autoplan`
- Bugs/errors → `/investigate`
- QA/testing site behavior → `/qa` or `/qa-only`
- Code review/diff check → `/review`
- Visual polish → `/design-review`
- Ship/deploy/PR → `/ship` or `/land-and-deploy`
- Save progress → `/context-save`
- Resume context → `/context-restore`

---

## Important Notes

- **Never skip `/review`** before merging. It is the safety net for SQL injection, race conditions, and trust boundary violations.
- **Never skip `/qa`** before shipping. Type checking and unit tests verify code correctness, not feature correctness.
- **`/autoplan` is the fast path** for new features. It runs all plan-phase skills in one go.
- **`/ship` handles docs** via `/document-release` internally. You do not need to run it separately unless you want to update docs before creating the PR.
- **gstack learns.** Run `/learn` after each session to capture pitfalls, preferences, and operational quirks so future sessions are faster.

---

*Last updated: 2026-05-13*
