import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, GetPromptRequestSchema, ListPromptsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";

export function registerEmptyPromptSupport(server: McpServer): void {
  server.server.registerCapabilities({
    prompts: {}
  });

  server.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: []
  }));

  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    throw new McpError(ErrorCode.InvalidParams, `Prompt ${request.params.name} not found`);
  });
}
