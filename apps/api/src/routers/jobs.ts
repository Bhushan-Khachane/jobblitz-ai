import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { schema } from "@jobblitz/db";
import { authMiddleware } from "../middleware/auth";
import { computeMatchScore } from "@jobblitz/core";
import { createEmbeddingClient, upsertJobEmbedding, findSimilarJobs } from "@jobblitz/memory";

const { jobs, profiles } = schema;

const embedder = createEmbeddingClient();

const jobsRouter = new Hono();

const createJobSchema = z.object({
  platform: z.string().min(1),
  externalJobId: z.string().optional(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  responsibilities: z.array(z.string()).optional(),
  skillsRequired: z.array(z.string()).optional(),
  experienceLevel: z.string().optional(),
  yearsExperienceMin: z.number().optional(),
  yearsExperienceMax: z.number().optional(),
  salaryMinLpa: z.number().optional(),
  salaryMaxLpa: z.number().optional(),
  jobType: z.string().optional(),
  remotePolicy: z.string().optional(),
  applyUrl: z.string().optional(),
  postedDate: z.string().optional(),
});

jobsRouter.use("/*", authMiddleware);

jobsRouter.get("/", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status");
  const search = c.req.query("search");
  const limit = Math.min(Number(c.req.query("limit") || "20"), 100);
  const offset = Number(c.req.query("offset") || "0");

  let query = db.select().from(jobs).where(eq(jobs.userId, user.id)).orderBy(desc(jobs.createdAt)).limit(limit).offset(offset);

  if (status) {
    query = db.select().from(jobs).where(and(eq(jobs.userId, user.id), eq(jobs.status, status as never))).orderBy(desc(jobs.createdAt)).limit(limit).offset(offset);
  }

  const result = await query;

  if (search) {
    const term = search.toLowerCase();
    const filtered = result.filter(
      (j) => j.title.toLowerCase().includes(term) || j.company.toLowerCase().includes(term)
    );
    return c.json(filtered);
  }

  return c.json(result);
});

jobsRouter.get("/semantic", async (c) => {
  const user = c.get("user");
  const query = c.req.query("q");
  const limit = Math.min(Number(c.req.query("limit") || "10"), 50);

  if (!query) {
    return c.json({ error: "Query parameter 'q' is required" }, 400);
  }

  const results = await findSimilarJobs(db, embedder, query, {
    userId: user.id,
    limit,
  });

  return c.json(results);
});

jobsRouter.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const inserted = await db
    .insert(jobs)
    .values({ ...parsed.data, userId: user.id })
    .returning();

  const job = inserted[0];
  if (!job) {
    return c.json({ error: "Failed to create job" }, 500);
  }

  // Embed the job asynchronously (best-effort)
  upsertJobEmbedding(db, embedder, job).catch((err: unknown) => {
    console.error("[jobs] embedding failed:", err instanceof Error ? err.message : String(err));
  });

  return c.json(job, 201);
});

jobsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).limit(1);
  if (!job) return c.json({ error: "Not found" }, 404);
  return c.json(job);
});

jobsRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();

  const [existing] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).limit(1);
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updated = await db.update(jobs).set({ ...body, updatedAt: new Date() }).where(eq(jobs.id, id)).returning();
  const job = updated[0];

  // Re-embed on update if the content changed
  if (job) {
    upsertJobEmbedding(db, embedder, job).catch((err: unknown) => {
      console.error("[jobs] re-embedding failed:", err instanceof Error ? err.message : String(err));
    });
  }

  return c.json(job);
});

jobsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await db.delete(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id)));
  return c.json({ success: true });
});

jobsRouter.post("/:id/score", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).limit(1);
  if (!job) return c.json({ error: "Not found" }, 404);

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (!profile) return c.json({ error: "Profile not found" }, 400);

  const score = computeMatchScore(job as never, profile as never);

  await db.update(jobs).set({
    matchScore: Math.round(score.fitScore * 100),
    status: score.decision === "auto" ? "approved" : "scored",
    matchExplanation: score.dimensions as never,
  }).where(eq(jobs.id, id));

  return c.json(score);
});

jobsRouter.post("/discover", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { keywords, location } = body;

  if (!keywords) {
    return c.json({ error: "keywords is required" }, 400);
  }

  const { hunterAgent, redFlagAgent } = await import("@jobblitz/agents");

  const huntResult = await hunterAgent.execute({ keywords, location });

  const discoveredJobs = [];
  for (const listing of huntResult.jobs) {
    const redFlag = await redFlagAgent.execute(listing.jdText);
    if (redFlag.overallRisk === "HIGH") continue;

    const [inserted] = await db
      .insert(jobs)
      .values({
        userId: user.id,
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

    if (inserted) {
      discoveredJobs.push(inserted);
    }
  }

  return c.json({ jobs: discoveredJobs, cached: huntResult.cached, quotaExhausted: huntResult.quotaExhausted });
});

jobsRouter.post("/:id/embed", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, user.id))).limit(1);
  if (!job) return c.json({ error: "Not found" }, 404);

  await upsertJobEmbedding(db, embedder, job);
  return c.json({ success: true, embedded: true });
});

export default jobsRouter;
