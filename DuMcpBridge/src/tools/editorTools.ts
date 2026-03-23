import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { BridgeCommandQueue } from "../bridge/commandQueue.js";
import { BridgeEventStore, type CommandEventSnapshot, type ProbeResultSnapshot } from "../bridge/eventStore.js";
import { targetKindSchema } from "../contracts/commands.js";
import { runNativeAhkInput, type NativeInputToolOptions } from "./nativeInputTools.js";

const editorTargetKindSchema = z.enum(["lua_editor", "screen_editor"]);
type EditorUiKind = z.infer<typeof editorTargetKindSchema>;

const stagedImportOutputSchema = {
  requestId: z.string(),
  status: z.literal("staged"),
  targetKind: editorTargetKindSchema,
  playerId: z.number().int().nonnegative(),
  sourcePath: z.string(),
  workspacePath: z.string(),
  metadataPath: z.string(),
  importPath: z.string(),
  codeCharLength: z.number().int().nonnegative(),
  codeUtf8Bytes: z.number().int().nonnegative(),
  codeHash32: z.string(),
  codeSha256: z.string(),
  hasContextMetadata: z.boolean()
};

const queuedCommandOutputSchema = {
  commandId: z.string(),
  status: z.literal("queued"),
  targetKind: editorTargetKindSchema,
  playerId: z.number().int().nonnegative(),
  queuePath: z.string(),
  saveRequested: z.boolean(),
  waitForEditor: z.boolean(),
  maxAttempts: z.number().int().positive().nullable(),
  retryDelayMs: z.number().int().positive().nullable()
};

const pullCodeOutputSchema = {
  found: z.boolean(),
  targetKind: editorTargetKindSchema,
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

const luaWaitEditorOutputSchema = {
  ready: z.boolean(),
  attempts: z.number().int().nonnegative(),
  waitedMs: z.number().int().nonnegative(),
  found: z.boolean(),
  commandId: z.string().nullable(),
  success: z.boolean().nullable(),
  createdAtUtc: z.string().nullable(),
  resultJson: z.string().nullable(),
  error: z.string().nullable()
};

const chatMessageOutputSchema = z.object({
  channelId: z.string().nullable(),
  channelName: z.string().nullable(),
  fromId: z.number().nullable(),
  fromName: z.string().nullable(),
  text: z.string(),
  fromMe: z.boolean(),
  isAdmin: z.boolean(),
  isCommunityHelper: z.boolean(),
  isNotification: z.boolean(),
  date: z.union([z.number(), z.string(), z.null()]),
  className: z.array(z.string())
});

const chatSnapshotOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  visible: z.boolean().nullable(),
  open: z.boolean().nullable(),
  source: z.string().nullable(),
  selectedChannelId: z.string().nullable(),
  selectedChannelName: z.string().nullable(),
  messageCount: z.number().nullable(),
  messages: z.array(chatMessageOutputSchema),
  snapshotJson: z.string().nullable(),
  parseError: z.string().nullable()
};

const chatAiMentionsOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  agentId: z.string().nullable(),
  includeGenericMentions: z.boolean(),
  source: z.string().nullable(),
  selectedChannelId: z.string().nullable(),
  selectedChannelName: z.string().nullable(),
  count: z.number().int().nonnegative(),
  messages: z.array(chatMessageOutputSchema),
  snapshotJson: z.string().nullable(),
  parseError: z.string().nullable()
};

const serverChatSnapshotOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  visible: z.boolean().nullable(),
  open: z.boolean().nullable(),
  source: z.string().nullable(),
  selectedChannelId: z.string().nullable(),
  selectedChannelName: z.string().nullable(),
  messageCount: z.number().nullable(),
  messages: z.array(chatMessageOutputSchema),
  snapshotJson: z.string().nullable(),
  parseError: z.string().nullable()
};

const serverChatMentionsOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  agentId: z.string().nullable(),
  includeGenericMentions: z.boolean(),
  source: z.string().nullable(),
  selectedChannelId: z.string().nullable(),
  selectedChannelName: z.string().nullable(),
  count: z.number().int().nonnegative(),
  messages: z.array(chatMessageOutputSchema),
  snapshotJson: z.string().nullable(),
  parseError: z.string().nullable()
};

const chatSendOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean().nullable(),
  channelId: z.string().nullable(),
  channelName: z.string().nullable(),
  message: z.string().nullable(),
  usedExplicitChannel: z.boolean().nullable(),
  resultJson: z.string().nullable(),
  error: z.string().nullable(),
  parseError: z.string().nullable()
};

const chatChannelOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean().nullable(),
  requestedChannelName: z.string().nullable(),
  expectedChannelId: z.string().nullable(),
  existed: z.boolean().nullable(),
  selected: z.boolean().nullable(),
  channelId: z.string().nullable(),
  channelName: z.string().nullable(),
  resultJson: z.string().nullable(),
  error: z.string().nullable(),
  parseError: z.string().nullable()
};

type LuaProbeMethod =
  | "describe"
  | "chat_snapshot"
  | "chat_send"
  | "chat_join_channel"
  | "chat_select_channel"
  | "list_filters"
  | "select_slot"
  | "select_context"
  | "select_filter"
  | "select_filter_index"
  | "apply"
  | "cancel"
  | "add_filter"
  | "outer_html"
  | "raw_eval";

