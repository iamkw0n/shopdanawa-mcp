import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { applySearchTools } from "./tools/search-tools.js";

export function createDanawaServer(): McpServer {
  const server = new McpServer({
    name: "shopdanawa-mcp",
    version: "0.1.0",
    title: "샵다나와 MCP 서버",
  });

  applySearchTools(server);

  return server;
}
