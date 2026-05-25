import { createMcpServer } from "@jobblitz/mcp-runtime";

createMcpServer("calendar", [
  {
    name: "create_event",
    description: "Create a calendar event (stub — integrate with Google Calendar in production)",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        start: { type: "string", description: "ISO 8601 datetime" },
        end: { type: "string", description: "ISO 8601 datetime" },
        attendees: { type: "array", items: { type: "string" } },
      },
      required: ["title", "start", "end"],
    },
    async handler(args: unknown) {
      const { title, start, end, attendees } = args as { title: string; start: string; end: string; attendees?: string[] };
      console.log(`[calendar:create] ${title} ${start} -> ${end}`);
      return { created: true, title, start, end, attendees: attendees || [] };
    },
  },
]);
