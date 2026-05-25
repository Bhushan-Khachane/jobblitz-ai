import { discoveryAgent } from "./agents/discovery";
import { matchAgent } from "./agents/match";
import { resumeAgent } from "./agents/resume";
import { applyAgent } from "./agents/apply";
import { followUpAgent } from "./agents/followup";
import { researchAgent } from "./agents/research";

export type AgentName = "discovery" | "match" | "resume" | "apply" | "followup" | "research";

export interface SupervisorTask {
  agent: AgentName;
  input: unknown;
}

export async function supervisorRoute(task: SupervisorTask): Promise<unknown> {
  switch (task.agent) {
    case "discovery":
      return discoveryAgent(task.input as Parameters<typeof discoveryAgent>[0]);
    case "match":
      return matchAgent(task.input as Parameters<typeof matchAgent>[0]);
    case "resume":
      return resumeAgent(task.input as Parameters<typeof resumeAgent>[0]);
    case "apply":
      return applyAgent(task.input as Parameters<typeof applyAgent>[0]);
    case "followup":
      return followUpAgent(task.input as Parameters<typeof followUpAgent>[0]);
    case "research":
      return researchAgent(task.input as Parameters<typeof researchAgent>[0]);
    default:
      throw new Error(`Unknown agent: ${task.agent}`);
  }
}
