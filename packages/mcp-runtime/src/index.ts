export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown) => Promise<unknown>;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null | undefined;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number | string | null | undefined;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown } | undefined;
}

export function createMcpServer(name: string, tools: McpTool[]) {
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  function sendResponse(response: JsonRpcResponse) {
    const line = JSON.stringify(response);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(line, "utf-8")}\r\n\r\n${line}`);
  }

  function handleRequest(req: JsonRpcRequest): JsonRpcResponse {
    if (req.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          serverInfo: { name, version: "1.0.0" },
        },
      };
    }

    if (req.method === "notifications/initialized") {
      return { jsonrpc: "2.0", id: req.id };
    }

    if (req.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
        },
      };
    }

    if (req.method === "tools/call") {
      const toolName = (req.params?.name as string) || "";
      const tool = toolMap.get(toolName);
      if (!tool) {
        return { jsonrpc: "2.0", id: req.id, error: { code: -32602, message: `Tool not found: ${toolName}` } };
      }
      tool.handler(req.params?.arguments || {})
        .then((result) => {
          sendResponse({ jsonrpc: "2.0", id: req.id, result: { content: [{ type: "text", text: JSON.stringify(result) }] } });
        })
        .catch((err) => {
          sendResponse({ jsonrpc: "2.0", id: req.id, error: { code: -32603, message: err instanceof Error ? err.message : String(err) } });
        });
      return { jsonrpc: "2.0", id: req.id };
    }

    return { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } };
  }

  let buffer = "";
  process.stdin.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf-8");
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const headers = buffer.slice(0, headerEnd);
      const match = /Content-Length:\s*(\d+)/i.exec(headers);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const length = parseInt(match[1] || "0", 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) break;
      const body = buffer.slice(bodyStart, bodyStart + length);
      buffer = buffer.slice(bodyStart + length);
      try {
        const req = JSON.parse(body) as JsonRpcRequest;
        const res = handleRequest(req);
        if (res.result !== undefined || res.error !== undefined) {
          sendResponse(res);
        }
      } catch {
        sendResponse({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } });
      }
    }
  });

  console.error(`[mcp:${name}] server started on stdio`);
}
