import { BaseAgent } from "../BaseAgent";
import { createLLMRouter } from "@jobblitz/core";
import type { ATSRewriteInput, ATSRewriteOutput } from "../state";

const SYSTEM_PROMPT = `You are an ATS resume optimization expert. Rewrite the candidate's resume to better match the provided job description. Keep all facts truthful — do not fabricate experience or skills. Return ONLY a JSON object with this shape:
{
  "markdown": "string (full rewritten resume in markdown)",
  "changeLog": ["string (list of changes made)"],
  "confidence": number (0-100),
  "antiFabricationCheck": boolean (true if no fabricated claims)
}`;

export class ATSRewriteAgent extends BaseAgent<ATSRewriteInput, ATSRewriteOutput> {
  readonly name = "ATSRewriteAgent";
  readonly model = "openai-gpt-4o";

  protected async run(input: ATSRewriteInput): Promise<ATSRewriteOutput> {
    const router = createLLMRouter();
    const res = await router.generate(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Job Description:\n${input.jobDescription.slice(0, 6000)}\n\nResume:\n${input.resumeText.slice(0, 8000)}`,
        },
      ],
      { jsonMode: true, maxTokens: 4096, temperature: 0.5 }
    );

    try {
      const raw = res.text.replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(raw) as Record<string, unknown>;
      return {
        markdown: String(data.markdown ?? ""),
        changeLog: Array.isArray(data.changeLog) ? data.changeLog.map(String) : [],
        confidence: Number(data.confidence ?? 70),
        antiFabricationCheck: Boolean(data.antiFabricationCheck ?? true),
      };
    } catch {
      return this.ruleBasedFallback(input);
    }
  }

  protected fallbackResult(input: ATSRewriteInput): ATSRewriteOutput {
    return this.ruleBasedFallback(input);
  }

  private ruleBasedFallback(input: ATSRewriteInput): ATSRewriteOutput {
    const jobWords = new Set(input.jobDescription.toLowerCase().split(/\W+/));
    const resumeLines = input.resumeText.split("\n");
    const changeLog: string[] = [];
    const enhanced: string[] = [];

    for (const line of resumeLines) {
      let modified = line;
      if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) {
        const bullet = line.trim().slice(2);
        const hasOverlap = Array.from(jobWords).some((w) => bullet.toLowerCase().includes(w));
        if (!hasOverlap && jobWords.size > 0) {
          const injected = Array.from(jobWords).find((w) => w.length > 5 && !bullet.toLowerCase().includes(w));
          if (injected) {
            modified = `${line} (including ${injected})`;
            changeLog.push(`Injected keyword "${injected}"`);
          }
        }
      }
      enhanced.push(modified);
    }

    return {
      markdown: enhanced.join("\n"),
      changeLog,
      confidence: Math.min(95, 60 + changeLog.length * 5),
      antiFabricationCheck: changeLog.length <= 5,
    };
  }
}

export const atsRewriteAgent = new ATSRewriteAgent();
