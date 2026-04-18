import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { BridgeCommandQueue } from "../bridge/commandQueue.js";
import { BridgeEventStore, type CommandEventSnapshot } from "../bridge/eventStore.js";
import { clampedIntSchema } from "./schemaUtils.js";

const jsonRecordSchema = z.record(z.string(), z.any());

const industryBatchMutationOutputSchema = {
  found: z.boolean(),
  commandId: z.string().nullable(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  summary: z.union([jsonRecordSchema, z.null()]),
  results: z.array(jsonRecordSchema),
  parseError: z.string().nullable()
};

const industryTargetEntrySchema = z.object({
  id: z.number().int().nonnegative().optional().describe("Construct-local industry element ID"),
  name: z.string().trim().min(1).optional().describe("Exact industry custom name or exact type name")
}).refine(
  (entry) => (typeof entry.id === "number") !== (typeof entry.name === "string"),
  "Provide exactly one of `id` or `name`."
);

const recipeSelectorEntrySchema = z.object({
  recipeId: z.number().int().positive().optional().describe("Explicit recipe ID. For transfer units this is the product item type ID."),
  itemTypeId: z.number().int().positive().optional().describe("Explicit product item type ID"),
  itemName: z.string().trim().min(1).optional().describe("Exact product item definition name"),
  recipeKey: z.string().trim().min(1).optional().describe("Exact embedded recipe key, for example `AlFeProduct`")
}).refine(
  (entry) => [entry.recipeId, entry.itemTypeId, entry.itemName, entry.recipeKey].filter((value) => value !== undefined).length >= 1,
  "Provide at least one recipe selector."
);

const industryResolveRecipeEntrySchema = industryTargetEntrySchema.extend(recipeSelectorEntrySchema.shape);
const industrySetRecipeEntrySchema = industryTargetEntrySchema.extend(recipeSelectorEntrySchema.shape);

const industryStopEntrySchema = industryTargetEntrySchema;

const industryStartEntrySchema = industryTargetEntrySchema.extend({
  mode: z.enum(["run", "make", "move", "maintain"]).describe("Start mode. `move` is the transfer-unit alias."),
  amount: z.number().int().min(0).optional().describe("Requested amount for `make`, `move`, or `maintain`")
});

const industryConfigureBatchEntrySchema = z.object({
  id: z.number().int().nonnegative().describe("Construct-local industry element ID"),
  recipeId: z.number().int().positive().optional().describe("Explicit recipe ID. For transfer units this is the product item type ID."),
  itemTypeId: z.number().int().positive().optional().describe("Explicit product item type ID"),
  itemName: z.string().trim().min(1).optional().describe("Exact product item definition name"),
  recipeKey: z.string().trim().min(1).optional().describe("Exact embedded recipe key, for example `AlFeProduct`"),
  mode: z.enum(["run", "make", "move", "maintain"]).describe("Requested final mode for this device."),
  amount: z.number().int().min(0).optional().describe("Requested amount for `make`, `move`, or `maintain`.")
}).refine(
  (entry) => [entry.recipeId, entry.itemTypeId, entry.itemName, entry.recipeKey].filter((value) => value !== undefined).length >= 1,
  "Provide at least one recipe selector."
);

const industryDescribeEntrySchema = industryTargetEntrySchema;

type IndustryTargetEntry = z.infer<typeof industryTargetEntrySchema>;
type IndustryRecipeSelectorEntry = z.infer<typeof recipeSelectorEntrySchema>;
type IndustryResolveRecipeEntry = z.infer<typeof industryResolveRecipeEntrySchema>;
type IndustrySetRecipeEntry = z.infer<typeof industrySetRecipeEntrySchema>;
type IndustryStopEntry = z.infer<typeof industryStopEntrySchema>;
type IndustryStartEntry = z.infer<typeof industryStartEntrySchema>;
type IndustryConfigureBatchEntry = z.infer<typeof industryConfigureBatchEntrySchema>;
type IndustryDescribeEntry = z.infer<typeof industryDescribeEntrySchema>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map((entry) => asRecord(entry)).filter((entry): entry is Record<string, unknown> => entry !== null)
    : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function firstRecord(source: Record<string, unknown> | null, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = asRecord(source?.[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function firstString(source: Record<string, unknown> | null, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(source?.[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function firstInteger(source: Record<string, unknown> | null, keys: string[]): number | null {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.trunc(value);
    }
  }

  return null;
}

function compactObject(entries: Array<[string, unknown]>): Record<string, unknown> | null {
  const compact: Record<string, unknown> = {};

  for (const [key, value] of entries) {
    if (value !== null && value !== undefined) {
      compact[key] = value;
    }
  }

  return Object.keys(compact).length > 0 ? compact : null;
}

function compactTarget(target: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["id", firstInteger(target, ["localId", "id"])],
    ["name", firstString(target, ["name", "customName", "displayName"])],
    ["typeName", firstString(target, ["typeName", "type"])],
    ["category", firstString(target, ["category"])]
  ]);
}

function compactRecipe(recipe: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["recipeId", firstInteger(recipe, ["recipeId"])],
    ["nextRecipeId", firstInteger(recipe, ["nextRecipeId"])],
    ["recipeKey", firstString(recipe, ["recipeKey"])],
    ["itemTypeId", firstInteger(recipe, ["itemTypeId"])],
    ["itemName", firstString(recipe, ["itemName", "productName", "name", "displayName"])]
  ]);
}

function compactState(state: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["state", firstString(state, ["state", "status"])],
    ["mode", firstString(state, ["mode"])],
    ["batchesRequested", firstInteger(state, ["batchesRequested"])],
    ["maintainQuantity", firstInteger(state, ["maintainQuantity", "maintainAmount", "amount"])],
    ["remainingTimeS", firstInteger(state, ["remainingTimeS", "remainingTimeSeconds"])],
    ["remainingTimeMs", firstInteger(state, ["remainingTimeMs", "remainingMs"])]
  ]);
}

