import { Worker } from "bullmq";
import Redis from "ioredis";
import { eq, and } from "drizzle-orm";
import { createDatabaseClient, schema } from "@jobblitz/db";
import { validateSecrets } from "@jobblitz/security";
import { createApplicationGraph } from "@jobblitz/agents";
import { Command, isGraphInterrupt } from "@langchain/langgraph";

const secrets = validateSecrets(process.env);
const db = createDatabaseClient(secrets.DATABASE_URL);

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

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
    .select({ applyUrl: schema.jobs.applyUrl })
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
    },
  };
}

async function run() {
  const graph = await createApplicationGraph({ db });

  const worker = new Worker<ApplicationJobData>(
    "jobblitz-applications",
    async (job) => {
      const data = job.data;
      console.log(`[worker] ${data.type} job ${job.id} application=${data.applicationId}`);

      const threadId = data.applicationId;

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
        } catch (err) {
          if (isGraphInterrupt(err)) {
            console.log(`[worker] interrupt awaiting approval for application ${data.applicationId}`);
            await db
              .update(schema.applications)
              .set({
                status: "pending",
                approvalStatus: "pending",
                updatedAt: new Date(),
              })
              .where(eq(schema.applications.id, data.applicationId));
            return;
          }
          throw err;
        }
      } else if (data.type === "resume") {
        try {
          await graph.invoke(
            new Command({ resume: { approved: true } }),
            { configurable: { thread_id: threadId } }
          );
        } catch (err) {
          if (isGraphInterrupt(err)) {
            console.log(`[worker] interrupt on resume for application ${data.applicationId}`);
            return;
          }
          throw err;
        }
      }
    },
    { connection, concurrency: 2 }
  );

  worker.on("completed", (job) => {
    console.log(`[worker] completed job ${job?.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] failed job ${job?.id}:`, err instanceof Error ? err.message : String(err));
  });

  console.log("[worker-orchestrator] BullMQ worker started on queue 'jobblitz:applications'");
}

run().catch((err) => {
  console.error("[worker-orchestrator] fatal error:", err);
  process.exit(1);
});
