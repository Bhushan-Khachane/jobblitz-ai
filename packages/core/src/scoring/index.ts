import type { Job, Profile } from "@jobblitz/types";

export interface MatchScore {
  fitScore: number; // 0.0 to 1.0
  decision: "auto" | "approve" | "skip";
  dimensions: {
    skillsMatch: { score: number; matched: string[]; missing: string[] };
    experienceMatch: { score: number; note: string };
    locationMatch: { score: number; note: string };
    salaryMatch: { score: number; note: string };
    titleMatch: { score: number; note: string };
  };
  explanation: string;
  gaps?: string[] | undefined;
  strengths?: string[] | undefined;
}

export function computeMatchScore(job: Job, profile: Profile): MatchScore {
  // Token-overlap fallback matcher (preserved from Python matcher.py)
  const profileSkills = new Set((profile.skills || []).map((s) => s.toLowerCase()));
  const jobSkills = new Set((job.skillsRequired || []).map((s) => s.toLowerCase()));

  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of Array.from(jobSkills)) {
    if (profileSkills.has(skill)) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }

  const skillsScore = jobSkills.size > 0 ? matched.length / jobSkills.size : 1;

  // Experience match
  let experienceScore = 1;
  let experienceNote = "Experience matches";
  if (job.yearsExperienceMin && profile.experienceYears) {
    if (profile.experienceYears < job.yearsExperienceMin) {
      experienceScore = Math.max(0, profile.experienceYears / job.yearsExperienceMin);
      experienceNote = `Has ${profile.experienceYears} years, needs ${job.yearsExperienceMin}`;
    } else if (job.yearsExperienceMax && profile.experienceYears > job.yearsExperienceMax + 3) {
      experienceScore = 0.7;
      experienceNote = `Possibly overqualified (${profile.experienceYears} vs ${job.yearsExperienceMax} max)`;
    }
  }

  // Location match
  let locationScore = 1;
  let locationNote = "Location OK";
  const preferredLocs = profile.preferredLocations || [];
  if (job.location && preferredLocs.length > 0) {
    const jobLoc = job.location.toLowerCase();
    const locMatch = preferredLocs.some((l) => jobLoc.includes(l.toLowerCase()) || l.toLowerCase().includes(jobLoc));
    if (!locMatch) {
      locationScore = 0.6;
      locationNote = `Job in ${job.location}, prefers ${preferredLocs.join(", ")}`;
    }
  }

  // Salary match
  let salaryScore = 1;
  let salaryNote = "Salary OK";
  if (job.salaryMinLpa && profile.salaryMinLpa) {
    if (job.salaryMaxLpa && job.salaryMaxLpa < profile.salaryMinLpa) {
      salaryScore = 0.4;
      salaryNote = `Max ${job.salaryMaxLpa} LPA below expectation ${profile.salaryMinLpa}`;
    } else if (job.salaryMinLpa < profile.salaryMinLpa * 0.7) {
      salaryScore = 0.7;
      salaryNote = `Salary range may be below expectations`;
    }
  }

  // Title match
  let titleScore = 1;
  let titleNote = "Title OK";
  const preferredTitles = profile.preferredJobTitles || [];
  if (preferredTitles.length > 0 && job.title) {
    const titleLower = job.title.toLowerCase();
    const titleMatch = preferredTitles.some((t) => titleLower.includes(t.toLowerCase()));
    if (!titleMatch) {
      titleScore = 0.7;
      titleNote = `Title "${job.title}" not in preferred list`;
    }
  }

  // Weighted average
  const fitScore =
    skillsScore * 0.35 +
    experienceScore * 0.25 +
    locationScore * 0.15 +
    salaryScore * 0.15 +
    titleScore * 0.10;

  let decision: "auto" | "approve" | "skip" = "approve";
  if (fitScore >= 0.75) decision = "auto";
  else if (fitScore < 0.4) decision = "skip";

  return {
    fitScore: Math.round(fitScore * 100) / 100,
    decision,
    dimensions: {
      skillsMatch: { score: Math.round(skillsScore * 100) / 100, matched, missing },
      experienceMatch: { score: Math.round(experienceScore * 100) / 100, note: experienceNote },
      locationMatch: { score: Math.round(locationScore * 100) / 100, note: locationNote },
      salaryMatch: { score: Math.round(salaryScore * 100) / 100, note: salaryNote },
      titleMatch: { score: Math.round(titleScore * 100) / 100, note: titleNote },
    },
    explanation: `Fit score ${Math.round(fitScore * 100)}%: ${matched.length}/${jobSkills.size} skills matched. ${experienceNote}. ${locationNote}.`,
    gaps: missing.length > 0 ? [`Missing skills: ${missing.join(", ")}`] : undefined,
    strengths: matched.length > jobSkills.size * 0.7 ? ["Strong skill match"] : undefined,
  };
}

export function shouldAutoApply(score: MatchScore, plan: string): boolean {
  if (score.decision !== "auto") return false;
  if (plan === "free" && score.fitScore < 0.85) return false;
  return true;
}
