import type { Page } from "playwright";
import type { AtsAdapter, ApplyPayload, ApplyResult } from "./index";

export const workdayAdapter: AtsAdapter = {
  name: "workday",
  detect: (url: string) => url.includes("myworkdayjobs.com") || url.includes("workday.com"),

  async apply(page: Page, payload: ApplyPayload): Promise<ApplyResult> {
    try {
      await page.waitForSelector('button[data-uxi-element-id="next"], button:has-text("Next")', { timeout: 8000 });

      await page.fill('input[aria-label*="First Name"], input[name="firstName"]', payload.firstName);
      await page.fill('input[aria-label*="Last Name"], input[name="lastName"]', payload.lastName);
      await page.fill('input[aria-label*="Email"], input[type="email"]', payload.email);

      if (payload.phone) {
        await page.fill('input[aria-label*="Phone"], input[name="phone"]', payload.phone);
      }

      let next = await page.$('button[data-uxi-element-id="next"], button:has-text("Next")');
      if (next) await next.click();
      await page.waitForTimeout(1500);

      if (payload.resumePath) {
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(payload.resumePath);
          await page.waitForTimeout(3000);
        }
      }

      next = await page.$('button[data-uxi-element-id="next"], button:has-text("Next")');
      if (next) await next.click();
      await page.waitForTimeout(1500);

      if (payload.coverLetter) {
        const textArea = await page.$('textarea[aria-label*="Cover"], textarea[name="coverLetter"]');
        if (textArea) await textArea.fill(payload.coverLetter);
      }

      if (payload.answers) {
        for (const [question, answer] of Object.entries(payload.answers)) {
          const label = await page.$(`label:has-text("${question}")`);
          if (label) {
            const parentHandle = await label.evaluateHandle((el) => el.parentElement);
            const parent = await parentHandle.asElement();
            if (parent) {
              const input = await parent.$('input, textarea, select');
              if (input) await input.fill(answer);
            }
          }
        }
      }

      const submit = await page.$('button[data-uxi-element-id="submit"], button:has-text("Submit")');
      if (submit) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle", timeout: 20000 }).catch(() => null),
          submit.click(),
        ]);
      }

      const bodyText = await page.$eval("body", (el) => el.innerText).catch(() => "");
      const success = /thank you|submitted|application received/i.test(bodyText);

      return { success, confirmationId: success ? await page.url() : undefined, step: "submitted" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err), step: "apply" };
    }
  },
};
