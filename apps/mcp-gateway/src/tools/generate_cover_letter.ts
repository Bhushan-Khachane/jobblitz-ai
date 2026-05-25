import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withSpan, traceLLMCall } from "@jobblitz/observability";

const { profiles, jobs, coverLetters } = schema;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function callOpenRouter(system: string, user: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "moonshotai/kimi-k2.6",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from OpenRouter");
  }
  return content;
}

export function registerGenerateCoverLetter(server: McpServer, db: DatabaseClient): void {
  // @ts-ignore MCP SDK Zod type recursion
  server.tool(
    "generate_cover_letter",
    {
      userId: z.string().describe("The UUID of the user"),
      jobId: z.string().describe("The UUID of the job"),
    },
    async (args) => {
      return withSpan("mcp.tool.generate_cover_letter", async () => {
        const [profile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.userId, args.userId))
          .limit(1);

        const [job] = await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.id, args.jobId), eq(jobs.userId, args.userId)))
          .limit(1);

        if (!profile || !job) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Profile or job not found" }) }],
            isError: true,
          };
        }

        const system =
          "You are an expert cover letter writer. Write a concise, personalized cover letter (max 300 words) for the candidate applying to the given job.";
        const user = `Candidate: ${profile.headline ?? ""}\nSummary: ${profile.summary ?? ""}\nSkills: ${(profile.skills ?? []).join(", ")}\n\nJob: ${job.title} at ${job.company}\nDescription: ${job.description ?? ""}\nRequirements: ${(job.requirements ?? []).join("\n")}`;

        const llmStart = Date.now();
        const content = await callOpenRouter(system, user);

        await traceLLMCall({
          name: "generate_cover_letter",
          model: "moonshotai/kimi-k2.6",
          input: user.slice(0, 2000),
          output: content.slice(0, 2000),
          userId: args.userId,
          metadata: { jobId: args.jobId, latencyMs: Date.now() - llmStart },
        });

        const [inserted] = await db
          .insert(coverLetters)
          .values({
            userId: args.userId,
            jobId: args.jobId,
            content,
            modelUsed: "moonshotai/kimi-k2.6",
            promptVersion: "v1",
          })
          .returning();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                coverLetterId: inserted?.id,
                content,
              }),
            },
          ],
        };
      });
    }
  );
}
