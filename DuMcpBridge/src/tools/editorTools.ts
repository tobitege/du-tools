import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { BridgeCommandQueue } from "../bridge/commandQueue.js";
import { BridgeEventStore, type CommandEventSnapshot, type ProbeResultSnapshot } from "../bridge/eventStore.js";
import { targetKindSchema } from "../contracts/commands.js";

const editorTargetKindSchema = z.enum(["lua_editor", "screen_editor"]);

const pushCodeOutputSchema = {
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

const luaSelectionOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  success: z.boolean().nullable(),
  visible: z.boolean().nullable(),
  selectedSlot: z.string().nullable(),
  selectedFilter: z.string().nullable(),
  title: z.string().nullable(),
  canApply: z.boolean().nullable(),
  wrapLines: z.boolean().nullable(),
  codeLength: z.number().nullable(),
  error: z.string().nullable(),
  parseError: z.string().nullable()
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
  | "select_slot"
  | "select_filter"
  | "set_code"
  | "apply"
  | "add_filter"
  | "outer_html"
  | "raw_eval";

type LuaProbeCallFields = {
  slotName?: string | undefined;
  filterEvent?: string | undefined;
  message?: string | undefined;
  channelId?: string | undefined;
  channelName?: string | undefined;
  code?: string | undefined;
  addFilterName?: string | undefined;
  outerHtmlSelector?: string | undefined;
  rawEvalBody?: string | undefined;
};

function buildLuaProbeArgs(method: LuaProbeMethod, fields: LuaProbeCallFields): string[] {
  switch (method) {
    case "describe":
    case "chat_snapshot":
    case "apply":
      return [];
    case "chat_send":
      return [fields.message ?? "", fields.channelId ?? ""];
    case "chat_join_channel":
      return [fields.channelName ?? ""];
    case "chat_select_channel":
      return [fields.channelId ?? fields.channelName ?? ""];
    case "select_slot":
      return [fields.slotName ?? ""];
    case "select_filter":
      return [fields.filterEvent ?? ""];
    case "set_code":
      return [fields.code ?? ""];
    case "add_filter":
      return [fields.addFilterName ?? ""];
    case "outer_html":
      return [fields.outerHtmlSelector ?? "#filters"];
    case "raw_eval":
      return [fields.rawEvalBody ?? ""];
    default: {
      const _exhaustive: never = method;
      void _exhaustive;
      return [];
    }
  }
}

const luaUiKindSchema = z.enum(["lua_editor"]).describe("Target UI; extend when a second probe surface shares this envelope");

async function enqueueAndWaitLuaProbe(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  playerId: number,
  method: LuaProbeMethod,
  probeArgs: string[],
  timeoutMs: number
): Promise<ProbeResultSnapshot> {
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

function parseDescribeSelection(
  resultJson: string | null
): {
  visible: boolean | null;
  selectedSlot: string | null;
  selectedFilter: string | null;
  title: string | null;
  canApply: boolean | null;
  wrapLines: boolean | null;
  codeLength: number | null;
  parseError: string | null;
} {
  if (resultJson === null) {
    return {
      visible: null,
      selectedSlot: null,
      selectedFilter: null,
      title: null,
      canApply: null,
      wrapLines: null,
      codeLength: null,
      parseError: null
    };
  }
  try {
    const parsed = JSON.parse(resultJson) as Record<string, unknown>;
    return {
      visible: typeof parsed.visible === "boolean" ? parsed.visible : null,
      selectedSlot: typeof parsed.selectedSlot === "string" ? parsed.selectedSlot : null,
      selectedFilter: typeof parsed.selectedFilter === "string" ? parsed.selectedFilter : null,
      title: typeof parsed.title === "string" ? parsed.title : null,
      canApply: typeof parsed.canApply === "boolean" ? parsed.canApply : null,
      wrapLines: typeof parsed.wrapLines === "boolean" ? parsed.wrapLines : null,
      codeLength: typeof parsed.codeLength === "number" && Number.isFinite(parsed.codeLength) ? parsed.codeLength : null,
      parseError: null
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      visible: null,
      selectedSlot: null,
      selectedFilter: null,
      title: null,
      canApply: null,
      wrapLines: null,
      codeLength: null,
      parseError: message
    };
  }
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

function parseChatSendResult(
  probeResult: ProbeResultSnapshot
): {
  channelId: string | null;
  channelName: string | null;
  message: string | null;
  usedExplicitChannel: boolean | null;
  parseError: string | null;
} {
  if (probeResult.resultJson === null) {
    return {
      channelId: null,
      channelName: null,
      message: null,
      usedExplicitChannel: null,
      parseError: null
    };
  }

  try {
    const parsed = JSON.parse(probeResult.resultJson) as Record<string, unknown>;
    return {
      channelId: typeof parsed.channelId === "string" ? parsed.channelId : null,
      channelName: typeof parsed.channelName === "string" ? parsed.channelName : null,
      message: typeof parsed.message === "string" ? parsed.message : null,
      usedExplicitChannel: typeof parsed.usedExplicitChannel === "boolean" ? parsed.usedExplicitChannel : null,
      parseError: null
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      channelId: null,
      channelName: null,
      message: null,
      usedExplicitChannel: null,
      parseError: message
    };
  }
}

function parseChatChannelResult(
  probeResult: ProbeResultSnapshot
): {
  requestedChannelName: string | null;
  expectedChannelId: string | null;
  existed: boolean | null;
  selected: boolean | null;
  channelId: string | null;
  channelName: string | null;
  parseError: string | null;
} {
  if (probeResult.resultJson === null) {
    return {
      requestedChannelName: null,
      expectedChannelId: null,
      existed: null,
      selected: null,
      channelId: null,
      channelName: null,
      parseError: null
    };
  }

  try {
    const parsed = JSON.parse(probeResult.resultJson) as Record<string, unknown>;
    return {
      requestedChannelName: typeof parsed.requestedChannelName === "string" ? parsed.requestedChannelName : null,
      expectedChannelId: typeof parsed.expectedChannelId === "string" ? parsed.expectedChannelId : null,
      existed: typeof parsed.existed === "boolean" ? parsed.existed : null,
      selected: typeof parsed.selected === "boolean" ? parsed.selected : null,
      channelId: typeof parsed.channelId === "string" ? parsed.channelId : null,
      channelName: typeof parsed.channelName === "string" ? parsed.channelName : null,
      parseError: null
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      requestedChannelName: null,
      expectedChannelId: null,
      existed: null,
      selected: null,
      channelId: null,
      channelName: null,
      parseError: message
    };
  }
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
  const hasSignal =
    parsed.visible === true ||
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

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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
        targetKind: editorTargetKindSchema.default("lua_editor").describe("Target editor kind"),
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
        method: z
          .enum([
            "describe",
            "select_slot",
            "select_filter",
            "chat_send",
            "chat_join_channel",
            "chat_select_channel",
            "set_code",
            "apply",
            "add_filter",
            "outer_html",
            "raw_eval"
          ])
          .describe("Lua probe method to invoke"),
        slotName: z.string().optional().describe("Slot name for select_slot"),
        filterEvent: z.string().optional().describe("Filter event name for select_filter"),
        message: z.string().optional().describe("Chat message for chat_send"),
        channelId: z.string().optional().describe("Optional channel ID for chat_send"),
        channelName: z.string().optional().describe("Custom channel name for chat_join_channel or channel ID for chat_select_channel"),
        code: z.string().optional().describe("Code for set_code"),
        addFilterName: z.string().optional().describe("Handler name for add_filter (e.g. onUpdate); must exist in the slot kebab menu for this device"),
        outerHtmlSelector: z
          .string()
          .optional()
          .describe("CSS selector for outer_html; resolved under #dpu_editor first, then document (default \"#filters\")"),
        rawEvalBody: z
          .string()
          .optional()
          .describe(
            "For raw_eval: function body with parameter `state` (__UI_EXTRACTOR_LUA_PROBE_STATE__). Example: return state.describeLuaEditor();"
          ),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ playerId, method, slotName, filterEvent, message, channelId, channelName, code, addFilterName, outerHtmlSelector, rawEvalBody, timeoutMs }) => {
      const probeArgs = buildLuaProbeArgs(method, {
        slotName,
        filterEvent,
        message,
        channelId,
        channelName,
        code,
        addFilterName,
        outerHtmlSelector,
        rawEvalBody
      });

      const probeResult = await enqueueAndWaitLuaProbe(
        commandQueue,
        eventStore,
        playerId,
        method,
        probeArgs,
        timeoutMs
      );
      return formatProbeToolResult(probeResult, timeoutMs, method);
    }
  );

  server.registerTool(
    "du_lua_describe_editor",
    {
      title: "Describe Lua Editor (probe)",
      description: "Thin wrapper: runs the Lua editor probe with method describe. Same snapshot as du_lua_probe_call(method=\"describe\").",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ playerId, timeoutMs }) => {
      const probeResult = await enqueueAndWaitLuaProbe(commandQueue, eventStore, playerId, "describe", [], timeoutMs);
      return formatProbeToolResult(probeResult, timeoutMs, "describe");
    }
  );

  server.registerTool(
    "du_lua_select_slot",
    {
      title: "Select Lua Editor Slot (probe)",
      description: "Thin wrapper: probe select_slot with the given slot name (exact match as in the probe / UI).",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        slotName: z.string().min(1).describe("Slot name to select"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ playerId, slotName, timeoutMs }) => {
      const probeResult = await enqueueAndWaitLuaProbe(commandQueue, eventStore, playerId, "select_slot", [slotName], timeoutMs);
      return formatProbeToolResult(probeResult, timeoutMs, "select_slot");
    }
  );

  server.registerTool(
    "du_lua_select_filter",
    {
      title: "Select Lua Editor Filter (probe)",
      description: "Thin wrapper: probe select_filter. filterName is the filter event string as shown in the probe snapshot (same as du_lua_probe_call filterEvent).",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        filterName: z.string().min(1).describe("Filter event name to select"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ playerId, filterName, timeoutMs }) => {
      const probeResult = await enqueueAndWaitLuaProbe(commandQueue, eventStore, playerId, "select_filter", [filterName], timeoutMs);
      return formatProbeToolResult(probeResult, timeoutMs, "select_filter");
    }
  );

  server.registerTool(
    "du_lua_add_filter",
    {
      title: "Add Lua Editor Filter (probe)",
      description:
        "Clicks + add filter when no unsettled row exists, then opens the new row’s kebab menu and picks the handler by name. Reuses an existing unsettled (\"select event\") row if present. Idempotent if that filter already exists (alreadyPresent). Prefer select_slot first.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        filterName: z.string().min(1).describe("Event/handler label as shown in the add list, e.g. onUpdate or onStart"),
        timeoutMs: z.number().int().min(250).max(15000).default(10000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ playerId, filterName, timeoutMs }) => {
      const probeResult = await enqueueAndWaitLuaProbe(commandQueue, eventStore, playerId, "add_filter", [filterName], timeoutMs);
      return formatProbeToolResult(probeResult, timeoutMs, "add_filter");
    }
  );

  server.registerTool(
    "du_lua_outer_html",
    {
      title: "Lua Editor outerHTML (probe)",
      description:
        "Runs the probe method outer_html: returns outerHTML of the first match for the selector (scoped to #dpu_editor when possible). Large markup is truncated (~350k chars) with truncated + originalLength in the JSON result.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        selector: z
          .string()
          .optional()
          .describe("CSS selector (default \"#filters\" for the filters column)"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ playerId, selector, timeoutMs }) => {
      const probeResult = await enqueueAndWaitLuaProbe(
        commandQueue,
        eventStore,
        playerId,
        "outer_html",
        [selector ?? "#filters"],
        timeoutMs
      );
      return formatProbeToolResult(probeResult, timeoutMs, "outer_html");
    }
  );

  server.registerTool(
    "du_lua_probe_raw",
    {
      title: "Lua probe raw_eval (escape hatch)",
      description:
        "Runs raw_eval: trusted-debug-only JS in the HUD. Body is executed as strict code with parameter `state` = __UI_EXTRACTOR_LUA_PROBE_STATE__. Example: return state.describeLuaEditor();",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        functionBody: z.string().min(1).describe("Function body using `state`"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ playerId, functionBody, timeoutMs }) => {
      const probeResult = await enqueueAndWaitLuaProbe(
        commandQueue,
        eventStore,
        playerId,
        "raw_eval",
        [functionBody],
        timeoutMs
      );
      return formatProbeToolResult(probeResult, timeoutMs, "raw_eval");
    }
  );

  server.registerTool(
    "du_lua_set_code",
    {
      title: "Set Lua Editor Code (probe)",
      description: "Thin wrapper: probe set_code. Replaces the entire editor buffer in the live Lua editor (same as du_lua_probe_call method set_code).",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        code: z.string().describe("Full editor contents to apply"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ playerId, code, timeoutMs }) => {
      const probeResult = await enqueueAndWaitLuaProbe(commandQueue, eventStore, playerId, "set_code", [code], timeoutMs);
      return formatProbeToolResult(probeResult, timeoutMs, "set_code");
    }
  );

  server.registerTool(
    "du_lua_apply",
    {
      title: "Apply Lua Editor (probe)",
      description: "Thin wrapper: probe apply — invokes LUAEditorManager.apply() in the open editor (same as du_lua_probe_call method apply).",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ playerId, timeoutMs }) => {
      const probeResult = await enqueueAndWaitLuaProbe(commandQueue, eventStore, playerId, "apply", [], timeoutMs);
      return formatProbeToolResult(probeResult, timeoutMs, "apply");
    }
  );

  server.registerTool(
    "du_lua_get_selection",
    {
      title: "Lua Editor Selection Summary (probe)",
      description: "Runs describe and returns only selection-oriented fields (slot, filter, title, apply affordance, visibility, etc.).",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaSelectionOutputSchema
    },
    async ({ playerId, timeoutMs }) => {
      const probeResult = await enqueueAndWaitLuaProbe(commandQueue, eventStore, playerId, "describe", [], timeoutMs);
      const fields = parseDescribeSelection(probeResult.resultJson);
      const structuredContent = {
        found: probeResult.found,
        commandId: probeResult.commandId,
        success: probeResult.success,
        visible: fields.visible,
        selectedSlot: fields.selectedSlot,
        selectedFilter: fields.selectedFilter,
        title: fields.title,
        canApply: fields.canApply,
        wrapLines: fields.wrapLines,
        codeLength: fields.codeLength,
        error: probeResult.error,
        parseError: fields.parseError
      };
      const text =
        probeResult.found && probeResult.success
          ? JSON.stringify(
              {
                visible: fields.visible,
                selectedSlot: fields.selectedSlot,
                selectedFilter: fields.selectedFilter,
                title: fields.title,
                canApply: fields.canApply,
                wrapLines: fields.wrapLines,
                codeLength: fields.codeLength
              },
              null,
              2
            )
          : probeResult.found
            ? (probeResult.error ?? "describe did not succeed")
            : `No probe result received for describe within ${timeoutMs}ms.`;
      return {
        content: [{ type: "text", text }],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_lua_wait_for_editor",
    {
      title: "Wait for Lua Editor (probe poll)",
      description:
        "Polls describe until the snapshot looks like an open editor (title, slot list, selection, or visible). Separate from du_editor_push_code retries. Each attempt waits timeoutMs for a probe_result.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        maxWaitMs: z.number().int().min(500).max(120000).default(30000).describe("Total wall time to keep polling"),
        pollIntervalMs: z.number().int().min(100).max(10000).default(500).describe("Delay after a failed readiness check before the next describe"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("Per-attempt wait for probe_result"),
        requireVisible: z.boolean().default(false).describe("When true, parsed.visible must be true in addition to other readiness signals")
      },
      outputSchema: luaWaitEditorOutputSchema
    },
    async ({ playerId, maxWaitMs, pollIntervalMs, timeoutMs, requireVisible }) => {
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
        last = await enqueueAndWaitLuaProbe(commandQueue, eventStore, playerId, "describe", [], attemptTimeout);
        if (last.found && last.success && last.resultJson) {
          try {
            const parsed = JSON.parse(last.resultJson) as Record<string, unknown>;
            if (luaEditorSnapshotLooksReady(parsed, requireVisible)) {
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
        "Generic UI snapshot hook. Today only uiKind \"lua_editor\" is supported (same as du_lua_describe_editor). Add uiKind values when a second probe shares the bridge envelope.",
      inputSchema: {
        uiKind: luaUiKindSchema,
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        timeoutMs: z.number().int().min(250).max(15000).default(15000).describe("How long to wait for the probe result event")
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ playerId, timeoutMs }) => {
      const probeResult = await enqueueAndWaitLuaProbe(commandQueue, eventStore, playerId, "describe", [], timeoutMs);
      return formatProbeToolResult(probeResult, timeoutMs, "describe");
    }
  );

  server.registerTool(
    "du_ui_invoke",
    {
      title: "Invoke UI probe (generic)",
      description:
        "Generic probe_call wrapper. uiKind \"lua_editor\" only for now; method/args mirror du_lua_probe_call. Use du_lua_* for less verbose agent prompts.",
      inputSchema: {
        uiKind: luaUiKindSchema,
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        method: z
          .enum([
            "describe",
            "select_slot",
            "select_filter",
            "chat_send",
            "chat_join_channel",
            "set_code",
            "apply",
            "add_filter",
            "outer_html",
            "raw_eval"
          ])
          .describe("Probe method name"),
        slotName: z.string().optional(),
        filterEvent: z.string().optional(),
        message: z.string().optional(),
        channelId: z.string().optional(),
        channelName: z.string().optional(),
        code: z.string().optional(),
        addFilterName: z.string().optional(),
        outerHtmlSelector: z.string().optional(),
        rawEvalBody: z.string().optional(),
        timeoutMs: z.number().int().min(250).max(15000).default(15000)
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({
      playerId,
      method,
      slotName,
      filterEvent,
      message,
      channelId,
      channelName,
      code,
      addFilterName,
      outerHtmlSelector,
      rawEvalBody,
      timeoutMs
    }) => {
      const probeArgs = buildLuaProbeArgs(method, {
        slotName,
        filterEvent,
        message,
        channelId,
        channelName,
        code,
        addFilterName,
        outerHtmlSelector,
        rawEvalBody
      });
      const probeResult = await enqueueAndWaitLuaProbe(commandQueue, eventStore, playerId, method, probeArgs, timeoutMs);
      return formatProbeToolResult(probeResult, timeoutMs, method);
    }
  );

  server.registerTool(
    "du_ui_wait",
    {
      title: "Wait for UI readiness (generic)",
      description:
        "Polls describe until the Lua editor snapshot looks ready. uiKind \"lua_editor\" only; same behavior as du_lua_wait_for_editor.",
      inputSchema: {
        uiKind: luaUiKindSchema,
        playerId: z.number().int().nonnegative(),
        maxWaitMs: z.number().int().min(500).max(120000).default(30000),
        pollIntervalMs: z.number().int().min(100).max(10000).default(500),
        timeoutMs: z.number().int().min(250).max(15000).default(15000),
        requireVisible: z.boolean().default(false)
      },
      outputSchema: luaWaitEditorOutputSchema
    },
    async ({ playerId, maxWaitMs, pollIntervalMs, timeoutMs, requireVisible }) => {
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
        last = await enqueueAndWaitLuaProbe(commandQueue, eventStore, playerId, "describe", [], attemptTimeout);
        if (last.found && last.success && last.resultJson) {
          try {
            const parsed = JSON.parse(last.resultJson) as Record<string, unknown>;
            if (luaEditorSnapshotLooksReady(parsed, requireVisible)) {
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
    "du_ui_eval_raw",
    {
      title: "Raw eval in UI probe (generic)",
      description:
        "uiKind \"lua_editor\" only; same as du_lua_probe_raw (raw_eval in HUD). Trusted debugging only.",
      inputSchema: {
        uiKind: luaUiKindSchema,
        playerId: z.number().int().nonnegative(),
        functionBody: z.string().min(1),
        timeoutMs: z.number().int().min(250).max(15000).default(15000)
      },
      outputSchema: luaProbeOutputSchema
    },
    async ({ playerId, functionBody, timeoutMs }) => {
      const probeResult = await enqueueAndWaitLuaProbe(
        commandQueue,
        eventStore,
        playerId,
        "raw_eval",
        [functionBody],
        timeoutMs
      );
      return formatProbeToolResult(probeResult, timeoutMs, "raw_eval");
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
