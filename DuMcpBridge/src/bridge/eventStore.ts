import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  type BridgeConfig,
  getPlayerIdeImportFile,
  getPlayerSnippetFile,
  getPlayerSnippetMetaFile
} from "../config.js";
import { bridgeEventSchema, type BridgeEvent } from "../contracts/events.js";
import { appendNdjson, readJsonFileIfExists, readTextFileIfExists, statFileIfExists } from "./fileBus.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const BRIDGE_EVENT_LEGACY_FILE_NAME = "bridge-events.ndjson";
const BRIDGE_EVENT_FILE_EXTENSION = ".ndjson";
const BRIDGE_EVENT_FILE_PATTERN = /^bridge-events-(\d{8})(?:-(\d{3}))?\.ndjson$/i;

type ParsedBridgeEvent = typeof bridgeEventSchema._output;

interface ListedFileEntry {
  fullPath: string;
  name: string;
  sizeBytes: number;
  mtimeMs: number;
  mtimeUtc: string;
}

interface BridgeEventFileEntry extends ListedFileEntry {
  dateKey: string | null;
  sequence: number;
  isLegacy: boolean;
}

export interface BridgeEventFileSummary {
  path: string;
  name: string;
  sizeBytes: number;
  mtimeUtc: string | null;
  dateKey: string | null;
  sequence: number | null;
  legacy: boolean;
}

export interface BridgeEventStatusSnapshot {
  currentWritableFilePath: string;
  currentWritableFileName: string;
  currentWritableFileSizeBytes: number;
  latestActiveFilePath: string | null;
  latestActiveFileName: string | null;
  maxFileSizeBytes: number;
  eventRetentionDays: number;
  processedCommandRetentionDays: number;
  maxFilesScanned: number;
  activeFileCount: number;
  archiveFileCount: number;
  processedCommandFileCount: number;
  activeTotalBytes: number;
  archiveTotalBytes: number;
  processedCommandTotalBytes: number;
  oldestActiveMtimeUtc: string | null;
  newestActiveMtimeUtc: string | null;
  oldestArchiveMtimeUtc: string | null;
  newestArchiveMtimeUtc: string | null;
  legacyFilePresent: boolean;
  largestActiveFiles: BridgeEventFileSummary[];
}

export interface BridgeEventHousekeepingInput {
  dryRun: boolean;
  pruneEventFilesOlderThanDays: number;
  pruneProcessedCommandsOlderThanDays: number;
  rotateNow: boolean;
  resetCurrent: boolean;
}

export interface BridgeEventHousekeepingResult {
  dryRun: boolean;
  rotated: boolean;
  reset: boolean;
  archivedFileCount: number;
  prunedEventFileCount: number;
  prunedArchiveFileCount: number;
  prunedProcessedCommandCount: number;
  archivedPaths: string[];
  deletedEventPaths: string[];
  deletedArchivePaths: string[];
  deletedProcessedCommandPaths: string[];
  status: BridgeEventStatusSnapshot;
}

export interface ActiveCodeSnapshot {
  found: boolean;
  targetKind: "lua_editor" | "screen_editor";
  playerId: number;
  code: string | null;
  source: string | null;
  path: string | null;
  metadataPath: string | null;
  context: string | null;
  syncId: string | null;
  updatedAtUtc: string | null;
  lastModifiedUtc: string | null;
  reason: string | null;
  message: string | null;
  nextStep: string | null;
}

export interface PendingIdeImportSnapshot {
  found: boolean;
  targetKind: "lua_editor" | "screen_editor";
  playerId: number;
  requestId: string | null;
  code: string | null;
  codeCharLength: number | null;
  codeUtf8Bytes: number | null;
  codeHash32: string | null;
  codeSha256: string | null;
  sourceSyncId: string | null;
  contextKey: string | null;
  path: string | null;
  workspaceCodePath: string | null;
  workspaceMetaPath: string | null;
  requestCreatedAtUtc: string | null;
  exportedAtUtc: string | null;
  lastModifiedUtc: string | null;
}

interface IdeImportPayload {
  requestId?: unknown;
  playerId?: unknown;
  code?: unknown;
  codeCharLength?: unknown;
  codeUtf8Bytes?: unknown;
  codeHash32?: unknown;
  codeSha256?: unknown;
  sourceSyncId?: unknown;
  contextKey?: unknown;
  workspaceCodePath?: unknown;
  workspaceMetaPath?: unknown;
  requestCreatedAtUtc?: unknown;
  exportedAtUtc?: unknown;
}

