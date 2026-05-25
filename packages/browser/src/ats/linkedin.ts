import type { Stagehand } from "@browserbasehq/stagehand";
import type { Page } from "playwright";
import type { AtsAdapter, ApplyPayload, ApplyResult } from "./index";

function randomDelay(min = 500, max = 1500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
}

export const linkedinAdapter: AtsAdapter = {
  name: "linkedin",
  detect: (url: string) => url.includes("linkedin.com"),

  async apply(_stagehand: Stagehand, page: Page, payload: ApplyPayload): Promise<ApplyResult> {
    try {
      await randomDelay();

      // Detect external-apply redirect (redirects to company site)
      const extSelectors = [
        'a:has-text("Apply")[href*="linkedin.com/jobs/view/"]',
        'button:has-text("Apply on company website")',
        'a:has-text("Apply on company website")',
      ];
      for (const sel of extSelectors) {
        const el = await page.$(sel);
        if (el && (await el.isVisible().catch(() => false))) {
          return {
            success: false,
            error: "External apply — LinkedIn redirects to company site",
            step: "detect",
          };
        }
      }

      // Click Easy Apply button
      const easyApplySelectors = [
        'button:has-text("Easy Apply")',
        'button[data-test-easy-apply-button]',
        'button:has-text("Apply")',
      ];
      let clicked = false;
      for (const sel of easyApplySelectors) {
        const btn = await page.$(sel);
        if (btn && (await btn.isVisible().catch(() => false))) {
          await btn.scrollIntoViewIfNeeded();
          await randomDelay(400, 800);
          await btn.click();
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        return { success: false, error: "No Easy Apply button found", step: "apply" };
      }

      await randomDelay(1500, 2500);

      // Multi-step modal loop
      const maxSteps = 10;
      for (let step = 0; step < maxSteps; step++) {
        // Check for "Submit application" button
        const submitSelectors = [
          'button:has-text("Submit application")',
          'button[type="submit"]',
          'button:has-text("Submit")',
        ];
        let submitFound = false;
        for (const sel of submitSelectors) {
          const btn = await page.$(sel);
          if (btn && (await btn.isVisible().catch(() => false))) {
            await btn.scrollIntoViewIfNeeded();
            await randomDelay(400, 800);
            await btn.click();
            submitFound = true;
            break;
          }
        }
        if (submitFound) {
          await randomDelay(2000, 3000);
          break;
        }

        // Fill current modal step fields
        const fieldMap: Record<string, string> = {
          "first-name": payload.firstName,
          "last-name": payload.lastName,
          "email": payload.email,
          "phone": payload.phone || "",
        };

        for (const [field, value] of Object.entries(fieldMap)) {
          if (!value) continue;
          const selectors = [
            `input[name*="${field}"]`,
            `input[id*="${field}"]`,
            `input[placeholder*="${field}"]`,
            `input[aria-label*="${field}"]`,
          ];
          for (const sel of selectors) {
            const input = await page.$(sel);
            if (input && (await input.isVisible().catch(() => false))) {
              await input.fill("");
              await randomDelay(200, 500);
              await input.type(value, { delay: 20 + Math.random() * 40 });
              await randomDelay(300, 600);
              break;
            }
          }
        }

        // Resume upload inside modal
        if (payload.resumePath) {
          const fileSelectors = [
            'input[type="file"]',
            'input[aria-label*="resume"]',
            'input[aria-label*="CV"]',
          ];
          for (const sel of fileSelectors) {
            const fi = await page.$(sel);
            if (fi) {
              await fi.setInputFiles(payload.resumePath);
              await randomDelay(1000, 2000);
              break;
            }
          }
        }

        // Click Next to proceed to next modal step
        const nextSelectors = [
          'button:has-text("Next")',
          'button:has-text("Continue")',
          'button[type="button"]',
        ];
        let nextClicked = false;
        for (const sel of nextSelectors) {
          const btn = await page.$(sel);
          if (btn && (await btn.isVisible().catch(() => false))) {
            await btn.scrollIntoViewIfNeeded();
            await randomDelay(400, 800);
            await btn.click();
            nextClicked = true;
            break;
          }
        }
        if (!nextClicked) {
          break; // No more steps
        }

        await randomDelay(1500, 2500);
      }

      // Check for success confirmation
      const bodyText = await page.$eval("body", (el) => el.innerText).catch(() => "");
      const success = /application sent|successfully applied|your application has been sent/i.test(bodyText);

      const ts = Date.now();
      const screenshotPath = `/tmp/screenshots/linkedin_${ts}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });

      return {
        success,
        confirmationId: success ? page.url() : undefined,
        screenshotPath,
        step: "submitted",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        step: "apply",
      };
    }
  },
};
