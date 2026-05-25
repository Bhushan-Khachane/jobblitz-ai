import { Hono } from "hono";
import { traceLLMCall } from "@jobblitz/observability";

const observability = new Hono();

observability.post("/llm-trace", async (c) => {
  const body = await c.req.json();
  const { name, model, input, output, userId, metadata } = body as {
    name: string;
    model: string;
    input: string;
    output: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  };

  await traceLLMCall({
    name,
    model,
    input,
    output,
    ...(userId ? { userId } : {}),
    ...(metadata ? { metadata } : {}),
  });
  return c.json({ success: true });
});

export default observability;
