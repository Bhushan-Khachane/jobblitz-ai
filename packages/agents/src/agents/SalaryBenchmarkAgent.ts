import { BaseAgent } from "../BaseAgent";
import { createLLMRouter } from "@jobblitz/core";
import type { SalaryInput, SalaryBenchmark } from "../state";

export class SalaryBenchmarkAgent extends BaseAgent<SalaryInput, SalaryBenchmark> {
  readonly name = "SalaryBenchmarkAgent";
  readonly model = "openai-gpt-4o-mini";

  protected async run(input: SalaryInput): Promise<SalaryBenchmark> {
    try {
      const router = createLLMRouter();
      const userPrompt = `What is the typical salary range in India for a ${input.role} role${input.location ? ` in ${input.location}` : ""}${input.experienceYears ? ` with ${input.experienceYears} years experience` : ""}? Return ONLY JSON: {"marketRange":{"min":number,"max":number,"median":number,"currency":"INR-LPA"},"source":"string","confidence":number(0-1),"negotiationTip":"string"}`;

      const res = await router.generate(
        [
          { role: "system", content: "You are a compensation research assistant for the Indian tech market." },
          { role: "user", content: userPrompt },
        ],
        { jsonMode: true, maxTokens: 1024, temperature: 0.3 }
      );

      const raw = res.text.replace(/```json/g, "").replace(/```/g, "").trim();
      const data = JSON.parse(raw) as Record<string, unknown>;
      const range = data.marketRange as Record<string, unknown> | undefined;

      return {
        marketRange: {
          min: Number(range?.min ?? 8),
          max: Number(range?.max ?? 25),
          median: Number(range?.median ?? 15),
          currency: String(range?.currency ?? "INR-LPA"),
        },
        source: String(data.source ?? "llm-estimate"),
        confidence: Number(data.confidence ?? 0.6),
        negotiationTip: String(data.negotiationTip ?? "Research market rates independently."),
      };
    } catch (err) {
      console.error("[SalaryBenchmarkAgent] LLM failed, using stub:", err instanceof Error ? err.message : String(err));
      return this.stubFallback(input);
    }
  }

  protected fallbackResult(input: SalaryInput): SalaryBenchmark {
    return this.stubFallback(input);
  }

  private stubFallback(input: SalaryInput): SalaryBenchmark {
    const baseMin = 8;
    const baseMax = 25;
    const multiplier = (input.experienceYears ?? 3) * 1.5;
    return {
      marketRange: {
        min: Math.round(baseMin + multiplier),
        max: Math.round(baseMax + multiplier * 2),
        median: Math.round((baseMin + baseMax) / 2 + multiplier * 1.2),
        currency: "INR-LPA",
      },
      source: "aggregated-market-stub",
      confidence: 0.6,
      negotiationTip: "Lead with your achievements, not your current CTC. Ask for the total compensation breakdown including fixed, variable, and ESOPs.",
    };
  }
}

export const salaryBenchmarkAgent = new SalaryBenchmarkAgent();
