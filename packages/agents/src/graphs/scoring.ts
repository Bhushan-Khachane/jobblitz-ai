import { StateGraph, START, END } from "../engine";
import { computeMatchScore } from "@jobblitz/core";
import type { ScoringState } from "../state";

function computeScore(state: ScoringState): ScoringState {
  if (!state.job || !state.profile) {
    return { ...state, error: "Missing job or profile" };
  }
  try {
    const result = computeMatchScore(state.job, state.profile);
    return {
      ...state,
      score: result.fitScore,
      decision: result.decision,
      dimensions: result.dimensions,
      step: "scored",
    };
  } catch (err) {
    return { ...state, error: err instanceof Error ? err.message : String(err), step: "score_failed" };
  }
}

function decideGate(state: ScoringState): ScoringState {
  if (state.error) return { ...state, step: "failed" };
  if (state.decision === "auto") return { ...state, step: "auto_approved" };
  if (state.decision === "skip") return { ...state, step: "skipped" };
  return { ...state, step: "needs_approval" };
}

export const scoringGraph = new StateGraph<ScoringState>()
  .addNode("compute", computeScore)
  .addNode("decide", decideGate)
  .addEdge(START, "compute")
  .addEdge("compute", "decide")
  .addEdge("decide", END)
  .compile();
