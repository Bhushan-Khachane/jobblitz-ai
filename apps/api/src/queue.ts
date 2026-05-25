import { Queue } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const applicationQueue = new Queue("jobblitz-applications", { connection });

export interface ApplicationJobData {
  type: "apply" | "resume";
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
