import { BaseAgent } from "../BaseAgent";
import { createLLMRouter } from "@jobblitz/core";
import type { CoverLetterInput, CoverLetterOutput } from "../state";

const SYSTEM_PROMPT = `You are a professional cover letter writer. Write a concise, personalized cover letter for the candidate applying to the specified job. Use the candidate's profile summary and skills naturally. Keep it under 300 words. Return ONLY a JSON object:
{
  "coverLetter": "string (full letter text)",
  "confidence": number (0-100)
}`;

export class CoverLetterAgent extends BaseAgent<CoverLetterInput, CoverLetterOutput> {
  readonly name = "CoverLetterAgent";
  readonly model = "openai-gpt-4o-mini";

  protected async run(input: CoverLetterInput): Promise<CoverLetterOutput> {
    const router = createLLMRouter();
    const profile = input.profile;
    const job = input.job;
    const tone = input.tone ?? "formal";

    const userPrompt = `Tone: ${tone}\nCandidate Profile:\n${profile.summary ?? profile.headline ?? ""}\nSkills: ${(profile.skills ?? []).join(", ")}\n\nJob: ${job.title} at ${job.company}\nLocation: ${job.location ?? "Remote"}\nDescription: ${job.description ?? ""}`;

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
        coverLetter: String(data.coverLetter ?? ""),
        confidence: Number(data.confidence ?? 80),
      };
    } catch {
      return this.templateFallback(input);
    }
  }

  protected fallbackResult(input: CoverLetterInput): CoverLetterOutput {
    return this.templateFallback(input);
  }

  private templateFallback(input: CoverLetterInput): CoverLetterOutput {
    const { profile, job } = input;
    const tone = input.tone ?? "formal";
    const salutation = "Dear Hiring Manager,";
    const body = [
      `I am writing to express my interest in the ${job.title} position at ${job.company}.`,
      `With a background in ${(profile.skills ?? []).slice(0, 3).join(", ")}, I am confident in my ability to contribute effectively.`,
      `I am particularly drawn to this role because of ${job.company}'s reputation and the opportunity to grow.`,
      `Thank you for considering my application. I look forward to discussing how my skills align with your needs.`,
    ].join("\n\n");
    const closing = tone === "friendly" ? "Warm regards," : tone === "assertive" ? "Best," : "Sincerely,";
    return {
      coverLetter: `${salutation}\n\n${body}\n\n${closing}\n${profile.headline ?? "Candidate"}`,
      confidence: 70,
    };
  }
}

export const coverLetterAgent = new CoverLetterAgent();
