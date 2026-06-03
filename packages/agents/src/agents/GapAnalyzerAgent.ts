import { BaseAgent } from "../BaseAgent";
import type { GapInput, GapOutput } from "../state";

export class GapAnalyzerAgent extends BaseAgent<GapInput, GapOutput> {
  readonly name = "GapAnalyzerAgent";
  readonly model = "rule-based";

  protected run(input: GapInput): Promise<GapOutput> {
    const jobSet = new Set(input.jobSkills.map((s) => s.toLowerCase()));
    const profileSet = new Set(input.profileSkills.map((s) => s.toLowerCase()));

    const missingSkills = Array.from(jobSet).filter((s) => !profileSet.has(s));
    const transferableSkills = Array.from(profileSet).filter((s) => !jobSet.has(s));

    const experienceGaps: string[] = [];
    if (input.jobExperience && input.profileExperience) {
      const jobYears = Number.parseInt(input.jobExperience);
      const profileYears = Number.parseInt(input.profileExperience);
      if (!Number.isNaN(jobYears) && !Number.isNaN(profileYears) && profileYears < jobYears) {
        experienceGaps.push(`Job requires ~${jobYears} years, profile shows ~${profileYears} years.`);
      }
    }

    const upgradePath: string[] = [];
    if (missingSkills.length > 0) {
      upgradePath.push(`Learn core missing skills: ${missingSkills.slice(0, 3).join(", ")}`);
    }
    if (transferableSkills.length > 0) {
      upgradePath.push(`Emphasize transferable skills: ${transferableSkills.slice(0, 3).join(", ")}`);
    }

    return Promise.resolve({
      missingSkills,
      transferableSkills,
      experienceGaps,
      upgradePath,
    });
  }

  protected fallbackResult(input: GapInput): GapOutput {
    return {
      missingSkills: input.jobSkills,
      transferableSkills: input.profileSkills,
      experienceGaps: [],
      upgradePath: ["Retry analysis after service recovery"],
    };
  }
}

export const gapAnalyzerAgent = new GapAnalyzerAgent();
