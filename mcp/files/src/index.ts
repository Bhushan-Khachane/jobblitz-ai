import { createMcpServer } from "@jobblitz/mcp-runtime";
import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";

const ALLOWED_ROOT = process.env.FILES_ROOT || "/tmp/jobblitz-files";

function sanitizePath(p: string): string {
  const resolved = join(ALLOWED_ROOT, p);
  if (!resolved.startsWith(ALLOWED_ROOT)) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

createMcpServer("files", [
  {
    name: "read",
    description: "Read a file from the allowed filesystem root",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    async handler(args: unknown) {
      const { path } = args as { path: string };
      const content = await readFile(sanitizePath(path), "utf-8");
      return { content };
    },
  },
  {
    name: "write",
    description: "Write a file to the allowed filesystem root",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
    async handler(args: unknown) {
      const { path, content } = args as { path: string; content: string };
      await writeFile(sanitizePath(path), content, "utf-8");
      return { written: true };
    },
  },
  {
    name: "list",
    description: "List files in a directory",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    async handler(args: unknown) {
      const { path } = args as { path: string };
      const entries = await readdir(sanitizePath(path), { withFileTypes: true });
      return {
        entries: entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() })),
      };
    },
  },
]);
