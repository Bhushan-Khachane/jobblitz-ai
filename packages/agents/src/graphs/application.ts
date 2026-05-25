import { Annotation, END, START, StateGraph, interrupt } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { detectAts, type ApplyPayload, createStagehandSession } from "@jobblitz/browser";
import { createDatabaseClient, schema } from "@jobblitz/db";
import type { DatabaseClient } from "@jobblitz/db";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

// ── State ───────────────────────────────────────────────────────────────────

const ApplicationStateAnnotation = Annotation.Root({
  userId: Annotation<string>,
  jobId: Annotation<string>,
  applicationId: Annotation<string | undefined>,
  jobUrl: Annotation<string | undefined>,
  atsType: Annotation<string | undefined>,
  resumePath: Annotation<string | undefined>,
  payload: Annotation<ApplyPayload | undefined>,
  browserResult: Annotation<
    | {
        success: boolean;
        confirmationId?: string | undefined;
        screenshot?: string | undefined;
        error?: string | undefined;
      }
    | undefined
  >,
  step: Annotation<string | undefined>,
  retryCount: Annotation<number>({ default: () => 0, value: (_a, b) => b }),
  humanApprovalRequired: Annotation<boolean>({ default: () => false, value: (_a, b) => b }),
  approvedAt: Annotation<string | undefined>,
});

type ApplicationState = typeof ApplicationStateAnnotation.State;

// ── Config ──────────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function getRedis(): Redis {
  if (!(globalThis as Record<string, unknown>)._jobblitzRedis) {
    (globalThis as Record<string, unknown>)._jobblitzRedis = new Redis(REDIS_URL);
  }
  return (globalThis as Record<string, unknown>)._jobblitzRedis as Redis;
}

// ── Graph builder ───────────────────────────────────────────────────────────

export interface ApplicationGraphConfig {
  databaseUrl?: string;
  db?: DatabaseClient;
}

