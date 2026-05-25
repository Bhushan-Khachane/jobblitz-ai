import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createDatabaseClient, schema } from "@jobblitz/db";
import { eq } from "drizzle-orm";
import {
  createEmbeddingClient,
  upsertJobEmbedding,
  findSimilarJobs,
  findJobsMatchingProfile,
} from "@jobblitz/memory";
import { createApplicationGraph } from "@jobblitz/agents";
import { applicationQueue } from "../src/queue";

const db = createDatabaseClient(process.env.DATABASE_URL!);
const embedder = createEmbeddingClient();

// Mock Stagehand browser automation so tests never launch a real browser
vi.mock("@jobblitz/browser", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@jobblitz/browser")>();
  return {
    ...mod,
    createStagehandSession: vi.fn(async () => ({
      stagehand: {
        observe: vi.fn(async (instruction: string) => {
          if (instruction.toLowerCase().includes("form field")) {
            return [
              { description: "first name", selector: "#first-name" },
              { description: "last name", selector: "#last-name" },
              { description: "email", selector: "#email" },
              { description: "phone", selector: "#phone" },
            ];
          }
          if (instruction.toLowerCase().includes("cover letter")) {
            return [{ description: "cover letter", selector: "#cover" }];
          }
          return [];
        }),
        act: vi.fn(async () => ({})),
        extract: vi.fn(async () => ({
          confirmed: true,
          message: "TEST-APP-123",
        })),
      },
      page: {
        goto: vi.fn(async () => ({}) as never),
        waitForTimeout: vi.fn(async () => {}),
        screenshot: vi.fn(async () => {}),
        locator: vi.fn(() => ({
          count: vi.fn(async () => 0),
          first: vi.fn(() => ({
            setInputFiles: vi.fn(async () => {}),
          })),
        })),
      },
      cleanup: vi.fn(async () => {}),
    })),
  };
});

async function pgAvailable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

import { sql } from "drizzle-orm";

async function redisAvailable(): Promise<boolean> {
  try {
    const testQueue = new (await import("bullmq")).Queue("test-ping", {
      connection: { host: "localhost", port: 6379, maxRetriesPerRequest: 1 },
    });
    await testQueue.close();
    return true;
  } catch {
    return false;
  }
}

describe("E2E Pipeline — Semantic Job Memory", () => {
  let userId: string;
  let jobId: string;

  beforeAll(async () => {
    if (!(await pgAvailable())) return;

    const [user] = await db
      .insert(schema.users)
      .values({
        email: `e2e-memory-${Date.now()}@test.com`,
        hashedPassword: "test",
        fullName: "Memory Test",
        applicationMode: "auto",
      } as never)
      .returning();
    userId = user.id;

    const [job] = await db
      .insert(schema.jobs)
      .values({
        userId,
        platform: "linkedin",
        title: "Senior LangGraph Engineer",
        company: "AI Startup",
        description: "Design and build autonomous agent graphs using LangChain and LangGraph.",
        skillsRequired: ["LangGraph", "LangChain", "TypeScript", "Node.js"],
        applyUrl: "https://boards.greenhouse.io/ai-startup/jobs/999",
      } as never)
      .returning();
    jobId = job.id;
  });

  afterAll(async () => {
    if (!userId) return;
    await db.delete(schema.embeddings).where(eq(schema.embeddings.entityId, jobId));
    await db.delete(schema.jobs).where(eq(schema.jobs.id, jobId));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("embeds a job and finds it via semantic search", async () => {
    if (!(await pgAvailable())) return;

    const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1);
    if (!job) throw new Error("Job not found");

    await upsertJobEmbedding(db, embedder, job);

    const results = await findSimilarJobs(db, embedder, "autonomous agent graphs with LangChain", {
      userId,
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entityId).toBe(jobId);
    expect(results[0].similarity).toBeGreaterThan(0);
  });

  it("finds jobs matching a user profile", async () => {
    if (!(await pgAvailable())) return;

    const [profile] = await db
      .insert(schema.profiles)
      .values({
        userId,
        headline: "Agent Engineer",
        summary: "I build AI agents with LangGraph and TypeScript.",
        skills: ["LangGraph", "TypeScript", "Node.js"],
        preferredJobTitles: ["Senior Engineer", "Agent Developer"],
        preferredLocations: ["Remote"],
      } as never)
      .returning();

    await upsertJobEmbedding(
      db,
      embedder,
      (await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1))[0]
    );

    const matches = await findJobsMatchingProfile(db, embedder, profile, { limit: 5 });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].entityId).toBe(jobId);

    await db.delete(schema.embeddings).where(eq(schema.embeddings.entityId, profile.id));
    await db.delete(schema.profiles).where(eq(schema.profiles.id, profile.id));
  });
});

