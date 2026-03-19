import { mkdirSync } from "node:fs";
import { join } from "node:path";

export interface BridgePaths {
  serverRoot: string;
  dumpRoot: string;
  mcpBridgeRoot: string;
  commandsDir: string;
  eventsDir: string;
  stateDir: string;
  processedCommandsDir: string;
  legacyPayloadOverridesDir: string;
  legacyIdeImportFile: string;
  legacyIdeWorkspaceDir: string;
  legacySnippetFile: string;
}

export interface BridgeConfig {
  serverName: string;
  version: string;
  pollIntervalMs: number;
  maxEventsReturned: number;
  paths: BridgePaths;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): BridgeConfig {
  const serverRoot = process.env.DU_SERVER_ROOT ?? "D:/MyDUserver";
  const dumpRoot = process.env.DU_UI_DUMP_ROOT ?? join(serverRoot, "tmp", "ui-dumps");
  const mcpBridgeRoot = process.env.DU_MCP_BRIDGE_ROOT ?? join(dumpRoot, "mcp-bridge");

  const paths: BridgePaths = {
    serverRoot,
    dumpRoot,
    mcpBridgeRoot,
    commandsDir: join(mcpBridgeRoot, "commands"),
    eventsDir: join(mcpBridgeRoot, "events"),
    stateDir: join(mcpBridgeRoot, "state"),
    processedCommandsDir: join(mcpBridgeRoot, "state", "processed-commands"),
    legacyPayloadOverridesDir: join(dumpRoot, "payload-overrides"),
    legacyIdeImportFile: join(dumpRoot, "payload-overrides", "ide_import.json"),
    legacyIdeWorkspaceDir: join(dumpRoot, "ide-workspace"),
    legacySnippetFile: join(dumpRoot, "ide-workspace", "snippet.lua")
  };

  return {
    serverName: "du-mcp-bridge",
    version: "0.1.0",
    pollIntervalMs: envInt("DU_MCP_BRIDGE_POLL_MS", 500),
    maxEventsReturned: envInt("DU_MCP_BRIDGE_MAX_EVENTS", 100),
    paths
  };
}

export function ensureBridgeDirectories(config: BridgeConfig): void {
  const directories = [
    config.paths.dumpRoot,
    config.paths.mcpBridgeRoot,
    config.paths.commandsDir,
    config.paths.eventsDir,
    config.paths.stateDir,
    config.paths.processedCommandsDir,
    config.paths.legacyPayloadOverridesDir,
    config.paths.legacyIdeWorkspaceDir
  ];

  for (const directory of directories) {
    mkdirSync(directory, { recursive: true });
  }
}
