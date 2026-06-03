import { Queue } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const applicationQueue = new Queue("orchestration-jobs", { connection });
export const dailyJobHuntQueue = new Queue("daily-job-hunt", { connection });
export const complianceFilterQueue = new Queue("compliance-filter", { connection });
export const coachHandoffQueue = new Queue("coach-handoff", { connection });
export const profileIngestionQueue = new Queue("profile-ingestion", { connection });

export interface ApplicationJobData {
  type: "apply" | "resume";
  userId: string;
  jobId: string;
  applicationId: string;
  resumeId?: string | undefined;
  coverLetterId?: string | undefined;
}

export interface OrchestrationJobData {
  type: "apply" | "resume" | "tailor";
  userId: string;
  jobId: string;
  applicationId: string;
  resumeId?: string | undefined;
  coverLetterId?: string | undefined;
}

export async function enqueueApplicationJob(data: ApplicationJobData): Promise<string> {
  const job = await applicationQueue.add(data.type, data, {
    jobId: `${data.type}-${data.applicationId}`,
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
  return job.id ?? data.applicationId;
}

export async function enqueueOrchestrationJob(data: OrchestrationJobData): Promise<string> {
  const job = await applicationQueue.add(data.type, data, {
    jobId: `${data.type}-${data.applicationId}`,
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
  return job.id ?? data.applicationId;
}

export interface DailyJobHuntData {
  userId?: string;
}

export async function enqueueDailyJobHunt(data: DailyJobHuntData = {}): Promise<string> {
  const job = await dailyJobHuntQueue.add("hunt", data, {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
  return job.id ?? "hunt";
}

export interface ComplianceFilterData {
  messageText: string;
  userId: string;
  channel: "whatsapp" | "email" | "sms";
}

export async function enqueueComplianceFilter(data: ComplianceFilterData): Promise<string> {
  const job = await complianceFilterQueue.add("check", data, {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
  return job.id ?? "check";
}

export interface CoachHandoffData {
  userId: string;
  applicationId?: string;
  triggerReason: string;
  priority?: number;
}

export async function enqueueCoachHandoff(data: CoachHandoffData): Promise<string> {
  const job = await coachHandoffQueue.add("handoff", data, {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
  return job.id ?? "handoff";
}

export interface ProfileIngestionData {
  userId: string;
  resumeText: string;
  source: "upload" | "whatsapp" | "manual";
}

export async function enqueueProfileIngestion(data: ProfileIngestionData): Promise<string> {
  const job = await profileIngestionQueue.add("ingest", data, {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
  });
  return job.id ?? "ingest";
}
