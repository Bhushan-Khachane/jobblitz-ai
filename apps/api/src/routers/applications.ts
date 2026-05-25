import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { schema } from "@jobblitz/db";
import { authMiddleware } from "../middleware/auth";
import { enqueueApplicationJob } from "../queue";

const { applications, jobs } = schema;

const applicationsRouter = new Hono();

applicationsRouter.use("/*", authMiddleware);

applicationsRouter.get("/", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status");
  const limit = Math.min(Number(c.req.query("limit") || "20"), 100);
  const offset = Number(c.req.query("offset") || "0");

  let conditions = and(eq(applications.userId, user.id));
  if (status) {
    conditions = and(eq(applications.userId, user.id), eq(applications.status, status as never));
  }

  const result = await db
    .select({
      id: applications.id,
      status: applications.status,
      approvalStatus: applications.approvalStatus,
      appliedAt: applications.appliedAt,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      errorMessage: applications.errorMessage,
      retryCount: applications.retryCount,
      job: {
        id: jobs.id,
        title: jobs.title,
        company: jobs.company,
        location: jobs.location,
      },
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(conditions as never)
    .orderBy(desc(applications.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json(result);
});

applicationsRouter.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { jobId, resumeId, coverLetterId } = body;

  if (!jobId) return c.json({ error: "jobId is required" }, 400);

  const inserted = await db
    .insert(applications)
    .values({
      userId: user.id,
      jobId,
      resumeId,
      coverLetterId,
      status: "pending",
    })
    .returning();

  const application = inserted[0];
  if (!application) {
    return c.json({ error: "Failed to create application" }, 500);
  }

  // Enqueue the application job
  await enqueueApplicationJob({
    type: "apply",
    userId: user.id,
    jobId,
    applicationId: application.id,
    resumeId,
    coverLetterId,
  });

  return c.json(application, 201);
});

applicationsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [app] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
    .limit(1);
  if (!app) return c.json({ error: "Not found" }, 404);
  return c.json(app);
});

applicationsRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();

  const [existing] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
    .limit(1);
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updated = await db.update(applications).set({ ...body, updatedAt: new Date() }).where(eq(applications.id, id)).returning();
  return c.json(updated[0]);
});

applicationsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await db.delete(applications).where(and(eq(applications.id, id), eq(applications.userId, user.id)));
  return c.json({ success: true });
});

applicationsRouter.post("/:id/apply", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [app] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
    .limit(1);
  if (!app) return c.json({ error: "Not found" }, 404);

  await enqueueApplicationJob({
    type: "apply",
    userId: user.id,
    jobId: app.jobId,
    applicationId: app.id,
    resumeId: app.resumeId ?? undefined,
    coverLetterId: app.coverLetterId ?? undefined,
  });

  return c.json({ success: true, enqueued: true });
});

applicationsRouter.post("/:id/resume", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [app] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
    .limit(1);
  if (!app) return c.json({ error: "Not found" }, 404);

  await enqueueApplicationJob({
    type: "resume",
    userId: user.id,
    jobId: app.jobId,
    applicationId: app.id,
    resumeId: app.resumeId ?? undefined,
    coverLetterId: app.coverLetterId ?? undefined,
  });

  return c.json({ success: true, resumed: true });
});

export default applicationsRouter;
