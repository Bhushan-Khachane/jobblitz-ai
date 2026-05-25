import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { DatabaseClient } from "@jobblitz/db";
import { schema } from "@jobblitz/db";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withSpan, traceLLMCall } from "@jobblitz/observability";

const { resumes, jobs, tailoredResumes } = schema;

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
      max_tokens: 4096,
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

export function registerTailorResume(server: McpServer, db: DatabaseClient): void {
  // @ts-ignore MCP SDK Zod type recursion
  server.tool(
    "tailor_resume",
    {
      userId: z.string().describe("The UUID of the user"),
      jobId: z.string().describe("The UUID of the job"),
      resumeId: z.string().optional().describe("Optional specific resume UUID; defaults to user's default resume"),
    },
    async (args) => {
      return withSpan("mcp.tool.tailor_resume", async () => {
        let resumeId = args.resumeId;

        if (!resumeId) {
          const [defaultResume] = await db
            .select()
            .from(resumes)
            .where(and(eq(resumes.userId, args.userId), eq(resumes.isDefault, true)))
            .limit(1);
          if (!defaultResume) {
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "No default resume found" }) }],
              isError: true,
            };
          }
          resumeId = defaultResume.id;
        }

        const [resume] = await db
          .select()
          .from(resumes)
          .where(and(eq(resumes.id, resumeId), eq(resumes.userId, args.userId)))
          .limit(1);
        if (!resume) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Resume not found" }) }],
            isError: true,
          };
        }

        const [job] = await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.id, args.jobId), eq(jobs.userId, args.userId)))
          .limit(1);
        if (!job) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Job not found" }) }],
            isError: true,
          };
        }

        const system =
          "You are an expert resume tailor. Rewrite the candidate's resume to better match the job description. Keep the same format and length. Do not invent new experiences.";
        const user = `Job Title: ${job.title}\nCompany: ${job.company}\nDescription: ${job.description ?? ""}\nRequirements: ${(job.requirements ?? []).join("\n")}\n\nResume:\n${resume.parsedText ?? ""}`;

        const llmStart = Date.now();
        const tailoredContent = await callOpenRouter(system, user);

        await traceLLMCall({
          name: "tailor_resume",
          model: "moonshotai/kimi-k2.6",
          input: user.slice(0, 2000),
          output: tailoredContent.slice(0, 2000),
          userId: args.userId,
          metadata: { jobId: args.jobId, resumeId, latencyMs: Date.now() - llmStart },
        });

        const [inserted] = await db
          .insert(tailoredResumes)
          .values({
            userId: args.userId,
            jobId: args.jobId,
            resumeId,
            content: tailoredContent,
            modelUsed: "moonshotai/kimi-k2.6",
          })
          .returning();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                tailoredResumeId: inserted?.id,
                modelUsed: "moonshotai/kimi-k2.6",
                preview: tailoredContent.slice(0, 500),
              }),
            },
          ],
        };
      });
    }
  );
}
