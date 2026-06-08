#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDanawaServer } from "./server.js";
import { isZyteAvailable } from "./utils/zyte.js";

async function main(): Promise<void> {
  const server = createDanawaServer();
  await server.connect(new StdioServerTransport());

  const proxyMode =
    isZyteAvailable() ? "Zyte 프록시 사용 가능" : "직접 요청만 사용";
  console.error(`shopdanawa-mcp 서버가 시작되었습니다. [${proxyMode}]`);
}

main().catch((error: unknown) => {
  console.error("shopdanawa-mcp 서버 시작 실패:", error);
  process.exit(1);
});
