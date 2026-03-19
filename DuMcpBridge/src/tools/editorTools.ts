import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { BridgeCommandQueue } from "../bridge/commandQueue.js";
import { BridgeEventStore } from "../bridge/eventStore.js";
import { targetKindSchema } from "../contracts/commands.js";

const pushCodeOutputSchema = {
  commandId: z.string(),
  status: z.literal("queued"),
  targetKind: targetKindSchema,
  playerId: z.number().int().nonnegative(),
  queuePath: z.string(),
  saveRequested: z.boolean(),
  waitForEditor: z.boolean(),
  maxAttempts: z.number().int().positive().nullable(),
  retryDelayMs: z.number().int().positive().nullable()
};

const pullCodeOutputSchema = {
  found: z.boolean(),
  targetKind: targetKindSchema,
  playerId: z.number().int().nonnegative(),
  code: z.string().nullable(),
  source: z.string().nullable(),
  path: z.string().nullable(),
  lastModifiedUtc: z.string().nullable()
};

const luaProbeOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  method: z.string().nullable(),
  success: z.boolean().nullable(),
  createdAtUtc: z.string().nullable(),
  resultJson: z.string().nullable(),
  error: z.string().nullable()
};

export function registerEditorTools(
  server: McpServer,
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore
): void {
  server.registerTool(
    "du_editor_push_code",
    {
      title: "Queue Editor Code Push",
      description: "Queues code for the active Dual Universe Lua or screen editor.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        targetKind: targetKindSchema.default("lua_editor").describe("Target editor kind"),
        code: z.string().min(1).describe("Code to inject into the active editor"),
        save: z.boolean().default(false).describe("Whether the bridge should try to save immediately"),
        boardId: z.string().nullable().optional().describe("Optional board identifier for future board-scoped routing"),
        isHtmlMode: z.boolean().optional().describe("For screen editor targets: whether the editor should switch to HTML mode"),
        waitForEditor: z.boolean().default(false).describe("When true, the client retries for a while until the editor UI becomes available"),
        maxAttempts: z.number().int().positive().default(10).describe("Maximum retry attempts when waitForEditor is enabled"),
        retryDelayMs: z.number().int().positive().default(2000).describe("Delay between retry attempts in milliseconds when waitForEditor is enabled")
      },
      outputSchema: pushCodeOutputSchema
    },
    async ({ playerId, targetKind, code, save, boardId, isHtmlMode, waitForEditor, maxAttempts, retryDelayMs }) => {
      const result = await commandQueue.enqueue({
        playerId,
        targetKind,
        action: "set_code",
        boardId,
        code,
        save,
        language: targetKind === "screen_editor" && isHtmlMode ? "html" : "lua",
        isHtmlMode,
        waitForEditor,
        maxAttempts,
        retryDelayMs
      });

      await eventStore.appendSystemEvent({
        eventId: `evt-${result.command.commandId}`,
        createdAtUtc: new Date().toISOString(),
        playerId,
        source: {
          kind: targetKind,
          boardId: boardId ?? null
        },
        type: "command_enqueued",
        payload: {
          commandId: result.command.commandId,
          action: "set_code",
          saveRequested: save,
          queuePath: result.path,
          waitForEditor,
          maxAttempts: waitForEditor ? maxAttempts : null,
          retryDelayMs: waitForEditor ? retryDelayMs : null
        }
      });

      const structuredContent = {
        commandId: result.command.commandId,
        status: "queued" as const,
        targetKind,
        playerId,
        queuePath: result.path,
        saveRequested: save,
        waitForEditor,
        maxAttempts: waitForEditor ? maxAttempts : null,
        retryDelayMs: waitForEditor ? retryDelayMs : null
      };

      return {
        content: [
          {
            type: "text",
            text: `Queued ${targetKind} set_code for player ${playerId}: ${result.command.commandId}`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_lua_probe_call",
    {
      title: "Call Lua Runtime Probe",
      description: "Calls the in-game Lua editor probe API and waits briefly for the structured result.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        method: z.enum(["describe", "select_slot", "select_filter", "set_code", "apply"]).describe("Lua probe method to invoke"),
        slotName: z.string().optional().describe("Slot name for select_slot"),
        filterEvent: z.string().optional().describe("Filter event name for select_filter"),
        code: z.string().optional().describe("Code for set_code"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ playerId, method, slotName, filterEvent, code, timeoutMs }) => {
      const probeArgs =
        method === "select_slot" ? [slotName ?? ""] :
        method === "select_filter" ? [filterEvent ?? ""] :
        method === "set_code" ? [code ?? ""] :
        [];

      const result = await commandQueue.enqueue({
        playerId,
        targetKind: "lua_editor",
        action: "probe_call",
        probeMethod: method,
        probeArgs
      });

      await eventStore.appendSystemEvent({
        eventId: `evt-${result.command.commandId}`,
        createdAtUtc: new Date().toISOString(),
        playerId,
        source: {
          kind: "lua_editor",
          boardId: null
        },
        type: "command_enqueued",
        payload: {
          commandId: result.command.commandId,
          action: "probe_call",
          probeMethod: method,
          queuePath: result.path
        }
      });

      const probeResult = await eventStore.waitForProbeResult(result.command.commandId, timeoutMs);
      const structuredContent = {
        found: probeResult.found,
        commandId: probeResult.commandId,
        method: probeResult.method,
        success: probeResult.success,
        createdAtUtc: probeResult.createdAtUtc,
        resultJson: probeResult.resultJson,
        error: probeResult.error
      };
      return {
        content: [
          {
            type: "text",
            text: probeResult.found
              ? (probeResult.resultJson ?? probeResult.error ?? "")
              : `No probe result received for ${method} within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_editor_pull_code",
    {
      title: "Read Active Editor Code",
      description: "Reads the currently exported editor code from the bridge workspace.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Player ID for session scoping"),
        targetKind: targetKindSchema.default("lua_editor").describe("Target editor kind")
      },
      outputSchema: pullCodeOutputSchema
    },
    async ({ playerId, targetKind }) => {
      const snapshot = await eventStore.readActiveCode(targetKind, playerId);
      const structuredContent = {
        ...snapshot
      };
      return {
        content: [
          {
            type: "text",
            text: snapshot.found
              ? snapshot.code ?? ""
              : `No active code snapshot found for player ${playerId} (${targetKind}).`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_editor_save",
    {
      title: "Queue Editor Save",
      description: "Queues a save action for the active Dual Universe editor.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        targetKind: targetKindSchema.default("lua_editor").describe("Target editor kind"),
        boardId: z.string().nullable().optional().describe("Optional board identifier for future board-scoped routing"),
        waitForEditor: z.boolean().default(false).describe("When true, the client retries for a while until the editor UI becomes available"),
        maxAttempts: z.number().int().positive().default(10).describe("Maximum retry attempts when waitForEditor is enabled"),
        retryDelayMs: z.number().int().positive().default(2000).describe("Delay between retry attempts in milliseconds when waitForEditor is enabled")
      },
      outputSchema: pushCodeOutputSchema
    },
    async ({ playerId, targetKind, boardId, waitForEditor, maxAttempts, retryDelayMs }) => {
      const result = await commandQueue.enqueue({
        playerId,
        targetKind,
        action: "save",
        boardId,
        save: true,
        waitForEditor,
        maxAttempts,
        retryDelayMs
      });

      await eventStore.appendSystemEvent({
        eventId: `evt-${result.command.commandId}`,
        createdAtUtc: new Date().toISOString(),
        playerId,
        source: {
          kind: targetKind,
          boardId: boardId ?? null
        },
        type: "command_enqueued",
        payload: {
          commandId: result.command.commandId,
          action: "save",
          queuePath: result.path,
          waitForEditor,
          maxAttempts: waitForEditor ? maxAttempts : null,
          retryDelayMs: waitForEditor ? retryDelayMs : null
        }
      });

      const structuredContent = {
        commandId: result.command.commandId,
        status: "queued" as const,
        targetKind,
        playerId,
        queuePath: result.path,
        saveRequested: true,
        waitForEditor,
        maxAttempts: waitForEditor ? maxAttempts : null,
        retryDelayMs: waitForEditor ? retryDelayMs : null
      };

      return {
        content: [
          {
            type: "text",
            text: `Queued ${targetKind} save for player ${playerId}: ${result.command.commandId}`
          }
        ],
        structuredContent
      };
    }
  );
}
