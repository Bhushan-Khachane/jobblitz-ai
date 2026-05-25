import { eq, sql, cosineDistance, asc } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import type { EmbeddingClient } from "./embeddings";

const { embeddings } = schema;

export interface SemanticSearchResult {
  id: string;
  entityType: string;
  entityId: string;
  content: string;
  similarity: number;
  metadata?: Record<string, unknown> | undefined;
}

export async function semanticSearch(
  db: DatabaseClient,
  embedder: EmbeddingClient,
  query: string,
  filters?: { entityType?: string; limit?: number }
): Promise<SemanticSearchResult[]> {
  const vectors = await embedder.embed([query]);
  const vector = vectors[0];
  if (!vector) throw new Error("Embedding failed");

  const limit = filters?.limit ?? 10;

  let queryBuilder = db
    .select({
      id: embeddings.id,
      entityType: embeddings.entityType,
      entityId: embeddings.entityId,
      content: embeddings.content,
      similarity: sql<number>`1 - (${cosineDistance(embeddings.embedding, vector)})`,
      metadata: embeddings.metadata,
    })
    .from(embeddings)
    .orderBy(asc(cosineDistance(embeddings.embedding, vector)))
    .limit(limit);

  if (filters?.entityType) {
    queryBuilder = queryBuilder.where(eq(embeddings.entityType, filters.entityType)) as typeof queryBuilder;
  }

  const results = await queryBuilder;

  return results.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    content: r.content,
    similarity: Number(r.similarity),
    metadata: r.metadata as Record<string, unknown> | undefined,
  }));
}

export async function storeEmbedding(
  db: DatabaseClient,
  entityType: string,
  entityId: string,
  content: string,
  vector: number[],
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(embeddings).values({
    entityType,
    entityId,
    content,
    embedding: vector,
    metadata: metadata as never,
  });
}
