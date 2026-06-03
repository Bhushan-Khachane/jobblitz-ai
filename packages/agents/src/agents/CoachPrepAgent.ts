import { BaseAgent } from "../BaseAgent";
import { createLLMRouter } from "@jobblitz/core";
import type { CoachPrepInput, CoachPrepOutput } from "../state";

const SYSTEM_PROMPT = `You are an interview coach. Given a company name, job title, and candidate profile, generate an interview preparation pack. Return ONLY a JSON object:
{
  "companyBrief": "string",
  "likelyQuestions": ["string"],
  "salaryPositioning": "string",
  "smartQuestions": ["string"],
  "redFlags": ["string"]
}`;

export class CoachPrepAgent extends BaseAgent<CoachPrepInput, CoachPrepOutput> {
  readonly name = "CoachPrepAgent";
  readonly model = "openai-gpt-4o";

  protected async run(input: CoachPrepInput): Promise<CoachPrepOutput> {
    const router = createLLMRouter();
    const userPrompt = `Company: ${input.companyName}\nJob Title: ${input.jobTitle}\nCandidate Profile:\n${input.profile.summary ?? input.profile.headline ?? ""}\nSkills: ${(input.profile.skills ?? []).join(", ")}\nExperience: ${JSON.stringify(input.profile.experience)}`;

    const res = await router.generate(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt.slice(0, 10000) },
      ],
      { jsonMode: true, maxTokens: 2048, temperature: 0.6 }
    );

    try {
      const raw = res.text.replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(raw) as Record<string, unknown>;
      return {
        companyBrief: String(data.companyBrief ?? ""),
        likelyQuestions: Array.isArray(data.likelyQuestions) ? data.likelyQuestions.map(String) : [],
        salaryPositioning: String(data.salaryPositioning ?? ""),
        smartQuestions: Array.isArray(data.smartQuestions) ? data.smartQuestions.map(String) : [],
        redFlags: Array.isArray(data.redFlags) ? data.redFlags.map(String) : [],
      };
    } catch {
      return this.templateFallback(input);
    }
  }

  protected fallbackResult(input: CoachPrepInput): CoachPrepOutput {
    return this.templateFallback(input);
  }

  private templateFallback(input: CoachPrepInput): CoachPrepOutput {
    const { companyName, jobTitle, profile } = input;
    const topSkills = (profile.skills ?? []).slice(0, 3);
    return {
      companyBrief: `${companyName} is hiring for ${jobTitle}. Focus on demonstrating impact and scalability.`,
      likelyQuestions: [
        `Tell me about a time you used ${topSkills[0] ?? "your core skill"} to solve a hard problem.`,
        "Describe a project where you had to make trade-offs under time pressure.",
        `Why ${companyName} and why this ${jobTitle} role?`,
        "How do you handle conflicting requirements from stakeholders?",
      ],
      salaryPositioning: "Anchor at the 75th percentile of your range and justify with concrete achievements.",
      smartQuestions: [
        "What does success look like in this role at 6 and 12 months?",
        "What is the biggest technical challenge the team is currently facing?",
        "How does this team collaborate with product and design?",
      ],
      redFlags: ["Vague growth plans", "High turnover in team", "No clarity on ownership boundaries"],
    };
  }
}

export const coachPrepAgent = new CoachPrepAgent();
