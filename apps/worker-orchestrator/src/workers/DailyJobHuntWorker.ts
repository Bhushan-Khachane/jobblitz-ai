import { Worker } from "bullmq";
import type Redis from "ioredis";
import { eq, and, gte } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import { hunterAgent, matchScorerAgent, redFlagAgent } from "@jobblitz/agents";
import type { DailyJobHuntJobData } from "../queues";
import { enqueueOrchestrationJob, QueueName } from "../queues";

export function createDailyJobHuntWorker(connection: Redis, db: DatabaseClient) {
  return new Worker<DailyJobHuntJobData>(
    QueueName.DAILY_JOB_HUNT,
    async (job) => {
      const data = job.data;
      console.log(`[DailyJobHuntWorker] starting job ${job.id}`);

      const profiles = data.userId
        ? await db.select().from(schema.profiles).where(eq(schema.profiles.userId, data.userId))
        : await db.select().from(schema.profiles).where(gte(schema.profiles.experienceYears, 0));

      for (const profile of profiles) {
        const desiredRole = (profile.preferredJobTitles ?? [])[0];
        if (!desiredRole) continue;

        const huntResult = await hunterAgent.execute({
          keywords: desiredRole,
          location: (profile.preferredLocations ?? [])[0] || undefined,
        });

        for (const listing of huntResult.jobs) {
          // Check if job already exists
          const [existing] = await db
            .select({ id: schema.jobs.id })
            .from(schema.jobs)
            .where(
              and(
                eq(schema.jobs.userId, profile.userId),
                eq(schema.jobs.externalJobId, listing.sourceId)
              )
            )
            .limit(1);

          if (existing) continue;

          const [jobRow] = await db
            .insert(schema.jobs)
            .values({
              userId: profile.userId,
              platform: listing.source,
              externalJobId: listing.sourceId,
              title: listing.title,
              company: listing.company,
              location: listing.location,
              description: listing.jdText,
              skillsRequired: listing.skills,
              applyUrl: listing.url,
              status: "discovered",
            })
            .returning();

          if (!jobRow) continue;

          const scoreResult = await matchScorerAgent.execute({ job: jobRow as never, profile: profile as never });
          const redFlagResult = await redFlagAgent.execute(listing.jdText);

          if (scoreResult.score <= 50 || redFlagResult.overallRisk === "HIGH") {
            await db.delete(schema.jobs).where(eq(schema.jobs.id, jobRow.id));
            continue;
          }

          await db
            .update(schema.jobs)
            .set({
              matchScore: scoreResult.score,
              matchExplanation: {
                analysis: scoreResult.analysis,
                strengths: scoreResult.strengths,
                gaps: scoreResult.gaps,
              } as never,
              status: "scored",
            })
            .where(eq(schema.jobs.id, jobRow.id));

          const [application] = await db
            .insert(schema.applications)
            .values({
              userId: profile.userId,
              jobId: jobRow.id,
              status: "pending",
            })
            .returning();

          if (application) {
            await enqueueOrchestrationJob({
              type: "tailor",
              userId: profile.userId,
              jobId: jobRow.id,
              applicationId: application.id,
            });
          }
        }
      }

      // Audit log
      await db.insert(schema.jobAuditLog).values({
        queueName: QueueName.DAILY_JOB_HUNT,
        jobId: job.id ?? "unknown",
        status: "completed",
        payload: data as never,
      });

      console.log(`[DailyJobHuntWorker] completed job ${job.id}`);
    },
    { connection, concurrency: 2 }
  );
}