interface WorkspaceSnippetMetadata {
  context?: unknown;
  syncId?: unknown;
  updatedAtUtc?: unknown;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildMissingActiveCodeSnapshot(
  targetKind: "lua_editor" | "screen_editor",
  playerId: number,
  codePath: string,
  metadataPath: string,
  reason: string | null,
  message: string | null,
  nextStep: string | null
): ActiveCodeSnapshot {
  return {
    found: false,
    targetKind,
    playerId,
    code: null,
    source: null,
    path: codePath,
    metadataPath,
    context: null,
    syncId: null,
    updatedAtUtc: null,
    lastModifiedUtc: null,
    reason,
    message,
    nextStep
  };
}

export interface SessionSummary {
  playerId: number;
  lastActivityUtc: string | null;
  sources: string[];
}

export interface ProbeResultSnapshot {
  found: boolean;
  commandId: string;
  method: string | null;
  success: boolean | null;
  createdAtUtc: string | null;
  resultJson: string | null;
  error: string | null;
}

export interface CommandEventSnapshot {
  found: boolean;
  commandId: string;
  eventType: string;
  createdAtUtc: string | null;
  payloadJson: string | null;
}

export class BridgeEventStore {
  private eventFileOperationChain: Promise<void> = Promise.resolve();

  public constructor(private readonly config: BridgeConfig) {}

  public async appendSystemEvent(event: BridgeEvent): Promise<void> {
    await this.withEventFileOperation(async () => {
      const serializedEvent = `${JSON.stringify(event)}\n`;
      const eventFile = await this.resolveCurrentWritableEventFile(Buffer.byteLength(serializedEvent, "utf8"));
      await appendNdjson(eventFile.fullPath, event);
    });
  }

  public async listRecentEvents(limit = this.config.maxEventsReturned): Promise<ParsedBridgeEvent[]> {
    const rawEvents = await this.readRecentRawEvents(limit * 4);
    const parsedEvents: ParsedBridgeEvent[] = [];

    for (const rawEvent of rawEvents) {
      const parsed = bridgeEventSchema.safeParse(rawEvent);
      if (parsed.success) {
        parsedEvents.push(parsed.data);
      }
    }

    return parsedEvents.slice(-limit);
  }

  public async getLastResult(playerId?: number, targetKind?: string, eventType?: string): Promise<ParsedBridgeEvent | null> {
    const events = await this.listRecentEvents(this.config.maxEventsReturned);

    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (typeof playerId === "number" && event.playerId !== playerId) {
        continue;
      }
      if (targetKind && event.source.kind !== targetKind) {
        continue;
      }
      if (eventType && event.type !== eventType) {
        continue;
      }
      return event;
    }

    return null;
  }

  public async tailRuntimeLogs(playerId: number | undefined, limit: number): Promise<string[]> {
    const events = await this.listRecentEvents(Math.max(limit * 4, 20));
    const lines: string[] = [];

    for (const event of events) {
      if (typeof playerId === "number" && event.playerId !== playerId) {
        continue;
      }
      if (
        event.type !== "runtime_log" &&
        event.type !== "command_result" &&
        event.type !== "bridge_status" &&
        event.type !== "chat_snapshot" &&
        event.type !== "chat_send_result" &&
        event.type !== "chat_channel_result" &&
        event.type !== "server_chat_snapshot"
      ) {
        continue;
      }

      const payloadText = JSON.stringify(event.payload);
      lines.push(`${event.createdAtUtc} [${event.type}] player=${event.playerId ?? "n/a"} source=${event.source.kind} ${payloadText}`);
    }

    return lines.slice(-limit);
  }

