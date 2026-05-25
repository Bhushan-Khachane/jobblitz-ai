import { Hono } from "hono";
import { eq, like, desc } from "drizzle-orm";
import { db } from "../db";
import { schema } from "@jobblitz/db";
import { authMiddleware } from "../middleware/auth";
import { PerplexityClient, researchEmployer, researchRole } from "@jobblitz/research";

const { employers, employerNotes } = schema;

const researchRouter = new Hono();

function getResearchClient(): PerplexityClient | null {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return null;
  return new PerplexityClient(key);
}

researchRouter.use("/*", authMiddleware);

researchRouter.get("/employers", async (c) => {
  const search = c.req.query("search");
  const limit = Math.min(Number(c.req.query("limit") || "20"), 100);
  const offset = Number(c.req.query("offset") || "0");

  if (search) {
    const result = await db
      .select()
      .from(employers)
      .where(like(employers.name, `%${search}%`))
      .orderBy(desc(employers.lastResearchedAt))
      .limit(limit)
      .offset(offset);
    return c.json(result);
  }

  const result = await db.select().from(employers).orderBy(desc(employers.lastResearchedAt)).limit(limit).offset(offset);
  return c.json(result);
});

researchRouter.get("/employers/:id", async (c) => {
  const id = c.req.param("id");
  const [employer] = await db.select().from(employers).where(eq(employers.id, id)).limit(1);
  if (!employer) return c.json({ error: "Not found" }, 404);

  const notes = await db
    .select()
    .from(employerNotes)
    .where(eq(employerNotes.employerId, id))
    .orderBy(desc(employerNotes.createdAt));

  return c.json({ employer, notes });
});

researchRouter.post("/employers/:id/enrich", async (c) => {
  const id = c.req.param("id");
  const [employer] = await db.select().from(employers).where(eq(employers.id, id)).limit(1);
  if (!employer) return c.json({ error: "Not found" }, 404);

  const client = getResearchClient();
  if (!client) return c.json({ error: "Perplexity API key not configured" }, 503);

  const result = await researchEmployer(client, employer.name);

  const updated = await db
    .update(employers)
    .set({
      industry: result.industry ?? employer.industry,
      size: result.size ?? employer.size,
      description: result.description ?? employer.description,
      culture: result.culture ?? employer.culture,
      techStack: result.techStack as never,
      reputationScore: result.reputationScore ? Math.round(result.reputationScore * 20) : employer.reputationScore,
      researchArtifacts: {
        ...(typeof employer.researchArtifacts === "object" && employer.researchArtifacts ? employer.researchArtifacts : {}),
        latest: result,
      } as never,
      lastResearchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(employers.id, id))
    .returning();

  return c.json(updated[0]);
});

researchRouter.post("/employers/:id/notes", async (c) => {
  const user = c.get("user");
  const employerId = c.req.param("id");
  const body = await c.req.json();
  const { note, sentiment, source } = body;

  if (!note) return c.json({ error: "note is required" }, 400);

  const inserted = await db
    .insert(employerNotes)
    .values({
      employerId,
      userId: user.id,
      note,
      sentiment,
      source,
    })
    .returning();

  return c.json(inserted[0], 201);
});

researchRouter.post("/role", async (c) => {
  const body = await c.req.json();
  const { title, company } = body;
  if (!title) return c.json({ error: "title is required" }, 400);

  const client = getResearchClient();
  if (!client) return c.json({ error: "Perplexity API key not configured" }, 503);

  const result = await researchRole(client, title, company);
  return c.json(result);
});

export default researchRouter;
