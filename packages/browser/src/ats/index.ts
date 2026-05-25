import type { Stagehand } from "@browserbasehq/stagehand";
import type { Page } from "@browserbasehq/stagehand/lib/v3/understudy/page";

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

import { greenhouseAdapter } from "./greenhouse";
import { leverAdapter } from "./lever";
import { ashbyAdapter } from "./ashby";
import { workdayAdapter } from "./workday";
import { naukriAdapter } from "./naukri";

export const ATS_ADAPTERS: AtsAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  ashbyAdapter,
  workdayAdapter,
  naukriAdapter,
];

export function detectAts(url: string): AtsAdapter | undefined {
  return ATS_ADAPTERS.find((a) => a.detect(url));
}
