import { applicationGraph } from "../graphs/application";
import type { ApplicationState } from "../state";
import type { Job } from "@jobblitz/types";

export interface ApplyInput {
  userId: string;
  job: Job;
  resumePath: string;
  coverLetter?: string;
}

export async function applyAgent(input: ApplyInput): Promise<ApplicationState> {
  const initialState: ApplicationState = {
    userId: input.userId,
    job: input.job,
    resumePath: input.resumePath,
    coverLetter: input.coverLetter,
  };

  return applicationGraph.invoke(initialState);
}
