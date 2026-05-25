import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  version: z.string(),
  db: z.enum(["ok", "unreachable"]).optional(),
  redis: z.enum(["ok", "unreachable"]).optional(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