  public async listActiveSessions(limit: number): Promise<SessionSummary[]> {
    const sessions = new Map<number, SessionSummary>();
    const recentEvents = await this.listRecentEvents(this.config.maxEventsReturned);

    for (const event of recentEvents) {
      if (typeof event.playerId !== "number") {
        continue;
      }

      const existing = sessions.get(event.playerId) ?? {
        playerId: event.playerId,
        lastActivityUtc: event.createdAtUtc,
        sources: []
      };

      existing.lastActivityUtc = existing.lastActivityUtc && existing.lastActivityUtc > event.createdAtUtc
        ? existing.lastActivityUtc
        : event.createdAtUtc;

      if (!existing.sources.includes(event.source.kind)) {
        existing.sources.push(event.source.kind);
      }

      sessions.set(event.playerId, existing);
    }

    try {
      const importFiles = await readdir(this.config.paths.payloadOverridesDir, { withFileTypes: true });
      for (const entry of importFiles) {
        if (!entry.isFile()) {
          continue;
        }
        const match = /^ide_import\.player-(\d+)\.(lua_editor|screen_editor)\.json$/i.exec(entry.name);
        if (!match) {
          continue;
        }

        const importPlayerId = Number.parseInt(match[1] ?? "", 10);
        const sourceKind = (match[2] ?? "lua_editor") as "lua_editor" | "screen_editor";
        if (!Number.isFinite(importPlayerId)) {
          continue;
        }

        const existing = sessions.get(importPlayerId);
        if (existing) {
          if (!existing.sources.includes(sourceKind)) {
            existing.sources.push(sourceKind);
          }
          sessions.set(importPlayerId, existing);
          continue;
        }

        sessions.set(importPlayerId, {
          playerId: importPlayerId,
          lastActivityUtc: null,
          sources: [sourceKind]
        });
      }
    } catch {
      // Ignore optional IDE-sync workspace scan errors.
    }

    return [...sessions.values()]
      .sort((left, right) => (right.lastActivityUtc ?? "").localeCompare(left.lastActivityUtc ?? ""))
      .slice(0, limit);
  }

  public async getBridgeEventStatus(): Promise<BridgeEventStatusSnapshot> {
    const activeFiles = await this.listActiveEventFiles();
    const archiveFiles = await this.listArchivedEventFiles();
    const processedCommandFiles = await this.listProcessedCommandFiles();
    const latestActiveFile = [...activeFiles].sort(compareBridgeEventFilesNewestFirst)[0] ?? null;
    const currentWritableFile = await this.resolveCurrentWritableEventFile(1);
    const currentWritableExisting = activeFiles.find((file) => file.fullPath === currentWritableFile.fullPath) ?? null;

    return {
      currentWritableFilePath: currentWritableFile.fullPath,
      currentWritableFileName: currentWritableFile.name,
      currentWritableFileSizeBytes: currentWritableExisting?.sizeBytes ?? 0,
      latestActiveFilePath: latestActiveFile?.fullPath ?? null,
      latestActiveFileName: latestActiveFile?.name ?? null,
      maxFileSizeBytes: this.config.bridgeEventFileMaxBytes,
      eventRetentionDays: this.config.bridgeEventRetentionDays,
      processedCommandRetentionDays: this.config.processedCommandRetentionDays,
      maxFilesScanned: this.config.maxEventFilesScanned,
      activeFileCount: activeFiles.length,
      archiveFileCount: archiveFiles.length,
      processedCommandFileCount: processedCommandFiles.length,
      activeTotalBytes: sumFileBytes(activeFiles),
      archiveTotalBytes: sumFileBytes(archiveFiles),
      processedCommandTotalBytes: sumFileBytes(processedCommandFiles),
      oldestActiveMtimeUtc: getOldestMtimeUtc(activeFiles),
      newestActiveMtimeUtc: getNewestMtimeUtc(activeFiles),
      oldestArchiveMtimeUtc: getOldestMtimeUtc(archiveFiles),
      newestArchiveMtimeUtc: getNewestMtimeUtc(archiveFiles),
      legacyFilePresent: activeFiles.some((file) => file.isLegacy),
      largestActiveFiles: [...activeFiles]
        .sort((left, right) => right.sizeBytes - left.sizeBytes || right.mtimeMs - left.mtimeMs)
        .slice(0, 5)
        .map(toBridgeEventFileSummary)
    };
  }

