import { Worker } from "bullmq";
import type Redis from "ioredis";
import { eq, and } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import {
  atsRewriteAgent,
  coverLetterAgent,
  companyResearchAgent,
  salaryBenchmarkAgent,
} from "@jobblitz/agents";
import type { OrchestrationJobData } from "../queues";
import { QueueName, enqueueCoachHandoff, enqueueComplianceFilter, enqueueOrchestrationJob } from "../queues";

export function createApplicationOrchestratorWorker(connection: Redis, db: DatabaseClient) {
  return new Worker<OrchestrationJobData>(
    QueueName.ORCHESTRATION,
    async (job) => {
      // ── Batch tailor cron job ──
      if (job.name === "batch_tailor") {
        console.log(`[ApplicationOrchestratorWorker] running batch tailor ${job.id}`);
        const pending = await db
          .select({ id: schema.applications.id, userId: schema.applications.userId, jobId: schema.applications.jobId, resumeId: schema.applications.resumeId })
          .from(schema.applications)
          .where(eq(schema.applications.status, "approved"));
        console.log(`[ApplicationOrchestratorWorker] approved applications to tailor: ${pending.length}`);
        for (const app of pending.slice(0, 10)) {
          await enqueueOrchestrationJob({
            type: "tailor",
            userId: app.userId,
            jobId: app.jobId,
            applicationId: app.id,
            resumeId: app.resumeId ?? undefined,
          });
        }
        await db.insert(schema.jobAuditLog).values({
          queueName: QueueName.ORCHESTRATION,
          jobId: job.id ?? "unknown",
          status: "completed",
          payload: { batch: true, enqueued: pending.length } as never,
        });
        return;
      }

      const data = job.data;
      console.log(`[ApplicationOrchestratorWorker] ${data.type} job ${job.id}`);

      const [application] = await db
        .select()
        .from(schema.applications)
        .where(eq(schema.applications.id, data.applicationId))
        .limit(1);

      if (!application) throw new Error(`Application not found: ${data.applicationId}`);

      const [jobRow] = await db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.id, data.jobId))
        .limit(1);

      const [profile] = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, data.userId))
        .limit(1);

      if (data.type === "tailor") {
        // Fetch resume text from the user's default resume or the application resume
        let resumeText = "";
        if (data.resumeId) {
          const [resume] = await db
            .select({ parsedText: schema.resumes.parsedText })
            .from(schema.resumes)
            .where(and(eq(schema.resumes.id, data.resumeId), eq(schema.resumes.userId, data.userId)))
            .limit(1);
          resumeText = resume?.parsedText ?? "";
        }
        if (!resumeText && profile?.parsedProfile) {
          // Fallback to parsed profile summary
          const parsed = profile.parsedProfile as { summary?: string } | null;
          resumeText = parsed?.summary ?? "";
        }

        const jd = jobRow?.description ?? "";

        const tailored = await atsRewriteAgent.execute({ resumeText, jobDescription: jd });
        const coverLetter = await coverLetterAgent.execute({
          profile: profile as never,
          job: jobRow as never,
        });
        await companyResearchAgent.execute(jobRow?.company ?? "");
        await salaryBenchmarkAgent.execute({
          role: jobRow?.title ?? "",
          location: jobRow?.location || undefined,
        });

        await db
          .update(schema.applications)
          .set({
            status: "pending",
            tailoredResumePath: tailored.markdown,
            updatedAt: new Date(),
          })
          .where(eq(schema.applications.id, data.applicationId));

        // Store cover letter
        const [clRow] = await db
          .insert(schema.coverLetters)
          .values({
            userId: data.userId,
            jobId: data.jobId,
            content: coverLetter.coverLetter,
          })
          .returning();

        if (clRow) {
          await db
            .update(schema.applications)
            .set({ coverLetterId: clRow.id })
            .where(eq(schema.applications.id, data.applicationId));
        }

        // Enqueue coach review if confidence is low
        if (tailored.confidence < 85 || !tailored.antiFabricationCheck) {
          await enqueueCoachHandoff({
            userId: data.userId,
            applicationId: data.applicationId,
            triggerReason: `Tailoring confidence ${tailored.confidence}%. Anti-fabrication: ${tailored.antiFabricationCheck}. Coach review required.`,
            priority: 2,
          });
        }

        // Notify user
        await enqueueComplianceFilter({
          userId: data.userId,
          messageText: `Your application for ${jobRow?.title} at ${jobRow?.company} has been tailored and is awaiting review.`,
          channel: "whatsapp",
        });
      }

      // Legacy apply/resume types are handled by the existing LangGraph worker in index.ts
      // This worker handles the new "tailor" action.

      await db.insert(schema.jobAuditLog).values({
        queueName: QueueName.ORCHESTRATION,
        jobId: job.id ?? "unknown",
        status: "completed",
        payload: data as never,
      });
    },
    { connection, concurrency: 3 }
  );
}
