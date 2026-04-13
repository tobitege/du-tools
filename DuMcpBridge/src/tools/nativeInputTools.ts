import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { BridgeCommandQueue } from "../bridge/commandQueue.js";
import { BridgeEventStore, type ProbeResultSnapshot } from "../bridge/eventStore.js";
import { clampedIntSchema } from "./schemaUtils.js";

const execFileAsync = promisify(execFile);

type NativeEditorKind = "lua_editor" | "screen_editor";
const supportedNativeKeys = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "Escape",
  "Tab",
  "Enter",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
  "Ctrl+L"
] as const;
type SupportedNativeKey = (typeof supportedNativeKeys)[number];

const nativeEditorOpenOutputSchema = {
  invoked: z.boolean(),
  editorReady: z.boolean(),
  waitedMs: z.number().int().nonnegative(),
  ahkPath: z.string().nullable(),
  scriptPath: z.string(),
  windowTitle: z.string(),
  targetHwnd: z.string().nullable(),
  activeBefore: z.boolean().nullable(),
  activeAfter: z.boolean().nullable(),
  sendEscapeFirst: z.boolean(),
  recoveryAttempted: z.boolean(),
  recoveryEscapeSent: z.boolean(),
  recoveryReturnToWorldSent: z.boolean(),
  sendMode: z.string().nullable(),
  commandId: z.string().nullable(),
  openedUiKind: z.enum(["lua_editor", "screen_editor"]).nullable(),
  visible: z.boolean().nullable(),
  selectedSlot: z.string().nullable(),
  selectedFilter: z.string().nullable(),
  title: z.string().nullable(),
  mode: z.string().nullable(),
  codeLength: z.number().nullable(),
  nativeResultJson: z.string().nullable(),
  error: z.string().nullable()
};

type NativeInputResult = {
  ok: boolean;
  action: string;
  windowTitle: string;
  targetHwnd: string;
  activeBefore: boolean;
  activeAfter: boolean;
  moveX?: number | null;
  moveY?: number | null;
  settleMs?: number | null;
  cursorX?: number | null;
  cursorY?: number | null;
  sendMode: string;
  key?: string | null;
  repeatCount?: number | null;
  startX?: number | null;
  startY?: number | null;
  endX?: number | null;
  endY?: number | null;
  startScreenX?: number | null;
  startScreenY?: number | null;
  endScreenX?: number | null;
  endScreenY?: number | null;
  durationMs?: number | null;
  dragSteps?: number | null;
  error: string;
};

const nativeCameraMoveOutputSchema = {
  invoked: z.boolean(),
  ahkPath: z.string().nullable(),
  scriptPath: z.string(),
  windowTitle: z.string(),
  targetHwnd: z.string().nullable(),
  activeBefore: z.boolean().nullable(),
  activeAfter: z.boolean().nullable(),
  moveX: z.number().int(),
  moveY: z.number().int(),
  settleMs: z.number().int().nonnegative(),
  cursorX: z.number().int().nullable(),
  cursorY: z.number().int().nullable(),
  nativeResultJson: z.string().nullable(),
  error: z.string().nullable()
};

const nativeKeySendOutputSchema = {
  invoked: z.boolean(),
  ahkPath: z.string().nullable(),
  scriptPath: z.string(),
  windowTitle: z.string(),
  targetHwnd: z.string().nullable(),
  activeBefore: z.boolean().nullable(),
  activeAfter: z.boolean().nullable(),
  key: z.enum(supportedNativeKeys),
  repeatCount: z.number().int().positive(),
  delayMs: z.number().int().nonnegative(),
  sendMode: z.string().nullable(),
  nativeResultJson: z.string().nullable(),
  error: z.string().nullable()
};

