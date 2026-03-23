#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { BridgeCommandQueue } from "./bridge/commandQueue.js";
import { BridgeEventStore } from "./bridge/eventStore.js";
import { ensureBridgeDirectories, loadConfig } from "./config.js";
import { registerSessionResources } from "./resources/sessionResources.js";
import { registerEditorTools } from "./tools/editorTools.js";
import { registerLogTools } from "./tools/logTools.js";
import { registerNativeInputTools } from "./tools/nativeInputTools.js";

type LaunchOptions = {
  ahkPath: string | null;
};

function parseLaunchOptions(argv: string[]): LaunchOptions {
  let ahkPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--ahk-path") {
      const value = argv[index + 1];
      if (value && !value.startsWith("--")) {
        ahkPath = value;
        index += 1;
      }
      continue;
    }

    if (arg.startsWith("--ahk-path=")) {
      const value = arg.slice("--ahk-path=".length).trim();
      ahkPath = value.length > 0 ? value : null;
    }
  }

  return {
    ahkPath
  };
}

async function main(): Promise<void> {
  const launchOptions = parseLaunchOptions(process.argv.slice(2));
  const config = loadConfig();
  ensureBridgeDirectories(config);

  const server = new McpServer({
    name: config.serverName,
    version: config.version
  });

  const commandQueue = new BridgeCommandQueue(config);
  const eventStore = new BridgeEventStore(config);

  registerEditorTools(server, commandQueue, eventStore, {
    defaultAhkPath: launchOptions.ahkPath
  });
  registerLogTools(server, eventStore);
  registerNativeInputTools(server, commandQueue, eventStore, {
    defaultAhkPath: launchOptions.ahkPath
  });
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
      eventsDir: config.paths.eventsDir,
      ahkPath: launchOptions.ahkPath
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
