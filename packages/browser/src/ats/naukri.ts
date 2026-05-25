import type { Stagehand } from "@browserbasehq/stagehand";
import type { Page } from "playwright";
import type { AtsAdapter, ApplyPayload, ApplyResult } from "./index";

function randomDelay(min = 800, max = 2000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
}

export const naukriAdapter: AtsAdapter = {
  name: "naukri",
  detect: (url: string) => url.includes("naukri.com"),

  async apply(_stagehand: Stagehand, page: Page, payload: ApplyPayload): Promise<ApplyResult> {
    try {
      await randomDelay();

      // Multi-selector fallback for Naukri login wall detection
      const loginSelectors = [
        'button:has-text("Login to Apply")',
        "#login_landing",
        'a:has-text("Login")',
      ];
      for (const sel of loginSelectors) {
        const el = await page.$(sel);
        if (el && (await el.isVisible().catch(() => false))) {
          return {
            success: false,
            error: "Naukri login required — connect via Neko cloud browser first",
            step: "apply",
          };
        }
      }

      // Check for external apply redirect
      const extSelectors = [
        'button:has-text("Apply on company site")',
        'a:has-text("Apply on company site")',
      ];
      for (const sel of extSelectors) {
        const el = await page.$(sel);
        if (el && (await el.isVisible().catch(() => false))) {
          return {
            success: false,
            error: "External apply — company site",
            step: "apply",
          };
        }
      }

      // Click Apply / Apply Now with fallback selectors
      const applySelectors = [
        'button:has-text("Apply")',
        'button:has-text("Apply Now")',
        'a:has-text("Apply")',
        'a:has-text("Apply Now")',
        "#apply-button",
        "[data-testid='apply-button']",
      ];
      let clicked = false;
      for (const sel of applySelectors) {
        const btn = await page.$(sel);
        if (btn && (await btn.isVisible().catch(() => false))) {
          await btn.scrollIntoViewIfNeeded();
          await randomDelay(500, 1200);
          await btn.click();
          clicked = true;
          break;
        }
      }
      if (!clicked) {
        return { success: false, error: "No apply button found", step: "apply" };
      }

      await randomDelay(2000, 4000);

      // Fill standard fields with multi-selector fallback
      const fieldMap: Record<string, string> = {
        first_name: payload.firstName,
        last_name: payload.lastName,
        email: payload.email,
        phone: payload.phone || "",
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
            await randomDelay(300, 800);
            await input.type(value, { delay: 30 + Math.random() * 50 });
            await randomDelay(500, 1200);
            break;
          }
        }
      }

      // Resume upload
      if (payload.resumePath) {
        const fileSelectors = [
          'input[type="file"]',
          "#resume-upload",
          "[data-testid='resume-input']",
        ];
        for (const sel of fileSelectors) {
          const fi = await page.$(sel);
          if (fi) {
            await fi.setInputFiles(payload.resumePath);
            await randomDelay(1500, 2500);
            break;
          }
        }
      }

      // Submit with fallback selectors
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Send")',
        "#submit_app",
        "[data-testid='submit-button']",
      ];
      for (const sel of submitSelectors) {
        const btn = await page.$(sel);
        if (btn && (await btn.isVisible().catch(() => false))) {
          await btn.scrollIntoViewIfNeeded();
          await randomDelay(500, 1200);
          await Promise.all([
            page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => null),
            btn.click(),
          ]);
          break;
        }
      }

      await randomDelay(2000, 4000);

      // Check for success confirmation
      const bodyText = await page.$eval("body", (el) => el.innerText).catch(() => "");
      const success = /successfully applied|application submitted|you have applied|applied successfully/i.test(bodyText);

      const ts = Date.now();
      const screenshotPath = `/tmp/screenshots/naukri_${ts}.png`;
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