const nativeMouseDragOutputSchema = {
  invoked: z.boolean(),
  ahkPath: z.string().nullable(),
  scriptPath: z.string(),
  windowTitle: z.string(),
  targetHwnd: z.string().nullable(),
  activeBefore: z.boolean().nullable(),
  activeAfter: z.boolean().nullable(),
  startX: z.number().int(),
  startY: z.number().int(),
  endX: z.number().int(),
  endY: z.number().int(),
  startScreenX: z.number().int().nullable(),
  startScreenY: z.number().int().nullable(),
  endScreenX: z.number().int().nullable(),
  endScreenY: z.number().int().nullable(),
  durationMs: z.number().int().nonnegative(),
  dragSteps: z.number().int().positive(),
  settleMs: z.number().int().nonnegative(),
  cursorX: z.number().int().nullable(),
  cursorY: z.number().int().nullable(),
  sendMode: z.string().nullable(),
  nativeResultJson: z.string().nullable(),
  error: z.string().nullable()
};

type NativeMouseDragOptions = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs: number;
  dragSteps: number;
};

type EditorSnapshotFields = {
  visible: boolean | null;
  selectedSlot: string | null;
  selectedFilter: string | null;
  title: string | null;
  mode: string | null;
  codeLength: number | null;
  parseError: string | null;
};

export type NativeInputToolOptions = {
  defaultAhkPath?: string | null;
};

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getAhkScriptPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..", "ahk", "du_bridge_input.ahk");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function expandAhkPathCandidates(rawPath: string): string[] {
  const trimmed = rawPath.trim();
  if (trimmed.length <= 0) {
    return [];
  }

  if (extname(trimmed).toLowerCase() === ".exe") {
    return [trimmed];
  }

  return [
    join(trimmed, "v2", "AutoHotkey64.exe"),
    join(trimmed, "v2", "AutoHotkeyU64.exe"),
    join(trimmed, "v2", "AutoHotkey.exe"),
    join(trimmed, "AutoHotkey64.exe"),
    join(trimmed, "AutoHotkeyU64.exe"),
    join(trimmed, "AutoHotkey.exe")
  ];
}

async function resolveAutoHotkeyExecutable(preferredPath?: string | null): Promise<string | null> {
  const envCandidates = [
    preferredPath ?? "",
    process.env.DU_AHK_EXE ?? "",
    process.env.DU_MCP_BRIDGE_AHK_EXE ?? "",
    process.env.DU_AHK_DIR ?? "",
    process.env.DU_MCP_BRIDGE_AHK_DIR ?? ""
  ]
    .flatMap((value) => expandAhkPathCandidates(value))
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
  const fileCandidates = [
    "C:/Program Files/AutoHotkey/v2/AutoHotkey64.exe",
    "C:/Program Files/AutoHotkey/v2/AutoHotkeyU64.exe",
    "C:/Program Files/AutoHotkey/v2/AutoHotkey.exe",
    "C:/Program Files/AutoHotkey/AutoHotkey64.exe",
    "C:/Program Files/AutoHotkey/AutoHotkeyU64.exe",
    "C:/Program Files/AutoHotkey/AutoHotkey.exe",
    "C:/Program Files/tools/AutoHotkey/AutoHotkey64.exe",
    "C:/Program Files/tools/AutoHotkey/AutoHotkeyU64.exe",
    "C:/Program Files/tools/AutoHotkey/AutoHotkey.exe",
    "C:/Program Files/tools/AutoHotkey/v2/AutoHotkey64.exe",
    "C:/Program Files/tools/AutoHotkey/v2/AutoHotkeyU64.exe",
    "C:/Program Files/tools/AutoHotkey/v2/AutoHotkey.exe"
  ];

  for (const candidate of [...envCandidates, ...fileCandidates]) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return "AutoHotkey64.exe";
}

