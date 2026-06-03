import { Worker } from "bullmq";
import type Redis from "ioredis";
import { eq } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import { parserAgent } from "@jobblitz/agents";
import type { ProfileIngestionJobData } from "../queues";
import { QueueName, enqueueCoachHandoff } from "../queues";

export function createProfileIngestionWorker(connection: Redis, db: DatabaseClient) {
  return new Worker<ProfileIngestionJobData>(
    QueueName.PROFILE_INGESTION,
    async (job) => {
      const data = job.data;
      console.log(`[ProfileIngestionWorker] ingest job ${job.id}`);

      const parsed = await parserAgent.execute(data.resumeText);

      const [existing] = await db
        .select({ id: schema.profiles.id })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, data.userId))
        .limit(1);

      if (existing) {
        await db
          .update(schema.profiles)
          .set({
            headline: parsed.name,
            skills: parsed.skills as never,
            parsedProfile: parsed as never,
            profileParsedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.profiles.userId, data.userId));
      } else {
        await db.insert(schema.profiles).values({
          userId: data.userId,
          headline: parsed.name,
          skills: parsed.skills as never,
          parsedProfile: parsed as never,
          profileParsedAt: new Date(),
        });
      }

      if (parsed.parsingConfidence < 70) {
        await enqueueCoachHandoff({
          userId: data.userId,
          triggerReason: `Low parsing confidence (${parsed.parsingConfidence}%). Manual review needed.`,
          priority: 2,
        });
      }

      await db.insert(schema.jobAuditLog).values({
        queueName: QueueName.PROFILE_INGESTION,
        jobId: job.id ?? "unknown",
        status: "completed",
        payload: data as never,
        result: { confidence: parsed.parsingConfidence } as never,
      });

      console.log(`[ProfileIngestionWorker] completed job ${job.id} confidence=${parsed.parsingConfidence}`);
    },
    { connection, concurrency: 3 }
  );
}
