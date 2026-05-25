import { StateGraph, START, END } from "../engine";
import type { FollowUpState } from "../state";

function evaluateFollowUpNeed(state: FollowUpState): FollowUpState {
  if (!state.application) {
    return { ...state, error: "No application provided" };
  }
  const status = state.application.status;
  if (status === "submitted") {
    return { ...state, followupType: "check_in", step: "scheduled" };
  }
  if (status === "interview") {
    return { ...state, followupType: "thank_you", step: "scheduled" };
  }
  return { ...state, step: "no_action" };
}

function scheduleFollowUp(state: FollowUpState): FollowUpState {
  if (state.error || state.step === "no_action") return state;
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return {
    ...state,
    scheduledFor: date.toISOString(),
    content: `Follow-up ${state.followupType} for application ${state.applicationId}`,
    step: "scheduled",
  };
}

export const followupGraph = new StateGraph<FollowUpState>()
  .addNode("evaluate", evaluateFollowUpNeed)
  .addNode("schedule", scheduleFollowUp)
  .addEdge(START, "evaluate")
  .addEdge("evaluate", "schedule")
  .addEdge("schedule", END)
  .compile();
