import { mkdirSync } from "node:fs";
import { join } from "node:path";

export interface BridgePaths {
  serverRoot: string;
  dumpRoot: string;
  mcpBridgeRoot: string;
  commandsDir: string;
  eventsDir: string;
  eventsArchiveDir: string;
  stateDir: string;
  processedCommandsDir: string;
  payloadOverridesDir: string;
  ideWorkspaceDir: string;
}

export interface BridgeConfig {
  serverName: string;
  version: string;
  pollIntervalMs: number;
  maxEventsReturned: number;
  maxEventFilesScanned: number;
  bridgeEventFileMaxBytes: number;
  bridgeEventRetentionDays: number;
  processedCommandRetentionDays: number;
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
    eventsArchiveDir: join(mcpBridgeRoot, "events", "archive"),
    stateDir: join(mcpBridgeRoot, "state"),
    processedCommandsDir: join(mcpBridgeRoot, "state", "processed-commands"),
    payloadOverridesDir: join(dumpRoot, "payload-overrides"),
    ideWorkspaceDir: join(dumpRoot, "ide-workspace")
  };

  return {
    serverName: "du-mcp-bridge",
    version: "0.1.0",
    pollIntervalMs: envInt("DU_MCP_BRIDGE_POLL_MS", 500),
    maxEventsReturned: envInt("DU_MCP_BRIDGE_MAX_EVENTS", 100),
    maxEventFilesScanned: envInt("DU_MCP_BRIDGE_MAX_EVENT_FILES_SCANNED", 12),
    bridgeEventFileMaxBytes: envInt("DU_MCP_BRIDGE_EVENT_FILE_MAX_BYTES", 512 * 1024),
    bridgeEventRetentionDays: envInt("DU_MCP_BRIDGE_EVENT_RETENTION_DAYS", 3),
    processedCommandRetentionDays: envInt("DU_MCP_BRIDGE_PROCESSED_COMMAND_RETENTION_DAYS", 3),
    paths
  };
}

export function ensureBridgeDirectories(config: BridgeConfig): void {
  const directories = [
    config.paths.dumpRoot,
    config.paths.mcpBridgeRoot,
    config.paths.commandsDir,
    config.paths.eventsDir,
    config.paths.eventsArchiveDir,
    config.paths.stateDir,
    config.paths.processedCommandsDir,
    config.paths.payloadOverridesDir,
    config.paths.ideWorkspaceDir
  ];

  for (const directory of directories) {
    mkdirSync(directory, { recursive: true });
  }
}

export function getPlayerWorkspaceDir(config: BridgeConfig, playerId: number): string {
  return join(config.paths.ideWorkspaceDir, `player-${playerId}`);
}

export function getPlayerTargetWorkspaceDir(
  config: BridgeConfig,
  playerId: number,
  targetKind: "lua_editor" | "screen_editor"
): string {
  return join(getPlayerWorkspaceDir(config, playerId), targetKind);
}

export function getPlayerSnippetFile(
  config: BridgeConfig,
  playerId: number,
  targetKind: "lua_editor" | "screen_editor"
): string {
  const fileName = targetKind === "lua_editor" ? "snippet.lua" : "snippet.txt";
  return join(getPlayerTargetWorkspaceDir(config, playerId, targetKind), fileName);
}

export function getPlayerSnippetMetaFile(
  config: BridgeConfig,
  playerId: number,
  targetKind: "lua_editor" | "screen_editor"
): string {
  return join(getPlayerTargetWorkspaceDir(config, playerId, targetKind), "snippet.sync.json");
}

export function getPlayerIdeImportFile(
  config: BridgeConfig,
  playerId: number,
  targetKind: "lua_editor" | "screen_editor"
): string {
  return join(config.paths.payloadOverridesDir, `ide_import.player-${playerId}.${targetKind}.json`);
}