export async function runNativeAhkInput(
  action: "ctrl_l" | "send_key" | "camera_move" | "mouse_drag",
  windowTitle: string,
  activateWindow: boolean,
  sendEscapeFirst: boolean,
  key: SupportedNativeKey | null,
  repeatCount: number,
  delayMs: number,
  preferredAhkPath?: string | null,
  moveX = 0,
  moveY = 0,
  settleMs = 400,
  dragOptions?: NativeMouseDragOptions | null
): Promise<{
  ahkPath: string | null;
  scriptPath: string;
  nativeResult: NativeInputResult | null;
  nativeResultJson: string | null;
}> {
  const scriptPath = getAhkScriptPath();
  if (!(await fileExists(scriptPath))) {
    throw new Error(`ahk_script_not_found:${scriptPath}`);
  }

  const ahkPath = await resolveAutoHotkeyExecutable(preferredAhkPath);
  if (!ahkPath) {
    throw new Error("autohotkey_not_found");
  }

  const args = [
    scriptPath,
    action,
    "--window-title",
    windowTitle,
    "--activate",
    activateWindow ? "true" : "false",
    "--send-escape-first",
    sendEscapeFirst ? "true" : "false"
  ];
  if (key) {
    args.push("--key", key);
  }
  args.push("--repeat", String(repeatCount), "--delay-ms", String(delayMs));
  if (action === "camera_move") {
    args.push("--x", String(moveX), "--y", String(moveY), "--settle-ms", String(settleMs));
  } else if (action === "mouse_drag") {
    if (!dragOptions) {
      throw new Error("mouse_drag_options_required");
    }
    args.push(
      "--start-x",
      String(dragOptions.startX),
      "--start-y",
      String(dragOptions.startY),
      "--end-x",
      String(dragOptions.endX),
      "--end-y",
      String(dragOptions.endY),
      "--duration-ms",
      String(dragOptions.durationMs),
      "--steps",
      String(dragOptions.dragSteps),
      "--settle-ms",
      String(settleMs)
    );
  }

  try {
    const { stdout } = await execFileAsync(ahkPath, args, {
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 1024 * 1024
    });
    const trimmed = stdout.trim();
    const parsed = trimmed.length > 0 ? (JSON.parse(trimmed) as NativeInputResult) : null;
    return {
      ahkPath,
      scriptPath,
      nativeResult: parsed,
      nativeResultJson: trimmed.length > 0 ? trimmed : null
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string | Buffer };
    const stdout = typeof err.stdout === "string" ? err.stdout.trim() : "";
    if (stdout.length > 0) {
      return {
        ahkPath,
        scriptPath,
        nativeResult: JSON.parse(stdout) as NativeInputResult,
        nativeResultJson: stdout
      };
    }
    throw new Error(`autohotkey_exec_failed:${err.message}`);
  }
}

async function enqueueAndWaitEditorDescribe(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  targetKind: NativeEditorKind,
  playerId: number,
  timeoutMs: number
): Promise<ProbeResultSnapshot> {
  const result = await commandQueue.enqueue({
    playerId,
    targetKind,
    action: "probe_call",
    probeMethod: "describe",
    probeArgs: []
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
      probeMethod: "describe",
      queuePath: result.path
    }
  });

  return eventStore.waitForProbeResult(result.command.commandId, timeoutMs);
}

function parseEditorSnapshot(targetKind: NativeEditorKind, resultJson: string | null): EditorSnapshotFields {
  if (!resultJson) {
    return {
      visible: null,
      selectedSlot: null,
      selectedFilter: null,
      title: null,
      mode: null,
      codeLength: null,
      parseError: null
    };
  }

  try {
    const parsed = JSON.parse(resultJson) as Record<string, unknown>;
    return {
      visible: typeof parsed.visible === "boolean" ? parsed.visible : null,
      selectedSlot: targetKind === "lua_editor" && typeof parsed.selectedSlot === "string" ? parsed.selectedSlot : null,
      selectedFilter: targetKind === "lua_editor" && typeof parsed.selectedFilter === "string" ? parsed.selectedFilter : null,
      title: typeof parsed.title === "string" ? parsed.title : null,
      mode: targetKind === "screen_editor" && typeof parsed.mode === "string" ? parsed.mode : null,
      codeLength: typeof parsed.codeLength === "number" ? parsed.codeLength : null,
      parseError: null
    };
  } catch (error) {
    return {
      visible: null,
      selectedSlot: null,
      selectedFilter: null,
      title: null,
      mode: null,
      codeLength: null,
      parseError: error instanceof Error ? error.message : String(error)
    };
  }
}

