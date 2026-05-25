import { createHash } from "node:crypto";
import { createEmbeddingClient } from "./embeddings";
import type { EmbeddingClient } from "./embeddings";

export interface RedisCache {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<unknown>;
}

let _client: EmbeddingClient | null = null;

function getClient(): EmbeddingClient {
  if (!_client) {
    _client = createEmbeddingClient();
  }
  return _client;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function cacheKey(text: string): string {
  return `embed:${sha256(text)}`;
}

export async function embedText(
  text: string,
  redis?: RedisCache,
): Promise<number[]> {
  const key = cacheKey(text);

  if (redis) {
    const cached = await redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as number[];
      } catch {
        // Cache corrupted; fall through to embed + overwrite
      }
    }
  }

  const client = getClient();
  const vectors = await client.embed([text]);
  const vector = vectors[0];
  if (!vector) {
    throw new Error("Embedding failed for text");
  }

  if (redis) {
    await redis.setex(key, 60 * 60 * 24 * 7, JSON.stringify(vector));
  }

  return vector;
}

export function resetEmbedClient(): void {
  _client = null;
}