type LuaProbeCallFields = {
  slotName?: string | undefined;
  filterName?: string | undefined;
  filterIndex?: number | undefined;
  settleMs?: number | undefined;
  message?: string | undefined;
  channelId?: string | undefined;
  channelName?: string | undefined;
  selector?: string | undefined;
  functionBody?: string | undefined;
};

const screenEditorProbeMethods = new Set<LuaProbeMethod>(["describe", "apply", "cancel", "outer_html", "raw_eval"]);

function buildUiProbeArgs(targetKind: EditorUiKind, method: LuaProbeMethod, fields: LuaProbeCallFields): string[] {
  switch (method) {
    case "describe":
    case "chat_snapshot":
    case "list_filters":
    case "apply":
    case "cancel":
      return [];
    case "chat_send":
      return [fields.message ?? "", fields.channelId ?? ""];
    case "chat_join_channel":
      return [fields.channelName ?? ""];
    case "chat_select_channel":
      return [fields.channelId ?? fields.channelName ?? ""];
    case "select_slot":
      return [fields.slotName ?? ""];
    case "select_context":
      return [fields.slotName ?? "", fields.filterName ?? "", fields.settleMs ? String(fields.settleMs) : ""];
    case "select_filter":
      return [fields.filterName ?? ""];
    case "select_filter_index":
      return [typeof fields.filterIndex === "number" ? String(fields.filterIndex) : ""];
    case "add_filter":
      return [fields.filterName ?? ""];
    case "outer_html":
      return [fields.selector ?? (targetKind === "screen_editor" ? "" : "#filters")];
    case "raw_eval":
      return [fields.functionBody ?? ""];
    default: {
      const _exhaustive: never = method;
      void _exhaustive;
      return [];
    }
  }
}

const uiKindSchema = z
  .enum(["lua_editor", "screen_editor"])
  .describe("Target UI. `lua_editor` supports the public Lua probe API; `screen_editor` currently supports `describe`, `apply`, `cancel`, `outer_html`, `raw_eval`.");

function assertUiProbeMethodSupported(uiKind: EditorUiKind, method: LuaProbeMethod): void {
  if (uiKind === "screen_editor" && !screenEditorProbeMethods.has(method)) {
    throw new Error(`ui_method_not_supported_for_${uiKind}:${method}`);
  }
}

async function enqueueAndWaitUiProbe(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  targetKind: EditorUiKind,
  playerId: number,
  method: LuaProbeMethod,
  probeArgs: string[],
  timeoutMs: number
): Promise<ProbeResultSnapshot> {
  const result = await commandQueue.enqueue({
    playerId,
    targetKind,
    action: "probe_call",
    probeMethod: method,
    probeArgs
  });

  await eventStore.appendSystemEvent({
    eventId: `evt-${result.command.commandId}`,
    createdAtUtc: new Date().toISOString(),
    playerId,
    source: {
      kind: targetKind,
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

  return eventStore.waitForProbeResult(result.command.commandId, timeoutMs);
}

function formatProbeToolResult(
  probeResult: ProbeResultSnapshot,
  timeoutMs: number,
  methodLabel: string
): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: {
    found: boolean;
    commandId: string;
    method: string | null;
    success: boolean | null;
    createdAtUtc: string | null;
    resultJson: string | null;
    error: string | null;
  };
} {
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
          : `No probe result received for ${methodLabel} within ${timeoutMs}ms.`
      }
    ],
    structuredContent
  };
}

