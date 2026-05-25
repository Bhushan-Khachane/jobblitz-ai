export interface LangfuseConfig {
  publicKey?: string | undefined;
  secretKey?: string | undefined;
  baseUrl?: string | undefined;
}

export class LangfuseClient {
  private config: LangfuseConfig;

  constructor(config: LangfuseConfig) {
    this.config = config;
  }

  async trace(payload: { name: string; userId?: string; metadata?: Record<string, unknown> }) {
    if (!this.config.publicKey) return;
    console.log(JSON.stringify({ event: "langfuse_trace", ...payload }));
  }

  async generation(payload: { name: string; model?: string; prompt?: string; completion?: string }) {
    if (!this.config.publicKey) return;
    console.log(JSON.stringify({ event: "langfuse_generation", ...payload }));
  }

  async score(payload: { traceId: string; name: string; value: number }) {
    if (!this.config.publicKey) return;
    console.log(JSON.stringify({ event: "langfuse_score", ...payload }));
  }
}

export function createLangfuseClient(): LangfuseClient {
  return new LangfuseClient({
    publicKey: typeof process !== "undefined" ? process.env.LANGFUSE_PUBLIC_KEY : undefined,
    secretKey: typeof process !== "undefined" ? process.env.LANGFUSE_SECRET_KEY : undefined,
    baseUrl: typeof process !== "undefined" ? process.env.LANGFUSE_BASE_URL : undefined,
  });
}