  public async runBridgeEventHousekeeping(input: BridgeEventHousekeepingInput): Promise<BridgeEventHousekeepingResult> {
    return await this.withEventFileOperation(async () => {
      const activeFiles = await this.listActiveEventFiles();
      const archiveFiles = await this.listArchivedEventFiles();
      const processedCommandFiles = await this.listProcessedCommandFiles();
      const latestActiveFile = [...activeFiles].sort(compareBridgeEventFilesNewestFirst)[0] ?? null;
      const currentWritableFile = await this.resolveCurrentWritableEventFile(1);
      const archivedPaths: string[] = [];
      const deletedEventPaths: string[] = [];
      const deletedArchivePaths: string[] = [];
      const deletedProcessedCommandPaths: string[] = [];
      const handledActiveFiles = new Set<string>();
      const dryRun = input.dryRun;
      const rotateRequested = input.rotateNow || input.resetCurrent;
      let rotated = false;

      if (rotateRequested && latestActiveFile) {
        const archivedPath = buildArchivedEventFilePath(
          this.config.paths.eventsArchiveDir,
          latestActiveFile.name,
          input.resetCurrent ? "reset" : "rotate"
        );
        pushLimited(archivedPaths, archivedPath);
        rotated = true;
        handledActiveFiles.add(latestActiveFile.fullPath);

        if (!dryRun) {
          await mkdir(this.config.paths.eventsArchiveDir, { recursive: true });
          await rename(latestActiveFile.fullPath, archivedPath);
        }
      }

      if (input.resetCurrent && !dryRun) {
        await mkdir(this.config.paths.eventsDir, { recursive: true });
        await writeFile(currentWritableFile.fullPath, "", "utf8");
      }

      const eventCutoffMs = Date.now() - Math.max(input.pruneEventFilesOlderThanDays, 0) * DAY_MS;
      const processedCommandCutoffMs = Date.now() - Math.max(input.pruneProcessedCommandsOlderThanDays, 0) * DAY_MS;

      for (const file of activeFiles) {
        if (handledActiveFiles.has(file.fullPath)) {
          continue;
        }
        if (file.mtimeMs >= eventCutoffMs) {
          continue;
        }

        pushLimited(deletedEventPaths, file.fullPath);
        if (!dryRun) {
          await rm(file.fullPath, { force: true });
        }
      }

      for (const file of archiveFiles) {
        if (file.mtimeMs >= eventCutoffMs) {
          continue;
        }

        pushLimited(deletedArchivePaths, file.fullPath);
        if (!dryRun) {
          await rm(file.fullPath, { force: true });
        }
      }

      for (const file of processedCommandFiles) {
        if (file.mtimeMs >= processedCommandCutoffMs) {
          continue;
        }

        pushLimited(deletedProcessedCommandPaths, file.fullPath);
        if (!dryRun) {
          await rm(file.fullPath, { force: true });
        }
      }

      return {
        dryRun,
        rotated,
        reset: input.resetCurrent,
        archivedFileCount: archivedPaths.length,
        prunedEventFileCount: deletedEventPaths.length,
        prunedArchiveFileCount: deletedArchivePaths.length,
        prunedProcessedCommandCount: deletedProcessedCommandPaths.length,
        archivedPaths,
        deletedEventPaths,
        deletedArchivePaths,
        deletedProcessedCommandPaths,
        status: await this.getBridgeEventStatus()
      };
    });
  }

  public async readActiveCode(targetKind: "lua_editor" | "screen_editor", playerId: number): Promise<ActiveCodeSnapshot> {
    const playerSnippetPath = getPlayerSnippetFile(this.config, playerId, targetKind);
    const playerSnippetMetaPath = getPlayerSnippetMetaFile(this.config, playerId, targetKind);
    const [snippetText, snippetMeta] = await Promise.all([
      readTextFileIfExists(playerSnippetPath),
      readJsonFileIfExists<WorkspaceSnippetMetadata>(playerSnippetMetaPath)
    ]);

    if (snippetText === null && snippetMeta === null) {
      return buildMissingActiveCodeSnapshot(
        targetKind,
        playerId,
        playerSnippetPath,
        playerSnippetMetaPath,
        "snippet_missing",
        "No workspace snippet is available for this editor.",
        "Export or reselect the editor context to refresh snippet.lua|txt and snippet.json."
      );
    }

    if (snippetText === null || snippetMeta === null) {
      return buildMissingActiveCodeSnapshot(
        targetKind,
        playerId,
        playerSnippetPath,
        playerSnippetMetaPath,
        "snippet_pair_missing",
        "snippet.lua|txt and snippet.json must exist together.",
        "Refresh the workspace snippet so both files are rewritten as a pair."
      );
    }

    const context = optionalString(snippetMeta.context);
    const syncId = optionalString(snippetMeta.syncId);
    const updatedAtUtc = optionalString(snippetMeta.updatedAtUtc);
    if (!context || !syncId || !updatedAtUtc) {
      return buildMissingActiveCodeSnapshot(
        targetKind,
        playerId,
        playerSnippetPath,
        playerSnippetMetaPath,
        "snippet_metadata_invalid",
        "snippet.json is missing required sync metadata.",
        "Refresh the workspace snippet to regenerate snippet.json with context and syncId."
      );
    }

    const stats = await statFileIfExists(playerSnippetPath);
    return {
      found: true,
      targetKind,
      playerId,
      code: snippetText,
      source: "workspace_snippet_pair",
      path: playerSnippetPath,
      metadataPath: playerSnippetMetaPath,
      context,
      syncId,
      updatedAtUtc,
      lastModifiedUtc: stats?.mtimeUtc ?? null,
      reason: null,
      message: null,
      nextStep: null
    };
  }

