#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { BridgeCommandQueue } from "./bridge/commandQueue.js";
import { BridgeEventStore } from "./bridge/eventStore.js";
import { ensureBridgeDirectories, loadConfig } from "./config.js";
import { registerSessionResources } from "./resources/sessionResources.js";
import { registerEditorTools } from "./tools/editorTools.js";
import { registerLogTools } from "./tools/logTools.js";

async function main(): Promise<void> {
  const config = loadConfig();
  ensureBridgeDirectories(config);

  const server = new McpServer({
    name: config.serverName,
    version: config.version
  });

  const commandQueue = new BridgeCommandQueue(config);
  const eventStore = new BridgeEventStore(config);

  registerEditorTools(server, commandQueue, eventStore);
  registerLogTools(server, eventStore);
  registerSessionResources(server, eventStore);

  await eventStore.appendSystemEvent({
    eventId: `evt-${Date.now()}`,
    createdAtUtc: new Date().toISOString(),
    playerId: null,
    source: {
      kind: "bridge",
      boardId: null
    },
    type: "bridge_status",
    payload: {
      status: "started",
      commandsDir: config.paths.commandsDir,
      eventsDir: config.paths.eventsDir
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`DuMcpBridge running on stdio. Commands: ${config.paths.commandsDir}`);
}

main().catch((error: unknown) => {
  console.error("DuMcpBridge failed:", error);
  process.exit(1);
});
