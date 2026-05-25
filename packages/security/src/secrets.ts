import { z } from "zod";

const secretsSchema = z.object({
  DATABASE_URL: z.string().url().min(1),
  REDIS_URL: z.string().url().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  API_URL: z.string().url().optional(),
  WEB_URL: z.string().url().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type Secrets = z.infer<typeof secretsSchema>;

export function validateSecrets(env: Record<string, string | undefined>): Secrets {
  const result = secretsSchema.safeParse(env);
  if (!result.success) {
    const missing = result.error.errors.map((e) => e.path.join(".")).join(", ");
    throw new Error(`Missing or invalid secrets: ${missing}`);
  }
  return result.data;
}

export function validateAtStartup() {
  try {
    validateSecrets(process.env);
    console.log("[secrets] All required secrets validated successfully");
  } catch (err) {
    console.error("[secrets] Validation failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