  public async readPendingIdeImport(targetKind: "lua_editor" | "screen_editor", playerId: number): Promise<PendingIdeImportSnapshot> {
    const playerImportPath = getPlayerIdeImportFile(this.config, playerId, targetKind);
    const importJson = await readJsonFileIfExists<IdeImportPayload>(playerImportPath);
    if (importJson === null) {
      return {
        found: false,
        targetKind,
        playerId,
        requestId: null,
        code: null,
        codeCharLength: null,
        codeUtf8Bytes: null,
        codeHash32: null,
        codeSha256: null,
        sourceSyncId: null,
        contextKey: null,
        path: null,
        workspaceCodePath: null,
        workspaceMetaPath: null,
        requestCreatedAtUtc: null,
        exportedAtUtc: null,
        lastModifiedUtc: null
      };
    }

    if (typeof importJson.playerId === "number" && importJson.playerId !== playerId) {
      return {
        found: false,
        targetKind,
        playerId,
        requestId: null,
        code: null,
        codeCharLength: null,
        codeUtf8Bytes: null,
        codeHash32: null,
        codeSha256: null,
        sourceSyncId: null,
        contextKey: null,
        path: playerImportPath,
        workspaceCodePath: null,
        workspaceMetaPath: null,
        requestCreatedAtUtc: null,
        exportedAtUtc: null,
        lastModifiedUtc: null
      };
    }

    const stats = await statFileIfExists(playerImportPath);
    return {
      found: true,
      targetKind,
      playerId,
      requestId: optionalString(importJson.requestId),
      code: typeof importJson.code === "string" ? importJson.code : null,
      codeCharLength: optionalNumber(importJson.codeCharLength),
      codeUtf8Bytes: optionalNumber(importJson.codeUtf8Bytes),
      codeHash32: optionalString(importJson.codeHash32),
      codeSha256: optionalString(importJson.codeSha256),
      sourceSyncId: optionalString(importJson.sourceSyncId),
      contextKey: optionalString(importJson.contextKey),
      path: playerImportPath,
      workspaceCodePath: optionalString(importJson.workspaceCodePath),
      workspaceMetaPath: optionalString(importJson.workspaceMetaPath),
      requestCreatedAtUtc: optionalString(importJson.requestCreatedAtUtc),
      exportedAtUtc: optionalString(importJson.exportedAtUtc),
      lastModifiedUtc: stats?.mtimeUtc ?? null
    };
  }

  public async waitForProbeResult(commandId: string, timeoutMs: number): Promise<ProbeResultSnapshot> {
    const deadline = Date.now() + Math.max(timeoutMs, 250);

    while (Date.now() <= deadline) {
      const event = await this.findProbeResult(commandId);
      if (event) {
        const payload = event.payload ?? {};
        return {
          found: true,
          commandId,
          method: typeof payload.method === "string" ? payload.method : null,
          success: typeof payload.success === "boolean" ? payload.success : null,
          createdAtUtc: event.createdAtUtc,
          resultJson: payload.result === undefined ? null : JSON.stringify(payload.result, null, 2),
          error: typeof payload.error === "string" ? payload.error : null
        };
      }

      await delay(250);
    }

    return {
      found: false,
      commandId,
      method: null,
      success: null,
      createdAtUtc: null,
      resultJson: null,
      error: null
    };
  }

