import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import { asc, cosineDistance, eq, sql } from "drizzle-orm";
import { embedText } from "./embed";
import type { RedisCache } from "./embed";

const { jobs, jobEmbeddings } = schema;

export interface HybridSearchOptions {
  userId: string;
  queryText: string;
  limit?: number;
  minSimilarity?: number;
}

export interface HybridSearchResult {
  id: string;
  jobId: string;
  title: string;
  company: string;
  semanticScore: number;
  matchScore: number;
  combinedScore: number;
}

const LEGACY_API_URL = process.env.LEGACY_API_URL;

async function fetchLegacyMatchScore(jobId: string): Promise<number | null> {
  if (!LEGACY_API_URL) return null;
  try {
    const res = await fetch(`${LEGACY_API_URL}/jobs/${jobId}/match-score`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { match_score?: number };
    return json.match_score ?? null;
  } catch {
    return null;
  }
}

export async function hybridJobSearch(
  db: DatabaseClient,
  redis: RedisCache,
  options: HybridSearchOptions,
): Promise<HybridSearchResult[]> {
  const { userId, queryText, limit = 10, minSimilarity = 0 } = options;

  const vector = await embedText(queryText, redis);

  const rawLimit = limit * 3;

  const rows = await db
    .select({
      id: jobEmbeddings.id,
      jobId: jobEmbeddings.jobId,
      title: jobs.title,
      company: jobs.company,
      similarity: sql<number>`1 - (${cosineDistance(jobEmbeddings.embedding, vector)})`,
      matchScore: jobs.matchScore,
    })
    .from(jobEmbeddings)
    .innerJoin(jobs, eq(jobEmbeddings.jobId, jobs.id))
    .where(eq(jobs.userId, userId))
    .orderBy(asc(cosineDistance(jobEmbeddings.embedding, vector)))
    .limit(rawLimit);

  const results: HybridSearchResult[] = [];

  for (const row of rows) {
    const semanticScore = Number(row.similarity);
    if (semanticScore < minSimilarity) continue;

    let matchScore = row.matchScore ? Number(row.matchScore) / 100 : 0;

    const legacy = await fetchLegacyMatchScore(row.jobId);
    if (legacy !== null) {
      matchScore = legacy / 100;
    }

    const combinedScore = semanticScore * 0.6 + matchScore * 0.4;

    results.push({
      id: row.id,
      jobId: row.jobId,
      title: row.title,
      company: row.company,
      semanticScore,
      matchScore,
      combinedScore,
    });
  }

  results.sort((a, b) => b.combinedScore - a.combinedScore);
  return results.slice(0, limit);
}
