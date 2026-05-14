# JobBlitz Anti-Ban Architecture Report
Date: 2026-05-15

## Architecture Change Summary
| Component | Before | After | Ban Risk |
|---|---|---|---|
| Apply execution | Server Playwright (datacenter IP) | Browser Extension (real IP) | Red -> Green |
| Apply velocity | No enforcement | Redis governor (hard limits) | Red -> Green |
| Cover letters | Same template | Variance engine (sim<0.15) | Orange -> Green |
| IP address | Shared datacenter | Per-user sticky residential | Red -> Yellow |
| Stealth | Basic | 5 navigator patches + enhanced | Orange -> Yellow |

## Platform Ban Risk After Changes
| Platform | Before | After | Notes |
|---|---|---|---|
| LinkedIn | Very High | Low | Extension applies from real browser |
| Naukri | Medium | Very Low | Real IP + conservative limits |
| Indeed | High | Low | Same |

## New Components Created
- `apps/browser-extension/` - Chrome MV3 extension with WebSocket, human-like delays, velocity governor
- `backend/app/services/velocity_governor.py` - Redis-backed per-platform rate limits
- `backend/app/services/cover_letter_service.py` - LLM variance engine with similarity checking
- `backend/app/services/proxy_service.py` - Per-user sticky residential proxy sessions
- `backend/app/services/extension_manager.py` - WebSocket connection manager for extensions
- `backend/app/routers/extension_ws.py` - `/ws/extension` WebSocket endpoint
- `frontend/app/settings/extension/page.tsx` - Extension connection UI with apply stats

## Safe Limits Enforced
- LinkedIn: 8/day, 5min gap
- Naukri: 15/day, 3min gap
- Indeed: 20/day, 2min gap
- Working hours gate: 8am-10pm only
- Human delays: log-normal 45-180s

## Apply Priority
1. Browser extension (real IP - low ban risk)
2. Server Playwright + residential proxy (fallback)

## QA Results
- New backend tests: 8/8 passed (velocity_governor, cover_letter_variance, extension_ws)
- TypeScript strict check: 0 errors
- Next.js build: green (all routes compiled)
- Security scan: 0 hardcoded secrets in new files
- Python syntax: all files compile cleanly
- Manifest validation: valid JSON

## Known Remaining Risks
- LinkedIn behavioral AI can still detect unnatural click patterns
- Users who ignore working-hours warning and apply in bulk manually may still get flagged
- Proxy required for server-side fallback (extension is the best path)
