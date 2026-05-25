import { PerplexityClient } from "./sonar";
import type { RoleResearchResult } from "./types";

export async function researchRole(
  client: PerplexityClient,
  jobTitle: string,
  companyName?: string
): Promise<RoleResearchResult> {
  const context = companyName ? ` at ${companyName}` : "";
  const query = `Research the ${jobTitle} role${context}. Provide: key responsibilities, required vs preferred skills, typical experience level, salary range in India (LPA), remote work policy, work-life balance indicators, and growth path. Be concise.`;

  const response = await client.queryWithRetry({ query, model: "sonar-pro" });
  const answer = response.answer;

  return {
    title: jobTitle,
    keyResponsibilities: extractList(answer, /responsibilities[\s\w]*:?/i),
    requiredSkills: extractSkills(answer, /required skills?[\s\w]*:?/i),
    preferredSkills: extractSkills(answer, /preferred skills?[\s\w]*:?/i),
    experienceLevel: extractField(answer, /experience level[\s\w]*:?\s*(.+)/i) || "Not specified",
    salaryRange: extractSalaryRange(answer),
    remotePolicy: extractField(answer, /remote[\s\w]*:?\s*(.+)/i),
    workLifeBalance: extractField(answer, /work[- ]life[\s\w]*:?\s*(.+)/i),
    growthPath: extractField(answer, /growth[\s\w]*:?\s*(.+)/i),
    citations: response.citations,
    researchedAt: new Date().toISOString(),
  };
}

function extractField(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  return match?.[1]?.trim();
}

function extractList(text: string, headerRegex: RegExp): string[] {
  const lines = text.split("\n");
  const result: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (headerRegex.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (/^#{1,3}\s/.test(line) || line.trim() === "") {
        inSection = false;
        continue;
      }
      const cleaned = line.replace(/^[-*\d.]+\s*/, "").trim();
      if (cleaned) result.push(cleaned);
    }
  }
  return result;
}

function extractSkills(text: string, headerRegex: RegExp): string[] {
  const list = extractList(text, headerRegex);
  if (list.length > 0) return list;
  // Fallback: grab any comma-separated skills mentioned
  const fallback = text.match(/(?:skills? include|technologies?)[\s:]*(.+)/i);
  if (fallback && fallback[1]) {
    return fallback[1].split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function extractSalaryRange(text: string): { minLpa: number; maxLpa: number } | undefined {
  const match = text.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*(?:LPA|lakhs?)/i);
  if (match) {
    return { minLpa: Number(match[1]), maxLpa: Number(match[2]) };
  }
  const single = text.match(/(?:₹)?\s*(\d{1,2})\s*(?:LPA|lakhs?)/i);
  if (single) {
    const val = Number(single[1]);
    return { minLpa: val, maxLpa: val + 5 };
  }
  return undefined;
}
