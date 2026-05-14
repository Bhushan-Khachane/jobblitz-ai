import { test, expect } from '@playwright/test';

test('Extension settings page renders correctly', async ({ page }) => {
  await page.goto('http://localhost:3000/settings/extension');
  await page.waitForLoadState('networkidle');

  // Must show token copy button
  await expect(page.locator('text=/copy/i')).toBeVisible();
  // Must show ToS warning
  await expect(page.locator('text=/terms of service/i')).toBeVisible();
  // Must show apply stats section
  await expect(page.locator('text=/apply stats/i')).toBeVisible();
});
