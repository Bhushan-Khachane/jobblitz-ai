import { followupGraph } from "../graphs/followup";
import type { FollowUpState } from "../state";
import type { Application } from "@jobblitz/types";

export interface FollowUpInput {
  userId: string;
  application: Application;
}

export async function followUpAgent(input: FollowUpInput): Promise<FollowUpState> {
  const initialState: FollowUpState = {
    userId: input.userId,
    applicationId: input.application.id,
    application: input.application,
  };

  return followupGraph.invoke(initialState);
}
