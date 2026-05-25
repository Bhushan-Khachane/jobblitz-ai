import { eq, and, sql, cosineDistance, asc } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import type { EmbeddingClient } from "./embeddings";

const { embeddings, jobs } = schema;

function buildJobText(job: typeof jobs.$inferSelect): string {
  const parts = [
    job.title,
    job.company,
    job.location,
    job.description,
    ...(job.skillsRequired || []),
    job.experienceLevel,
    job.jobType,
    job.remotePolicy,
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  return parts.join("\n");
}

function buildProfileText(profile: typeof schema.profiles.$inferSelect): string {
  const parts = [
    profile.headline,
    profile.summary,
    ...(profile.skills || []),
    ...(profile.preferredJobTitles || []),
    ...(profile.preferredLocations || []),
    profile.jobType,
    profile.workMode,
  ].filter((p): p is string => typeof p === "string" && p.length > 0);
  return parts.join("\n");
}

export async function upsertJobEmbedding(
  db: DatabaseClient,
  embedder: EmbeddingClient,
  job: typeof jobs.$inferSelect
): Promise<void> {
  const text = buildJobText(job);
  const vectors = await embedder.embed([text]);
  const vector = vectors[0];
  if (!vector) throw new Error("Embedding failed for job " + job.id);

  // Delete any previous embeddings for this job
  await db
    .delete(embeddings)
    .where(and(eq(embeddings.entityType, "job"), eq(embeddings.entityId, job.id)));

  await db.insert(embeddings).values({
    entityType: "job",
    entityId: job.id,
    content: text,
    embedding: vector,
    metadata: {
      title: job.title,
      company: job.company,
      platform: job.platform,
      location: job.location,
    } as Record<string, unknown>,
  });
}

export async function upsertProfileEmbedding(
  db: DatabaseClient,
  embedder: EmbeddingClient,
  profile: typeof schema.profiles.$inferSelect
): Promise<void> {
  const text = buildProfileText(profile);
  const vectors = await embedder.embed([text]);
  const vector = vectors[0];
  if (!vector) throw new Error("Embedding failed for profile " + profile.id);

  await db
    .delete(embeddings)
    .where(and(eq(embeddings.entityType, "profile"), eq(embeddings.entityId, profile.id)));

  await db.insert(embeddings).values({
    entityType: "profile",
    entityId: profile.id,
    content: text,
    embedding: vector,
    metadata: {
      userId: profile.userId,
      headline: profile.headline,
    } as Record<string, unknown>,
  });
}

export interface SemanticJobResult {
  id: string;
  entityId: string;
  content: string;
  similarity: number;
  metadata?: Record<string, unknown> | undefined;
  job?: typeof jobs.$inferSelect | undefined;
}

export async function findSimilarJobs(
  db: DatabaseClient,
  embedder: EmbeddingClient,
  query: string,
  options?: { userId?: string; limit?: number; minSimilarity?: number }
): Promise<SemanticJobResult[]> {
  const vectors = await embedder.embed([query]);
  const vector = vectors[0];
  if (!vector) throw new Error("Query embedding failed");

  const rawLimit = (options?.limit ?? 10) * 3;

  const rows = await db
    .select({
      id: embeddings.id,
      entityId: embeddings.entityId,
      content: embeddings.content,
      similarity: sql<number>`1 - (${cosineDistance(embeddings.embedding, vector)})`,
      metadata: embeddings.metadata,
      job: jobs,
    })
    .from(embeddings)
    .innerJoin(jobs, eq(embeddings.entityId, jobs.id))
    .where(
      and(
        eq(embeddings.entityType, "job"),
        options?.userId ? eq(jobs.userId, options.userId) : undefined
      )
    )
    .orderBy(asc(cosineDistance(embeddings.embedding, vector)))
    .limit(rawLimit);

  const minSim = options?.minSimilarity ?? 0;
  const filtered = rows
    .filter((r) => Number(r.similarity) >= minSim)
    .slice(0, options?.limit ?? 10);

  return filtered.map((r) => ({
    id: r.id,
    entityId: r.entityId,
    content: r.content,
    similarity: Number(r.similarity),
    metadata: r.metadata as Record<string, unknown> | undefined,
    job: r.job,
  }));
}

export async function findJobsMatchingProfile(
  db: DatabaseClient,
  embedder: EmbeddingClient,
  profile: typeof schema.profiles.$inferSelect,
  options?: { limit?: number; minSimilarity?: number }
): Promise<SemanticJobResult[]> {
  const text = buildProfileText(profile);
  return findSimilarJobs(db, embedder, text, {
    userId: profile.userId,
    limit: options?.limit ?? 10,
    minSimilarity: options?.minSimilarity ?? 0.6,
  });
}
