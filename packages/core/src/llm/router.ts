import type { LLMProvider, LLMMessage, LLMGenerateOptions, LLMResponse } from "./index";
import { OpenAIProvider } from "./openai-provider";
import { GeminiProvider } from "./gemini-provider";

export interface CostLogCallback {
  (entry: {
    provider: string;
    model: string;
    latencyMs: number;
    promptTokens?: number | undefined;
    completionTokens?: number | undefined;
    totalTokens?: number | undefined;
  }): void | Promise<void>;
}

let defaultCostLogCallback: CostLogCallback | undefined;

export function registerDefaultCostLogger(cb: CostLogCallback | undefined): void {
  defaultCostLogCallback = cb;
}

export class LLMRouter implements LLMProvider {
  name = "router";
  private providers: LLMProvider[];
  private onCostLog?: CostLogCallback | undefined;

  constructor(providers: LLMProvider[], onCostLog?: CostLogCallback | undefined) {
    this.providers = providers;
    this.onCostLog = onCostLog;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    for (const provider of this.providers) {
      try {
        const result = await provider.generate(messages, options);
        this.onCostLog?.({
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          promptTokens: result.usage?.promptTokens,
          completionTokens: result.usage?.completionTokens,
          totalTokens: result.usage?.totalTokens,
        });
        return result;
      } catch (err) {
        console.error(`[LLMRouter] ${provider.name} failed:`, err instanceof Error ? err.message : String(err));
        continue;
      }
    }
    throw new Error("All LLM providers failed");
  }

  async healthCheck(): Promise<boolean> {
    const checks = await Promise.all(this.providers.map((p) => p.healthCheck().catch(() => false)));
    return checks.some((ok) => ok);
  }
}

export function createLLMRouter(onCostLog?: CostLogCallback | undefined): LLMRouter {
  const providers: LLMProvider[] = [];

  if (process.env.OPENAI_API_KEY) {
    providers.push(new OpenAIProvider(process.env.OPENAI_API_KEY));
  }

  if (process.env.GOOGLE_API_KEY) {
    providers.push(new GeminiProvider(process.env.GOOGLE_API_KEY));
  }

  if (providers.length === 0) {
    throw new Error("No LLM providers configured. Set OPENAI_API_KEY or GOOGLE_API_KEY.");
  }

  return new LLMRouter(providers, onCostLog ?? defaultCostLogCallback);
}
