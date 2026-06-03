import type Redis from "ioredis";

const KEY_PREFIX = "jb:";

export class CacheService {
  constructor(private redis: Redis) {}

  private key(k: string): string {
    return `${KEY_PREFIX}${k}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(this.key(key));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error("[cache] get error:", err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const raw = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis.setex(this.key(key), ttlSeconds, raw);
      } else {
        await this.redis.set(this.key(key), raw);
      }
    } catch (err) {
      console.error("[cache] set error:", err instanceof Error ? err.message : String(err));
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(this.key(key));
    } catch (err) {
      console.error("[cache] del error:", err instanceof Error ? err.message : String(err));
    }
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      const raw = await this.redis.hget(this.key(key), field);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error("[cache] hget error:", err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  async hset<T>(key: string, field: string, value: T): Promise<void> {
    try {
      await this.redis.hset(this.key(key), field, JSON.stringify(value));
    } catch (err) {
      console.error("[cache] hset error:", err instanceof Error ? err.message : String(err));
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    try {
      const raw = await this.redis.hgetall(this.key(key));
      if (!raw || Object.keys(raw).length === 0) return null;
      const out: Record<string, T> = {};
      for (const [k, v] of Object.entries(raw as Record<string, string>)) {
        out[k] = JSON.parse(v) as T;
      }
      return out;
    } catch (err) {
      console.error("[cache] hgetall error:", err instanceof Error ? err.message : String(err));
      return null;
    }
  }
}

export function createCacheService(redis: Redis): CacheService {
  return new CacheService(redis);
}
