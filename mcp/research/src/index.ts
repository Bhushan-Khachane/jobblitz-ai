import { createMcpServer } from "@jobblitz/mcp-runtime";
import { PerplexityClient, researchEmployer, researchRole } from "@jobblitz/research";

const client = process.env.PERPLEXITY_API_KEY
  ? new PerplexityClient(process.env.PERPLEXITY_API_KEY)
  : undefined;

createMcpServer("research", [
  {
    name: "research_employer",
    description: "Research an employer using Perplexity Sonar",
    inputSchema: {
      type: "object",
      properties: {
        companyName: { type: "string" },
      },
      required: ["companyName"],
    },
    async handler(args: unknown) {
      if (!client) throw new Error("PERPLEXITY_API_KEY not set");
      const { companyName } = args as { companyName: string };
      const result = await researchEmployer(client, companyName);
      return result;
    },
  },
  {
    name: "research_role",
    description: "Research a job role using Perplexity Sonar",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        company: { type: "string" },
      },
      required: ["title"],
    },
    async handler(args: unknown) {
      if (!client) throw new Error("PERPLEXITY_API_KEY not set");
      const { title, company } = args as { title: string; company?: string };
      const result = await researchRole(client, title, company);
      return result;
    },
  },
]);
