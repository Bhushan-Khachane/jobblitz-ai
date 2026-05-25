import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import { eq } from "drizzle-orm";
import { embedText } from "./embed";
import type { RedisCache } from "./embed";
import { truncateToTokens } from "./summarize";

const { jobEmbeddings, userSkillEmbeddings, profiles } = schema;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function indexJob(
  jobId: string,
  jdText: string,
  db: DatabaseClient,
  redis: RedisCache,
): Promise<void> {
  const cleaned = stripHtml(jdText);
  const truncated = truncateToTokens(cleaned, 8000);
  const vector = await embedText(truncated, redis);

  await db.delete(jobEmbeddings).where(eq(jobEmbeddings.jobId, jobId));

  await db.insert(jobEmbeddings).values({
    jobId,
    embedding: vector,
  });
}

export async function indexUserProfile(
  userId: string,
  profile: typeof profiles.$inferSelect,
  db: DatabaseClient,
  redis: RedisCache,
): Promise<void> {
  const parts = [
    profile.headline,
    profile.summary,
    ...(profile.skills || []),
    profile.jobType,
    profile.workMode,
  ].filter((p): p is string => typeof p === "string" && p.length > 0);

  const skillText = truncateToTokens(parts.join("\n"), 8000);
  const vector = await embedText(skillText, redis);

  await db
    .delete(userSkillEmbeddings)
    .where(eq(userSkillEmbeddings.userId, userId));

  await db.insert(userSkillEmbeddings).values({
    userId,
    skillText,
    embedding: vector,
  });
}
