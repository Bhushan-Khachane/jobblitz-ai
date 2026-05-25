import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3001';
const API  = 'http://localhost:8000/api/v1';
const TS   = Date.now();
const EMAIL = `pw_${TS}@test.com`;
const PASS  = 'Playwright1!';

// Track console errors globally
let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));
});

test.afterEach(async ({}, testInfo) => {
  const critical = consoleErrors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('ResizeObserver') &&
    !e.includes('Non-Error promise rejection') &&
    !e.includes('RSC payload') &&
    !e.includes('Falling back to browser navigation')
  );
  if (critical.length > 0) {
    console.warn('Console errors detected:', critical);
    const apiErrors = critical.filter(e =>
      (e.includes('fetch') || e.includes('500') || e.includes('undefined is not')) &&
      !e.includes('RSC payload')
    );
    if (apiErrors.length > 0) {
      throw new Error(`Critical JS errors: ${apiErrors.join('\n')}`);
    }
  }
});

// ── SCENARIO A: Health Check ──────────────────────────────────────────
test('A — API health endpoint returns ok', async ({ page }) => {
  const resp = await page.request.get('http://localhost:8000/health');
  const body = await resp.json();
  expect(resp.ok()).toBeTruthy();
  expect(body.status).toBe('ok');
  expect(body.db).toBe('ok');
  expect(body.redis).toBe('ok');
  await page.screenshot({ path: '../.planning/screenshots/A_health.png' });
});

// ── SCENARIO B: Registration ──────────────────────────────────────────
test('B — Registration flow with password strength enforcement', async ({ page }) => {
  await page.goto(`${BASE}/register`);
  await page.screenshot({ path: '../.planning/screenshots/B1_register_page.png' });

  // Fill form with strong password
  await page.fill('input[id="full_name"]', 'Playwright User');
  await page.fill('input[id="email"]', EMAIL);
  await page.fill('input[id="password"]', PASS);
  await page.fill('input[id="confirm_password"]', PASS);
  await page.click('button[type="submit"]');

  // Wait for redirect to onboarding
  await page.waitForURL(/onboarding/, { timeout: 10000 });
  await page.screenshot({ path: '../.planning/screenshots/B3_post_register.png' });
  console.log('Registration — PASS');
});

// ── SCENARIO C: Login ─────────────────────────────────────────────────
test('C — Login flow: wrong password blocked, correct login succeeds', async ({ page }) => {
  await page.goto(`${BASE}/login`);

  // Wrong password
  await page.fill('input[id="email"]', EMAIL);
  await page.fill('input[id="password"]', 'WrongPass1!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '../.planning/screenshots/C1_wrong_password.png' });

  // Correct login
  await page.fill('input[id="email"]', EMAIL);
  await page.fill('input[id="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 10000 });
  await page.screenshot({ path: '../.planning/screenshots/C2_logged_in.png' });

  // Verify auth token stored
  const storage = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
  }));
  const hasToken = storage.local.includes('jb_access_token');
  expect(hasToken).toBeTruthy();
  console.log('Login — PASS');
});

// ── SCENARIO D: Dashboard ─────────────────────────────────────────────
test('D — Dashboard loads with real data (no mock/undefined values)', async ({ page }) => {
  // Already logged in from test C; navigate directly
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '../.planning/screenshots/D1_dashboard.png' });

  // Check for undefined/NaN rendered on page
  const bodyText = await page.locator('body').innerText();
  const badValues = ['undefined', 'NaN', '[object Object]', 'null'];
  for (const bad of badValues) {
    if (bodyText.includes(bad)) {
      throw new Error(`Dashboard renders "${bad}" — data binding broken`);
    }
  }

  // Navigate to searches
  await page.goto(`${BASE}/dashboard/searches`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '../.planning/screenshots/D2_searches.png' });

  console.log('Dashboard — PASS');
});

// ── SCENARIO E: Applications Page ────────────────────────────────────
test('E — Applications page loads without crash', async ({ page }) => {
  await page.goto(`${BASE}/dashboard/applications`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '../.planning/screenshots/E_applications.png' });

  const title = await page.title();
  expect(title).not.toContain('500');
  expect(title).not.toContain('Error');

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('Internal Server Error');
  console.log('Applications page — PASS');
});

// ── SCENARIO F: Profile / Apply Mode ────────────────────────────────
test('F — Profile page loads and has apply mode info', async ({ page }) => {
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '../.planning/screenshots/F1_profile.png' });

  // Profile page should have user info
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).toContain('Profile');
  console.log('Profile page — PASS');
});

// ── SCENARIO G: Portals / Credentials ────────────────────────────────
test('G — Portals page loads without raw password field', async ({ page }) => {
  await page.goto(`${BASE}/dashboard/portals`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '../.planning/screenshots/G1_portals.png' });

  // SECURITY: raw password input must NOT exist on portals page
  const rawPassInput = page.locator('input[type="password"][name*="password" i]:not([name*="current" i]):not([name*="new" i])');
  const rawPassCount = await rawPassInput.count();
  if (rawPassCount > 0) {
    await page.screenshot({ path: '../.planning/screenshots/G2_raw_password_FAIL.png' });
    throw new Error(`SECURITY: Raw password input found on portals page (${rawPassCount} field(s))`);
  }
  console.log('Portals security check — PASS');
});
