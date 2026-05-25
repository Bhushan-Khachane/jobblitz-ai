import { createApplicationGraph } from "../graphs/application";
import type { ApplicationState } from "../state";
import type { Job } from "@jobblitz/types";

export interface ApplyInput {
  userId: string;
  job: Job;
  resumePath: string;
  coverLetter?: string | undefined;
}

export async function applyAgent(input: ApplyInput): Promise<ApplicationState> {
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
