import { readdir } from "node:fs/promises";
import {
  type BridgeConfig,
  getPlayerIdeImportFile,
  getPlayerSnippetFile
} from "../config.js";
import { bridgeEventSchema, type BridgeEvent } from "../contracts/events.js";
import { appendNdjson, readJsonFileIfExists, readNdjsonRecords, readTextFileIfExists, statFileIfExists } from "./fileBus.js";

type ParsedBridgeEvent = typeof bridgeEventSchema._output;

export interface ActiveCodeSnapshot {
  found: boolean;
  targetKind: "lua_editor" | "screen_editor";
  playerId: number;
  code: string | null;
  source: string | null;
  path: string | null;
  lastModifiedUtc: string | null;
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
  public constructor(private readonly config: BridgeConfig) {}

  public async appendSystemEvent(event: BridgeEvent): Promise<void> {
    const eventFile = `${this.config.paths.eventsDir}/bridge-events.ndjson`;
    await appendNdjson(eventFile, event);
  }

  public async listRecentEvents(limit = this.config.maxEventsReturned): Promise<ParsedBridgeEvent[]> {
    const rawEvents = await readNdjsonRecords<unknown>(this.config.paths.eventsDir, limit * 4);
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

  public async readActiveCode(targetKind: "lua_editor" | "screen_editor", playerId: number): Promise<ActiveCodeSnapshot> {
    const playerSnippetPath = getPlayerSnippetFile(this.config, playerId, targetKind);
    const snippetText = await readTextFileIfExists(playerSnippetPath);
    if (snippetText !== null) {
      const stats = await statFileIfExists(playerSnippetPath);
      return {
        found: true,
        targetKind,
        playerId,
        code: snippetText,
        source: "workspace_snippet",
        path: playerSnippetPath,
        lastModifiedUtc: stats?.mtimeUtc ?? null
      };
    }

    const playerImportPath = getPlayerIdeImportFile(this.config, playerId, targetKind);
    const importJson = await readJsonFileIfExists<{ code?: string; playerId?: number }>(playerImportPath);
    if (typeof importJson?.code === "string" && (typeof importJson.playerId !== "number" || importJson.playerId === playerId)) {
      const stats = await statFileIfExists(playerImportPath);
      return {
        found: true,
        targetKind,
        playerId,
        code: importJson.code,
        source: "ide_import",
        path: playerImportPath,
        lastModifiedUtc: stats?.mtimeUtc ?? null
      };
    }

    return {
      found: false,
      targetKind,
      playerId,
      code: null,
      source: null,
      path: null,
      lastModifiedUtc: null
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
