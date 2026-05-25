import { createMcpServer } from "@jobblitz/mcp-runtime";
import { createDatabaseClient } from "@jobblitz/db";

const dbUrl = (typeof process !== "undefined" && process.env?.DATABASE_URL) || "postgresql://localhost:5432/jobblitz";
const db = createDatabaseClient(dbUrl);

createMcpServer("postgres", [
  {
    name: "query",
    description: "Run a read-only SQL query against the JobBlitz database",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SELECT query to run" },
      },
      required: ["sql"],
    },
    async handler(args: unknown) {
      const { sql } = args as { sql: string };
      if (!/^(\s|\()*select/i.test(sql)) {
        throw new Error("Only SELECT queries are allowed");
      }
      const result = await db.execute(sql);
      return { rows: result };
    },
  },
  {
    name: "list_tables",
    description: "List all tables in the database",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      const result = await db.execute(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
      );
      return { tables: result };
    },
  },
]);
