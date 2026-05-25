import type { Page } from "playwright";
import type { AtsAdapter, ApplyPayload, ApplyResult } from "./index";

export const greenhouseAdapter: AtsAdapter = {
  name: "greenhouse",
  detect: (url: string) => url.includes("boards.greenhouse.io") || url.includes("greenhouse.com"),

  async apply(page: Page, payload: ApplyPayload): Promise<ApplyResult> {
    try {
      await page.waitForSelector('input[name="first_name"], #first_name, [data-testid="first-name"]', { timeout: 8000 });

      await page.fill('input[name="first_name"], #first_name, [data-testid="first-name"]', payload.firstName);
      await page.fill('input[name="last_name"], #last_name, [data-testid="last-name"]', payload.lastName);
      await page.fill('input[name="email"], #email, [type="email"]', payload.email);

      if (payload.phone) {
        await page.fill('input[name="phone"], #phone, [type="tel"]', payload.phone);
      }

      if (payload.linkedin) {
        await page.fill('input[name="linkedin"], #linkedin_profile', payload.linkedin);
      }

      if (payload.resumePath) {
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(payload.resumePath);
          await page.waitForTimeout(2000);
        }
      }

      if (payload.coverLetter) {
        const coverInput = await page.$('textarea[name="cover_letter"], #cover_letter_body');
        if (coverInput) {
          await coverInput.fill(payload.coverLetter);
        }
      }

      if (payload.answers) {
        for (const [question, answer] of Object.entries(payload.answers)) {
          const input = await page.$(`text=${question}`);
          if (input) {
            const parentHandle = await input.evaluateHandle((el) => el.closest("div, fieldset"));
            const parent = await parentHandle.asElement();
            if (parent) {
              const textArea = await parent.$('textarea, input[type="text"]');
              if (textArea) await textArea.fill(answer);
            }
          }
        }
      }

      const submit = await page.$('input[type="submit"], button[type="submit"], #submit_app');
      if (submit) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => null),
          submit.click(),
        ]);
      }

      const confirmation = await page.$eval("body", (el) => el.innerText).catch(() => "");
      const success = /thank you|submitted|application received/i.test(confirmation);

      return {
        success,
        confirmationId: success ? await page.url() : undefined,
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