function editorSnapshotLooksReady(targetKind: NativeEditorKind, fields: EditorSnapshotFields): boolean {
  if (fields.visible !== true) {
    return false;
  }

  if (targetKind === "screen_editor") {
    return (
      (typeof fields.title === "string" && fields.title.trim().length > 0) ||
      typeof fields.codeLength === "number" ||
      (typeof fields.mode === "string" && fields.mode.length > 0)
    );
  }

  return (
    (typeof fields.title === "string" && fields.title.trim().length > 0) ||
    (typeof fields.selectedSlot === "string" && fields.selectedSlot.length > 0)
  );
}

async function waitForAnyEditorVisible(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  playerId: number,
  maxWaitMs: number
): Promise<{
  editorReady: boolean;
  waitedMs: number;
  commandId: string | null;
  openedUiKind: NativeEditorKind | null;
  visible: boolean | null;
  selectedSlot: string | null;
  selectedFilter: string | null;
  title: string | null;
  mode: string | null;
  codeLength: number | null;
}> {
  const startedAt = Date.now();
  let lastCommandId: string | null = null;
  let lastOpenedUiKind: NativeEditorKind | null = null;
  let lastFields: EditorSnapshotFields = {
    visible: null,
    selectedSlot: null,
    selectedFilter: null,
    title: null,
    mode: null,
    codeLength: null,
    parseError: null
  };
  const targetKinds: NativeEditorKind[] = ["screen_editor", "lua_editor"];

  while (Date.now() - startedAt <= maxWaitMs) {
    for (const targetKind of targetKinds) {
      const remaining = maxWaitMs - (Date.now() - startedAt);
      if (remaining <= 0) {
        break;
      }

      const attemptTimeout = Math.min(4000, Math.max(500, remaining));
      const probeResult = await enqueueAndWaitEditorDescribe(commandQueue, eventStore, targetKind, playerId, attemptTimeout);
      lastCommandId = probeResult.commandId || null;
      lastFields = parseEditorSnapshot(targetKind, probeResult.resultJson);
      lastOpenedUiKind = lastFields.visible === true ? targetKind : lastOpenedUiKind;

      if (probeResult.found && probeResult.success && editorSnapshotLooksReady(targetKind, lastFields)) {
        return {
          editorReady: true,
          waitedMs: Date.now() - startedAt,
          commandId: lastCommandId,
          openedUiKind: targetKind,
          visible: lastFields.visible,
          selectedSlot: lastFields.selectedSlot,
          selectedFilter: lastFields.selectedFilter,
          title: lastFields.title,
          mode: lastFields.mode,
          codeLength: lastFields.codeLength
        };
      }
    }

    const remaining = maxWaitMs - (Date.now() - startedAt);
    if (remaining <= 0) {
      break;
    }

    await sleepMs(Math.min(250, remaining));
  }

  return {
    editorReady: false,
    waitedMs: Date.now() - startedAt,
    commandId: lastCommandId,
    openedUiKind: lastOpenedUiKind,
    visible: lastFields.visible,
    selectedSlot: lastFields.selectedSlot,
    selectedFilter: lastFields.selectedFilter,
    title: lastFields.title,
    mode: lastFields.mode,
    codeLength: lastFields.codeLength
  };
}

