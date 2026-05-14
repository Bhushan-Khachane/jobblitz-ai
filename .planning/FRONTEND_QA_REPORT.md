# Frontend QA Report — Extension Settings Page
Date: 2026-05-15
Tester: Playwright E2E + frontend-dev-guidelines skill review

## E2E Test Results
| Test | Result | Details |
|---|---|---|
| Extension settings page renders | PASS | All expected elements visible |
| Landing page load | PASS | Title correct, no console errors |
| Login page load | PASS | Email input present |
| Dashboard auth redirect | PASS | Redirects to /login when unauthenticated |
| Mobile viewport (375x667) | PASS | Responsive layout OK |
| Console errors | PASS | 0 errors on landing page |

## Code Review Findings (frontend/app/settings/extension/page.tsx)

### Critical Issues

1. **SECURITY — postMessage with wildcard origin** (Line 16)
   `window.postMessage({ type: 'JOBBLITZ_SET_TOKEN', token: stored }, '*');`
   Using `'*'` allows any origin to receive the token. Should restrict to the extension origin.
   **Fix:** Use `chrome-extension://*` or remove postMessage and let the extension read localStorage directly.

2. **No error handling for fetch** (Line 20-26)
   `.catch(() => {})` silently swallows network/auth errors.
   **Fix:** Show an error state or retry mechanism.

### Medium Issues

3. **No loading state** (Line 19-26)
   Stats fetch happens without any loading indicator. Page shows "0 / 15" while loading.
   **Fix:** Add `isLoading` state and skeleton/progress indicator.

4. **platforms array recreated every render** (Line 35)
   `const platforms = [...]` inside component body creates a new array reference each render.
   **Fix:** Move outside component or wrap in `useMemo`.

5. **No explicit Props interface**
   Component has no typed props. While currently props-less, best practice is to declare `interface Props {}`.

### Minor Issues

6. **Missing ARIA on progress bars** (Line 76-80)
   Progress bars have no `role="progressbar"`, `aria-valuenow`, `aria-valuemax`.
   **Fix:** Add ARIA attributes for screen readers.

7. **Copy button missing aria-label** (Line 55-60)
   The copy button should have `aria-label="Copy authentication token"`.

8. **Token truncated but not announced to screen readers**
   The truncated token in `<code>` is invisible to screen readers. Should add `aria-label` with full token.

9. **useEffect dependency array** (Line 27)
   `[]` is correct here (mount-only), but the skill prefers data fetching via Suspense/query libraries.

## Recommendations

1. Extract data fetching to a custom hook: `useApplyStats()`
2. Add Suspense boundary at the settings layout level
3. Use a proper data-fetching library (React Query / SWR) instead of raw fetch
4. Add error boundaries for graceful failure
5. Implement the security fix for postMessage before shipping

## Screenshots Captured
- `.planning/screenshots/qa-landing.png`
- `.planning/screenshots/qa-login.png`
- `.planning/screenshots/qa-extension-settings.png`
- `.planning/screenshots/qa-landing-mobile.png`
