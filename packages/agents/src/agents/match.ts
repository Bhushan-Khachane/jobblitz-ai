import { scoringGraph } from "../graphs/scoring";
import type { ScoringState } from "../state";
import type { Job, Profile } from "@jobblitz/types";

export interface MatchInput {
  userId: string;
  job: Job;
  profile: Profile;
}

export async function matchAgent(input: MatchInput): Promise<ScoringState> {
  const initialState: ScoringState = {
    userId: input.userId,
    job: input.job,
    profile: input.profile,
  };

  return scoringGraph.invoke(initialState);
}
