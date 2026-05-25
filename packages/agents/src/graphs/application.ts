import { StateGraph, START, END } from "../engine";
import type { ApplicationState } from "../state";

function prepareApplication(state: ApplicationState): ApplicationState {
  if (!state.job) {
    return { ...state, error: "No job provided" };
  }
  return { ...state, step: "prepared", applyUrl: state.job.applyUrl || undefined };
}

function verifyRequirements(state: ApplicationState): ApplicationState {
  if (state.error) return state;
  if (!state.applyUrl) {
    return { ...state, error: "No apply URL", step: "failed" };
  }
  if (!state.resumePath) {
    return { ...state, error: "No resume provided", step: "failed" };
  }
  return { ...state, step: "verified" };
}

function executeApplication(state: ApplicationState): ApplicationState {
  if (state.error) return state;
  return {
    ...state,
    step: "submitted",
    confirmationId: `simulated-${Date.now()}`,
  };
}

function handleResult(state: ApplicationState): ApplicationState {
  if (state.error) return { ...state, step: "failed" };
  return { ...state, step: "completed" };
}

export const applicationGraph = new StateGraph<ApplicationState>()
  .addNode("prepare", prepareApplication)
  .addNode("verify", verifyRequirements)
  .addNode("execute", executeApplication)
  .addNode("handleResult", handleResult)
  .addEdge(START, "prepare")
  .addEdge("prepare", "verify")
  .addEdge("verify", "execute")
  .addEdge("execute", "handleResult")
  .addEdge("handleResult", END)
  .compile();