async function enqueueAndWaitCommandEvent(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  playerId: number,
  targetKind: z.infer<typeof targetKindSchema>,
  method: string,
  probeArgs: string[],
  eventType: string,
  timeoutMs: number
): Promise<CommandEventSnapshot> {
  const result = await commandQueue.enqueue({
    playerId,
    targetKind,
    action: "probe_call",
    probeMethod: method,
    probeArgs
  });

  await eventStore.appendSystemEvent({
    eventId: `evt-${result.command.commandId}`,
    createdAtUtc: new Date().toISOString(),
    playerId,
    source: {
      kind: targetKind,
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

  return eventStore.waitForCommandEvent(result.command.commandId, eventType, timeoutMs);
}

function parseChatSnapshotPayload(
  payloadJson: string | null
): {
  visible: boolean | null;
  open: boolean | null;
  source: string | null;
  selectedChannelId: string | null;
  selectedChannelName: string | null;
  messageCount: number | null;
  messages: Array<{
    channelId: string | null;
    channelName: string | null;
    fromId: number | null;
    fromName: string | null;
    text: string;
    fromMe: boolean;
    isAdmin: boolean;
    isCommunityHelper: boolean;
    isNotification: boolean;
    date: number | string | null;
    className: string[];
  }>;
  snapshotJson: string | null;
  parseError: string | null;
} {
  if (payloadJson === null) {
    return {
      visible: null,
      open: null,
      source: null,
      selectedChannelId: null,
      selectedChannelName: null,
      messageCount: null,
      messages: [],
      snapshotJson: null,
      parseError: null
    };
  }

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    const snapshot = parsed.snapshot && typeof parsed.snapshot === "object"
      ? parsed.snapshot as Record<string, unknown>
      : null;
    const rawMessages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
    const messages = rawMessages
      .map((message): {
        channelId: string | null;
        channelName: string | null;
        fromId: number | null;
        fromName: string | null;
        text: string;
        fromMe: boolean;
        isAdmin: boolean;
        isCommunityHelper: boolean;
        isNotification: boolean;
        date: number | string | null;
        className: string[];
      } | null => {
        if (!message || typeof message !== "object") {
          return null;
        }
        const value = message as Record<string, unknown>;
        return {
          channelId: typeof value.channelId === "string" ? value.channelId : null,
          channelName: typeof value.channelName === "string" ? value.channelName : null,
          fromId: typeof value.fromId === "number" && Number.isFinite(value.fromId) ? value.fromId : null,
          fromName: typeof value.fromName === "string" ? value.fromName : null,
          text: typeof value.text === "string" ? value.text : "",
          fromMe: value.fromMe === true,
          isAdmin: value.isAdmin === true,
          isCommunityHelper: value.isCommunityHelper === true,
          isNotification: value.isNotification === true,
          date: typeof value.date === "number" || typeof value.date === "string" ? value.date : null,
          className: Array.isArray(value.className) ? value.className.filter((item): item is string => typeof item === "string") : []
        };
      })
      .filter((message): message is {
        channelId: string | null;
        channelName: string | null;
        fromId: number | null;
        fromName: string | null;
        text: string;
        fromMe: boolean;
        isAdmin: boolean;
        isCommunityHelper: boolean;
        isNotification: boolean;
        date: number | string | null;
        className: string[];
      } => message !== null);
    return {
      visible: typeof snapshot?.visible === "boolean" ? snapshot.visible : null,
      open: typeof snapshot?.open === "boolean" ? snapshot.open : null,
      source: typeof snapshot?.source === "string" ? snapshot.source : null,
      selectedChannelId: typeof snapshot?.selectedChannelId === "string" ? snapshot.selectedChannelId : null,
      selectedChannelName: typeof snapshot?.selectedChannelName === "string" ? snapshot.selectedChannelName : null,
      messageCount: typeof snapshot?.messageCount === "number" && Number.isFinite(snapshot.messageCount) ? snapshot.messageCount : null,
      messages,
      snapshotJson: snapshot ? JSON.stringify(snapshot, null, 2) : null,
      parseError: null
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      visible: null,
      open: null,
      source: null,
      selectedChannelId: null,
      selectedChannelName: null,
      messageCount: null,
      messages: [],
      snapshotJson: null,
      parseError: message
    };
  }
}

function parseServerChatSnapshotPayload(
  payloadJson: string | null
): {
  success: boolean;
  error: string | null;
  visible: boolean | null;
  open: boolean | null;
  source: string | null;
  selectedChannelId: string | null;
  selectedChannelName: string | null;
  messageCount: number | null;
  messages: Array<{
    channelId: string | null;
    channelName: string | null;
    fromId: number | null;
    fromName: string | null;
    text: string;
    fromMe: boolean;
    isAdmin: boolean;
    isCommunityHelper: boolean;
    isNotification: boolean;
    date: number | string | null;
    className: string[];
  }>;
  snapshotJson: string | null;
  parseError: string | null;
} {
  if (payloadJson === null) {
    return {
      success: false,
      error: null,
      visible: null,
      open: null,
      source: null,
      selectedChannelId: null,
      selectedChannelName: null,
      messageCount: null,
      messages: [],
      snapshotJson: null,
      parseError: null
    };
  }

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    const snapshotParsed = parseChatSnapshotPayload(payloadJson);
    return {
      success: parsed.success === true,
      error: typeof parsed.error === "string" ? parsed.error : null,
      visible: snapshotParsed.visible,
      open: snapshotParsed.open,
      source: snapshotParsed.source,
      selectedChannelId: snapshotParsed.selectedChannelId,
      selectedChannelName: snapshotParsed.selectedChannelName,
      messageCount: snapshotParsed.messageCount,
      messages: snapshotParsed.messages,
      snapshotJson: snapshotParsed.snapshotJson,
      parseError: snapshotParsed.parseError
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: null,
      visible: null,
      open: null,
      source: null,
      selectedChannelId: null,
      selectedChannelName: null,
      messageCount: null,
      messages: [],
      snapshotJson: null,
      parseError: message
    };
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAgentId(agentId: string | undefined): string | null {
  const value = (agentId ?? "").trim().toLowerCase();
  return value.length > 0 ? value : null;
}

function messageHasAiReplyPrefix(text: string): boolean {
  return /^\s*\[AI:[A-Za-z0-9_-]+\]\s*/i.test(text);
}

function messageMentionsAi(text: string, agentId?: string, includeGenericMentions = true): boolean {
  if (messageHasAiReplyPrefix(text)) {
    return false;
  }

  const genericMention = /@ai\b(?!:)/i.test(text);
  const normalizedAgentId = normalizeAgentId(agentId);
  if (!normalizedAgentId) {
    return genericMention;
  }

  const targetedMention = new RegExp(`@ai:${escapeRegex(normalizedAgentId)}\\b`, "i").test(text);
  return targetedMention || (includeGenericMentions && genericMention);
}

function parseChatSendEventPayload(
  payloadJson: string | null
): {
  success: boolean | null;
  channelId: string | null;
  channelName: string | null;
  message: string | null;
  usedExplicitChannel: boolean | null;
  resultJson: string | null;
  error: string | null;
  parseError: string | null;
} {
  if (payloadJson === null) {
    return {
      success: null,
      channelId: null,
      channelName: null,
      message: null,
      usedExplicitChannel: null,
      resultJson: null,
      error: null,
      parseError: null
    };
  }

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    const result = parsed.result && typeof parsed.result === "object"
      ? parsed.result as Record<string, unknown>
      : null;
    return {
      success: typeof parsed.success === "boolean" ? parsed.success : null,
      channelId: typeof result?.channelId === "string" ? result.channelId : null,
      channelName: typeof result?.channelName === "string" ? result.channelName : null,
      message: typeof result?.message === "string" ? result.message : null,
      usedExplicitChannel: typeof result?.usedExplicitChannel === "boolean" ? result.usedExplicitChannel : null,
      resultJson: result ? JSON.stringify(result, null, 2) : null,
      error: typeof parsed.error === "string" ? parsed.error : null,
      parseError: null
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: null,
      channelId: null,
      channelName: null,
      message: null,
      usedExplicitChannel: null,
      resultJson: null,
      error: null,
      parseError: message
    };
  }
}

function parseChatChannelEventPayload(
  payloadJson: string | null
): {
  success: boolean | null;
  requestedChannelName: string | null;
  expectedChannelId: string | null;
  existed: boolean | null;
  selected: boolean | null;
  channelId: string | null;
  channelName: string | null;
  resultJson: string | null;
  error: string | null;
  parseError: string | null;
} {
  if (payloadJson === null) {
    return {
      success: null,
      requestedChannelName: null,
      expectedChannelId: null,
      existed: null,
      selected: null,
      channelId: null,
      channelName: null,
      resultJson: null,
      error: null,
      parseError: null
    };
  }

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    const result = parsed.result && typeof parsed.result === "object"
      ? parsed.result as Record<string, unknown>
      : null;
    return {
      success: typeof parsed.success === "boolean" ? parsed.success : null,
      requestedChannelName: typeof result?.requestedChannelName === "string" ? result.requestedChannelName : null,
      expectedChannelId: typeof result?.expectedChannelId === "string" ? result.expectedChannelId : null,
      existed: typeof result?.existed === "boolean" ? result.existed : null,
      selected: typeof result?.selected === "boolean" ? result.selected : null,
      channelId: typeof result?.channelId === "string" ? result.channelId : null,
      channelName: typeof result?.channelName === "string" ? result.channelName : null,
      resultJson: result ? JSON.stringify(result, null, 2) : null,
      error: typeof parsed.error === "string" ? parsed.error : null,
      parseError: null
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: null,
      requestedChannelName: null,
      expectedChannelId: null,
      existed: null,
      selected: null,
      channelId: null,
      channelName: null,
      resultJson: null,
      error: null,
      parseError: message
    };
  }
}

function luaEditorSnapshotLooksReady(parsed: Record<string, unknown>, requireVisible: boolean): boolean {
  if (parsed.visible !== true) {
    return false;
  }
  const hasSignal =
    (typeof parsed.title === "string" && parsed.title.trim().length > 0) ||
    (typeof parsed.selectedSlot === "string" && parsed.selectedSlot.length > 0) ||
    (Array.isArray(parsed.slots) && parsed.slots.length > 0);
  if (!hasSignal) {
    return false;
  }
  if (requireVisible && parsed.visible !== true) {
    return false;
  }
  return true;
}

function screenEditorSnapshotLooksReady(parsed: Record<string, unknown>, requireVisible: boolean): boolean {
  if (parsed.visible !== true) {
    return false;
  }
  const hasSignal =
    (typeof parsed.title === "string" && parsed.title.trim().length > 0) ||
    typeof parsed.codeLength === "number" ||
    typeof parsed.mode === "string" ||
    parsed.canApply === true;
  if (!hasSignal) {
    return false;
  }
  if (requireVisible && parsed.visible !== true) {
    return false;
  }
  return true;
}

function uiSnapshotLooksReady(uiKind: EditorUiKind, parsed: Record<string, unknown>, requireVisible: boolean): boolean {
  if (uiKind === "screen_editor") {
    return screenEditorSnapshotLooksReady(parsed, requireVisible);
  }
  return luaEditorSnapshotLooksReady(parsed, requireVisible);
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function registerEditorTools(
  server: McpServer,
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  options?: NativeInputToolOptions
): void {
  server.registerTool(
    "du_editor_push_code",
    {
      title: "Stage Editor IDE Import",
      description: "Stages editor content through the file-based IDE import contract from a local source file.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        targetKind: editorTargetKindSchema.default("lua_editor").describe("Target editor kind"),
        sourcePath: z.string().min(1).describe("Absolute path of the local source file to stage into IDE Sync")
      },
      outputSchema: stagedImportOutputSchema
    },
    async ({ playerId, targetKind, sourcePath }) => {
      const result = await commandQueue.stageIdeImportFromFile({
        playerId,
        targetKind,
        sourcePath
      });

      await eventStore.appendSystemEvent({
        eventId: `evt-${result.requestId}`,
        createdAtUtc: new Date().toISOString(),
        playerId,
        source: {
          kind: targetKind,
          boardId: null
        },
        type: "ide_import_staged",
        payload: {
          requestId: result.requestId,
          sourcePath: result.sourcePath,
          workspacePath: result.workspacePath,
          metadataPath: result.metadataPath,
          importPath: result.importPath,
          codeCharLength: result.codeCharLength,
          codeUtf8Bytes: result.codeUtf8Bytes,
          codeHash32: result.codeHash32,
          codeSha256: result.codeSha256,
          hasContextMetadata: result.hasContextMetadata
        }
      });

      const structuredContent = {
        requestId: result.requestId,
        status: "staged" as const,
        targetKind,
        playerId,
        sourcePath: result.sourcePath,
        workspacePath: result.workspacePath,
        metadataPath: result.metadataPath,
        importPath: result.importPath,
        codeCharLength: result.codeCharLength,
        codeUtf8Bytes: result.codeUtf8Bytes,
        codeHash32: result.codeHash32,
        codeSha256: result.codeSha256,
        hasContextMetadata: result.hasContextMetadata
      };

      return {
        content: [
          {
            type: "text",
            text: `Staged ${targetKind} IDE import for player ${playerId}: ${result.requestId}`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_chat_snapshot",
    {
      title: "Read Chat Snapshot",
      description:
        "Queues a read-only chat snapshot in the active HUD and waits for the structured chat_snapshot bridge event. Returns the selected channel and recent messages without sending chat input.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the chat_snapshot event")
      },
      outputSchema: chatSnapshotOutputSchema
    },
    async ({ playerId, timeoutMs }) => {
      const snapshotEvent = await enqueueAndWaitCommandEvent(
        commandQueue,
        eventStore,
        playerId,
        "lua_editor",
        "chat_snapshot",
        [],
        "chat_snapshot",
        timeoutMs
      );
      const parsed = parseChatSnapshotPayload(snapshotEvent.payloadJson);
      const structuredContent = {
        found: snapshotEvent.found,
        commandId: snapshotEvent.commandId,
        createdAtUtc: snapshotEvent.createdAtUtc,
        visible: parsed.visible,
        open: parsed.open,
        source: parsed.source,
        selectedChannelId: parsed.selectedChannelId,
        selectedChannelName: parsed.selectedChannelName,
        messageCount: parsed.messageCount,
        messages: parsed.messages,
        snapshotJson: parsed.snapshotJson,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: snapshotEvent.found
              ? (parsed.snapshotJson ?? snapshotEvent.payloadJson ?? "")
              : `No chat_snapshot event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_chat_ai_mentions",
    {
      title: "Read AI Chat Mentions",
      description:
        "Reads the active HUD chat snapshot and returns only messages that contain case-insensitive @ai or optional targeted mentions like @ai:helper. Messages already tagged as AI replies ([AI:<agentId>]) are ignored.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        agentId: z
          .string()
          .regex(/^[A-Za-z0-9_-]{1,32}$/)
          .optional()
          .describe("Optional AI agent identifier for targeted mentions, e.g. helper in @ai:helper"),
        includeGenericMentions: z
          .boolean()
          .default(true)
          .describe("When agentId is set, also match plain @ai in addition to @ai:<agentId>"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the chat_snapshot event")
      },
      outputSchema: chatAiMentionsOutputSchema
    },
    async ({ playerId, agentId, includeGenericMentions, timeoutMs }) => {
      const normalizedAgentId = normalizeAgentId(agentId);
      const snapshotEvent = await enqueueAndWaitCommandEvent(
        commandQueue,
        eventStore,
        playerId,
        "lua_editor",
        "chat_snapshot",
        [],
        "chat_snapshot",
        timeoutMs
      );
      const parsed = parseChatSnapshotPayload(snapshotEvent.payloadJson);
      const messages = parsed.messages.filter((message) =>
        message.text.length > 0 &&
        message.isNotification !== true &&
        messageMentionsAi(message.text, normalizedAgentId ?? undefined, includeGenericMentions)
      );
      const structuredContent = {
        found: snapshotEvent.found,
        commandId: snapshotEvent.commandId,
        createdAtUtc: snapshotEvent.createdAtUtc,
        agentId: normalizedAgentId,
        includeGenericMentions,
        source: parsed.source,
        selectedChannelId: parsed.selectedChannelId,
        selectedChannelName: parsed.selectedChannelName,
        count: messages.length,
        messages,
        snapshotJson: parsed.snapshotJson,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: snapshotEvent.found
              ? JSON.stringify(
                  {
                    agentId: normalizedAgentId,
                    includeGenericMentions,
                    selectedChannelId: parsed.selectedChannelId,
                    selectedChannelName: parsed.selectedChannelName,
                    count: messages.length,
                    messages
                  },
                  null,
                  2
                )
              : `No chat_snapshot event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_chat_server_snapshot",
    {
      title: "Read Server Chat Snapshot",
      description:
        "Reads recent chat messages across server-side channels relevant to the player without depending on the visible HUD chat. This path is opt-in and requires ModUiExtractor to be built with server chat support.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        limit: z.number().int().min(1).max(500).default(120).describe("Maximum number of recent chat messages to return across relevant server-side channels"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the server_chat_snapshot event")
      },
      outputSchema: serverChatSnapshotOutputSchema
    },
    async ({ playerId, limit, timeoutMs }) => {
      const snapshotEvent = await enqueueAndWaitCommandEvent(
        commandQueue,
        eventStore,
        playerId,
        "server_chat",
        "snapshot",
        [String(limit)],
        "server_chat_snapshot",
        timeoutMs
      );
      const parsed = parseServerChatSnapshotPayload(snapshotEvent.payloadJson);
      const structuredContent = {
        found: snapshotEvent.found,
        commandId: snapshotEvent.commandId,
        createdAtUtc: snapshotEvent.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        visible: parsed.visible,
        open: parsed.open,
        source: parsed.source,
        selectedChannelId: parsed.selectedChannelId,
        selectedChannelName: parsed.selectedChannelName,
        messageCount: parsed.messageCount,
        messages: parsed.messages,
        snapshotJson: parsed.snapshotJson,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: snapshotEvent.found
              ? (parsed.snapshotJson ?? parsed.error ?? snapshotEvent.payloadJson ?? "")
              : `No server_chat_snapshot event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_chat_server_mentions",
    {
      title: "Read Server AI Chat Mentions",
      description:
        "Reads recent server-side chat messages across channels relevant to the player and returns only AI mentions. This path is opt-in and requires ModUiExtractor to be built with server chat support.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        agentId: z
          .string()
          .regex(/^[A-Za-z0-9_-]{1,32}$/)
          .optional()
          .describe("Optional AI agent identifier for targeted mentions, e.g. helper in @ai:helper"),
        includeGenericMentions: z
          .boolean()
          .default(true)
          .describe("When agentId is set, also match plain @ai in addition to @ai:<agentId>"),
        limit: z.number().int().min(1).max(500).default(120).describe("Maximum number of recent chat messages to inspect across relevant server-side channels"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the server_chat_snapshot event")
      },
      outputSchema: serverChatMentionsOutputSchema
    },
    async ({ playerId, agentId, includeGenericMentions, limit, timeoutMs }) => {
      const normalizedAgentId = normalizeAgentId(agentId);
      const snapshotEvent = await enqueueAndWaitCommandEvent(
        commandQueue,
        eventStore,
        playerId,
        "server_chat",
        "snapshot",
        [String(limit)],
        "server_chat_snapshot",
        timeoutMs
      );
      const parsed = parseServerChatSnapshotPayload(snapshotEvent.payloadJson);
      const messages = parsed.messages.filter((message) =>
        message.text.length > 0 &&
        message.isNotification !== true &&
        messageMentionsAi(message.text, normalizedAgentId ?? undefined, includeGenericMentions)
      );
      const structuredContent = {
        found: snapshotEvent.found,
        commandId: snapshotEvent.commandId,
        createdAtUtc: snapshotEvent.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        agentId: normalizedAgentId,
        includeGenericMentions,
        source: parsed.source,
        selectedChannelId: parsed.selectedChannelId,
        selectedChannelName: parsed.selectedChannelName,
        count: messages.length,
        messages,
        snapshotJson: parsed.snapshotJson,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: snapshotEvent.found
              ? JSON.stringify(
                  {
                    success: parsed.success,
                    error: parsed.error,
                    agentId: normalizedAgentId,
                    includeGenericMentions,
                    count: messages.length,
                    messages
                  },
                  null,
                  2
                )
              : `No server_chat_snapshot event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_chat_send_message",
    {
      title: "Send Chat Message",
      description:
        "Sends a chat message through the HUD chat manager. By default it uses the currently selected channel; an explicit channelId overrides that channel.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        message: z.string().min(1).describe("Chat message to send"),
        channelId: z.string().optional().describe("Optional explicit channel ID; otherwise the currently selected channel is used"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the probe_result event")
      },
      outputSchema: chatSendOutputSchema
    },
    async ({ playerId, message, channelId, timeoutMs }) => {
      const eventResult = await enqueueAndWaitCommandEvent(
        commandQueue,
        eventStore,
        playerId,
        "lua_editor",
        "chat_send",
        [message, channelId ?? ""],
        "chat_send_result",
        timeoutMs
      );
      const parsed = parseChatSendEventPayload(eventResult.payloadJson);
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        channelId: parsed.channelId,
        channelName: parsed.channelName,
        message: parsed.message,
        usedExplicitChannel: parsed.usedExplicitChannel,
        resultJson: parsed.resultJson,
        error: parsed.error,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? JSON.stringify(
                  {
                    success: parsed.success,
                    channelId: parsed.channelId,
                    channelName: parsed.channelName,
                    message: parsed.message,
                    usedExplicitChannel: parsed.usedExplicitChannel
                  },
                  null,
                  2
                )
              : `No chat_send_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_chat_create_channel",
    {
      title: "Create Or Join Chat Channel",
      description:
        "Creates or joins a custom chat channel using the same /join path as the HUD plus dialog. Names are limited to 3-10 ASCII letters, digits, plus, underscore, or dash.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        channelName: z
          .string()
          .min(3)
          .max(10)
          .regex(/^[A-Za-z0-9+_-]+$/)
          .describe("Custom channel name: 3-10 chars, no blanks, allowed: A-Z a-z 0-9 + _ -"),
        timeoutMs: z.number().int().min(250).max(20000).default(8000).describe("How long to wait for the probe_result event")
      },
      outputSchema: chatChannelOutputSchema
    },
    async ({ playerId, channelName, timeoutMs }) => {
      const eventResult = await enqueueAndWaitCommandEvent(
        commandQueue,
        eventStore,
        playerId,
        "lua_editor",
        "chat_join_channel",
        [channelName],
        "chat_channel_result",
        timeoutMs
      );
      const parsed = parseChatChannelEventPayload(eventResult.payloadJson);
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        requestedChannelName: parsed.requestedChannelName,
        expectedChannelId: parsed.expectedChannelId,
        existed: parsed.existed,
        selected: parsed.selected,
        channelId: parsed.channelId,
        channelName: parsed.channelName,
        resultJson: parsed.resultJson,
        error: parsed.error,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? JSON.stringify(
                  {
                    success: parsed.success,
                    requestedChannelName: parsed.requestedChannelName,
                    expectedChannelId: parsed.expectedChannelId,
                    existed: parsed.existed,
                    selected: parsed.selected,
                    channelId: parsed.channelId,
                    channelName: parsed.channelName
                  },
                  null,
                  2
                )
              : `No chat_channel_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_chat_select_channel",
    {
      title: "Select Existing Chat Channel",
      description:
        "Selects an existing HUD chat channel by channel ID. This never creates or joins a channel and fails if the channel is not currently available in the HUD.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        channelId: z.string().min(1).describe("Existing channel ID to select, e.g. room_local or room_ai_hlp2"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the probe_result event")
      },
      outputSchema: chatChannelOutputSchema
    },
    async ({ playerId, channelId, timeoutMs }) => {
      const eventResult = await enqueueAndWaitCommandEvent(
        commandQueue,
        eventStore,
        playerId,
        "lua_editor",
        "chat_select_channel",
        [channelId],
        "chat_channel_result",
        timeoutMs
      );
      const parsed = parseChatChannelEventPayload(eventResult.payloadJson);
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        requestedChannelName: parsed.requestedChannelName,
        expectedChannelId: parsed.expectedChannelId,
        existed: parsed.existed,
        selected: parsed.selected,
        channelId: parsed.channelId,
        channelName: parsed.channelName,
        resultJson: parsed.resultJson,
        error: parsed.error,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? JSON.stringify(
                  {
                    success: parsed.success,
                    expectedChannelId: parsed.expectedChannelId,
                    selected: parsed.selected,
                    channelId: parsed.channelId,
                    channelName: parsed.channelName
                  },
                  null,
                  2
                )
              : `No chat_channel_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_ui_describe",
    {
      title: "Describe UI (generic)",
      description:
        "Canonical UI snapshot hook for `lua_editor` and `screen_editor`.",
      inputSchema: {
        uiKind: uiKindSchema,
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        timeoutMs: z.number().int().min(250).max(15000).default(15000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ uiKind, playerId, timeoutMs }) => {
      const probeResult = await enqueueAndWaitUiProbe(commandQueue, eventStore, uiKind, playerId, "describe", [], timeoutMs);
      return formatProbeToolResult(probeResult, timeoutMs, "describe");
    }
  );

  server.registerTool(
    "du_ui_invoke",
    {
      title: "Invoke UI probe (generic)",
      description:
        "Generic probe_call wrapper. `lua_editor` supports the public Lua probe API; `screen_editor` currently supports `describe`, `apply`, `cancel`, `outer_html`, `raw_eval`. For current live `screen_editor` behavior, `cancel` also performs a delayed native `Escape` cleanup automatically after the probe close. For the same `playerId`, do not parallelize Lua-editor UI calls with each other.",
      inputSchema: {
        uiKind: uiKindSchema,
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        method: z
          .enum([
            "describe",
            "list_filters",
            "select_slot",
            "select_context",
            "select_filter",
            "select_filter_index",
            "chat_send",
            "chat_join_channel",
            "chat_select_channel",
            "apply",
            "cancel",
            "add_filter",
            "outer_html",
            "raw_eval"
          ])
          .describe("Probe method name"),
        slotName: z.string().optional().describe("Slot name for `select_slot` or `select_context`"),
        filterName: z
          .string()
          .optional()
          .describe("Visible filter or handler name for `select_filter`, `select_context`, or `add_filter`"),
        filterIndex: z.number().int().nonnegative().optional().describe("DOM filter index for `select_filter_index`"),
        settleMs: z.number().int().min(1000).max(15000).optional().describe("Minimum wait after slot confirmation for `select_context`"),
        message: z.string().optional().describe("Chat message for `chat_send`"),
        channelId: z.string().optional().describe("Optional channel ID for `chat_send` or `chat_select_channel`"),
        channelName: z.string().optional().describe("Custom channel name for `chat_join_channel`"),
        selector: z.string().optional().describe("CSS selector for `outer_html`"),
        functionBody: z.string().optional().describe("Trusted function body for `raw_eval` using parameter `state`"),
        timeoutMs: z.number().int().min(250).max(15000).default(15000)
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({
      uiKind,
      playerId,
      method,
      slotName,
      filterName,
      filterIndex,
      settleMs,
      message,
      channelId,
      channelName,
      selector,
      functionBody,
      timeoutMs
    }) => {
      assertUiProbeMethodSupported(uiKind, method);
      const probeArgs = buildUiProbeArgs(uiKind, method, {
        slotName,
        filterName,
        filterIndex,
        settleMs,
        message,
        channelId,
        channelName,
        selector,
        functionBody
      });
      const effectiveTimeout = method === "select_context"
        ? Math.max(timeoutMs, (settleMs ?? 1000) + 5000)
        : timeoutMs;
      const probeResult = await enqueueAndWaitUiProbe(commandQueue, eventStore, uiKind, playerId, method, probeArgs, effectiveTimeout);
      if (uiKind === "screen_editor" && method === "cancel" && probeResult.found && probeResult.success) {
        await sleepMs(500);
        const native = await runNativeAhkInput(
          "send_key",
          "Dual Universe",
          true,
          false,
          "Escape",
          1,
          120,
          options?.defaultAhkPath ?? null
        );
        const nativeOk = native.nativeResult?.ok === true;
        const finalDescribe = await enqueueAndWaitUiProbe(commandQueue, eventStore, "screen_editor", playerId, "describe", [], effectiveTimeout);
        const combinedSuccess = nativeOk && finalDescribe.found && finalDescribe.success === true;
        const combinedPayload = {
          cancel: {
            commandId: probeResult.commandId,
            resultJson: probeResult.resultJson,
            error: probeResult.error
          },
          nativeCleanup: {
            invoked: nativeOk,
            ahkPath: native.ahkPath,
            scriptPath: native.scriptPath,
            nativeResultJson: native.nativeResultJson,
            error: native.nativeResult?.error || null
          },
          finalDescribe: {
            commandId: finalDescribe.commandId,
            resultJson: finalDescribe.resultJson,
            error: finalDescribe.error
          }
        };
        return formatProbeToolResult(
          {
            found: probeResult.found,
            commandId: probeResult.commandId,
            method: probeResult.method,
            success: combinedSuccess,
            createdAtUtc: probeResult.createdAtUtc,
            resultJson: JSON.stringify(combinedPayload, null, 2),
            error: combinedSuccess ? null : native.nativeResult?.error || finalDescribe.error || "screen_editor_cancel_cleanup_failed"
          },
          effectiveTimeout,
          method
        );
      }
      return formatProbeToolResult(probeResult, effectiveTimeout, method);
    }
  );

  server.registerTool(
    "du_ui_wait",
    {
      title: "Wait for UI readiness (generic)",
      description:
        "Polls `describe` until the chosen UI snapshot looks ready. Works for `lua_editor` and `screen_editor` with target-specific readiness heuristics.",
      inputSchema: {
        uiKind: uiKindSchema,
        playerId: z.number().int().nonnegative(),
        maxWaitMs: z.number().int().min(500).max(120000).default(30000),
        pollIntervalMs: z.number().int().min(100).max(10000).default(500),
        timeoutMs: z.number().int().min(250).max(15000).default(15000),
        requireVisible: z.boolean().default(false)
      },
      outputSchema: luaWaitEditorOutputSchema
    },
    async ({ uiKind, playerId, maxWaitMs, pollIntervalMs, timeoutMs, requireVisible }) => {
      const started = Date.now();
      let attempts = 0;
      let last: ProbeResultSnapshot = {
        found: false,
        commandId: "",
        method: null,
        success: null,
        createdAtUtc: null,
        resultJson: null,
        error: null
      };

      while (Date.now() - started <= maxWaitMs) {
        attempts += 1;
        const remainingBudget = maxWaitMs - (Date.now() - started);
        const attemptTimeout = Math.min(timeoutMs, Math.max(250, remainingBudget));
        last = await enqueueAndWaitUiProbe(commandQueue, eventStore, uiKind, playerId, "describe", [], attemptTimeout);
        if (last.found && last.success && last.resultJson) {
          try {
            const parsed = JSON.parse(last.resultJson) as Record<string, unknown>;
            if (uiSnapshotLooksReady(uiKind, parsed, requireVisible)) {
              const waitedMs = Date.now() - started;
              const structuredContent = {
                ready: true,
                attempts,
                waitedMs,
                found: last.found,
                commandId: last.commandId,
                success: last.success,
                createdAtUtc: last.createdAtUtc,
                resultJson: last.resultJson,
                error: last.error
              };
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ ready: true, attempts, waitedMs, snapshot: parsed }, null, 2)
                  }
                ],
                structuredContent
              };
            }
          } catch {
            /* keep polling */
          }
        }

        const remaining = maxWaitMs - (Date.now() - started);
        if (remaining <= 0) {
          break;
        }
        await sleepMs(Math.min(pollIntervalMs, remaining));
      }

      const waitedMs = Date.now() - started;
      const structuredContent = {
        ready: false,
        attempts,
        waitedMs,
        found: last.found,
        commandId: last.commandId || null,
        success: last.success,
        createdAtUtc: last.createdAtUtc,
        resultJson: last.resultJson,
        error: last.error
      };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ready: false, attempts, waitedMs, lastProbe: structuredContent }, null, 2)
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
        targetKind: editorTargetKindSchema.default("lua_editor").describe("Target editor kind")
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
        targetKind: editorTargetKindSchema.default("lua_editor").describe("Target editor kind"),
        boardId: z.string().nullable().optional().describe("Optional board identifier for future board-scoped routing"),
        waitForEditor: z.boolean().default(false).describe("When true, the client retries for a while until the editor UI becomes available"),
        maxAttempts: z.number().int().positive().default(10).describe("Maximum retry attempts when waitForEditor is enabled"),
        retryDelayMs: z.number().int().positive().default(2000).describe("Delay between retry attempts in milliseconds when waitForEditor is enabled")
      },
      outputSchema: queuedCommandOutputSchema
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
