import { computeMatchScore } from "@jobblitz/core";
import type { Job, Profile } from "@jobblitz/types";

export interface ScoringExample {
  job: Job;
  profile: Profile;
  expectedDecision: "auto" | "approve" | "skip";
  minScore: number;
}

export const SCORING_EXAMPLES: ScoringExample[] = [
  {
    job: {
      id: "1",
      userId: "u1",
      platform: "linkedin",
      title: "Python Backend Engineer",
      company: "TechCorp",
      skillsRequired: ["Python", "Django", "PostgreSQL"],
      yearsExperienceMin: 3,
      salaryMinLpa: 20,
      salaryMaxLpa: 40,
      status: "discovered",
      createdAt: new Date().toISOString(),
    } as Job,
    profile: {
      id: "p1",
      userId: "u1",
      skills: ["Python", "Django", "PostgreSQL", "AWS"],
      experienceYears: 5,
      salaryMinLpa: 25,
      salaryMaxLpa: 50,
      preferredLocations: ["Bangalore"],
      preferredJobTitles: ["Backend Engineer", "Python Developer"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Profile,
    expectedDecision: "auto",
    minScore: 0.8,
  },
];

export function evaluateScoring(example: ScoringExample): { passed: boolean; score: number; decision: string } {
  const result = computeMatchScore(example.job, example.profile);
  const passed = result.decision === example.expectedDecision && result.fitScore >= example.minScore;
  return { passed, score: result.fitScore, decision: result.decision };
}
