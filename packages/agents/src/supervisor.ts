import { discoveryAgent } from "./agents/discovery";
import { matchAgent } from "./agents/match";
import { resumeAgent } from "./agents/resume";
import { applyAgent } from "./agents/apply";
import { followUpAgent } from "./agents/followup";
import { researchAgent } from "./agents/research";
import { parserAgent } from "./agents/ParserAgent";
import { hunterAgent } from "./agents/HunterAgent";
import { matchScorerAgent } from "./agents/MatchScorerAgent";
import { gapAnalyzerAgent } from "./agents/GapAnalyzerAgent";
import { redFlagAgent } from "./agents/RedFlagAgent";
import { atsRewriteAgent } from "./agents/ATSRewriteAgent";
import { coverLetterAgent } from "./agents/CoverLetterAgent";
import { companyResearchAgent } from "./agents/CompanyResearchAgent";
import { coachPrepAgent } from "./agents/CoachPrepAgent";
import { salaryBenchmarkAgent } from "./agents/SalaryBenchmarkAgent";
import { complianceAgent } from "./agents/ComplianceAgent";
import { sentimentAgent } from "./agents/SentimentAgent";

export type AgentName =
  | "discovery"
  | "match"
  | "resume"
  | "apply"
  | "followup"
  | "research"
  | "parser"
  | "hunter"
  | "matchScorer"
  | "gapAnalyzer"
  | "redFlag"
  | "atsRewrite"
  | "coverLetter"
  | "companyResearch"
  | "coachPrep"
  | "salaryBenchmark"
  | "compliance"
  | "sentiment";

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
    case "parser":
      return parserAgent.execute(task.input as Parameters<typeof parserAgent.execute>[0]);
    case "hunter":
      return hunterAgent.execute(task.input as Parameters<typeof hunterAgent.execute>[0]);
    case "matchScorer":
      return matchScorerAgent.execute(task.input as Parameters<typeof matchScorerAgent.execute>[0]);
    case "gapAnalyzer":
      return gapAnalyzerAgent.execute(task.input as Parameters<typeof gapAnalyzerAgent.execute>[0]);
    case "redFlag":
      return redFlagAgent.execute(task.input as Parameters<typeof redFlagAgent.execute>[0]);
    case "atsRewrite":
      return atsRewriteAgent.execute(task.input as Parameters<typeof atsRewriteAgent.execute>[0]);
    case "coverLetter":
      return coverLetterAgent.execute(task.input as Parameters<typeof coverLetterAgent.execute>[0]);
    case "companyResearch":
      return companyResearchAgent.execute(task.input as Parameters<typeof companyResearchAgent.execute>[0]);
    case "coachPrep":
      return coachPrepAgent.execute(task.input as Parameters<typeof coachPrepAgent.execute>[0]);
    case "salaryBenchmark":
      return salaryBenchmarkAgent.execute(task.input as Parameters<typeof salaryBenchmarkAgent.execute>[0]);
    case "compliance":
      return complianceAgent.execute(task.input as Parameters<typeof complianceAgent.execute>[0]);
    case "sentiment":
      return sentimentAgent.execute(task.input as Parameters<typeof sentimentAgent.execute>[0]);
    default:
      throw new Error(`Unknown agent: ${task.agent}`);
  }
}
