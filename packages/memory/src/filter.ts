import { eq, and, gte, lte, like } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";

const { jobs } = schema;

export interface JobFilter {
  status?: string;
  platform?: string;
  minSalary?: number;
  maxSalary?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function filterJobs(db: DatabaseClient, userId: string, filter: JobFilter) {
  let query = db.select().from(jobs).where(eq(jobs.userId, userId)).limit(filter.limit ?? 20).offset(filter.offset ?? 0);

  const conditions = [eq(jobs.userId, userId)];
  if (filter.status) conditions.push(eq(jobs.status, filter.status as never));
  if (filter.platform) conditions.push(eq(jobs.platform, filter.platform));
  if (filter.minSalary) conditions.push(gte(jobs.salaryMinLpa, filter.minSalary));
  if (filter.maxSalary) conditions.push(lte(jobs.salaryMaxLpa, filter.maxSalary));
  if (filter.search) conditions.push(like(jobs.title, `%${filter.search}%`));

  if (conditions.length > 1) {
    query = db.select().from(jobs).where(and(...conditions)).limit(filter.limit ?? 20).offset(filter.offset ?? 0);
  }

  return query;
}
