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
  hasContextMetadata: z.boolean(),
  contextSource: z.enum(["none", "workspace_metadata", "live_probe"])
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

const pendingIdeImportOutputSchema = {
  found: z.boolean(),
  targetKind: editorTargetKindSchema,
  playerId: z.number().int().nonnegative(),
  requestId: z.string().nullable(),
  code: z.string().nullable(),
  codeCharLength: z.number().int().nonnegative().nullable(),
  codeUtf8Bytes: z.number().int().nonnegative().nullable(),
  codeHash32: z.string().nullable(),
  codeSha256: z.string().nullable(),
  sourceSyncId: z.string().nullable(),
  contextKey: z.string().nullable(),
  path: z.string().nullable(),
  workspaceCodePath: z.string().nullable(),
  workspaceMetaPath: z.string().nullable(),
  requestCreatedAtUtc: z.string().nullable(),
  exportedAtUtc: z.string().nullable(),
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

const luaOpenContextOutputSchema = {
  invoked: z.boolean(),
  editorReady: z.boolean(),
  alreadyVisible: z.boolean(),
  waitedMs: z.number().int().nonnegative(),
  ahkPath: z.string().nullable(),
  scriptPath: z.string().nullable(),
  windowTitle: z.string(),
  targetHwnd: z.string().nullable(),
  activeBefore: z.boolean().nullable(),
  activeAfter: z.boolean().nullable(),
  recoveryAttempted: z.boolean(),
  recoveryEscapeSent: z.boolean(),
  recoveryReturnToWorldSent: z.boolean(),
  sendMode: z.string().nullable(),
  openCommandId: z.string().nullable(),
  selectCommandId: z.string().nullable(),
  title: z.string().nullable(),
  selectedSlot: z.string().nullable(),
  selectedFilter: z.string().nullable(),
  resultJson: z.string().nullable(),
  error: z.string().nullable()
};

const luaPushContextOutputSchema = {
  editorReady: z.boolean(),
  staged: z.boolean(),
  verified: z.boolean(),
  playerId: z.number().int().nonnegative(),
  sourcePath: z.string(),
  requestId: z.string().nullable(),
  contextSource: z.enum(["none", "workspace_metadata", "live_probe"]).nullable(),
  codeCharLength: z.number().int().nonnegative().nullable(),
  codeHash32: z.string().nullable(),
  workspacePath: z.string().nullable(),
  metadataPath: z.string().nullable(),
  importPath: z.string().nullable(),
  openCommandId: z.string().nullable(),
  selectCommandId: z.string().nullable(),
  verifyCommandId: z.string().nullable(),
  verifyWaitedMs: z.number().int().nonnegative(),
  recoveryAttempted: z.boolean(),
  title: z.string().nullable(),
  selectedSlot: z.string().nullable(),
  selectedFilter: z.string().nullable(),
  verifyResultJson: z.string().nullable(),
  error: z.string().nullable()
};

const reinjectLuaProbeOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  method: z.string().nullable(),
  success: z.boolean().nullable(),
  createdAtUtc: z.string().nullable(),
  dispatched: z.boolean(),
  modName: z.string().nullable(),
  injectActionId: z.number().int().nullable(),
  constructId: z.number().int().nullable(),
  reason: z.string().nullable(),
  parseError: z.string().nullable(),
  openEditorAfter: z.boolean(),
  editorReady: z.boolean().nullable(),
  editorVisible: z.boolean().nullable(),
  editorTitle: z.string().nullable(),
  editorSelectedSlot: z.string().nullable(),
  editorSelectedFilter: z.string().nullable(),
  nativeResultJson: z.string().nullable(),
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

type UiProbeMethod =
  | "describe"
  | "list_filters"
  | "select_slot"
  | "select_context"
  | "select_filter"
  | "select_filter_index"
  | "apply"
  | "cancel"
  | "add_filter"
  | "outer_html"
  | "raw_eval"
  | "close_runtime_ui";

type UiProbeCallFields = {
  slotName?: string | undefined;
  filterName?: string | undefined;
  filterIndex?: number | undefined;
  settleMs?: number | undefined;
  selector?: string | undefined;
  functionBody?: string | undefined;
};

const screenEditorProbeMethods = new Set<UiProbeMethod>(["describe", "apply", "cancel", "outer_html", "raw_eval"]);
const luaEditorProbeMethods = new Set<UiProbeMethod>(["describe", "select_slot", "select_filter", "select_filter_index", "select_context", "cancel", "outer_html", "raw_eval", "close_runtime_ui"]);

function buildUiProbeArgs(targetKind: EditorUiKind, method: UiProbeMethod, fields: UiProbeCallFields): string[] {
  switch (method) {
    case "describe":
    case "list_filters":
    case "apply":
    case "cancel":
    case "close_runtime_ui":
      return [];
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
  .describe("Target UI. `lua_editor` supports the public Lua probe API including `close_runtime_ui`; `screen_editor` currently supports `describe`, `apply`, `cancel`, `outer_html`, `raw_eval`.");

function assertUiProbeMethodSupported(uiKind: EditorUiKind, method: UiProbeMethod): void {
  if (uiKind === "screen_editor" && !screenEditorProbeMethods.has(method)) {
    throw new Error(`ui_method_not_supported_for_${uiKind}:${method}`);
  }
  if (uiKind === "lua_editor" && !luaEditorProbeMethods.has(method)) {
    throw new Error(`ui_method_not_supported_for_${uiKind}:${method}`);
  }
}

async function enqueueAndWaitUiProbe(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  targetKind: EditorUiKind,
  playerId: number,
  method: UiProbeMethod,
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

function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (typeof value !== "string" || value.trim().length <= 0) {
    return null;
  }

  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
}

function parseReinjectLuaProbeResult(
  payloadJson: string | null
): {
  dispatched: boolean;
  modName: string | null;
  injectActionId: number | null;
  constructId: number | null;
  reason: string | null;
  parseError: string | null;
} {
  if (payloadJson === null) {
    return {
      dispatched: false,
      modName: null,
      injectActionId: null,
      constructId: null,
      reason: null,
      parseError: null
    };
  }

  try {
    const parsed = parseJsonObject(payloadJson);
    return {
      dispatched: parsed?.ok === true,
      modName: typeof parsed?.modName === "string" ? parsed.modName : null,
      injectActionId: typeof parsed?.actionId === "number" && Number.isFinite(parsed.actionId) ? parsed.actionId : null,
      constructId: typeof parsed?.constructId === "number" && Number.isFinite(parsed.constructId) ? parsed.constructId : null,
      reason: typeof parsed?.reason === "string" ? parsed.reason : null,
      parseError: null
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      dispatched: false,
      modName: null,
      injectActionId: null,
      constructId: null,
      reason: null,
      parseError: message
    };
  }
}

function parseEditorDescribeSnapshot(
  payloadJson: string | null
): {
  visible: boolean | null;
  title: string | null;
  selectedSlot: string | null;
  selectedFilter: string | null;
  contextKey: string | null;
  reference: Record<string, unknown> | null;
} {
  try {
    const parsed = parseJsonObject(payloadJson);
    return {
      visible: typeof parsed?.visible === "boolean" ? parsed.visible : null,
      title: typeof parsed?.title === "string" ? parsed.title : null,
      selectedSlot: typeof parsed?.selectedSlot === "string" ? parsed.selectedSlot : null,
      selectedFilter: typeof parsed?.selectedFilter === "string" ? parsed.selectedFilter : null,
      contextKey: typeof parsed?.contextKey === "string" ? parsed.contextKey : null,
      reference:
        parsed?.reference && typeof parsed.reference === "object" && !Array.isArray(parsed.reference)
          ? parsed.reference as Record<string, unknown>
          : null
    };
  } catch {
    return {
      visible: null,
      title: null,
      selectedSlot: null,
      selectedFilter: null,
      contextKey: null,
      reference: null
    };
  }
}

async function resolveLiveIdeImportContext(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  targetKind: EditorUiKind,
  playerId: number
): Promise<{
  contextKey: string;
  reference: Record<string, unknown>;
}> {
  const probeResult = await enqueueAndWaitUiProbe(commandQueue, eventStore, targetKind, playerId, "describe", [], 5000);
  const snapshot = parseEditorDescribeSnapshot(probeResult.resultJson);

  if (!probeResult.found) {
    throw new Error(`live_${targetKind}_describe_timeout`);
  }
  if (probeResult.success !== true) {
    throw new Error(probeResult.error ?? `live_${targetKind}_describe_failed`);
  }
  if (snapshot.visible !== true) {
    throw new Error(`${targetKind}_not_visible`);
  }
  if (targetKind === "lua_editor" && (!snapshot.selectedSlot || !snapshot.selectedFilter)) {
    throw new Error("lua_editor_context_incomplete");
  }

  if (snapshot.reference) {
    return {
      contextKey: snapshot.contextKey ?? "",
      reference: snapshot.reference
    };
  }

  if (targetKind === "lua_editor") {
    return {
      contextKey: "",
      reference: {
        editorTitle: snapshot.title,
        currentSlotName: snapshot.selectedSlot,
        currentFilterSignature: snapshot.selectedFilter
      }
    };
  }

  throw new Error(`live_${targetKind}_ide_sync_context_missing`);
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForLuaEditorReady(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  playerId: number,
  maxWaitMs: number,
  timeoutMs: number
): Promise<{
  ready: boolean;
  waitedMs: number;
  probe: ProbeResultSnapshot;
  snapshot: ReturnType<typeof parseEditorDescribeSnapshot>;
}> {
  const started = Date.now();
  let last: ProbeResultSnapshot = {
    found: false,
    commandId: "",
    method: null,
    success: null,
    createdAtUtc: null,
    resultJson: null,
    error: null
  };
  let lastSnapshot = parseEditorDescribeSnapshot(null);

  while (Date.now() - started <= maxWaitMs) {
    const remainingBudget = maxWaitMs - (Date.now() - started);
    const attemptTimeout = Math.min(timeoutMs, Math.max(250, remainingBudget));
    last = await enqueueAndWaitUiProbe(commandQueue, eventStore, "lua_editor", playerId, "describe", [], attemptTimeout);
    lastSnapshot = parseEditorDescribeSnapshot(last.resultJson);
    const parsed = parseJsonObject(last.resultJson);
    if (last.found && last.success && parsed && uiSnapshotLooksReady("lua_editor", parsed, true)) {
      return {
        ready: true,
        waitedMs: Date.now() - started,
        probe: last,
        snapshot: lastSnapshot
      };
    }

    const remaining = maxWaitMs - (Date.now() - started);
    if (remaining <= 0) {
      break;
    }
    await sleepMs(Math.min(250, remaining));
  }

  return {
    ready: false,
    waitedMs: Date.now() - started,
    probe: last,
    snapshot: lastSnapshot
  };
}

async function openLuaContext(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  playerId: number,
  slotName: string,
  filterName: string,
  settleMs: number,
  timeoutMs: number,
  probeTimeoutMs: number,
  activateWindow: boolean,
  windowTitle: string,
  ahkPath: string | undefined,
  defaultAhkPath: string | null
): Promise<{
  invoked: boolean;
  editorReady: boolean;
  alreadyVisible: boolean;
  waitedMs: number;
  ahkPath: string | null;
  scriptPath: string | null;
  windowTitle: string;
  targetHwnd: string | null;
  activeBefore: boolean | null;
  activeAfter: boolean | null;
  recoveryAttempted: boolean;
  recoveryEscapeSent: boolean;
  recoveryReturnToWorldSent: boolean;
  sendMode: string | null;
  openCommandId: string | null;
  selectCommandId: string | null;
  title: string | null;
  selectedSlot: string | null;
  selectedFilter: string | null;
  resultJson: string | null;
  error: string | null;
}> {
  const initial = await enqueueAndWaitUiProbe(commandQueue, eventStore, "lua_editor", playerId, "describe", [], probeTimeoutMs);
  const initialSnapshot = parseEditorDescribeSnapshot(initial.resultJson);
  const initialParsed = parseJsonObject(initial.resultJson);
  const alreadyVisible = initial.found && initial.success === true && !!initialParsed && uiSnapshotLooksReady("lua_editor", initialParsed, true);

  let invoked = false;
  let waitedMs = 0;
  let openProbeCommandId: string | null = initial.commandId || null;
  let openSnapshot = initialSnapshot;
  let nativeResult = {
    ahkPath: ahkPath ?? defaultAhkPath,
    scriptPath: null as string | null,
    nativeResult: null as Awaited<ReturnType<typeof runNativeAhkInput>>["nativeResult"],
    nativeResultJson: null as string | null
  };
  let recoveryAttempted = false;
  let recoveryEscapeSent = false;
  let recoveryReturnToWorldSent = false;

  if (!alreadyVisible) {
    invoked = true;
    nativeResult = await runNativeAhkInput(
      "ctrl_l",
      windowTitle,
      activateWindow,
      false,
      null,
      1,
      120,
      ahkPath ?? defaultAhkPath
    );
    if (nativeResult.nativeResult?.ok !== true) {
      return {
        invoked,
        editorReady: false,
        alreadyVisible,
        waitedMs: 0,
        ahkPath: nativeResult.ahkPath,
        scriptPath: nativeResult.scriptPath,
        windowTitle,
        targetHwnd: nativeResult.nativeResult?.targetHwnd || null,
        activeBefore: nativeResult.nativeResult?.activeBefore ?? null,
        activeAfter: nativeResult.nativeResult?.activeAfter ?? null,
        recoveryAttempted,
        recoveryEscapeSent,
        recoveryReturnToWorldSent,
        sendMode: nativeResult.nativeResult?.sendMode || null,
        openCommandId: null,
        selectCommandId: null,
        title: null,
        selectedSlot: null,
        selectedFilter: null,
        resultJson: null,
        error: nativeResult.nativeResult?.error || "native_open_failed"
      };
    }

    let openResult = await waitForLuaEditorReady(commandQueue, eventStore, playerId, timeoutMs, probeTimeoutMs);
    waitedMs = openResult.waitedMs;
    openProbeCommandId = openResult.probe.commandId || null;
    openSnapshot = openResult.snapshot;

    if (!openResult.ready) {
      recoveryAttempted = true;
      const escapeRecovery = await runNativeAhkInput(
        "send_key",
        windowTitle,
        activateWindow,
        false,
        "Escape",
        1,
        120,
        ahkPath ?? defaultAhkPath
      );
      recoveryEscapeSent = escapeRecovery.nativeResult?.ok === true;

      if (recoveryEscapeSent) {
        await sleepMs(250);
        nativeResult = await runNativeAhkInput(
          "ctrl_l",
          windowTitle,
          activateWindow,
          false,
          null,
          1,
          120,
          ahkPath ?? defaultAhkPath
        );
        if (nativeResult.nativeResult?.ok === true) {
          openResult = await waitForLuaEditorReady(commandQueue, eventStore, playerId, timeoutMs, probeTimeoutMs);
          waitedMs += openResult.waitedMs;
          openProbeCommandId = openResult.probe.commandId || openProbeCommandId;
          openSnapshot = openResult.snapshot;
        }
      }

      if (!(openSnapshot.visible === true)) {
        const returnToWorld = await runNativeAhkInput(
          "send_key",
          windowTitle,
          activateWindow,
          false,
          "Escape",
          1,
          120,
          ahkPath ?? defaultAhkPath
        );
        recoveryReturnToWorldSent = returnToWorld.nativeResult?.ok === true;
      }
    }
  }

  if (openSnapshot.visible !== true) {
    return {
      invoked,
      editorReady: false,
      alreadyVisible,
      waitedMs,
      ahkPath: nativeResult.ahkPath,
      scriptPath: nativeResult.scriptPath,
      windowTitle,
      targetHwnd: nativeResult.nativeResult?.targetHwnd || null,
      activeBefore: nativeResult.nativeResult?.activeBefore ?? null,
      activeAfter: nativeResult.nativeResult?.activeAfter ?? null,
      recoveryAttempted,
      recoveryEscapeSent,
      recoveryReturnToWorldSent,
      sendMode: nativeResult.nativeResult?.sendMode || null,
      openCommandId: openProbeCommandId,
      selectCommandId: null,
      title: openSnapshot.title,
      selectedSlot: openSnapshot.selectedSlot,
      selectedFilter: openSnapshot.selectedFilter,
      resultJson: initial.resultJson,
      error: "lua_editor_not_ready"
    };
  }

  const selectArgs = buildUiProbeArgs("lua_editor", "select_context", {
    slotName,
    filterName,
    settleMs
  });
  const effectiveSelectTimeout = Math.max(probeTimeoutMs, settleMs + 5000);
  const selected = await enqueueAndWaitUiProbe(
    commandQueue,
    eventStore,
    "lua_editor",
    playerId,
    "select_context",
    selectArgs,
    effectiveSelectTimeout
  );
  const selectedSnapshot = parseEditorDescribeSnapshot(selected.resultJson);
  const editorReady = selected.found && selected.success === true &&
    selectedSnapshot.visible === true &&
    selectedSnapshot.selectedSlot === slotName &&
    selectedSnapshot.selectedFilter === filterName;

  return {
    invoked,
    editorReady,
    alreadyVisible,
    waitedMs,
    ahkPath: nativeResult.ahkPath,
    scriptPath: nativeResult.scriptPath,
    windowTitle,
    targetHwnd: nativeResult.nativeResult?.targetHwnd || null,
    activeBefore: nativeResult.nativeResult?.activeBefore ?? null,
    activeAfter: nativeResult.nativeResult?.activeAfter ?? null,
    recoveryAttempted,
    recoveryEscapeSent,
    recoveryReturnToWorldSent,
    sendMode: nativeResult.nativeResult?.sendMode || null,
    openCommandId: openProbeCommandId,
    selectCommandId: selected.commandId,
    title: selectedSnapshot.title,
    selectedSlot: selectedSnapshot.selectedSlot,
    selectedFilter: selectedSnapshot.selectedFilter,
    resultJson: selected.resultJson,
    error: editorReady ? null : (selected.error ?? "lua_context_not_ready")
  };
}

async function stageEditorIdeImport(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  playerId: number,
  targetKind: EditorUiKind,
  sourcePath: string
) {
  const liveContext = await resolveLiveIdeImportContext(commandQueue, eventStore, targetKind, playerId);
  return commandQueue.stageIdeImportFromFile({
    playerId,
    targetKind,
    sourcePath,
    contextKeyOverride: liveContext.contextKey,
    referenceOverride: liveContext.reference
  });
}

function buildLuaBufferHashVerifyFunctionBody(expectedHash32: string, expectedLength: number): string {
  return [
    "function computeHash32(text) {",
    "  var hash = 0x811c9dc5;",
    "  for (var index = 0; index < text.length; index += 1) {",
    "    var code = text.charCodeAt(index);",
    "    var lowByte = code & 0xff;",
    "    var highByte = (code >>> 8) & 0xff;",
    "    hash = Math.imul((hash ^ lowByte) >>> 0, 0x01000193) >>> 0;",
    "    hash = Math.imul((hash ^ highByte) >>> 0, 0x01000193) >>> 0;",
    "  }",
    "  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);",
    "}",
    "var manager = window.LUAEditorManager || null;",
    "var code = '';",
    "if (manager && typeof manager.getCodeLuaEditor === 'function') {",
    "  code = String(manager.getCodeLuaEditor() || '');",
    "} else if (manager && typeof manager.getLuaEditor === 'function') {",
    "  var cm = manager.getLuaEditor();",
    "  code = cm && typeof cm.getValue === 'function' ? String(cm.getValue() || '') : '';",
    "}",
    "var hash32 = computeHash32(code);",
    `var expectedHash32 = ${JSON.stringify(expectedHash32)};`,
    `var expectedLength = ${JSON.stringify(expectedLength)};`,
    "return {",
    "  ok: true,",
    "  codeLength: code.length,",
    "  hash32: hash32,",
    "  matches: code.length === expectedLength && hash32 === expectedHash32",
    "};"
  ].join("\n");
}

async function verifyLuaContextBuffer(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  playerId: number,
  expectedHash32: string,
  expectedLength: number,
  maxWaitMs: number,
  probeTimeoutMs: number,
  pollIntervalMs: number
): Promise<{
  verified: boolean;
  waitedMs: number;
  probe: ProbeResultSnapshot;
}> {
  const started = Date.now();
  const functionBody = buildLuaBufferHashVerifyFunctionBody(expectedHash32, expectedLength);
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
    const remainingBudget = maxWaitMs - (Date.now() - started);
    const attemptTimeout = Math.min(probeTimeoutMs, Math.max(250, remainingBudget));
    last = await enqueueAndWaitUiProbe(commandQueue, eventStore, "lua_editor", playerId, "raw_eval", [functionBody], attemptTimeout);
    const parsed = parseJsonObject(last.resultJson);
    if (last.found && last.success === true && parsed?.matches === true) {
      return {
        verified: true,
        waitedMs: Date.now() - started,
        probe: last
      };
    }

    const remaining = maxWaitMs - (Date.now() - started);
    if (remaining <= 0) {
      break;
    }
    await sleepMs(Math.min(pollIntervalMs, remaining));
  }

  return {
    verified: false,
    waitedMs: Date.now() - started,
    probe: last
  };
}

async function runEditorEscapeCleanup(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  playerId: number,
  timeoutMs: number,
  defaultAhkPath: string | null,
  editorKind: "screen_editor" | "lua_editor"
): Promise<{
  nativeOk: boolean;
  native: Awaited<ReturnType<typeof runNativeAhkInput>>;
  finalDescribe: ProbeResultSnapshot;
}> {
  await sleepMs(500);
  const native = await runNativeAhkInput(
    "send_key",
    "Dual Universe",
    true,
    false,
    "Escape",
    1,
    120,
    defaultAhkPath
  );
  const nativeOk = native.nativeResult?.ok === true;
  const finalDescribe = await enqueueAndWaitUiProbe(commandQueue, eventStore, editorKind, playerId, "describe", [], timeoutMs);

  return {
    nativeOk,
    native,
    finalDescribe
  };
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
      const result = await stageEditorIdeImport(commandQueue, eventStore, playerId, targetKind, sourcePath);

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
          hasContextMetadata: result.hasContextMetadata,
          contextSource: result.contextSource
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
        hasContextMetadata: result.hasContextMetadata,
        contextSource: result.contextSource
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
        "hud_chat",
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
        "hud_chat",
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
        "Reads recent chat messages across server-side channels relevant to the player without depending on the visible HUD chat. This path is opt-in and requires ModUiToolbox to be built with server chat support.",
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
        "Reads recent server-side chat messages across channels relevant to the player and returns only AI mentions. This path is opt-in and requires ModUiToolbox to be built with server chat support.",
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
        "hud_chat",
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
        "hud_chat",
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
        "hud_chat",
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
        "Generic probe_call wrapper. `lua_editor` supports the public Lua probe API; `screen_editor` currently supports `describe`, `apply`, `cancel`, `outer_html`, `raw_eval`. For current live behavior, `screen_editor apply` and `screen_editor cancel` perform their own delayed native `Escape` cleanup after the probe-driven close. For the same `playerId`, do not parallelize Lua-editor UI calls with each other.",
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
        selector,
        functionBody
      });
      const effectiveTimeout = method === "select_context"
        ? Math.max(timeoutMs, (settleMs ?? 1000) + 5000)
        : timeoutMs;
      const probeResult = await enqueueAndWaitUiProbe(commandQueue, eventStore, uiKind, playerId, method, probeArgs, effectiveTimeout);
      if (uiKind === "screen_editor" && (method === "cancel" || method === "apply") && probeResult.found && probeResult.success) {
        const cleanup = await runEditorEscapeCleanup(
          commandQueue,
          eventStore,
          playerId,
          effectiveTimeout,
          options?.defaultAhkPath ?? null,
          uiKind
        );
        const combinedSuccess = cleanup.nativeOk && cleanup.finalDescribe.found && cleanup.finalDescribe.success === true;
        const combinedPayload = {
          action: {
            commandId: probeResult.commandId,
            resultJson: probeResult.resultJson,
            error: probeResult.error
          },
          nativeCleanup: {
            invoked: cleanup.nativeOk,
            ahkPath: cleanup.native.ahkPath,
            scriptPath: cleanup.native.scriptPath,
            nativeResultJson: cleanup.native.nativeResultJson,
            error: cleanup.native.nativeResult?.error || null
          },
          finalDescribe: {
            commandId: cleanup.finalDescribe.commandId,
            resultJson: cleanup.finalDescribe.resultJson,
            error: cleanup.finalDescribe.error
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
            error: combinedSuccess ? null : cleanup.native.nativeResult?.error || cleanup.finalDescribe.error || `${uiKind}_${method}_cleanup_failed`
          },
          effectiveTimeout,
          method
        );
      }
      return formatProbeToolResult(probeResult, effectiveTimeout, method);
    }
  );

  server.registerTool(
    "du_reinject_lua_probe",
    {
      title: "Reinject Lua Probe",
      description:
        "Asks an already-injected Lua probe page to reinject itself through `CPPMod.sendModAction`. This is the stable post-bootstrap path and does not depend on menu clicks. Works only after the first probe has already been injected at least once for the active construct/page.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        openEditorAfter: z.boolean().default(false).describe("When true, reopen the Lua editor after dispatching the reinject request"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the initial raw_eval probe result"),
        reopenDelayMs: z.number().int().min(0).max(5000).default(400).describe("Delay before reopening the editor after dispatching reinject"),
        reopenTimeoutMs: z.number().int().min(250).max(15000).default(8000).describe("How long to wait for the reopened editor describe snapshot"),
        activateWindow: z.boolean().default(true).describe("When reopening, activate the Dual Universe window before sending Ctrl+L"),
        ahkPath: z.string().optional().describe("Optional AutoHotkey v2 exe path or directory override for reopen"),
        windowTitle: z.string().default("Dual Universe").describe("Window title substring used when reopening the editor")
      },
      outputSchema: reinjectLuaProbeOutputSchema
    },
    async ({ playerId, openEditorAfter, timeoutMs, reopenDelayMs, reopenTimeoutMs, activateWindow, ahkPath, windowTitle }) => {
      const functionBody = [
        "try {",
        "  var cfg = window.__UI_TOOLBOX_LUA_PROBE_CONFIG || {};",
        "  var modName = cfg.modName || 'NQ.UIToolbox';",
        "  var actionId = parseInt(cfg.injectActionId || 5, 10) || 5;",
        "  if (!window.CPPMod || typeof window.CPPMod.sendModAction !== 'function') {",
        "    return { ok: false, reason: 'sendModAction_unavailable', modName: modName, actionId: actionId };",
        "  }",
        "  window.CPPMod.sendModAction(modName, actionId, [], '');",
        "  return { ok: true, modName: modName, actionId: actionId, constructId: cfg.constructId || null };",
        "} catch (err) {",
        "  return { ok: false, reason: String(err && err.message ? err.message : err) };",
        "}"
      ].join("\n");

      const probeResult = await enqueueAndWaitUiProbe(
        commandQueue,
        eventStore,
        "lua_editor",
        playerId,
        "raw_eval",
        [functionBody],
        timeoutMs
      );

      const parsed = parseReinjectLuaProbeResult(probeResult.resultJson);
      let editorReady: boolean | null = null;
      let editorVisible: boolean | null = null;
      let editorTitle: string | null = null;
      let editorSelectedSlot: string | null = null;
      let editorSelectedFilter: string | null = null;
      let nativeResultJson: string | null = null;
      let combinedError: string | null = probeResult.error;

      if (openEditorAfter && parsed.dispatched) {
        if (reopenDelayMs > 0) {
          await sleepMs(reopenDelayMs);
        }

        const native = await runNativeAhkInput(
          "ctrl_l",
          windowTitle,
          activateWindow,
          false,
          null,
          1,
          120,
          ahkPath ?? options?.defaultAhkPath ?? null
        );
        nativeResultJson = native.nativeResultJson;

        if (native.nativeResult?.ok === true) {
          const reopened = await enqueueAndWaitUiProbe(commandQueue, eventStore, "lua_editor", playerId, "describe", [], reopenTimeoutMs);
          const snapshot = parseEditorDescribeSnapshot(reopened.resultJson);
          editorReady = reopened.found && reopened.success === true;
          editorVisible = snapshot.visible;
          editorTitle = snapshot.title;
          editorSelectedSlot = snapshot.selectedSlot;
          editorSelectedFilter = snapshot.selectedFilter;
          if (!editorReady && combinedError === null) {
            combinedError = reopened.error ?? "lua_editor_reopen_not_ready";
          }
        } else if (combinedError === null) {
          combinedError = native.nativeResult?.error || "native_reopen_failed";
        }
      }

      const structuredContent = {
        found: probeResult.found,
        commandId: probeResult.commandId,
        method: probeResult.method,
        success: probeResult.success,
        createdAtUtc: probeResult.createdAtUtc,
        dispatched: parsed.dispatched,
        modName: parsed.modName,
        injectActionId: parsed.injectActionId,
        constructId: parsed.constructId,
        reason: parsed.reason,
        parseError: parsed.parseError,
        openEditorAfter,
        editorReady,
        editorVisible,
        editorTitle,
        editorSelectedSlot,
        editorSelectedFilter,
        nativeResultJson,
        resultJson: probeResult.resultJson,
        error: combinedError
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                dispatched: structuredContent.dispatched,
                modName: structuredContent.modName,
                injectActionId: structuredContent.injectActionId,
                constructId: structuredContent.constructId,
                openEditorAfter: structuredContent.openEditorAfter,
                editorReady: structuredContent.editorReady,
                editorVisible: structuredContent.editorVisible,
                editorTitle: structuredContent.editorTitle,
                error: structuredContent.error,
                reason: structuredContent.reason
              },
              null,
              2
            )
          }
        ],
        structuredContent
      };
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
    "du_open_lua_context",
    {
      title: "Open Lua Editor Context",
      description:
        "Opens the Programming Board Lua editor if needed, waits for a live Lua editor snapshot, selects the requested slot/filter, and returns the final verified context in one deterministic call.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        slotName: z.string().min(1).describe("Lua slot to activate, for example `library`"),
        filterName: z.string().min(1).describe("Visible Lua handler/filter signature, for example `onStart()`"),
        settleMs: z.number().int().min(1000).max(15000).default(1500).describe("Minimum wait after slot confirmation before final describe"),
        timeoutMs: z.number().int().min(500).max(30000).default(10000).describe("Maximum total wait for the Lua editor to appear"),
        probeTimeoutMs: z.number().int().min(250).max(15000).default(8000).describe("Timeout for individual describe/select probe calls"),
        activateWindow: z.boolean().default(true).describe("When true, activate the Dual Universe window before native open"),
        windowTitle: z.string().default("Dual Universe").describe("Window title substring used to locate the Dual Universe client"),
        ahkPath: z.string().min(1).optional().describe("Optional AutoHotkey v2 exe path or directory override")
      },
      outputSchema: luaOpenContextOutputSchema
    },
    async ({ playerId, slotName, filterName, settleMs, timeoutMs, probeTimeoutMs, activateWindow, windowTitle, ahkPath }) => {
      const structuredContent = await openLuaContext(
        commandQueue,
        eventStore,
        playerId,
        slotName,
        filterName,
        settleMs,
        timeoutMs,
        probeTimeoutMs,
        activateWindow,
        windowTitle,
        ahkPath,
        options?.defaultAhkPath ?? null
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(structuredContent, null, 2)
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_push_lua_context_code",
    {
      title: "Push Lua Context Code",
      description:
        "Opens the Programming Board Lua editor context if needed, stages a local source file into that exact slot/filter, and verifies the visible live buffer matches the expected code hash.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        sourcePath: z.string().min(1).describe("Absolute path of the local source file to stage into the live Lua context"),
        slotName: z.string().min(1).describe("Lua slot to activate, for example `library`"),
        filterName: z.string().min(1).describe("Visible Lua handler/filter signature, for example `onStart()`"),
        settleMs: z.number().int().min(1000).max(15000).default(1500).describe("Minimum wait after slot confirmation before push"),
        timeoutMs: z.number().int().min(500).max(30000).default(10000).describe("Maximum total wait for the Lua editor to appear"),
        probeTimeoutMs: z.number().int().min(250).max(15000).default(8000).describe("Timeout for individual probe calls"),
        verifyTimeoutMs: z.number().int().min(500).max(30000).default(10000).describe("Maximum wait for the live buffer to match the staged source"),
        verifyPollIntervalMs: z.number().int().min(100).max(5000).default(250).describe("Polling interval while verifying the live buffer"),
        activateWindow: z.boolean().default(true).describe("When true, activate the Dual Universe window before native open"),
        windowTitle: z.string().default("Dual Universe").describe("Window title substring used to locate the Dual Universe client"),
        ahkPath: z.string().min(1).optional().describe("Optional AutoHotkey v2 exe path or directory override")
      },
      outputSchema: luaPushContextOutputSchema
    },
    async ({
      playerId,
      sourcePath,
      slotName,
      filterName,
      settleMs,
      timeoutMs,
      probeTimeoutMs,
      verifyTimeoutMs,
      verifyPollIntervalMs,
      activateWindow,
      windowTitle,
      ahkPath
    }) => {
      const openResult = await openLuaContext(
        commandQueue,
        eventStore,
        playerId,
        slotName,
        filterName,
        settleMs,
        timeoutMs,
        probeTimeoutMs,
        activateWindow,
        windowTitle,
        ahkPath,
        options?.defaultAhkPath ?? null
      );

      if (!openResult.editorReady) {
        const structuredContent = {
          editorReady: false,
          staged: false,
          verified: false,
          playerId,
          sourcePath,
          requestId: null,
          contextSource: null,
          codeCharLength: null,
          codeHash32: null,
          workspacePath: null,
          metadataPath: null,
          importPath: null,
          openCommandId: openResult.openCommandId,
          selectCommandId: openResult.selectCommandId,
          verifyCommandId: null,
          verifyWaitedMs: 0,
          recoveryAttempted: openResult.recoveryAttempted,
          title: openResult.title,
          selectedSlot: openResult.selectedSlot,
          selectedFilter: openResult.selectedFilter,
          verifyResultJson: null,
          error: openResult.error ?? "lua_context_not_ready"
        };
        return {
          content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
          structuredContent
        };
      }

      const staged = await stageEditorIdeImport(commandQueue, eventStore, playerId, "lua_editor", sourcePath);
      const verify = await verifyLuaContextBuffer(
        commandQueue,
        eventStore,
        playerId,
        staged.codeHash32,
        staged.codeCharLength,
        verifyTimeoutMs,
        probeTimeoutMs,
        verifyPollIntervalMs
      );

      const structuredContent = {
        editorReady: openResult.editorReady,
        staged: true,
        verified: verify.verified,
        playerId,
        sourcePath: staged.sourcePath,
        requestId: staged.requestId,
        contextSource: staged.contextSource,
        codeCharLength: staged.codeCharLength,
        codeHash32: staged.codeHash32,
        workspacePath: staged.workspacePath,
        metadataPath: staged.metadataPath,
        importPath: staged.importPath,
        openCommandId: openResult.openCommandId,
        selectCommandId: openResult.selectCommandId,
        verifyCommandId: verify.probe.commandId || null,
        verifyWaitedMs: verify.waitedMs,
        recoveryAttempted: openResult.recoveryAttempted,
        title: openResult.title,
        selectedSlot: openResult.selectedSlot,
        selectedFilter: openResult.selectedFilter,
        verifyResultJson: verify.probe.resultJson,
        error: verify.verified ? null : (verify.probe.error ?? "lua_buffer_verify_failed")
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(structuredContent, null, 2)
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_editor_pull_code",
    {
      title: "Read Workspace Editor Code",
      description: "Reads the last known editor workspace snippet for a session.",
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
    "du_editor_pending_import",
    {
      title: "Read Pending Editor Import",
      description: "Reads the currently staged IDE import payload for a session, if one exists.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Player ID for session scoping"),
        targetKind: editorTargetKindSchema.default("lua_editor").describe("Target editor kind")
      },
      outputSchema: pendingIdeImportOutputSchema
    },
    async ({ playerId, targetKind }) => {
      const snapshot = await eventStore.readPendingIdeImport(targetKind, playerId);
      const structuredContent = {
        ...snapshot
      };
      return {
        content: [
          {
            type: "text",
            text: snapshot.found
              ? snapshot.code ?? ""
              : `No pending IDE import found for player ${playerId} (${targetKind}).`
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

      if (targetKind === "screen_editor") {
        const cleanupTimeoutMs = waitForEditor
          ? Math.min((maxAttempts * retryDelayMs) + 5000, 30000)
          : 5000;
        const commandEvent = await eventStore.waitForCommandEvent(result.command.commandId, "command_result", cleanupTimeoutMs);
        if (commandEvent.found) {
          try {
            const payload = commandEvent.payloadJson ? JSON.parse(commandEvent.payloadJson) as Record<string, unknown> : null;
            if (payload?.status === "injected") {
              await runEditorEscapeCleanup(
                commandQueue,
                eventStore,
                playerId,
                cleanupTimeoutMs,
                options?.defaultAhkPath ?? null,
                targetKind
              );
            }
          } catch {
            // If command_result payload parsing fails, keep the save result stable and skip cleanup inference.
          }
        }
      }
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

  server.registerTool(
    "du_ui_dump",
    {
      title: "Queue UI Dump",
      description:
        "Queues a full UI dump (ModUiToolbox Action 1/2). Outputs chunked NDJSON to tmp/ui-dumps/. Use initialDelayMs to wait (e.g. for F1/Help system to load) before scraping. Use htmlSelector to target a specific DOM element instead of the full document.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        deep: z.boolean().default(true).describe("Deep mode (true) or safe mode (false)"),
        initialDelayMs: z.number().int().min(0).max(30000).default(0).describe("Delay in ms before starting the dump (e.g. 3000 for F1/Help load)"),
        htmlSelector: z.string().default("").describe("CSS selector to target a specific DOM element for HTML dump (e.g. '#dashboard_panel'). Empty = full document.")
      },
      outputSchema: queuedCommandOutputSchema
    },
    async ({ playerId, deep, initialDelayMs, htmlSelector }) => {
      const result = await commandQueue.enqueue({
        playerId,
        targetKind: "lua_editor",
        action: "ui_dump",
        deep,
        initialDelayMs,
        htmlSelector
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
          action: "ui_dump",
          queuePath: result.path,
          deep,
          initialDelayMs,
          htmlSelector
        }
      });

      const structuredContent = {
        commandId: result.command.commandId,
        status: "queued" as const,
        targetKind: "lua_editor",
        playerId,
        queuePath: result.path,
        saveRequested: false,
        waitForEditor: false,
        maxAttempts: null,
        retryDelayMs: null
      };

      return {
        content: [
          {
            type: "text",
            text: `Queued UI dump (${deep ? "deep" : "safe"}, delay=${initialDelayMs}ms) for player ${playerId}: ${result.command.commandId}`
          }
        ],
        structuredContent
      };
    }
  );
}