  public async waitForCommandEvent(commandId: string, eventType: string, timeoutMs: number): Promise<CommandEventSnapshot> {
    const deadline = Date.now() + Math.max(timeoutMs, 250);

    while (Date.now() <= deadline) {
      const event = await this.findCommandEvent(commandId, eventType);
      if (event) {
        return {
          found: true,
          commandId,
          eventType,
          createdAtUtc: event.createdAtUtc,
          payloadJson: JSON.stringify(event.payload ?? {}, null, 2)
        };
      }

      await delay(250);
    }

    return {
      found: false,
      commandId,
      eventType,
      createdAtUtc: null,
      payloadJson: null
    };
  }

  private async withEventFileOperation<T>(action: () => Promise<T>): Promise<T> {
    const previous = this.eventFileOperationChain;
    let release!: () => void;
    this.eventFileOperationChain = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous.catch(() => undefined);

    try {
      return await action();
    } finally {
      release();
    }
  }

  private async readRecentRawEvents(limit: number): Promise<unknown[]> {
    const files = (await this.listActiveEventFiles())
      .sort(compareBridgeEventFilesNewestFirst)
      .slice(0, this.config.maxEventFilesScanned);
    const newestFirst: unknown[] = [];

    for (const file of files) {
      const raw = await readTextFileIfExists(file.fullPath);
      if (!raw) {
        continue;
      }

      const lines = stripUtf8Bom(raw).split(/\r?\n/);
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const trimmed = lines[index]?.trim();
        if (!trimmed) {
          continue;
        }

        try {
          newestFirst.push(JSON.parse(trimmed) as unknown);
        } catch {
          continue;
        }

        if (newestFirst.length >= limit) {
          return newestFirst.reverse();
        }
      }
    }

    return newestFirst.reverse();
  }

  private async resolveCurrentWritableEventFile(appendBytes: number): Promise<BridgeEventFileEntry> {
    const dateKey = formatUtcDateKey(new Date());
    const activeFiles = await this.listActiveEventFiles();
    const todaysFiles = activeFiles
      .filter((file) => !file.isLegacy && file.dateKey === dateKey)
      .sort((left, right) => left.sequence - right.sequence);
    const latestTodayFile = todaysFiles.at(-1);

    if (!latestTodayFile) {
      return createVirtualBridgeEventFile(this.config.paths.eventsDir, dateKey, 0);
    }

    if (latestTodayFile.sizeBytes + appendBytes <= this.config.bridgeEventFileMaxBytes) {
      return latestTodayFile;
    }

    return createVirtualBridgeEventFile(this.config.paths.eventsDir, dateKey, latestTodayFile.sequence + 1);
  }

  private async listActiveEventFiles(): Promise<BridgeEventFileEntry[]> {
    const files = await listDirectoryFiles(this.config.paths.eventsDir);
    const result: BridgeEventFileEntry[] = [];

    for (const file of files) {
      const parsed = parseActiveBridgeEventFileName(file.name);
      if (!parsed) {
        continue;
      }

      result.push({
        ...file,
        dateKey: parsed.dateKey,
        sequence: parsed.sequence,
        isLegacy: parsed.isLegacy
      });
    }

    return result;
  }

  private async listArchivedEventFiles(): Promise<BridgeEventFileEntry[]> {
    const files = await listDirectoryFiles(this.config.paths.eventsArchiveDir);
    return files
      .filter((file) => file.name.toLowerCase().endsWith(BRIDGE_EVENT_FILE_EXTENSION))
      .map((file) => {
        const dateMatch = /^bridge-events-(\d{8})/i.exec(file.name);
        return {
          ...file,
          dateKey: dateMatch?.[1] ?? null,
          sequence: -1,
          isLegacy: false
        };
      });
  }

  private async listProcessedCommandFiles(): Promise<ListedFileEntry[]> {
    return await listDirectoryFiles(this.config.paths.processedCommandsDir);
  }

  private async findProbeResult(commandId: string): Promise<ParsedBridgeEvent | null> {
    const events = await this.listRecentEvents(this.config.maxEventsReturned);

    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event.type !== "probe_result") {
        continue;
      }

      const payload = event.payload ?? {};
      if (payload.commandId === commandId) {
        return event;
      }
    }

    return null;
  }

  private async findCommandEvent(commandId: string, eventType: string): Promise<ParsedBridgeEvent | null> {
    const events = await this.listRecentEvents(this.config.maxEventsReturned);

    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event.type !== eventType) {
        continue;
      }

      const payload = event.payload ?? {};
      if (payload.commandId === commandId) {
        return event;
      }
    }

    return null;
  }
}