function compactStart(start: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["mode", firstString(start, ["mode"])],
    ["amount", firstInteger(start, ["amount", "requestedAmount", "batchesRequested", "maintainQuantity"])]
  ]);
}

function compactResult(result: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["status", firstString(result, ["status", "state"])],
    ["action", firstString(result, ["action"])],
    ["message", firstString(result, ["message", "reason", "error"])],
    ["amount", firstInteger(result, ["amount", "requestedAmount", "appliedAmount", "maintainQuantity"])],
    ["recipeId", firstInteger(result, ["recipeId"])],
    ["nextRecipeId", firstInteger(result, ["nextRecipeId"])]
  ]);
}

function compactSummary(summary: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["requestedCount", firstInteger(summary, ["requestedCount"])],
    ["foundCount", firstInteger(summary, ["foundCount"])],
    ["successfulCount", firstInteger(summary, ["successfulCount"])],
    ["failedCount", firstInteger(summary, ["failedCount"])],
    ["method", firstString(summary, ["method"])],
    ["constructId", firstInteger(summary, ["constructId"])]
  ]);
}

function compactBatchResult(result: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(compactObject([
      ["index", firstInteger(result, ["index"])],
      ["found", result.found === true],
      ["success", result.success === true],
      ["error", firstString(result, ["error"])],
      ["method", firstString(result, ["method"])],
      ["parseError", firstString(result, ["parseError"])]
    ]) ?? {}),
    ...(compactObject([
      ["entry", asRecord(result.entry)],
      ["target", compactTarget(firstRecord(result, ["target"]))],
      ["recipe", compactRecipe(firstRecord(result, ["recipe"]))],
      ["state", compactState(firstRecord(result, ["state"]))],
      ["start", compactStart(firstRecord(result, ["start"]))],
      ["result", compactResult(firstRecord(result, ["result"]))]
    ]) ?? {})
  };
}

function renderTextPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

function buildIndustryTargetSelector(args: {
  constructId?: number;
  entry: IndustryTargetEntry;
}): Record<string, unknown> {
  return {
    ...(typeof args.constructId === "number" ? { constructId: args.constructId } : {}),
    ...(typeof args.entry.id === "number" ? { localId: args.entry.id } : {}),
    ...(typeof args.entry.name === "string" && args.entry.name.trim().length > 0 ? { name: args.entry.name.trim() } : {})
  };
}

