import { Worker, Queue } from "bullmq";
import Redis from "ioredis";
import { eq, and } from "drizzle-orm";
import { createDatabaseClient, schema } from "@jobblitz/db";
import { validateSecrets } from "@jobblitz/security";
import { createApplicationGraph } from "@jobblitz/agents";
import { Command, isGraphInterrupt } from "@langchain/langgraph";
import {
  initTracer,
  shutdownTracer,
  recordError,
  initMetrics,
  applicationsSubmittedCounter,
  agentLatencyHistogram,
} from "@jobblitz/observability";
import { trace } from "@opentelemetry/api";
import { registerDefaultCostLogger, CostTrackingService } from "@jobblitz/core";
import {
  createDailyJobHuntWorker,
  createComplianceFilterWorker,
  createCoachHandoffWorker,
  createProfileIngestionWorker,
  createApplicationOrchestratorWorker,
} from "./workers";

const secrets = validateSecrets(process.env);
const db = createDatabaseClient(secrets.DATABASE_URL);

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const redisPub = new Redis(REDIS_URL);

// ── Cron schedule queues (same names as API queue.ts) ──
const dailyJobHuntQueue = new Queue("daily-job-hunt", { connection });
const complianceFilterQueue = new Queue("compliance-filter", { connection });
const applicationQueue = new Queue("orchestration-jobs", { connection });

async function setupCronSchedules() {
  const tz = "Asia/Kolkata";
  try {
    await dailyJobHuntQueue.add("hunt", {}, {
      repeat: { pattern: "0 */6 * * *", tz },
      removeOnComplete: 10,
      removeOnFail: 10,
      jobId: "cron:daily-hunt",
    });
    console.log("[cron] daily job hunt scheduled every 6 hours (IST)");
  } catch (err) {
    console.error("[cron] failed to schedule daily hunt:", err instanceof Error ? err.message : String(err));
  }

  try {
    await complianceFilterQueue.add("batch_audit", {}, {
      repeat: { pattern: "0 2 * * *", tz },
      removeOnComplete: 10,
      removeOnFail: 10,
      jobId: "cron:compliance-batch",
    });
    console.log("[cron] compliance batch audit scheduled daily at 02:00 (IST)");
  } catch (err) {
    console.error("[cron] failed to schedule compliance batch:", err instanceof Error ? err.message : String(err));
  }

  try {
    await applicationQueue.add("batch_tailor", {
      type: "tailor",
      userId: "batch",
      jobId: "batch",
      applicationId: "batch",
    }, {
      repeat: { pattern: "0 2 * * *", tz },
      removeOnComplete: 10,
      removeOnFail: 10,
      jobId: "cron:tailor-batch",
    });
    console.log("[cron] tailor batch scheduled daily at 02:00 (IST)");
  } catch (err) {
    console.error("[cron] failed to schedule tailor batch:", err instanceof Error ? err.message : String(err));
  }
}

interface ApplicationJobData {
  type: "apply" | "resume";
  userId: string;
  jobId: string;
  applicationId: string;
  resumeId?: string | undefined;
  coverLetterId?: string | undefined;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

async function buildPayload(data: ApplicationJobData) {
  const [user] = await db
    .select({ id: schema.users.id, fullName: schema.users.fullName, email: schema.users.email, phone: schema.users.phone })
    .from(schema.users)
    .where(eq(schema.users.id, data.userId))
    .limit(1);

  if (!user) throw new Error(`User not found: ${data.userId}`);

  const [profile] = await db
    .select({ linkedinUrl: schema.profiles.linkedinUrl, portfolioUrl: schema.profiles.portfolioUrl })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, data.userId))
    .limit(1);

  const [job] = await db
    .select({ applyUrl: schema.jobs.applyUrl, platform: schema.jobs.platform })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.id, data.jobId), eq(schema.jobs.userId, data.userId)))
    .limit(1);

  let resumePath: string | undefined;
  if (data.resumeId) {
    const [resume] = await db
      .select({ filePath: schema.resumes.filePath })
      .from(schema.resumes)
      .where(and(eq(schema.resumes.id, data.resumeId), eq(schema.resumes.userId, data.userId)))
      .limit(1);
    if (resume) resumePath = resume.filePath;
  }

  let coverLetter: string | undefined;
  if (data.coverLetterId) {
    const [cl] = await db
      .select({ content: schema.coverLetters.content })
      .from(schema.coverLetters)
      .where(and(eq(schema.coverLetters.id, data.coverLetterId), eq(schema.coverLetters.userId, data.userId)))
      .limit(1);
    if (cl) coverLetter = cl.content;
  }

  const { firstName, lastName } = splitName(user.fullName);

  return {
    jobUrl: job?.applyUrl || undefined,
    payload: {
      firstName,
      lastName,
      email: user.email,
      phone: user.phone || undefined,
      resumePath,
      coverLetter,
      linkedin: profile?.linkedinUrl || undefined,
      portfolio: profile?.portfolioUrl || undefined,
      platform: job?.platform || undefined,
    },
  };
}

