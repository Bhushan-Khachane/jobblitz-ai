import { eq, gte, and, sql } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";

export interface CostEntry {
  userId?: string | undefined;
  engine: string;
  model: string;
  tokensIn?: number | undefined;
  tokensOut?: number | undefined;
  costUsd?: number | undefined;
  latencyMs?: number | undefined;
  jobId?: string | undefined;
  queueName?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface EngineBreakdown {
  engine: string;
  totalCostUsd: number;
  calls: number;
}

export class CostTrackingService {
  constructor(private db: DatabaseClient) {}

  async log(entry: CostEntry): Promise<void> {
    const costMicro = entry.costUsd ? Math.round(entry.costUsd * 1_000_000) : null;
    await this.db.insert(schema.costLog).values({
      userId: entry.userId,
      engine: entry.engine,
      model: entry.model,
      tokensIn: entry.tokensIn,
      tokensOut: entry.tokensOut,
      costUsd: costMicro,
      latencyMs: entry.latencyMs,
      jobId: entry.jobId,
      queueName: entry.queueName,
      metadata: entry.metadata,
    });
  }

  async dailyBurn(userId?: string): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const conditions = userId
      ? and(gte(schema.costLog.createdAt, since), eq(schema.costLog.userId, userId))
      : gte(schema.costLog.createdAt, since);

    const [row] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${schema.costLog.costUsd}), 0)` })
      .from(schema.costLog)
      .where(conditions);

    return (row?.total ?? 0) / 1_000_000;
  }

  async perEngineBreakdown(
    userId?: string,
    since?: Date
  ): Promise<EngineBreakdown[]> {
    const cutoff = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await this.db
      .select({
        engine: schema.costLog.engine,
        total: sql<number>`COALESCE(SUM(${schema.costLog.costUsd}), 0)`,
        calls: sql<number>`COUNT(*)`,
      })
      .from(schema.costLog)
      .where(
        userId
          ? sql`${schema.costLog.userId} = ${userId} AND ${schema.costLog.createdAt} >= ${cutoff}`
          : sql`${schema.costLog.createdAt} >= ${cutoff}`
      )
      .groupBy(schema.costLog.engine);

    return rows.map((r) => ({
      engine: r.engine,
      totalCostUsd: r.total / 1_000_000,
      calls: r.calls,
    }));
  }

  async monthlyEstimate(userId?: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const conditions = userId
      ? and(gte(schema.costLog.createdAt, startOfMonth), eq(schema.costLog.userId, userId))
      : gte(schema.costLog.createdAt, startOfMonth);

    const [row] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${schema.costLog.costUsd}), 0)` })
      .from(schema.costLog)
      .where(conditions);

    const spent = (row?.total ?? 0) / 1_000_000;
    const daysPassed = Math.max(1, new Date().getDate());
    const daysInMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate();
    return Math.round((spent / daysPassed) * daysInMonth * 100) / 100;
  }
}

export function createCostTrackingService(db: DatabaseClient): CostTrackingService {
  return new CostTrackingService(db);
}
