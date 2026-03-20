import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { BridgeCommandQueue } from "../bridge/commandQueue.js";
import { BridgeEventStore, type ProbeResultSnapshot } from "../bridge/eventStore.js";
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

type LuaProbeMethod =
  | "describe"
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
  code?: string | undefined;
  addFilterName?: string | undefined;
  outerHtmlSelector?: string | undefined;
  rawEvalBody?: string | undefined;
};

function buildLuaProbeArgs(method: LuaProbeMethod, fields: LuaProbeCallFields): string[] {
  switch (method) {
    case "describe":
    case "apply":
      return [];
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
        method: z
          .enum([
            "describe",
            "select_slot",
            "select_filter",
            "set_code",
            "apply",
            "add_filter",
            "outer_html",
            "raw_eval"
          ])
          .describe("Lua probe method to invoke"),
        slotName: z.string().optional().describe("Slot name for select_slot"),
        filterEvent: z.string().optional().describe("Filter event name for select_filter"),
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
    async ({ playerId, method, slotName, filterEvent, code, addFilterName, outerHtmlSelector, rawEvalBody, timeoutMs }) => {
      const probeArgs = buildLuaProbeArgs(method, {
        slotName,
        filterEvent,
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
            "set_code",
            "apply",
            "add_filter",
            "outer_html",
            "raw_eval"
          ])
          .describe("Probe method name"),
        slotName: z.string().optional(),
        filterEvent: z.string().optional(),
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
      code,
      addFilterName,
      outerHtmlSelector,
      rawEvalBody,
      timeoutMs
    }) => {
      const probeArgs = buildLuaProbeArgs(method, {
        slotName,
        filterEvent,
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
