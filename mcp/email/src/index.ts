import { createMcpServer } from "@jobblitz/mcp-runtime";

createMcpServer("email", [
  {
    name: "send",
    description: "Send an email (stub — configure SMTP in production)",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
    async handler(args: unknown) {
      const { to, subject, body } = args as { to: string; subject: string; body: string };
      console.log(`[email:send] to=${to} subject=${subject}`);
      return { sent: true, to, subject, bodyLength: body.length };
    },
  },
]);
