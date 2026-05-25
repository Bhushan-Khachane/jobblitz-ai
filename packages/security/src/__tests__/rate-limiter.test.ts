import { describe, it, expect } from "vitest";
import { applicationRateLimit, llmRateLimit } from "../rate-limiter";

describe("rate-limiter", () => {
  it("blocks the 16th application", async () => {
    const getDailyLimit = async () => 15;
    const getTodayCount = async () => 15;

    const result = await applicationRateLimit("user-1", getDailyLimit, getTodayCount);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("allows when under limit", async () => {
    const getDailyLimit = async () => 15;
    const getTodayCount = async () => 5;

    const result = await applicationRateLimit("user-1", getDailyLimit, getTodayCount);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(10);
  });

  it("tracks LLM calls via Redis sliding window", async () => {
    const store = new Map<string, Array<{ score: number; member: string }>>();

    const redis = {
      zadd: async (key: string, ...args: unknown[]) => {
        const score = args[0] as number;
        const member = args[1] as string;
        const entries = store.get(key) || [];
        entries.push({ score, member });
        store.set(key, entries);
      },
      zcount: async (key: string, min: string, max: string) => {
        const entries = store.get(key) || [];
        return entries.filter((e) => e.score >= Number(min) && e.score <= Number(max)).length;
      },
      expire: async () => {},
    };

    // First 99 calls should be allowed
    for (let i = 0; i < 99; i++) {
      const r = await llmRateLimit("user-1", redis);
      expect(r.allowed).toBe(true);
    }

    // 100th call should be blocked (count includes itself)
    const blocked = await llmRateLimit("user-1", redis);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
