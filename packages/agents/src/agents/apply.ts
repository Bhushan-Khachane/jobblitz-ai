import { createApplicationGraph } from "../graphs/application";
import type { ApplicationState } from "../state";
import type { Job } from "@jobblitz/types";
import { checkAndIncrementQuota, getUserPlan } from "@jobblitz/core";

export interface ApplyInput {
  userId: string;
  job: Job;
  resumePath: string;
  coverLetter?: string | undefined;
}

export async function applyAgent(input: ApplyInput): Promise<ApplicationState> {
  // Task 4: Quota Enforcement
  const canApply = await checkAndIncrementQuota(input.userId, "apply");
  if (!canApply) {
    return {
      userId: input.userId,
      jobId: input.job.id,
      status: "quota_exceeded",
      error: "Daily apply quota exceeded",
    } as any;
  }

  // Plan-based portal access check
  const plan = await getUserPlan(input.userId);
  if (plan && !plan.portalAccess.includes(input.job.platform)) {
    return {
      userId: input.userId,
      jobId: input.job.id,
      status: "portal_not_in_plan",
      error: `Portal ${input.job.platform} is not included in your ${plan.name} plan`,
    } as any;
  }

  // Score floor check
  if (input.job.matchScore !== null && input.job.matchScore !== undefined && input.job.matchScore < 65) {
    return {
      userId: input.userId,
      jobId: input.job.id,
      status: "score_below_threshold",
      error: `Match score ${input.job.matchScore} is below the required 65% threshold`,
    } as any;
  }

  const graph = await createApplicationGraph();
  const initialState = {
    userId: input.userId,
    jobId: input.job.id,
    jobUrl: input.job.applyUrl,
    resumePath: input.resumePath,
    coverLetter: input.coverLetter,
    payload: {
      firstName: input.job.title,
      lastName: "",
      email: "",
    },
  };

  const result = await graph.invoke(initialState, { configurable: { thread_id: input.job.id } });
  return result as ApplicationState;
}
