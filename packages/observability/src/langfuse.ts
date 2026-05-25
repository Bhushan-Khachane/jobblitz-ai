import { Langfuse } from "langfuse";

const PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;
const BASE_URL = process.env.LANGFUSE_BASE_URL;

let client: Langfuse | null = null;

function getClient(): Langfuse {
  if (!client) {
    client = new Langfuse({
      publicKey: PUBLIC_KEY || "",
      secretKey: SECRET_KEY || "",
      ...(BASE_URL ? { baseUrl: BASE_URL } : {}),
    });
  }
  return client;
}

export function initLangfuse() {
  getClient();
}

export function shutdownLangfuse(): Promise<void> {
  if (!client) return Promise.resolve();
  return client.shutdownAsync();
}

export async function traceLLMCall(params: {
  name: string;
  model: string;
  input: string;
  output: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!PUBLIC_KEY) return;
  const lf = getClient();
  const trace = lf.trace({
    name: params.name,
    ...(params.userId ? { userId: params.userId } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
  });
  trace.generation({
    name: params.name,
    model: params.model,
    input: params.input,
    output: params.output,
  });
}

export async function traceAgentStep(params: {
  traceId: string;
  name: string;
  input: unknown;
  output: unknown;
  latencyMs: number;
}) {
  if (!PUBLIC_KEY) return;
  const lf = getClient();
  const trace = lf.trace({ id: params.traceId });
  trace.span({
    name: params.name,
    input: params.input,
    output: params.output,
  });
}
