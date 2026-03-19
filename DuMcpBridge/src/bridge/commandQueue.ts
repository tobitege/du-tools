import { randomUUID } from "node:crypto";
import { join } from "node:path";

import type { BridgeConfig } from "../config.js";
import { atomicWriteJson } from "./fileBus.js";
import type { BridgeCommand, CommandAction, TargetKind } from "../contracts/commands.js";

export interface EnqueueCommandInput {
  playerId: number;
  targetKind: TargetKind;
  action: CommandAction;
  boardId?: string | null;
  code?: string;
  language?: "lua" | "html";
  save?: boolean;
  isHtmlMode?: boolean;
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
        ...(typeof input.code === "string" ? { code: input.code } : {}),
        ...(input.language ? { language: input.language } : {}),
        ...(typeof input.save === "boolean" ? { save: input.save } : {}),
        ...(typeof input.isHtmlMode === "boolean" ? { isHtmlMode: input.isHtmlMode } : {}),
        ...(typeof input.waitForEditor === "boolean" ? { waitForEditor: input.waitForEditor } : {}),
        ...(typeof input.maxAttempts === "number" ? { maxAttempts: input.maxAttempts } : {}),
        ...(typeof input.retryDelayMs === "number" ? { retryDelayMs: input.retryDelayMs } : {}),
        ...(typeof input.probeMethod === "string" ? { probeMethod: input.probeMethod } : {}),
        ...(Array.isArray(input.probeArgs) ? { probeArgs: input.probeArgs } : {})
      }
    };

    await atomicWriteJson(path, command);
    if (input.action === "set_code" && typeof input.code === "string") {
      const statePath = join(this.config.paths.stateDir, `${input.targetKind}-${input.playerId}.json`);
      await atomicWriteJson(statePath, {
        playerId: input.playerId,
        targetKind: input.targetKind,
        boardId: input.boardId ?? null,
        code: input.code,
        language: input.language ?? null,
        isHtmlMode: input.isHtmlMode ?? null,
        queuedAtUtc: createdAtUtc
      });
    }
    return { command, path };
  }
}
