import { z } from "zod";

export const JobDiscoveredEventSchema = z.object({
  type: z.literal("job.discovered"),
  payload: z.object({
    userId: z.string().uuid(),
    jobId: z.string().uuid(),
    source: z.string(),
    discoveredAt: z.string().datetime(),
  }),
});

export type JobDiscoveredEvent = z.infer<typeof JobDiscoveredEventSchema>;
