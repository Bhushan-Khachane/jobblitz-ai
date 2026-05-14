import { test, expect } from '@playwright/test';

test('Extension settings page renders correctly', async ({ page }) => {
  await page.goto('http://localhost:3000/settings/extension');
  await page.waitForLoadState('networkidle');

  // Must show token copy button
  await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  // Must show ToS warning
  await expect(page.getByRole('heading', { name: /Terms of Service/i })).toBeVisible();
  // Must show apply stats section
  await expect(page.getByText(/Today.s Apply Stats/i)).toBeVisible();
});
