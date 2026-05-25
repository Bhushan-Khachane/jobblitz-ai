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
  applyUrl?: string | undefined;
  resumePath?: string | undefined;
  coverLetter?: string | undefined;
  confirmationId?: string | undefined;
  screenshotPath?: string | undefined;
}

export interface FollowUpState extends JobBlitzState {
  followupType?: string | undefined;
  scheduledFor?: string | undefined;
  content?: string | undefined;
}
