import type { Page } from "playwright";
import type { AtsAdapter, ApplyPayload, ApplyResult } from "./index";

export const ashbyAdapter: AtsAdapter = {
  name: "ashby",
  detect: (url: string) => url.includes("jobs.ashbyhq.com"),

  async apply(page: Page, payload: ApplyPayload): Promise<ApplyResult> {
    try {
      await page.waitForSelector('input[name="firstName"], #firstName', { timeout: 8000 });

      await page.fill('input[name="firstName"], #firstName', payload.firstName);
      await page.fill('input[name="lastName"], #lastName', payload.lastName);
      await page.fill('input[name="email"], #email, [type="email"]', payload.email);

      if (payload.phone) {
        await page.fill('input[name="phone"], #phone', payload.phone);
      }

      if (payload.resumePath) {
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(payload.resumePath);
          await page.waitForTimeout(2000);
        }
      }

      const submit = await page.$('button[type="submit"], [data-testid="submit-button"]');
      if (submit) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => null),
          submit.click(),
        ]);
      }

      const bodyText = await page.$eval("body", (el) => el.innerText).catch(() => "");
      const success = /thank you|submitted|received/i.test(bodyText);

      return { success, confirmationId: success ? await page.url() : undefined, step: "submitted" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err), step: "apply" };
    }
  },
};
