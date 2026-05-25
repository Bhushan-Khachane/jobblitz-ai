import { z } from "zod";
import type { Stagehand } from "@browserbasehq/stagehand";
import type { Page } from "playwright";
import type { AtsAdapter, ApplyPayload, ApplyResult } from "./index";

export const ashbyAdapter: AtsAdapter = {
  name: "ashby",
  detect: (url: string) => url.includes("jobs.ashbyhq.com"),

  async apply(stagehand: Stagehand, page: Page, payload: ApplyPayload): Promise<ApplyResult> {
    try {
      const fields = await stagehand.observe("Find all required form fields on this job application form");

      for (const field of fields) {
        const desc = field.description?.toLowerCase() || "";
        let value: string | undefined;

        if (desc.includes("first name") || desc.includes("firstname")) value = payload.firstName;
        else if (desc.includes("last name") || desc.includes("lastname") || desc.includes("surname")) value = payload.lastName;
        else if (desc.includes("email")) value = payload.email;
        else if (desc.includes("phone")) value = payload.phone;

        if (value) {
          await stagehand.act(`Fill the ${field.description} field with "${value}"`);
        }
      }

      if (payload.resumePath) {
        const fileLocator = page.locator('input[type="file"]');
        if ((await fileLocator.count()) > 0) {
          await stagehand.act("Upload the resume file");
          await fileLocator.first().setInputFiles(payload.resumePath);
          await page.waitForTimeout(2000);
        }
      }

      await stagehand.act("Click the Submit Application button");
      await page.waitForTimeout(3000);

      const extracted = await stagehand.extract(
        "Extract any confirmation message or application ID",
        z.object({
          confirmed: z.boolean(),
          message: z.string(),
        })
      );

      const ts = Date.now();
      const screenshotPath = `/tmp/screenshots/ashby_${ts}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });

      return {
        success: extracted.confirmed,
        confirmationId: extracted.message || undefined,
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