export function registerNativeInputTools(
  server: McpServer,
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  options?: NativeInputToolOptions
): void {
  server.registerTool(
    "du_camera_move",
    {
      title: "Move Dual Universe Camera",
      description:
        "Uses a native AutoHotkey v2 helper from `DuMcpBridge/ahk` to move the cursor to the center of the Dual Universe client area, then apply one relative camera move with explicit `x` and `y` deltas. This is the canonical live path for native camera steering.",
      inputSchema: {
        x: z.number().int().describe("Relative horizontal camera move in native mouse-event units"),
        y: z.number().int().describe("Relative vertical camera move in native mouse-event units"),
        settleMs: z.number().int().min(0).max(10000).default(400).describe("Post-move settle delay in milliseconds before the tool returns"),
        windowTitle: z.string().min(1).default("Dual Universe").describe("Window title substring used to locate the Dual Universe client"),
        activateWindow: z.boolean().default(true).describe("When true, AutoHotkey first activates the target window before moving the camera"),
        ahkPath: z.string().min(1).optional().describe("Optional AutoHotkey v2 exe path or directory override for this call")
      },
      outputSchema: nativeCameraMoveOutputSchema
    },
    async ({ x, y, settleMs, windowTitle, activateWindow, ahkPath }) => {
      const resolvedAhkPath = ahkPath ?? options?.defaultAhkPath ?? null;
      const native = await runNativeAhkInput("camera_move", windowTitle, activateWindow, false, null, 1, 0, resolvedAhkPath, x, y, settleMs);
      const nativeOk = native.nativeResult?.ok === true;

      const structuredContent = {
        invoked: nativeOk,
        ahkPath: native.ahkPath,
        scriptPath: native.scriptPath,
        windowTitle,
        targetHwnd: native.nativeResult?.targetHwnd || null,
        activeBefore: native.nativeResult ? native.nativeResult.activeBefore : null,
        activeAfter: native.nativeResult ? native.nativeResult.activeAfter : null,
        moveX: native.nativeResult?.moveX ?? x,
        moveY: native.nativeResult?.moveY ?? y,
        settleMs: native.nativeResult?.settleMs ?? settleMs,
        cursorX: native.nativeResult?.cursorX ?? null,
        cursorY: native.nativeResult?.cursorY ?? null,
        nativeResultJson: native.nativeResultJson,
        error: native.nativeResult?.error || null
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
    "du_send_key_native",
    {
      title: "Send Native Dual Universe Key",
      description:
        "Uses the native AutoHotkey helper from `DuMcpBridge/ahk` to send one supported gameplay or editor key such as `F`, `Escape`, function keys, or `Ctrl+L` to the Dual Universe window.",
      inputSchema: {
        key: z.enum(supportedNativeKeys).describe("Supported key to send, for example `F`, `Escape`, `F1`, or `Ctrl+L`"),
        repeatCount: z.number().int().min(1).max(20).default(1).describe("How many times to send the key"),
        delayMs: z.number().int().min(0).max(5000).default(120).describe("Delay between repeated sends in milliseconds"),
        windowTitle: z.string().min(1).default("Dual Universe").describe("Window title substring used to locate the Dual Universe client"),
        activateWindow: z.boolean().default(true).describe("When true, AutoHotkey first activates the target window before sending the key"),
        ahkPath: z.string().min(1).optional().describe("Optional AutoHotkey v2 exe path or directory override for this call")
      },
      outputSchema: nativeKeySendOutputSchema
    },
    async ({ key, repeatCount, delayMs, windowTitle, activateWindow, ahkPath }) => {
      const resolvedAhkPath = ahkPath ?? options?.defaultAhkPath ?? null;
      const native = await runNativeAhkInput(
        "send_key",
        windowTitle,
        activateWindow,
        false,
        key,
        repeatCount,
        delayMs,
        resolvedAhkPath
      );
      const nativeOk = native.nativeResult?.ok === true;

      const structuredContent = {
        invoked: nativeOk,
        ahkPath: native.ahkPath,
        scriptPath: native.scriptPath,
        windowTitle,
        targetHwnd: native.nativeResult?.targetHwnd || null,
        activeBefore: native.nativeResult ? native.nativeResult.activeBefore : null,
        activeAfter: native.nativeResult ? native.nativeResult.activeAfter : null,
        key,
        repeatCount: native.nativeResult?.repeatCount ?? repeatCount,
        delayMs,
        sendMode: native.nativeResult?.sendMode || null,
        nativeResultJson: native.nativeResultJson,
        error: native.nativeResult?.error || null
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
    "du_mouse_drag_native",
    {
      title: "Drag Mouse Inside Dual Universe Window",
      description:
        "Uses the native AutoHotkey helper from `DuMcpBridge/ahk` to perform a real left-button mouse drag between two client-relative points inside the Dual Universe window. This is intended for live HUD interactions such as resize-handle drags that probe-only DOM events cannot reproduce.",
      inputSchema: {
        startX: z.number().int().min(0).max(20000).describe("Client-relative horizontal start coordinate in pixels"),
        startY: z.number().int().min(0).max(20000).describe("Client-relative vertical start coordinate in pixels"),
        endX: z.number().int().min(0).max(20000).describe("Client-relative horizontal end coordinate in pixels"),
        endY: z.number().int().min(0).max(20000).describe("Client-relative vertical end coordinate in pixels"),
        durationMs: z.number().int().min(0).max(10000).default(220).describe("Total drag duration in milliseconds"),
        dragSteps: z.number().int().min(1).max(240).default(18).describe("How many interpolated cursor moves to perform while the left button is held"),
        settleMs: z.number().int().min(0).max(10000).default(120).describe("Post-drag settle delay in milliseconds before the tool returns"),
        windowTitle: z.string().min(1).default("Dual Universe").describe("Window title substring used to locate the Dual Universe client"),
        activateWindow: z.boolean().default(true).describe("When true, AutoHotkey first activates the target window before dragging"),
        ahkPath: z.string().min(1).optional().describe("Optional AutoHotkey v2 exe path or directory override for this call")
      },
      outputSchema: nativeMouseDragOutputSchema
    },
    async ({ startX, startY, endX, endY, durationMs, dragSteps, settleMs, windowTitle, activateWindow, ahkPath }) => {
      const resolvedAhkPath = ahkPath ?? options?.defaultAhkPath ?? null;
      const native = await runNativeAhkInput(
        "mouse_drag",
        windowTitle,
        activateWindow,
        false,
        null,
        1,
        0,
        resolvedAhkPath,
        0,
        0,
        settleMs,
        {
          startX,
          startY,
          endX,
          endY,
          durationMs,
          dragSteps
        }
      );
      const nativeOk = native.nativeResult?.ok === true;

      const structuredContent = {
        invoked: nativeOk,
        ahkPath: native.ahkPath,
        scriptPath: native.scriptPath,
        windowTitle,
        targetHwnd: native.nativeResult?.targetHwnd || null,
        activeBefore: native.nativeResult ? native.nativeResult.activeBefore : null,
        activeAfter: native.nativeResult ? native.nativeResult.activeAfter : null,
        startX: native.nativeResult?.startX ?? startX,
        startY: native.nativeResult?.startY ?? startY,
        endX: native.nativeResult?.endX ?? endX,
        endY: native.nativeResult?.endY ?? endY,
        startScreenX: native.nativeResult?.startScreenX ?? null,
        startScreenY: native.nativeResult?.startScreenY ?? null,
        endScreenX: native.nativeResult?.endScreenX ?? null,
        endScreenY: native.nativeResult?.endScreenY ?? null,
        durationMs: native.nativeResult?.durationMs ?? durationMs,
        dragSteps: native.nativeResult?.dragSteps ?? dragSteps,
        settleMs: native.nativeResult?.settleMs ?? settleMs,
        cursorX: native.nativeResult?.cursorX ?? null,
        cursorY: native.nativeResult?.cursorY ?? null,
        sendMode: native.nativeResult?.sendMode || null,
        nativeResultJson: native.nativeResultJson,
        error: native.nativeResult?.error || null
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
    "du_open_editor_native",
    {
      title: "Open Element Code Editor via AutoHotkey",
      description:
        "Uses a native AutoHotkey v2 helper from `DuMcpBridge/ahk` to send `Ctrl+L` to the Dual Universe window and then waits until either the Lua editor or screen editor becomes visible, depending on the element the player is looking at.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID for the follow-up probe wait"),
        timeoutMs: clampedIntSchema(500, 30000, 12000).describe("Maximum total wait for either supported element editor to become visible"),
        windowTitle: z.string().min(1).default("Dual Universe").describe("Window title substring used to locate the Dual Universe client"),
        activateWindow: z.boolean().default(true).describe("When true, AutoHotkey first activates the target window before sending `Ctrl+L`"),
        sendEscapeFirst: z.boolean().default(false).describe("When true, AutoHotkey first sends `Escape` before `Ctrl+L`. Use this only as a recovery path when the client is already stuck in a UI; from a normal in-world state that first `Escape` can open the game Options menu, and a second `Escape` is then needed to return in-world before retrying."),
        ahkPath: z.string().min(1).optional().describe("Optional AutoHotkey v2 exe path or directory override for this call")
      },
      outputSchema: nativeEditorOpenOutputSchema
    },
    async ({ playerId, timeoutMs, windowTitle, activateWindow, sendEscapeFirst, ahkPath }) => {
      const resolvedAhkPath = ahkPath ?? options?.defaultAhkPath ?? null;
      const native = await runNativeAhkInput("ctrl_l", windowTitle, activateWindow, sendEscapeFirst, null, 1, 120, resolvedAhkPath);
      const nativeOk = native.nativeResult?.ok === true;
      let selection = nativeOk
        ? await waitForAnyEditorVisible(commandQueue, eventStore, playerId, timeoutMs)
        : {
            editorReady: false,
            waitedMs: 0,
            commandId: null,
            openedUiKind: null,
            visible: null,
            selectedSlot: null,
            selectedFilter: null,
            title: null,
            mode: null,
            codeLength: null
          };
      let recoveryAttempted = false;
      let recoveryEscapeSent = false;
      let recoveryReturnToWorldSent = false;

      if (!selection.editorReady && nativeOk && !sendEscapeFirst) {
        recoveryAttempted = true;
        const escapeRecovery = await runNativeAhkInput("send_key", windowTitle, activateWindow, false, "Escape", 1, 120, resolvedAhkPath);
        recoveryEscapeSent = escapeRecovery.nativeResult?.ok === true;
        if (recoveryEscapeSent) {
          await sleepMs(250);
          const retryNative = await runNativeAhkInput("ctrl_l", windowTitle, activateWindow, false, null, 1, 120, resolvedAhkPath);
          if (retryNative.nativeResult?.ok === true) {
            selection = await waitForAnyEditorVisible(commandQueue, eventStore, playerId, timeoutMs);
          }

          if (!selection.editorReady) {
            const returnToWorld = await runNativeAhkInput("send_key", windowTitle, activateWindow, false, "Escape", 1, 120, resolvedAhkPath);
            recoveryReturnToWorldSent = returnToWorld.nativeResult?.ok === true;
          }
        }
      }

      const structuredContent = {
        invoked: nativeOk,
        editorReady: selection.editorReady,
        waitedMs: selection.waitedMs,
        ahkPath: native.ahkPath,
        scriptPath: native.scriptPath,
        windowTitle,
        targetHwnd: native.nativeResult?.targetHwnd || null,
        activeBefore: native.nativeResult ? native.nativeResult.activeBefore : null,
        activeAfter: native.nativeResult ? native.nativeResult.activeAfter : null,
        sendEscapeFirst,
        recoveryAttempted,
        recoveryEscapeSent,
        recoveryReturnToWorldSent,
        sendMode: native.nativeResult?.sendMode || null,
        commandId: selection.commandId,
        openedUiKind: selection.openedUiKind,
        visible: selection.visible,
        selectedSlot: selection.selectedSlot,
        selectedFilter: selection.selectedFilter,
        title: selection.title,
        mode: selection.mode,
        codeLength: selection.codeLength,
        nativeResultJson: native.nativeResultJson,
        error: native.nativeResult?.error || null
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

}
