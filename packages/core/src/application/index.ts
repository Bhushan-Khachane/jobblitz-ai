import { eq, and, desc, count } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";

type ApplicationStatus =
  | "pending"
  | "approved"
  | "submitted"
  | "failed"
  | "interview"
  | "rejected"
  | "accepted"
  | "withdrawn"
  | "skipped";

const ALLOWED_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  pending: ["approved", "skipped", "withdrawn"],
  approved: ["submitted", "failed", "withdrawn"],
  submitted: ["interview", "rejected", "accepted", "failed"],
  failed: ["pending", "withdrawn"],
  interview: ["rejected", "accepted", "withdrawn"],
  rejected: ["withdrawn"],
  accepted: ["withdrawn"],
  withdrawn: ["pending"],
  skipped: ["pending"],
};

export class ApplicationService {
  constructor(private db: DatabaseClient) {}

  async createApplication(userId: string, jobId: string, resumeId?: string) {
    const [row] = await this.db
      .insert(schema.applications)
      .values({
        userId,
        jobId,
        resumeId: resumeId ?? null,
        status: "pending",
      })
      .returning();
    return row;
  }

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    updates?: Partial<typeof schema.applications.$inferInsert>
  ) {
    const [existing] = await this.db
      .select({ status: schema.applications.status })
      .from(schema.applications)
      .where(eq(schema.applications.id, id))
      .limit(1);

    if (!existing) throw new Error(`Application not found: ${id}`);

    const current = existing.status as string;
    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(status)) {
      throw new Error(`Invalid status transition: ${current} → ${status}`);
    }

    const patch: Record<string, unknown> = { status, updatedAt: new Date() };
    if (updates) {
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) patch[k] = v;
      }
    }
    if (status === "submitted") {
      patch.appliedAt = new Date();
    }

    const [row] = await this.db
      .update(schema.applications)
      .set(patch as never)
      .where(eq(schema.applications.id, id))
      .returning();
    return row;
  }

  async getApplication(id: string) {
    const [row] = await this.db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.id, id))
      .limit(1);
    if (!row) return null;
    const [job] = await this.db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, row.jobId))
      .limit(1);
    return { ...row, job: job ?? null };
  }

  async listByUser(
    userId: string,
    status?: ApplicationStatus,
    limit = 20,
    offset = 0
  ) {
    let conditions = eq(schema.applications.userId, userId) as ReturnType<typeof and>;
    if (status) {
      conditions = and(eq(schema.applications.userId, userId), eq(schema.applications.status, status));
    }
    return this.db
      .select()
      .from(schema.applications)
      .where(conditions as never)
      .orderBy(desc(schema.applications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async listByStatus(status: ApplicationStatus, limit = 100) {
    return this.db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.status, status))
      .orderBy(desc(schema.applications.createdAt))
      .limit(limit);
  }

  async countByUser(userId: string, status?: ApplicationStatus) {
    let conditions = eq(schema.applications.userId, userId) as ReturnType<typeof and>;
    if (status) {
      conditions = and(eq(schema.applications.userId, userId), eq(schema.applications.status, status));
    }
    const [row] = await this.db
      .select({ total: count() })
      .from(schema.applications)
      .where(conditions as never);
    return row?.total ?? 0;
  }
}

export function createApplicationService(db: DatabaseClient): ApplicationService {
  return new ApplicationService(db);
}
