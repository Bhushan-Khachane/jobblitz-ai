import type { LLMProvider, LLMMessage, LLMGenerateOptions, LLMResponse } from "./index";

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gemini-2.0-flash-lite") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    const start = Date.now();
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: {
          maxOutputTokens: options?.maxTokens ?? 2048,
          temperature: options?.temperature ?? 0.7,
          responseMimeType: options?.jsonMode ? "application/json" : "text/plain",
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini error ${res.status}: ${body}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const usage = {
      promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens:
        (data.usageMetadata?.promptTokenCount ?? 0) + (data.usageMetadata?.candidatesTokenCount ?? 0),
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}?key=${this.apiKey}`;
      const res = await fetch(url);
      return res.ok;
    } catch {
      return false;
    }
  }
}

export function createGeminiProvider(apiKey?: string, model?: string): GeminiProvider {
  const key = apiKey ?? process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY is required");
  return new GeminiProvider(key, model);
}