function buildRecipeSelector(args: IndustryRecipeSelectorEntry): Record<string, unknown> {
  if (typeof args.recipeId === "number") {
    return { recipeId: args.recipeId };
  }

  if (typeof args.itemTypeId === "number") {
    return { itemTypeId: args.itemTypeId };
  }

  if (typeof args.itemName === "string" && args.itemName.trim().length > 0) {
    return { itemName: args.itemName.trim() };
  }

  if (typeof args.recipeKey === "string" && args.recipeKey.trim().length > 0) {
    return { recipeKey: args.recipeKey.trim() };
  }

  return {};
}

function parseToolboxOpsPayload(payloadJson: string | null): {
  parsed: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
  method: string | null;
  target: Record<string, unknown> | null;
  recipe: Record<string, unknown> | null;
  state: Record<string, unknown> | null;
  start: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  parseError: string | null;
} {
  if (typeof payloadJson !== "string" || payloadJson.trim().length === 0) {
    return {
      parsed: null,
      success: false,
      error: null,
      method: null,
      target: null,
      recipe: null,
      state: null,
      start: null,
      result: null,
      parseError: null
    };
  }

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    return {
      parsed,
      success: parsed.success === true,
      error: asString(parsed.error),
      method: asString(parsed.method),
      target: asRecord(parsed.target),
      recipe: asRecord(parsed.recipe),
      state: asRecord(parsed.state),
      start: asRecord(parsed.start),
      result: asRecord(parsed.result),
      parseError: null
    };
  } catch (error: unknown) {
    return {
      parsed: null,
      success: false,
      error: null,
      method: null,
      target: null,
      recipe: null,
      state: null,
      start: null,
      result: null,
      parseError: error instanceof Error ? error.message : String(error)
    };
  }
}

function parseIndustryBatchPayload(payloadJson: string | null): {
  parsed: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
  method: string | null;
  summary: Record<string, unknown> | null;
  results: Record<string, unknown>[];
  parseError: string | null;
} {
  const parsed = parseToolboxOpsPayload(payloadJson);
  return {
    parsed: parsed.parsed,
    success: parsed.success,
    error: parsed.error,
    method: parsed.method,
    summary: asRecord(parsed.parsed?.summary),
    results: asRecordArray(parsed.parsed?.results),
    parseError: parsed.parseError
  };
}

