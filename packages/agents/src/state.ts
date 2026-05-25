import type { Job, Profile, Application, Employer } from "@jobblitz/types";

export interface JobBlitzState {
  userId: string;
  jobId?: string | undefined;
  applicationId?: string | undefined;
  employerId?: string | undefined;
  job?: Job | undefined;
  profile?: Profile | undefined;
  application?: Application | undefined;
  employer?: Employer | undefined;
  score?: number | undefined;
  decision?: "auto" | "approve" | "skip" | undefined;
  error?: string | undefined;
  step?: string | undefined;
  artifacts?: Record<string, unknown> | undefined;
}

export interface IngestionState extends JobBlitzState {
  rawJobs: unknown[];
  normalizedJobs: Job[];
}

export interface ScoringState extends JobBlitzState {
  dimensions?: Record<string, unknown> | undefined;
}

export interface ApplicationState extends JobBlitzState {
  jobUrl?: string | undefined;
  atsType?: "greenhouse" | "lever" | "ashby" | "workday" | "naukri" | "linkedin" | "unknown" | undefined;
  applyUrl?: string | undefined;
  resumePath?: string | undefined;
  coverLetter?: string | undefined;
  payload?: ApplyPayload | undefined;
  confirmationId?: string | undefined;
  screenshotPath?: string | undefined;
  browserResult?: { success: boolean; confirmationId?: string; screenshot?: string; error?: string } | undefined;
  step?: "init" | "detect_ats" | "apply" | "verify" | "notify" | "failed" | "completed" | undefined;
  retryCount?: number | undefined;
  humanApprovalRequired?: boolean | undefined;
  approvedAt?: string | undefined;
}

export interface ApplyPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  resumePath?: string;
  coverLetter?: string;
  linkedin?: string;
  portfolio?: string;
  answers?: Record<string, string>;
}

export interface FollowUpState extends JobBlitzState {
  followupType?: string | undefined;
  scheduledFor?: string | undefined;
  content?: string | undefined;
}
