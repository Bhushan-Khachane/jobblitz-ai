import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { schema } from "@jobblitz/db";
import { enqueueOrchestrationJob } from "../queue";

const webhooksRouter = new Hono();

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// WA Cloud API verification
webhooksRouter.get("/whatsapp", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    return c.text(challenge || "");
  }
  return c.text("Forbidden", 403);
});

// Inbound messages
webhooksRouter.post("/whatsapp", async (c) => {
  const body = await c.req.json();

  // Basic WA Cloud API structure parsing
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const message = value?.messages?.[0];

  if (message) {
    const from = message.from; // phone number
    const text = message.text?.body?.trim();

    // Find pending approval linked to this phone number via user
    const [approval] = await db
      .select({
        id: schema.approvals.id,
        applicationId: schema.approvals.applicationId,
        userId: schema.approvals.userId,
        jobId: schema.approvals.jobId,
      })
      .from(schema.approvals)
      .innerJoin(schema.users, eq(schema.approvals.userId, schema.users.id))
      .where(
        and(
          eq(schema.users.phone, from),
          eq(schema.approvals.status, "pending")
        )
      )
      .orderBy(sql`${schema.approvals.createdAt} DESC`)
      .limit(1);

    if (approval) {
      if (text === "1") {
        // Approve
        await db
          .update(schema.approvals)
          .set({ status: "approved", reviewedAt: new Date() })
          .where(eq(schema.approvals.id, approval.id));

        if (approval.applicationId) {
          await db
            .update(schema.applications)
            .set({ status: "approved", updatedAt: new Date() })
            .where(eq(schema.applications.id, approval.applicationId));

          // Enqueue BullMQ job
          await enqueueOrchestrationJob({
            type: "apply",
            userId: approval.userId,
            jobId: approval.jobId,
            applicationId: approval.applicationId,
          });
        }

      } else if (text === "2") {
        // Reject
        await db
          .update(schema.approvals)
          .set({ status: "rejected", reviewedAt: new Date() })
          .where(eq(schema.approvals.id, approval.id));

        if (approval.applicationId) {
          await db
            .update(schema.applications)
            .set({ status: "rejected", updatedAt: new Date() })
            .where(eq(schema.applications.id, approval.applicationId));
        }
      }
    }
  }

  return c.json({ status: "received" });
});

export default webhooksRouter;
