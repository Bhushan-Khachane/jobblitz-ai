import { Queue } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
export const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export enum QueueName {
  ORCHESTRATION = "orchestration-jobs",
  DAILY_JOB_HUNT = "daily-job-hunt",
  COMPLIANCE_FILTER = "compliance-filter",
  COACH_HANDOFF = "coach-handoff",
  PROFILE_INGESTION = "profile-ingestion",
}

export const orchestrationQueue = new Queue(QueueName.ORCHESTRATION, { connection });
export const dailyJobHuntQueue = new Queue(QueueName.DAILY_JOB_HUNT, { connection });
export const complianceFilterQueue = new Queue(QueueName.COMPLIANCE_FILTER, { connection });
export const coachHandoffQueue = new Queue(QueueName.COACH_HANDOFF, { connection });
export const profileIngestionQueue = new Queue(QueueName.PROFILE_INGESTION, { connection });

export interface OrchestrationJobData {
  type: "apply" | "resume" | "tailor";
  userId: string;
  jobId: string;
  applicationId: string;
  resumeId?: string | undefined;
  coverLetterId?: string | undefined;
}

export interface DailyJobHuntJobData {
  userId?: string | undefined;
}

export interface ComplianceFilterJobData {
  messageText: string;
  userId: string;
  channel: "whatsapp" | "email" | "sms";
}

export interface CoachHandoffJobData {
  userId: string;
  applicationId?: string | undefined;
  triggerReason: string;
  priority?: number | undefined;
}

export interface ProfileIngestionJobData {
  userId: string;
  resumeText: string;
  source: "upload" | "whatsapp" | "manual";
}

export async function enqueueOrchestrationJob(data: OrchestrationJobData): Promise<string> {
  const job = await orchestrationQueue.add(data.type, data, {
    jobId: `${data.type}-${data.applicationId}`,
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
  return job.id ?? data.applicationId;
}

export async function enqueueDailyJobHunt(data: DailyJobHuntJobData): Promise<string> {
  const job = await dailyJobHuntQueue.add("hunt", data, {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
  return job.id ?? "hunt";
}

export async function enqueueComplianceFilter(data: ComplianceFilterJobData): Promise<string> {
  const job = await complianceFilterQueue.add("check", data, {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
  return job.id ?? "check";
}

export async function enqueueCoachHandoff(data: CoachHandoffJobData): Promise<string> {
  const job = await coachHandoffQueue.add("handoff", data, {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
  return job.id ?? "handoff";
}

export async function enqueueProfileIngestion(data: ProfileIngestionJobData): Promise<string> {
  const job = await profileIngestionQueue.add("ingest", data, {
    removeOnComplete: 10,
    removeOnFail: 10,
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
  });
  return job.id ?? "ingest";
}
