import type { Page } from "playwright";

export interface AtsAdapter {
  name: string;
  detect: (url: string) => boolean;
  apply: (page: Page, payload: ApplyPayload) => Promise<ApplyResult>;
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

export const ATS_ADAPTERS: AtsAdapter[] = [];

export function detectAts(url: string): AtsAdapter | undefined {
  return ATS_ADAPTERS.find((a) => a.detect(url));
}

export { greenhouseAdapter } from "./greenhouse";
export { leverAdapter } from "./lever";
export { ashbyAdapter } from "./ashby";
export { workdayAdapter } from "./workday";
