import type { LLMProvider, LLMMessage, LLMGenerateOptions, LLMResponse } from "./index";

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model = "gpt-4o-mini", baseUrl = "https://api.openai.com/v1") {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: options?.maxTokens ?? 2048,
        temperature: options?.temperature ?? 0.7,
        response_format: options?.jsonMode ? { type: "json_object" } : undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${body}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const usage = {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    };

    return {
      text,
      model: this.model,
      provider: this.name,
      usage,
      latencyMs: Date.now() - start,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export function createOpenAIProvider(apiKey?: string, model?: string): OpenAIProvider {
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required");
  return new OpenAIProvider(key, model);
}