export async function createApplicationGraph(config?: ApplicationGraphConfig) {
  const dbUrl = config?.databaseUrl || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is required for PostgresSaver");
  }

  const db = config?.db || createDatabaseClient(dbUrl);
  const checkpointer = PostgresSaver.fromConnString(dbUrl);
  await checkpointer.setup();

  // ── Nodes ─────────────────────────────────────────────────────────────────

  async function detectAtsNode(state: ApplicationState): Promise<Partial<ApplicationState>> {
    const adapter = state.jobUrl ? detectAts(state.jobUrl) : undefined;
    return {
      atsType: adapter?.name || "unknown",
      step: "detect_ats",
    };
  }

  async function checkApprovalRequiredNode(
    state: ApplicationState
  ): Promise<Partial<ApplicationState>> {
    if ((state.retryCount || 0) > 0) {
      return { humanApprovalRequired: false, step: "verify" };
    }

    try {
      const [user] = await db
        .select({ applicationMode: schema.users.applicationMode })
        .from(schema.users)
        .where(eq(schema.users.id, state.userId))
        .limit(1);
      const needsApproval = user?.applicationMode === "assisted";
      return { humanApprovalRequired: needsApproval, step: "verify" };
    } catch {
      return { humanApprovalRequired: true, step: "verify" };
    }
  }

  async function waitForHumanApprovalNode(
    state: ApplicationState
  ): Promise<Partial<ApplicationState>> {
    const redis = getRedis();
    await redis.publish(
      "jobblitz:approvals",
      JSON.stringify({
        type: "awaiting_approval",
        jobId: state.jobId,
        userId: state.userId,
        applicationId: state.applicationId,
      })
    );

    const resume = interrupt({ type: "awaiting_approval", jobId: state.jobId, userId: state.userId });
    const approved = (resume as Record<string, unknown>)?.approved === true;
    return {
      humanApprovalRequired: false,
      approvedAt: approved ? new Date().toISOString() : undefined,
      step: "apply",
    };
  }

  async function executeApplicationNode(
    state: ApplicationState
  ): Promise<Partial<ApplicationState>> {
    const adapter = state.jobUrl ? detectAts(state.jobUrl) : undefined;
    if (!adapter || !state.payload) {
      return {
        browserResult: { success: false, error: "No ATS adapter or payload available" },
        step: "apply",
      };
    }

    let screenshotPath: string | undefined;
    let session;

    try {
      session = await createStagehandSession({
        headless: process.env.HEADLESS !== "false",
      });

      await session.page.goto(state.jobUrl!, { waitUntil: "domcontentloaded", timeoutMs: 30000 });
      await session.page.waitForTimeout(2000);

      const result = await adapter.apply(session.stagehand, session.page, state.payload);

      if (result.screenshotPath) {
        screenshotPath = result.screenshotPath;
      } else if (result.success) {
        const ts = Date.now();
        screenshotPath = `/tmp/screenshots/${state.userId}_${state.jobId}_${ts}.png`;
        await session.page.screenshot({ path: screenshotPath, fullPage: true });
      }

      return {
        browserResult: {
          success: result.success,
          confirmationId: result.confirmationId,
          screenshot: screenshotPath,
          error: result.error,
        },
        step: "apply",
      };
    } catch (err) {
      return {
        browserResult: {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        },
        step: "apply",
      };
    } finally {
      if (session) await session.cleanup().catch(() => null);
    }
  }

  async function handleRetryNode(state: ApplicationState): Promise<Partial<ApplicationState>> {
    const retries = state.retryCount || 0;
    const success = state.browserResult?.success ?? false;
    if (!success && retries < 2) {
      return { retryCount: retries + 1, step: "apply" };
    }
    return { step: "notify" };
  }

  async function notifyResultNode(state: ApplicationState): Promise<Partial<ApplicationState>> {
    const redis = getRedis();
    await redis.publish(
      `jobblitz:notifications:${state.userId}`,
      JSON.stringify({
        userId: state.userId,
        jobId: state.jobId,
        applicationId: state.applicationId,
        success: state.browserResult?.success ?? false,
        confirmationId: state.browserResult?.confirmationId,
        screenshot: state.browserResult?.screenshot,
      })
    );
    return { step: "completed" };
  }

  async function persistResultNode(state: ApplicationState): Promise<Partial<ApplicationState>> {
    if (!state.applicationId) return { step: "completed" };

    const success = state.browserResult?.success ?? false;
    try {
      await db
        .update(schema.applications)
        .set({
          status: success ? "submitted" : "failed",
          errorMessage: state.browserResult?.error || null,
          screenshotPath: state.browserResult?.screenshot || null,
          appliedAt: success ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(schema.applications.id, state.applicationId));
    } catch {
      // Best-effort persistence; notification already sent
    }
    return { step: "completed" };
  }

  // ── Routing ─────────────────────────────────────────────────────────────────

  function routeAfterApproval(state: ApplicationState): string {
    return state.humanApprovalRequired ? "waitForHumanApproval" : "executeApplication";
  }

  function routeAfterRetry(state: ApplicationState): string {
    const retries = state.retryCount || 0;
    const success = state.browserResult?.success ?? false;
    if (!success && retries < 2) {
      return "executeApplication";
    }
    return "notifyResult";
  }

  // ── Compile ───────────────────────────────────────────────────────────────

  const graph = new StateGraph(ApplicationStateAnnotation)
    .addNode("detectAts", detectAtsNode)
    .addNode("checkApprovalRequired", checkApprovalRequiredNode)
    .addNode("waitForHumanApproval", waitForHumanApprovalNode)
    .addNode("executeApplication", executeApplicationNode)
    .addNode("handleRetry", handleRetryNode)
    .addNode("notifyResult", notifyResultNode)
    .addNode("persistResult", persistResultNode)
    .addEdge(START, "detectAts")
    .addEdge("detectAts", "checkApprovalRequired")
    .addConditionalEdges("checkApprovalRequired", routeAfterApproval, [
      "waitForHumanApproval",
      "executeApplication",
    ])
    .addEdge("waitForHumanApproval", "executeApplication")
    .addEdge("executeApplication", "handleRetry")
    .addConditionalEdges("handleRetry", routeAfterRetry, ["executeApplication", "notifyResult"])
    .addEdge("notifyResult", "persistResult")
    .addEdge("persistResult", END)
    .compile({ checkpointer });

  return graph;
}

// Re-export for index.ts compatibility
export { createApplicationGraph as applicationGraph };
