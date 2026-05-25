import type { Page } from "playwright";
import type { AtsAdapter, ApplyPayload, ApplyResult } from "./index";

export const leverAdapter: AtsAdapter = {
  name: "lever",
  detect: (url: string) => url.includes("jobs.lever.co"),

  async apply(page: Page, payload: ApplyPayload): Promise<ApplyResult> {
    try {
      await page.waitForSelector('input[name="name"], #name, [data-qa="name-input"]', { timeout: 8000 });

      await page.fill('input[name="name"], #name', `${payload.firstName} ${payload.lastName}`);
      await page.fill('input[name="email"], #email, [type="email"]', payload.email);

      if (payload.phone) {
        await page.fill('input[name="phone"], #phone', payload.phone);
      }

      if (payload.linkedin) {
        await page.fill('input[name="linkedin"], #linkedin', payload.linkedin);
      }

      if (payload.portfolio) {
        await page.fill('input[name="portfolio"], #portfolio', payload.portfolio);
      }

      if (payload.resumePath) {
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(payload.resumePath);
          await page.waitForTimeout(2000);
        }
      }

      if (payload.coverLetter) {
        const coverInput = await page.$('textarea[name="comments"], #comments');
        if (coverInput) await coverInput.fill(payload.coverLetter);
      }

      const submit = await page.$('input[type="submit"], button[type="submit"]');
      if (submit) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => null),
          submit.click(),
        ]);
      }

      const bodyText = await page.$eval("body", (el) => el.innerText).catch(() => "");
      const success = /thank you|application submitted|we received/i.test(bodyText);

      return { success, confirmationId: success ? await page.url() : undefined, step: "submitted" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err), step: "apply" };
    }
  },
};