async function writeCheckpoint(
  applicationId: string,
  userId: string,
  graphState: Record<string, unknown>,
  status: string
) {
  const expiresAt = status === "awaiting_approval"
    ? new Date(Date.now() + 24 * 60 * 60 * 1000)
    : null;

  await db.insert(schema.orchestrationCheckpoints).values({
    applicationId,
    userId,
    graphState,
    status,
    expiresAt,
  } as never);
}

async function updateCheckpointStatus(applicationId: string, status: string) {
  await db
    .update(schema.orchestrationCheckpoints)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.orchestrationCheckpoints.applicationId, applicationId));
}

async function publishNotification(userId: string, event: Record<string, unknown>) {
  await redisPub.publish(`jobblitz:notifications:${userId}`, JSON.stringify(event));
}

async function publishApprovalEvent(userId: string, applicationId: string, jobId: string) {
  await redisPub.publish(
    "jobblitz:approvals",
    JSON.stringify({
      type: "awaiting_approval",
      userId,
      applicationId,
      jobId,
      timestamp: new Date().toISOString(),
    })
  );
}

async function run() {
  initTracer("worker-orchestrator");
  initMetrics("worker-orchestrator");

  // Wire LLM cost tracking to database
  const costTracker = new CostTrackingService(db);
  registerDefaultCostLogger((entry) => {
    costTracker
      .log({
        engine: entry.provider,
        model: entry.model,
        tokensIn: entry.promptTokens,
        tokensOut: entry.completionTokens,
        latencyMs: entry.latencyMs,
      })
      .catch((err) => console.error("[cost-tracker] failed to log:", err instanceof Error ? err.message : String(err)));
  });

  const graph = await createApplicationGraph({ db });

  await setupCronSchedules();

  // ── Legacy LangGraph application worker (preserved) ──
  const legacyWorker = new Worker<ApplicationJobData>(
    "orchestration-jobs",
    async (job) => {
      const data = job.data;
      const tracer = trace.getTracer("worker-orchestrator");
      const span = tracer.startSpan("orchestration.job");
      span.setAttribute("job.type", data.type);
      span.setAttribute("job.id", job.id || "");
      span.setAttribute("application.id", data.applicationId);
      span.setAttribute("user.id", data.userId);
      console.log(`[worker] ${data.type} job ${job.id} application=${data.applicationId}`);

      const startMs = Date.now();
      const threadId = data.applicationId;

      try {
        if (data.type === "apply") {
          const { jobUrl, payload } = await buildPayload(data);

          if (!jobUrl) {
            throw new Error(`No applyUrl for job ${data.jobId}`);
          }

          const initialState = {
            userId: data.userId,
            jobId: data.jobId,
            applicationId: data.applicationId,
            jobUrl,
            payload,
          };

          try {
            await graph.invoke(initialState, { configurable: { thread_id: threadId } });

            await db
              .update(schema.applications)
              .set({
                status: "submitted",
                updatedAt: new Date(),
              })
              .where(eq(schema.applications.id, data.applicationId));

            applicationsSubmittedCounter.add(1, {
              userId: data.userId,
              platform: payload.platform || "unknown",
              status: "submitted",
            });

            await publishNotification(data.userId, {
              type: "application_completed",
              applicationId: data.applicationId,
              jobId: data.jobId,
              timestamp: new Date().toISOString(),
            });
          } catch (err) {
            if (isGraphInterrupt(err)) {
              console.log(`[worker] interrupt awaiting approval for application ${data.applicationId}`);

              await writeCheckpoint(
                data.applicationId,
                data.userId,
                { userId: data.userId, jobId: data.jobId, applicationId: data.applicationId, jobUrl, payload },
                "awaiting_approval"
              );

              await db
                .update(schema.applications)
                .set({
                  status: "pending",
                  approvalStatus: "pending",
                  updatedAt: new Date(),
                })
                .where(eq(schema.applications.id, data.applicationId));

              await publishApprovalEvent(data.userId, data.applicationId, data.jobId);
              span.end();
              return;
            }

            console.error(`[worker] fatal error for application ${data.applicationId}:`, err);

            await db
              .update(schema.applications)
              .set({
                status: "failed",
                errorMessage: err instanceof Error ? err.message : String(err),
                updatedAt: new Date(),
              })
              .where(eq(schema.applications.id, data.applicationId));

            await updateCheckpointStatus(data.applicationId, "failed");

            applicationsSubmittedCounter.add(1, {
              userId: data.userId,
              platform: payload.platform || "unknown",
              status: "failed",
            });

            await publishNotification(data.userId, {
              type: "application_failed",
              applicationId: data.applicationId,
              jobId: data.jobId,
              error: err instanceof Error ? err.message : String(err),
              timestamp: new Date().toISOString(),
            });

            recordError(span, err);
            span.end();
            throw err;
          }
        } else if (data.type === "resume") {
          try {
            await graph.invoke(
              new Command({ resume: { approved: true } }),
              { configurable: { thread_id: threadId } }
            );

            await db
              .update(schema.applications)
              .set({
                status: "submitted",
                updatedAt: new Date(),
              })
              .where(eq(schema.applications.id, data.applicationId));

            applicationsSubmittedCounter.add(1, {
              userId: data.userId,
              platform: "unknown",
              status: "submitted",
            });

            await publishNotification(data.userId, {
              type: "application_completed",
              applicationId: data.applicationId,
              jobId: data.jobId,
              timestamp: new Date().toISOString(),
            });
          } catch (err) {
            if (isGraphInterrupt(err)) {
              console.log(`[worker] interrupt on resume for application ${data.applicationId}`);
              span.end();
              return;
            }

            await db
              .update(schema.applications)
              .set({
                status: "failed",
                errorMessage: err instanceof Error ? err.message : String(err),
                updatedAt: new Date(),
              })
              .where(eq(schema.applications.id, data.applicationId));

            await updateCheckpointStatus(data.applicationId, "failed");

            applicationsSubmittedCounter.add(1, {
              userId: data.userId,
              platform: "unknown",
              status: "failed",
            });

            await publishNotification(data.userId, {
              type: "application_failed",
              applicationId: data.applicationId,
              jobId: data.jobId,
              error: err instanceof Error ? err.message : String(err),
              timestamp: new Date().toISOString(),
            });

            recordError(span, err);
            span.end();
            throw err;
          }
        }
      } finally {
        agentLatencyHistogram.record(Date.now() - startMs, {
          agentName: "orchestrator",
          step: data.type,
        });
        if (span.isRecording()) {
          span.end();
        }
      }
    },
    { connection, concurrency: 3 }
  );

  legacyWorker.on("completed", (job) => {
    console.log(`[worker] completed job ${job?.id}`);
  });

  legacyWorker.on("failed", (job, err) => {
    console.error(`[worker] failed job ${job?.id}:`, err instanceof Error ? err.message : String(err));
  });

  // ── New assisted_apply-inspired workers ──
  const dailyJobHuntWorker = createDailyJobHuntWorker(connection, db);
  const complianceFilterWorker = createComplianceFilterWorker(connection, db);
  const coachHandoffWorker = createCoachHandoffWorker(connection, db);
  const profileIngestionWorker = createProfileIngestionWorker(connection, db);
  const applicationOrchestratorWorker = createApplicationOrchestratorWorker(connection, db);

  const allWorkers = [
    legacyWorker,
    dailyJobHuntWorker,
    complianceFilterWorker,
    coachHandoffWorker,
    profileIngestionWorker,
    applicationOrchestratorWorker,
  ];

  console.log("[worker-orchestrator] All workers started");

  // Graceful shutdown
  async function shutdown(signal: string) {
    console.log(`[worker-orchestrator] received ${signal}, shutting down gracefully...`);
    for (const w of allWorkers) {
      await w.close();
    }
    await redisPub.quit();
    await connection.quit();
    await shutdownTracer();
    console.log("[worker-orchestrator] shutdown complete");
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

run().catch((err) => {
  console.error("[worker-orchestrator] fatal error:", err);
  process.exit(1);
});