async function enqueueToolboxOpsCommand(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  playerId: number,
  method: string,
  probeArgs: unknown[],
  timeoutMs: number
): Promise<CommandEventSnapshot> {
  const result = await commandQueue.enqueue({
    playerId,
    targetKind: "toolbox_ops",
    action: "probe_call",
    probeMethod: method,
    probeArgs
  });

  await eventStore.appendSystemEvent({
    eventId: `evt-${result.command.commandId}`,
    createdAtUtc: new Date().toISOString(),
    playerId,
    source: {
      kind: "toolbox_ops",
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

  return eventStore.waitForCommandEvent(result.command.commandId, "toolbox_ops_result", timeoutMs);
}

type BatchExecutionOptions<TEntry> = {
  playerId: number;
  constructId?: number;
  timeoutMs: number;
  entries: TEntry[];
  method: string;
  buildProbeArgs: (entry: TEntry, constructId?: number) => unknown[];
};

async function executeIndustryBatch<TEntry extends Record<string, unknown>>(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  options: BatchExecutionOptions<TEntry>
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
}> {
  const results: Record<string, unknown>[] = [];
  let successCount = 0;
  let foundCount = 0;
  let firstCommandId: string | null = null;
  let firstCreatedAtUtc: string | null = null;

  for (let index = 0; index < options.entries.length; index += 1) {
    const entry = options.entries[index];
    const eventResult = await enqueueToolboxOpsCommand(
      commandQueue,
      eventStore,
      options.playerId,
      options.method,
      options.buildProbeArgs(entry, options.constructId),
      options.timeoutMs
    );
    const parsed = parseToolboxOpsPayload(eventResult.payloadJson);

    if (firstCommandId === null) {
      firstCommandId = eventResult.commandId;
      firstCreatedAtUtc = eventResult.createdAtUtc;
    }

    if (eventResult.found) {
      foundCount += 1;
    }

    if (parsed.success) {
      successCount += 1;
    }

    results.push({
      index,
      entry,
      found: eventResult.found,
      success: parsed.success,
      error: parsed.error,
      method: parsed.method,
      target: parsed.target,
      recipe: parsed.recipe,
      state: parsed.state,
      start: parsed.start,
      result: parsed.result,
      parseError: parsed.parseError
    });
  }

  const summary = compactSummary({
    requestedCount: options.entries.length,
    foundCount,
    successfulCount: successCount,
    failedCount: options.entries.length - successCount,
    method: options.method,
    ...(typeof options.constructId === "number" ? { constructId: options.constructId } : {})
  });

  const compactResults = results.map((result) => compactBatchResult(result));

  const payload = {
    summary,
    results: compactResults
  };

  return {
    content: [
      {
        type: "text",
        text: renderTextPayload(payload)
      }
    ],
    structuredContent: {
      found: foundCount > 0,
      commandId: firstCommandId,
      createdAtUtc: firstCreatedAtUtc,
      success: successCount === options.entries.length,
      error: successCount === options.entries.length ? null : "one_or_more_entries_failed",
      method: options.method,
      summary,
      results: compactResults,
      parseError: null
    }
  };
}

export function registerIndustryBackendTools(server: McpServer, commandQueue: BridgeCommandQueue, eventStore: BridgeEventStore): void {
  server.registerTool(
    "du_industry_describe_batch",
    {
      title: "Describe Industry Batch",
      description: "Reads runtime state for one or more industry elements through one backend batch call.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        entries: z.array(industryDescribeEntrySchema).min(1).describe("Batch entries. Use a single entry when you only need one target."),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: industryBatchMutationOutputSchema
    },
    async ({ playerId, constructId, entries, timeoutMs }) => {
      const batchOptions: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {})
      };
      const batchEntries = entries.map((entry) => ({
        ...(typeof entry.id === "number" ? { localId: entry.id } : {}),
        ...(typeof entry.name === "string" && entry.name.trim().length > 0 ? { name: entry.name.trim() } : {})
      }));
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "describe_industry_batch", [batchOptions, batchEntries], timeoutMs);
      const parsed = parseIndustryBatchPayload(eventResult.payloadJson);
      const summary = compactSummary(parsed.summary);
      const results = parsed.results.map((result) => compactBatchResult(result));
      const payload = {
        summary,
        results
      };
      return {
        content: [
          {
            type: "text",
            text: eventResult.found ? renderTextPayload(payload) : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent: {
          found: eventResult.found,
          commandId: eventResult.commandId,
          createdAtUtc: eventResult.createdAtUtc,
          success: parsed.success,
          error: parsed.error,
          method: parsed.method,
          summary,
          results,
          parseError: parsed.parseError
        }
      };
    }
  );

  server.registerTool(
    "du_industry_configure_batch",
    {
      title: "Configure Industry Batch",
      description: "Configures a same-kind batch of industry devices through one backend call, with per-device recipe selector, mode, and amount plus state-aware stop/set/start sequencing.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        stopMode: z.enum(["soft", "hard"]).default("soft").describe("Stop mode to use when a device must be stopped before recipe assignment."),
        parallelism: z.number().int().min(1).max(10).default(1).describe("How many devices the mod may configure concurrently. Values above 10 are rejected."),
        pollIntervalMs: z.number().int().min(50).max(1000).default(150).describe("Status polling interval between backend steps."),
        stateTimeoutMs: z.number().int().min(500).max(30000).default(5000).describe("Maximum wait for each backend state transition."),
        entries: z.array(industryConfigureBatchEntrySchema).min(1).describe("Per-device configuration entries. All devices must be the same element type."),
        timeoutMs: clampedIntSchema(250, 60000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: industryBatchMutationOutputSchema
    },
    async ({ playerId, constructId, stopMode, parallelism, pollIntervalMs, stateTimeoutMs, entries, timeoutMs }) => {
      const batchOptions: Record<string, unknown> = {
        stopMode,
        parallelism,
        pollIntervalMs,
        stateTimeoutMs,
        ...(typeof constructId === "number" ? { constructId } : {})
      };
      const batchEntries = entries.map((entry) => ({
        localId: entry.id,
        ...buildRecipeSelector(entry),
        mode: entry.mode,
        ...(typeof entry.amount === "number" ? { amount: entry.amount } : {})
      }));
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "industry_configure_batch", [batchOptions, batchEntries], timeoutMs);
      const parsed = parseIndustryBatchPayload(eventResult.payloadJson);
      const summary = compactSummary(parsed.summary);
      const results = parsed.results.map((result) => compactBatchResult(result));
      const payload = {
        summary,
        results
      };
      return {
        content: [
          {
            type: "text",
            text: eventResult.found ? renderTextPayload(payload) : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent: {
          found: eventResult.found,
          commandId: eventResult.commandId,
          createdAtUtc: eventResult.createdAtUtc,
          success: parsed.success,
          error: parsed.error,
          method: parsed.method,
          summary,
          results,
          parseError: parsed.parseError
        }
      };
    }
  );

  server.registerTool(
    "du_industry_resolve_recipes",
    {
      title: "Resolve Industry Recipes",
      description: "Resolves recipes deterministically for one or more target industry elements from explicit recipe IDs or exact product item selectors.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        entries: z.array(industryResolveRecipeEntrySchema).min(1).describe("Batch entries. Use a single entry when you only need one target."),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for each toolbox_ops_result event")
      },
      outputSchema: industryBatchMutationOutputSchema
    },
    async ({ playerId, constructId, entries, timeoutMs }) => executeIndustryBatch(commandQueue, eventStore, {
      playerId,
      constructId,
      timeoutMs,
      entries,
      method: "resolve_industry_recipe",
      buildProbeArgs: (entry: IndustryResolveRecipeEntry, currentConstructId?: number) => {
        const targetSelector = buildIndustryTargetSelector({ constructId: currentConstructId, entry });
        const recipeSelector = buildRecipeSelector(entry);
        return [targetSelector, recipeSelector];
      }
    })
  );

  server.registerTool(
    "du_industry_stop_batch",
    {
      title: "Stop Industry Batch",
      description: "Stops one or more industry elements directly through the server-side grain path.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        stopMode: z.enum(["soft", "hard"]).default("soft").describe("Stop mode. `soft` finishes the current batch; `hard` stops immediately."),
        entries: z.array(industryStopEntrySchema).min(1).describe("Batch entries. Use a single entry when you only need one target."),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for each toolbox_ops_result event")
      },
      outputSchema: industryBatchMutationOutputSchema
    },
    async ({ playerId, constructId, stopMode, entries, timeoutMs }) => executeIndustryBatch(commandQueue, eventStore, {
      playerId,
      constructId,
      timeoutMs,
      entries,
      method: "industry_stop",
      buildProbeArgs: (entry: IndustryStopEntry, currentConstructId?: number) => {
        const targetSelector = buildIndustryTargetSelector({ constructId: currentConstructId, entry });
        return [targetSelector, stopMode];
      }
    })
  );

  server.registerTool(
    "du_industry_set_recipes",
    {
      title: "Set Industry Recipes",
      description: "Sets recipes directly on one or more stopped industry elements through the server-side grain path.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        entries: z.array(industrySetRecipeEntrySchema).min(1).describe("Batch entries. Use a single entry when you only need one target."),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for each toolbox_ops_result event")
      },
      outputSchema: industryBatchMutationOutputSchema
    },
    async ({ playerId, constructId, entries, timeoutMs }) => executeIndustryBatch(commandQueue, eventStore, {
      playerId,
      constructId,
      timeoutMs,
      entries,
      method: "industry_set_recipe",
      buildProbeArgs: (entry: IndustrySetRecipeEntry, currentConstructId?: number) => {
        const targetSelector = buildIndustryTargetSelector({ constructId: currentConstructId, entry });
        const recipeSelector = buildRecipeSelector(entry);
        return [targetSelector, recipeSelector];
      }
    })
  );

  server.registerTool(
    "du_industry_start_batch",
    {
      title: "Start Industry Batch",
      description: "Starts one or more industry elements directly through the server-side grain path with concrete modes and amounts.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        entries: z.array(industryStartEntrySchema).min(1).describe("Batch entries. Use a single entry when you only need one target."),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for each toolbox_ops_result event")
      },
      outputSchema: industryBatchMutationOutputSchema
    },
    async ({ playerId, constructId, entries, timeoutMs }) => executeIndustryBatch(commandQueue, eventStore, {
      playerId,
      constructId,
      timeoutMs,
      entries,
      method: "industry_start",
      buildProbeArgs: (entry: IndustryStartEntry, currentConstructId?: number) => {
        const targetSelector = buildIndustryTargetSelector({ constructId: currentConstructId, entry });
        return [targetSelector, entry.mode, entry.amount ?? ""];
      }
    })
  );
}
