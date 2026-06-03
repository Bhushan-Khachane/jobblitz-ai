import { Worker } from "bullmq";
import type Redis from "ioredis";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import { createSlackWebhook } from "@jobblitz/core";
import type { CoachHandoffJobData } from "../queues";
import { QueueName } from "../queues";

const SLA_HOURS = 4;

export function createCoachHandoffWorker(connection: Redis, db: DatabaseClient) {
  const slack = createSlackWebhook();

  return new Worker<CoachHandoffJobData>(
    QueueName.COACH_HANDOFF,
    async (job) => {
      const data = job.data;
      console.log(`[CoachHandoffWorker] handoff job ${job.id}`);

      const slaDeadline = new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000);

      const [row] = await db
        .insert(schema.coachQueue)
        .values({
          userId: data.userId,
          applicationId: data.applicationId ?? null,
          priority: data.priority ?? 3,
          triggerReason: data.triggerReason,
          slaDeadline,
          status: "open",
        })
        .returning();

      if (data.priority === 1 && slack) {
        try {
          await slack.send({
            text: `🚨 *URGENT Coach Handoff*\nUser: ${data.userId}\nApplication: ${data.applicationId ?? "N/A"}\nReason: ${data.triggerReason}\nSLA: ${slaDeadline.toISOString()}`,
          });
          console.log(`[CoachHandoffWorker] sent Slack alert for priority 1 handoff`);
        } catch (err) {
          console.error(
            `[CoachHandoffWorker] Slack alert failed:`,
            err instanceof Error ? err.message : String(err)
          );
        }
      }

      await db.insert(schema.jobAuditLog).values({
        queueName: QueueName.COACH_HANDOFF,
        jobId: job.id ?? "unknown",
        status: "completed",
        payload: data as never,
        result: { coachQueueId: row?.id } as never,
      });

      console.log(`[CoachHandoffWorker] completed job ${job.id} queueId=${row?.id}`);
    },
    { connection, concurrency: 3 }
  );
}
