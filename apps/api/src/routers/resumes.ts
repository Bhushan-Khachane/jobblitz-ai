import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { schema } from "@jobblitz/db";
import { authMiddleware } from "../middleware/auth";

const { resumes } = schema;

const resumesRouter = new Hono();

resumesRouter.use("/*", authMiddleware);

resumesRouter.get("/", async (c) => {
  const user = c.get("user");
  const result = await db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, user.id))
    .orderBy(desc(resumes.createdAt));
  return c.json(result);
});

resumesRouter.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { title, filePath, fileKey, parsedText, isDefault } = body;

  if (!title || !filePath) {
    return c.json({ error: "title and filePath are required" }, 400);
  }

  if (isDefault) {
    await db.update(resumes).set({ isDefault: false }).where(eq(resumes.userId, user.id));
  }

  const inserted = await db
    .insert(resumes)
    .values({
      userId: user.id,
      title,
      filePath,
      fileKey,
      parsedText,
      isDefault: isDefault || false,
    })
    .returning();

  return c.json(inserted[0], 201);
});

resumesRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const [resume] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)))
    .limit(1);
  if (!resume) return c.json({ error: "Not found" }, 404);
  return c.json(resume);
});

resumesRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();

  const [existing] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)))
    .limit(1);
  if (!existing) return c.json({ error: "Not found" }, 404);

  if (body.isDefault) {
    await db.update(resumes).set({ isDefault: false }).where(eq(resumes.userId, user.id));
  }

  const updated = await db
    .update(resumes)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(resumes.id, id))
    .returning();
  return c.json(updated[0]);
});

resumesRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await db.delete(resumes).where(and(eq(resumes.id, id), eq(resumes.userId, user.id)));
  return c.json({ success: true });
});

resumesRouter.post("/:id/parse", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [resume] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, user.id)))
    .limit(1);
  if (!resume) return c.json({ error: "Not found" }, 404);

  if (!resume.parsedText) {
    return c.json({ error: "Resume has no parsed text. Upload and parse first." }, 400);
  }

  const { enqueueProfileIngestion } = await import("../queue");
  await enqueueProfileIngestion({
    userId: user.id,
    resumeText: resume.parsedText,
    source: "upload",
  });

  return c.json({ success: true, enqueued: true });
});

export default resumesRouter;
