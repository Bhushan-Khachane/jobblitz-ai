import { BaseAgent } from "../BaseAgent";
import { computeMatchScore } from "@jobblitz/core";
import type { Job, Profile } from "@jobblitz/types";

export interface MatchInput {
  job: Job;
  profile: Profile;
}

export interface MatchResult {
  score: number;
  analysis: string;
  strengths: string[];
  gaps: string[];
  confidence: number;
}

export class MatchScorerAgent extends BaseAgent<MatchInput, MatchResult> {
  readonly name = "MatchScorerAgent";
  readonly model = "hybrid-embedding-rule";

  protected run(input: MatchInput): Promise<MatchResult> {
    const base = computeMatchScore(input.job, input.profile);

    const score = Math.round(base.fitScore * 100);
    const gaps = base.gaps ?? [];
    const strengths = base.strengths ?? [];

    const analysis = base.explanation;
    const confidence = base.decision === "auto" ? 0.9 : base.decision === "approve" ? 0.75 : 0.6;

    return Promise.resolve({
      score,
      analysis,
      strengths,
      gaps,
      confidence,
    });
  }

  protected fallbackResult(_input: MatchInput): MatchResult {
    return {
      score: 50,
      analysis: "Unable to compute match score due to service error.",
      strengths: [],
      gaps: ["Service error — retry recommended"],
      confidence: 0,
    };
  }
}

export const matchScorerAgent = new MatchScorerAgent();
