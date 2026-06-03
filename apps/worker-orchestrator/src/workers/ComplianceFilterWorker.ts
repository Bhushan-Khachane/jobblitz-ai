import { Worker } from "bullmq";
import type Redis from "ioredis";
import { eq, and, gte } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import { complianceAgent } from "@jobblitz/agents";
import { createWhatsAppSender } from "@jobblitz/core";
import type { ComplianceFilterJobData } from "../queues";
import { QueueName } from "../queues";

export function createComplianceFilterWorker(connection: Redis, db: DatabaseClient) {
  const whatsapp = createWhatsAppSender();

  return new Worker<ComplianceFilterJobData>(
    QueueName.COMPLIANCE_FILTER,
    async (job) => {
      // ── Batch audit cron job ──
      if (job.name === "batch_audit") {
        console.log(`[ComplianceFilterWorker] running batch audit ${job.id}`);
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const blockedRows = await db
          .select()
          .from(schema.complianceLog)
          .where(and(eq(schema.complianceLog.blocked, true), gte(schema.complianceLog.createdAt, since)));
        console.log(`[ComplianceFilterWorker] blocked messages in last 24h: ${blockedRows.length}`);
        await db.insert(schema.jobAuditLog).values({
          queueName: QueueName.COMPLIANCE_FILTER,
          jobId: job.id ?? "unknown",
          status: "completed",
          payload: { batch: true, blockedCount: blockedRows.length } as never,
        });
        return;
      }

      const data = job.data;
      console.log(`[ComplianceFilterWorker] checking job ${job.id}`);

      const result = await complianceAgent.execute(data.messageText);

      await db.insert(schema.complianceLog).values({
        userId: data.userId,
        outboundText: data.messageText,
        blocked: result.blocked,
        violations: result.violations,
        modifiedText: result.modifiedText,
        channel: data.channel,
      });

      if (result.blocked) {
        console.log(`[ComplianceFilterWorker] BLOCKED job ${job.id}: ${result.violations.join(", ")}`);
      } else {
        const textToSend = result.modifiedText ?? data.messageText;

        if (data.channel === "whatsapp" && whatsapp) {
          try {
            const [user] = await db
              .select({ phone: schema.users.phone })
              .from(schema.users)
              .where(eq(schema.users.id, data.userId))
              .limit(1);

            if (user?.phone) {
              await whatsapp.sendText({ to: user.phone, body: textToSend });
              console.log(`[ComplianceFilterWorker] sent WhatsApp to ${user.phone}`);
            } else {
              console.warn(`[ComplianceFilterWorker] no phone for user ${data.userId}`);
            }
          } catch (err) {
            console.error(
              `[ComplianceFilterWorker] WhatsApp send failed:`,
              err instanceof Error ? err.message : String(err)
            );
          }
        } else if (data.channel === "email") {
          // TODO: wire email sender (Resend / Postmark / SMTP)
          console.log(`[ComplianceFilterWorker] PASSED email — would send: ${textToSend.slice(0, 100)}`);
        } else {
          console.log(`[ComplianceFilterWorker] PASSED ${data.channel} — would send: ${textToSend.slice(0, 100)}`);
        }
      }

      await db.insert(schema.jobAuditLog).values({
        queueName: QueueName.COMPLIANCE_FILTER,
        jobId: job.id ?? "unknown",
        status: result.blocked ? "blocked" : "completed",
        payload: data as never,
        result: result as never,
      });
    },
    { connection, concurrency: 5 }
  );
}
