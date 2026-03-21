import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";

import type { BridgeConfig } from "../config.js";
import {
  getPlayerIdeImportFile,
  getPlayerSnippetFile,
  getPlayerSnippetMetaFile
} from "../config.js";
import { atomicWriteJson, atomicWriteText, readJsonFileIfExists } from "./fileBus.js";
import type { BridgeCommand, CommandAction, TargetKind } from "../contracts/commands.js";

export interface EnqueueCommandInput {
  playerId: number;
  targetKind: TargetKind;
  action: CommandAction;
  boardId?: string | null;
  save?: boolean;
  waitForEditor?: boolean;
  maxAttempts?: number;
  retryDelayMs?: number;
  probeMethod?: string;
  probeArgs?: unknown[];
}

export interface EnqueueCommandResult {
  command: BridgeCommand;
  path: string;
}

export interface StageIdeImportInput {
  playerId: number;
  targetKind: "lua_editor" | "screen_editor";
  sourcePath: string;
}

export interface StageIdeImportResult {
  requestId: string;
  playerId: number;
  targetKind: "lua_editor" | "screen_editor";
  sourcePath: string;
  workspacePath: string;
  metadataPath: string;
  importPath: string;
  code: string;
  codeCharLength: number;
  codeUtf8Bytes: number;
  codeHash32: string;
  codeSha256: string;
  hasContextMetadata: boolean;
}

type LegacySnippetMetadata = {
  syncId?: unknown;
  codeHash32?: unknown;
  codeSha256?: unknown;
  contextKey?: unknown;
  reference?: unknown;
  exportedAtUtc?: unknown;
};

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function computeTextHash32(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const lowByte = code & 0xff;
    const highByte = (code >>> 8) & 0xff;
    hash = Math.imul((hash ^ lowByte) >>> 0, 0x01000193) >>> 0;
    hash = Math.imul((hash ^ highByte) >>> 0, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

export class BridgeCommandQueue {
  public constructor(private readonly config: BridgeConfig) {}

  public async enqueue(input: EnqueueCommandInput): Promise<EnqueueCommandResult> {
    const commandId = randomUUID();
    const createdAtUtc = new Date().toISOString();
    const fileName = `${createdAtUtc.replaceAll(":", "-")}-${commandId}.json`;
    const path = join(this.config.paths.commandsDir, fileName);

    const command: BridgeCommand = {
      commandId,
      createdAtUtc,
      playerId: input.playerId,
      target: {
        kind: input.targetKind,
        boardId: input.boardId ?? null
      },
      action: input.action,
      payload: {
        ...(typeof input.save === "boolean" ? { save: input.save } : {}),
        ...(typeof input.waitForEditor === "boolean" ? { waitForEditor: input.waitForEditor } : {}),
        ...(typeof input.maxAttempts === "number" ? { maxAttempts: input.maxAttempts } : {}),
        ...(typeof input.retryDelayMs === "number" ? { retryDelayMs: input.retryDelayMs } : {}),
        ...(typeof input.probeMethod === "string" ? { probeMethod: input.probeMethod } : {}),
        ...(Array.isArray(input.probeArgs) ? { probeArgs: input.probeArgs } : {})
      }
    };

    await atomicWriteJson(path, command);
    return { command, path };
  }

  public async stageIdeImportFromFile(input: StageIdeImportInput): Promise<StageIdeImportResult> {
    const sourcePath = input.sourcePath;
    const code = await fs.readFile(sourcePath, "utf8");
    const workspacePath = getPlayerSnippetFile(this.config, input.playerId, input.targetKind);
    const metadataPath = getPlayerSnippetMetaFile(this.config, input.playerId, input.targetKind);
    const importPath = getPlayerIdeImportFile(this.config, input.playerId, input.targetKind);
    const lastExportMeta = await readJsonFileIfExists<LegacySnippetMetadata>(metadataPath);
    const requestId = `ide-import-${randomUUID().replaceAll("-", "")}`;
    const codeHash32 = computeTextHash32(code);
    const codeSha256 = createHash("sha256").update(code, "utf8").digest("hex");
    const codeUtf8Bytes = Buffer.byteLength(code, "utf8");
    const payload = {
      requestId,
      targetKind: input.targetKind,
      playerId: input.playerId,
      code,
      codeCharLength: code.length,
      codeUtf8Bytes,
      codeHash32,
      codeSha256,
      baseCodeHash32: readOptionalString(lastExportMeta?.codeHash32),
      baseCodeSha256: readOptionalString(lastExportMeta?.codeSha256),
      sourceSyncId: readOptionalString(lastExportMeta?.syncId),
      contextKey: readOptionalString(lastExportMeta?.contextKey),
      reference: lastExportMeta?.reference ?? null,
      exportedAtUtc: readOptionalString(lastExportMeta?.exportedAtUtc),
      workspaceCodePath: workspacePath,
      workspaceMetaPath: metadataPath,
      requestCreatedAtUtc: new Date().toISOString()
    };

    await atomicWriteText(workspacePath, code);
    await atomicWriteJson(importPath, payload);

    return {
      requestId,
      playerId: input.playerId,
      targetKind: input.targetKind,
      sourcePath,
      workspacePath,
      metadataPath,
      importPath,
      code,
      codeCharLength: code.length,
      codeUtf8Bytes,
      codeHash32,
      codeSha256,
      hasContextMetadata: lastExportMeta !== null
    };
  }
}
