import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { schema } from "@jobblitz/db";
import { authMiddleware } from "../middleware/auth";

const { approvals, jobs } = schema;

const approvalsRouter = new Hono();

approvalsRouter.use("/*", authMiddleware);

approvalsRouter.get("/", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status") || "pending";
  const limit = Math.min(Number(c.req.query("limit") || "20"), 100);
  const offset = Number(c.req.query("offset") || "0");

  const result = await db
    .select({
      id: approvals.id,
      status: approvals.status,
      fitScore: approvals.fitScore,
      reason: approvals.reason,
      reviewedAt: approvals.reviewedAt,
      createdAt: approvals.createdAt,
      updatedAt: approvals.updatedAt,
      job: {
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
      },
    })
    .from(approvals)
    .innerJoin(jobs, eq(approvals.jobId, jobs.id))
    .where(and(eq(approvals.userId, user.id), eq(approvals.status, status as never)))
    .orderBy(desc(approvals.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json(result);
});

approvalsRouter.post("/:id/approve", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, id), eq(approvals.userId, user.id)))
    .limit(1);
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updated = await db
    .update(approvals)
    .set({ status: "approved", reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(approvals.id, id))
    .returning();

  return c.json(updated[0]);
});

approvalsRouter.post("/:id/reject", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, id), eq(approvals.userId, user.id)))
    .limit(1);
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updated = await db
    .update(approvals)
    .set({ status: "rejected", reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(approvals.id, id))
    .returning();

  return c.json(updated[0]);
});

export default approvalsRouter;
