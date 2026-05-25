import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import { eq } from "drizzle-orm";

const { agentRuns } = schema;

export interface Checkpoint {
  runId: string;
  state: Record<string, unknown>;
  node: string;
  createdAt: string;
}

export async function saveCheckpoint(
  db: DatabaseClient,
  runId: string,
  node: string,
  state: Record<string, unknown>
): Promise<void> {
  await db.insert(agentRuns).values({
    id: runId,
    agentName: node,
    stateJson: state as never,
    status: "running",
  }).onConflictDoUpdate({
    target: agentRuns.id,
    set: { stateJson: state as never, completedAt: new Date() },
  });
}

export async function loadCheckpoint(db: DatabaseClient, runId: string): Promise<Checkpoint | undefined> {
  const [row] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1);
  if (!row) return undefined;
  return {
    runId: row.id,
    state: (row.stateJson as Record<string, unknown>) || {},
    node: row.agentName,
    createdAt: row.startedAt.toISOString(),
  };
}