describe("E2E Pipeline — LangGraph Application Graph", () => {
  let userId: string;
  let jobId: string;
  let applicationId: string;

  beforeAll(async () => {
    if (!(await pgAvailable())) return;

    const [user] = await db
      .insert(schema.users)
      .values({
        email: `e2e-graph-${Date.now()}@test.com`,
        hashedPassword: "test",
        fullName: "Graph Test",
        applicationMode: "auto",
        phone: "+1-555-0199",
      } as never)
      .returning();
    userId = user.id;

    const [job] = await db
      .insert(schema.jobs)
      .values({
        userId,
        platform: "greenhouse",
        title: "Backend Engineer",
        company: "TestCorp",
        description: "Build APIs",
        skillsRequired: ["Node.js"],
        applyUrl: "https://boards.greenhouse.io/testcorp/jobs/1",
      } as never)
      .returning();
    jobId = job.id;
  });

  afterAll(async () => {
    if (!userId) return;
    if (applicationId) {
      await db.delete(schema.applications).where(eq(schema.applications.id, applicationId));
    }
    await db.delete(schema.jobs).where(eq(schema.jobs.id, jobId));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("runs the full application graph end-to-end", async () => {
    if (!(await pgAvailable())) return;

    const graph = await createApplicationGraph({ db });

    const state = {
      userId,
      jobId,
      jobUrl: "https://boards.greenhouse.io/testcorp/jobs/1",
      payload: {
        firstName: "Graph",
        lastName: "Test",
        email: "e2e-graph@test.com",
        phone: "+1-555-0199",
      },
    };

    const result = await graph.invoke(state, {
      configurable: { thread_id: `e2e-test-${Date.now()}` },
    });

    expect(result.browserResult).toBeDefined();
    expect(result.browserResult?.success).toBe(true);
    expect(result.browserResult?.confirmationId).toBe("TEST-APP-123");
    expect(result.step).toBe("completed");
  });

  it("persists application results to the database", async () => {
    if (!(await pgAvailable())) return;

    const [app] = await db
      .insert(schema.applications)
      .values({
        userId,
        jobId,
        status: "pending",
      } as never)
      .returning();
    applicationId = app.id;

    const graph = await createApplicationGraph({ db });

    await graph.invoke(
      {
        userId,
        jobId,
        applicationId,
        jobUrl: "https://boards.greenhouse.io/testcorp/jobs/1",
        payload: {
          firstName: "Persist",
          lastName: "Test",
          email: "persist@test.com",
          phone: "+1-555-0200",
        },
      },
      { configurable: { thread_id: applicationId } }
    );

    const [updated] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, applicationId))
      .limit(1);

    expect(updated).toBeDefined();
    expect(updated.status).toBe("submitted");
    expect(updated.appliedAt).not.toBeNull();
  });
});

describe("E2E Pipeline — BullMQ Queue", () => {
  it("enqueues and retrieves an application job", async () => {
    if (!(await redisAvailable())) return;

    const jobData = {
      type: "apply" as const,
      userId: "test-user-id",
      jobId: "test-job-id",
      applicationId: `test-app-${Date.now()}`,
    };

    const added = await applicationQueue.add(jobData.type, jobData, {
      jobId: `test-${jobData.applicationId}`,
      removeOnComplete: true,
      removeOnFail: true,
    });

    expect(added).not.toBeNull();
    expect(added.id).toBe(`test-${jobData.applicationId}`);

    const job = await applicationQueue.getJob(`test-${jobData.applicationId}`);
    expect(job).not.toBeNull();
    expect(job?.data.type).toBe("apply");
    expect(job?.data.applicationId).toBe(jobData.applicationId);

    await job?.remove();
  });
});
