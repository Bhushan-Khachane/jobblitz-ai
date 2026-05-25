import type { Stagehand } from "@browserbasehq/stagehand";
import type { Page } from "playwright";

export interface AtsAdapter {
  name: string;
  detect: (url: string) => boolean;
  apply: (stagehand: Stagehand, page: Page, payload: ApplyPayload) => Promise<ApplyResult>;
}

export interface ApplyPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | undefined;
  resumePath?: string | undefined;
  coverLetter?: string | undefined;
  linkedin?: string | undefined;
  portfolio?: string | undefined;
  answers?: Record<string, string> | undefined;
}

export interface ApplyResult {
  success: boolean;
  confirmationId?: string | undefined;
  screenshotPath?: string | undefined;
  error?: string | undefined;
  step: string;
}

export { greenhouseAdapter } from "./greenhouse";
export { leverAdapter } from "./lever";
export { ashbyAdapter } from "./ashby";
export { workdayAdapter } from "./workday";
export { naukriAdapter } from "./naukri";
export { linkedinAdapter } from "./linkedin";

import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { ashbyAdapter } from "./ashby";
import { workdayAdapter } from "./workday";
import { naukriAdapter } from "./naukri";
import { linkedinAdapter } from "./linkedin";

export const ATS_ADAPTERS: AtsAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  workdayAdapter,
  naukriAdapter,
  linkedinAdapter,
];

export function detectAtsType(url: string): string {
  if (url.includes("greenhouse.io") || url.includes("greenhouse.com")) return "greenhouse";
  if (url.includes("lever.co")) return "lever";
  if (url.includes("ashbyhq.com")) return "ashby";
  if (url.includes("myworkdayjobs.com") || url.includes("workday.com")) return "workday";
  if (url.includes("naukri.com")) return "naukri";
  if (url.includes("linkedin.com")) return "linkedin";
  return "unknown";
}

export function detectAts(url: string): AtsAdapter | undefined {
  return ATS_ADAPTERS.find((a) => a.detect(url));
}
