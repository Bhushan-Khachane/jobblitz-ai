export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  text: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface LLMGenerateOptions {
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface LLMProvider {
  name: string;
  generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse>;
  healthCheck(): Promise<boolean>;
}

export * from "./openai-provider";
export * from "./gemini-provider";
export * from "./router";