async function listDirectoryFiles(directory: string): Promise<ListedFileEntry[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const fullPath = join(directory, entry.name);
          const stats = await stat(fullPath);
          return {
            fullPath,
            name: entry.name,
            sizeBytes: stats.size,
            mtimeMs: stats.mtimeMs,
            mtimeUtc: stats.mtime.toISOString()
          };
        })
    );

    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function parseActiveBridgeEventFileName(name: string): { dateKey: string | null; sequence: number; isLegacy: boolean } | null {
  if (name === BRIDGE_EVENT_LEGACY_FILE_NAME) {
    return {
      dateKey: null,
      sequence: -1,
      isLegacy: true
    };
  }

  const match = BRIDGE_EVENT_FILE_PATTERN.exec(name);
  if (!match) {
    return null;
  }

  return {
    dateKey: match[1] ?? null,
    sequence: Number.parseInt(match[2] ?? "0", 10) || 0,
    isLegacy: false
  };
}

function buildBridgeEventFileName(dateKey: string, sequence: number): string {
  return sequence <= 0
    ? `bridge-events-${dateKey}.ndjson`
    : `bridge-events-${dateKey}-${sequence.toString().padStart(3, "0")}.ndjson`;
}

function createVirtualBridgeEventFile(eventsDir: string, dateKey: string, sequence: number): BridgeEventFileEntry {
  const name = buildBridgeEventFileName(dateKey, sequence);
  return {
    fullPath: join(eventsDir, name),
    name,
    sizeBytes: 0,
    mtimeMs: 0,
    mtimeUtc: "",
    dateKey,
    sequence,
    isLegacy: false
  };
}

function buildArchivedEventFilePath(archiveDir: string, originalName: string, reason: "reset" | "rotate"): string {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const baseName = originalName.toLowerCase().endsWith(BRIDGE_EVENT_FILE_EXTENSION)
    ? originalName.slice(0, -BRIDGE_EVENT_FILE_EXTENSION.length)
    : originalName;
  return join(archiveDir, `${baseName}.${reason}-${timestamp}.ndjson`);
}

function compareBridgeEventFilesNewestFirst(left: BridgeEventFileEntry, right: BridgeEventFileEntry): number {
  if (left.dateKey && right.dateKey && left.dateKey !== right.dateKey) {
    return right.dateKey.localeCompare(left.dateKey);
  }
  if (left.dateKey && !right.dateKey) {
    return -1;
  }
  if (!left.dateKey && right.dateKey) {
    return 1;
  }
  if (left.sequence !== right.sequence) {
    return right.sequence - left.sequence;
  }
  return right.mtimeMs - left.mtimeMs;
}

function formatUtcDateKey(value: Date): string {
  const year = value.getUTCFullYear().toString().padStart(4, "0");
  const month = (value.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = value.getUTCDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function sumFileBytes(files: Array<{ sizeBytes: number }>): number {
  return files.reduce((total, file) => total + file.sizeBytes, 0);
}

function getOldestMtimeUtc(files: Array<{ mtimeMs: number; mtimeUtc: string | null }>): string | null {
  if (files.length === 0) {
    return null;
  }

  return [...files].sort((left, right) => left.mtimeMs - right.mtimeMs)[0]?.mtimeUtc ?? null;
}

function getNewestMtimeUtc(files: Array<{ mtimeMs: number; mtimeUtc: string | null }>): string | null {
  if (files.length === 0) {
    return null;
  }

  return [...files].sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.mtimeUtc ?? null;
}

function toBridgeEventFileSummary(file: BridgeEventFileEntry): BridgeEventFileSummary {
  return {
    path: file.fullPath,
    name: file.name,
    sizeBytes: file.sizeBytes,
    mtimeUtc: file.mtimeUtc || null,
    dateKey: file.dateKey,
    sequence: file.isLegacy ? null : file.sequence,
    legacy: file.isLegacy
  };
}

function pushLimited(values: string[], nextValue: string): void {
  if (values.length >= 100) {
    return;
  }

  values.push(nextValue);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
