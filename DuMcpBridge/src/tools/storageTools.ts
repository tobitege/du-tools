import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { BridgeCommandQueue } from "../bridge/commandQueue.js";
import { BridgeEventStore, type CommandEventSnapshot } from "../bridge/eventStore.js";
import { clampedIntSchema } from "./schemaUtils.js";

const jsonRecordSchema = z.record(z.string(), z.any());
const storageKindSchema = z.enum([
  "container",
  "container_hub",
  "player_inventory",
  "player_inventory_raw",
  "player_primary_container"
]);

const storageResolveOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  storage: z.union([jsonRecordSchema, z.null()]),
  candidates: z.array(jsonRecordSchema),
  parseError: z.string().nullable()
};

const storageDescribeOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  storage: z.union([jsonRecordSchema, z.null()]),
  snapshot: z.union([jsonRecordSchema, z.null()]),
  summary: z.union([jsonRecordSchema, z.null()]),
  results: z.array(jsonRecordSchema),
  candidates: z.array(jsonRecordSchema),
  parseError: z.string().nullable()
};

const storageMutationOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  storage: z.union([jsonRecordSchema, z.null()]),
  from: z.union([jsonRecordSchema, z.null()]),
  to: z.union([jsonRecordSchema, z.null()]),
  item: z.union([jsonRecordSchema, z.null()]),
  result: z.union([jsonRecordSchema, z.null()]),
  slot: z.union([jsonRecordSchema, z.null()]),
  sourceSlot: z.union([jsonRecordSchema, z.null()]),
  appliedToSlot: z.number().int().nullable(),
  rawQuantity: z.number().nullable(),
  requestedQuantity: z.number().nullable(),
  candidates: z.array(jsonRecordSchema),
  parseError: z.string().nullable()
};

const storageBatchMutationOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  storage: z.union([jsonRecordSchema, z.null()]),
  summary: z.union([jsonRecordSchema, z.null()]),
  results: z.array(jsonRecordSchema),
  parseError: z.string().nullable()
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null)
    : [];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asInteger(value: unknown): number | null {
  const numberValue = asNumber(value);
  return numberValue !== null ? Math.trunc(numberValue) : null;
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

function firstRecordArray(source: Record<string, unknown> | null, keys: string[]): Record<string, unknown>[] {
  for (const key of keys) {
    const value = asRecordArray(source?.[key]);
    if (value.length > 0) {
      return value;
    }
  }

  return [];
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
    const value = asInteger(source?.[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function firstNumber(source: Record<string, unknown> | null, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(source?.[key]);
    if (value !== null) {
      return value;
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

function compactStorageRef(source: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["storageKind", firstString(source, ["storageKind"])],
    ["constructId", firstInteger(source, ["constructId"])],
    ["id", firstInteger(source, ["localId", "id"])],
    ["name", firstString(source, ["name", "displayName"])],
    ["category", firstString(source, ["category"])]
  ]);
}

function compactItemRef(source: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["itemTypeId", firstInteger(source, ["itemTypeId"])],
    ["itemName", firstString(source, ["itemName", "name", "displayName"])],
    ["quantity", firstInteger(source, ["quantity", "count"])],
    ["volumeL", firstNumber(source, ["volumeL", "totalVolumeL", "stackVolumeL"])]
  ]);
}

function compactSlotRef(source: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["slot", firstInteger(source, ["slot", "slotIndex"])],
    ["itemTypeId", firstInteger(source, ["itemTypeId"])],
    ["itemName", firstString(source, ["itemName", "name", "displayName"])],
    ["quantity", firstInteger(source, ["quantity", "count"])],
    ["volumeL", firstNumber(source, ["volumeL", "totalVolumeL", "stackVolumeL"])]
  ]);
}

function compactStorageSnapshot(source: Record<string, unknown> | null): Record<string, unknown> | null {
  const items = firstRecordArray(source, ["items", "slots"])
    .map((entry) => compactSlotRef(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);

  return compactObject([
    ["occupiedSlotCount", firstInteger(source, ["occupiedSlotCount", "itemCount", "occupiedCount"])],
    ["slotCount", firstInteger(source, ["slotCount"])],
    ["usedVolumeL", firstNumber(source, ["usedVolumeL", "usedVolume"])],
    ["freeVolumeL", firstNumber(source, ["freeVolumeL", "freeVolume"])],
    ["maxVolumeL", firstNumber(source, ["maxVolumeL", "maxVolume", "capacityL", "capacity"])],
    ["items", items.length > 0 ? items : null]
  ]);
}

function compactMutationResult(source: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["status", firstString(source, ["status", "state"])],
    ["action", firstString(source, ["action"])],
    ["message", firstString(source, ["message", "reason", "error"])],
    ["quantity", firstInteger(source, ["quantity", "movedQuantity", "appliedQuantity"])],
    ["slot", firstInteger(source, ["slot", "slotIndex", "appliedToSlot"])]
  ]);
}

function compactBatchResult(source: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(compactObject([
      ["storage", compactStorageRef(firstRecord(source, ["storage"]))],
      ["item", compactItemRef(firstRecord(source, ["item"]))],
      ["result", compactMutationResult(firstRecord(source, ["result"]))],
      ["slot", compactSlotRef(firstRecord(source, ["slot"]))],
      ["sourceSlot", compactSlotRef(firstRecord(source, ["sourceSlot"]))]
    ]) ?? {}),
    ...(compactObject([
      ["appliedToSlot", firstInteger(source, ["appliedToSlot"])],
      ["requestedQuantity", firstNumber(source, ["requestedQuantity"])],
      ["rawQuantity", firstNumber(source, ["rawQuantity"])],
      ["error", firstString(source, ["error"])]
    ]) ?? {})
  };
}

function compactDescribeBatchResult(source: Record<string, unknown>): Record<string, unknown> {
  const storage = compactStorageRef(firstRecord(source, ["storage"]));
  const snapshot = compactStorageSnapshot(firstRecord(source, ["snapshot"]));
  const candidates = compactCandidates(asRecordArray(source.candidates), true);
  return {
    ...(compactObject([
      ["storage", storage],
      ["snapshot", snapshot],
      ["error", firstString(source, ["error"])],
      ["index", firstInteger(source, ["index"])]
    ]) ?? {}),
    ...(candidates.length > 0 ? { candidates } : {}),
    success: source.success === true
  };
}

function compactSummary(source: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["requestedCount", firstInteger(source, ["requestedCount"])],
    ["successfulCount", firstInteger(source, ["successfulCount"])],
    ["failedCount", firstInteger(source, ["failedCount"])],
    ["totalQuantity", firstNumber(source, ["totalQuantity"])],
    ["itemLimit", firstInteger(source, ["itemLimit"])],
    ["storageKind", firstString(source, ["storageKind"])],
    ["storage", compactStorageRef(firstRecord(source, ["storage"]))]
  ]);
}

function compactCandidates(candidates: Record<string, unknown>[], include: boolean): Record<string, unknown>[] {
  if (!include) {
    return [];
  }

  return candidates
    .map((entry) => compactStorageRef(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);
}

function renderTextPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

function parseToolboxOpsPayload(payloadJson: string | null): {
  parsed: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
  method: string | null;
  storage: Record<string, unknown> | null;
  from: Record<string, unknown> | null;
  to: Record<string, unknown> | null;
  item: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  slot: Record<string, unknown> | null;
  sourceSlot: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  results: Record<string, unknown>[];
  candidates: Record<string, unknown>[];
  parseError: string | null;
} {
  if (typeof payloadJson !== "string" || payloadJson.trim().length === 0) {
    return {
      parsed: null,
      success: false,
      error: null,
      method: null,
      storage: null,
      from: null,
      to: null,
      item: null,
      result: null,
      slot: null,
      sourceSlot: null,
      summary: null,
      results: [],
      candidates: [],
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
      storage: asRecord(parsed.storage),
      from: asRecord(parsed.from),
      to: asRecord(parsed.to),
      item: asRecord(parsed.item),
      result: asRecord(parsed.result),
      slot: asRecord(parsed.slot),
      sourceSlot: asRecord(parsed.sourceSlot),
      summary: asRecord(parsed.summary),
      results: asRecordArray(parsed.results),
      candidates: asRecordArray(parsed.candidates),
      parseError: null
    };
  } catch (error: unknown) {
    return {
      parsed: null,
      success: false,
      error: null,
      method: null,
      storage: null,
      from: null,
      to: null,
      item: null,
      result: null,
      slot: null,
      sourceSlot: null,
      summary: null,
      results: [],
      candidates: [],
      parseError: error instanceof Error ? error.message : String(error)
    };
  }
}

function buildStorageSelector(args: {
  storageKind: z.infer<typeof storageKindSchema>;
  constructId?: number;
  id?: number;
  name?: string;
  category?: string;
  targetPlayerId?: number;
}): Record<string, unknown> {
  return {
    storageKind: args.storageKind,
    ...(typeof args.constructId === "number" ? { constructId: args.constructId } : {}),
    ...(typeof args.id === "number" ? { localId: args.id } : {}),
    ...(typeof args.name === "string" && args.name.trim().length > 0 ? { name: args.name.trim() } : {}),
    ...(typeof args.category === "string" && args.category.trim().length > 0 ? { category: args.category.trim() } : {}),
    ...(typeof args.targetPlayerId === "number" ? { targetPlayerId: args.targetPlayerId } : {})
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

export function registerStorageTools(server: McpServer, commandQueue: BridgeCommandQueue, eventStore: BridgeEventStore): void {
  const storageDescribeEntrySchema = z.object({
    storageKind: storageKindSchema.optional().describe("Storage target kind override for this entry"),
    constructId: z.number().int().nonnegative().optional().describe("Optional construct ID for this entry"),
    id: z.number().int().nonnegative().optional().describe("Construct-local element ID inside the chosen construct"),
    name: z.string().trim().min(1).optional().describe("Exact element custom name or exact type name inside the chosen construct"),
    category: z.string().trim().min(1).optional().describe("Optional category filter, for example container or container_hub"),
    targetPlayerId: z.number().int().nonnegative().optional().describe("Optional target player ID for player inventory selectors")
  });

  server.registerTool(
    "du_storage_resolve",
    {
      title: "Resolve Storage",
      description: "Resolves a storage target deterministically by explicit player target, construct ID, construct-local ID, or exact name.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        storageKind: storageKindSchema.default("container").describe("Storage target kind"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID for element-backed storages. When omitted, the player's current construct is used."),
        id: z.number().int().nonnegative().optional().describe("Construct-local element ID inside the chosen construct"),
        name: z.string().trim().min(1).optional().describe("Exact element custom name or exact type name inside the chosen construct"),
        category: z.string().trim().min(1).optional().describe("Optional category filter, for example container or container_hub"),
        targetPlayerId: z.number().int().nonnegative().optional().describe("Optional target player ID for player inventory selectors"),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: storageResolveOutputSchema
    },
    async ({ playerId, storageKind, constructId, id, name, category, targetPlayerId, timeoutMs }) => {
      const selector = buildStorageSelector({
        storageKind,
        constructId,
        id,
        name,
        category,
        targetPlayerId
      });
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "resolve_storage", [selector], timeoutMs);
      const parsed = parseToolboxOpsPayload(eventResult.payloadJson);
      const storage = compactStorageRef(parsed.storage);
      const candidates = compactCandidates(parsed.candidates, !parsed.success || storage === null);
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        storage,
        candidates,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? renderTextPayload(structuredContent)
              : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_storage_describe",
    {
      title: "Describe Storage",
      description: "Reads a resolved storage target and returns occupied slots, item stacks, and capacity state.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        storageKind: storageKindSchema.default("container").describe("Storage target kind"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID for element-backed storages. When omitted, the player's current construct is used."),
        id: z.number().int().nonnegative().optional().describe("Construct-local element ID inside the chosen construct"),
        name: z.string().trim().min(1).optional().describe("Exact element custom name or exact type name inside the chosen construct"),
        category: z.string().trim().min(1).optional().describe("Optional category filter, for example container or container_hub"),
        targetPlayerId: z.number().int().nonnegative().optional().describe("Optional target player ID for player inventory selectors"),
        entries: z.array(storageDescribeEntrySchema).min(1).optional().describe("Optional batch of storage targets. Top-level storage fields act as defaults for entries that omit them."),
        itemLimit: z.number().int().min(1).max(500).default(100).describe("Maximum number of occupied slots to return"),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: storageDescribeOutputSchema
    },
    async ({ playerId, storageKind, constructId, id, name, category, targetPlayerId, entries, itemLimit, timeoutMs }) => {
      const selectorBase = buildStorageSelector({
        storageKind,
        constructId,
        id,
        name,
        category,
        targetPlayerId
      });

      const selector = Array.isArray(entries) && entries.length > 0
        ? {
            ...selectorBase,
            entries: entries.map((entry) => buildStorageSelector({
              storageKind: entry.storageKind ?? storageKind,
              constructId: entry.constructId ?? constructId,
              id: entry.id,
              name: entry.name,
              category: entry.category ?? category,
              targetPlayerId: entry.targetPlayerId ?? targetPlayerId
            }))
          }
        : selectorBase;

      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "describe_storage", [selector, itemLimit], timeoutMs);
      const parsed = parseToolboxOpsPayload(eventResult.payloadJson);
      const storage = compactStorageRef(parsed.storage);
      const snapshot = compactStorageSnapshot(asRecord(parsed.parsed?.snapshot));
      const candidates = compactCandidates(parsed.candidates, !parsed.success || storage === null);
      const summary = compactSummary(parsed.summary);
      const results = parsed.results.map((entry) => compactDescribeBatchResult(entry));
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        storage,
        snapshot,
        summary,
        results,
        candidates,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? renderTextPayload(structuredContent)
              : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_storage_spawn",
    {
      title: "Spawn Item Into Storage",
      description: "Gives a specific item type by ID or exact name into the chosen storage target.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        storageKind: storageKindSchema.default("container").describe("Storage target kind"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID for element-backed storages. When omitted, the player's current construct is used."),
        id: z.number().int().nonnegative().optional().describe("Construct-local element ID inside the chosen construct"),
        name: z.string().trim().min(1).optional().describe("Exact element custom name or exact type name inside the chosen construct"),
        category: z.string().trim().min(1).optional().describe("Optional category filter, for example container or container_hub"),
        targetPlayerId: z.number().int().nonnegative().optional().describe("Optional target player ID for player inventory selectors"),
        itemTypeId: z.number().int().positive().optional().describe("Explicit item type ID"),
        itemName: z.string().trim().min(1).optional().describe("Exact item definition name"),
        quantity: z.number().int().positive().describe("Gameplay quantity to give"),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: storageMutationOutputSchema
    },
    async ({ playerId, storageKind, constructId, id, name, category, targetPlayerId, itemTypeId, itemName, quantity, timeoutMs }) => {
      const selector = buildStorageSelector({
        storageKind,
        constructId,
        id,
        name,
        category,
        targetPlayerId
      });
      const itemSelector = {
        ...(typeof itemTypeId === "number" ? { itemTypeId } : {}),
        ...(typeof itemName === "string" && itemName.trim().length > 0 ? { itemName: itemName.trim() } : {})
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "spawn_item", [selector, itemSelector, quantity], timeoutMs);
      const parsed = parseToolboxOpsPayload(eventResult.payloadJson);
      const storage = compactStorageRef(parsed.storage);
      const candidates = compactCandidates(parsed.candidates, !parsed.success || storage === null);
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        storage,
        from: compactStorageRef(parsed.from),
        to: compactStorageRef(parsed.to),
        item: compactItemRef(parsed.item),
        result: compactMutationResult(parsed.result),
        slot: compactSlotRef(parsed.slot),
        sourceSlot: compactSlotRef(parsed.sourceSlot),
        appliedToSlot: asInteger(parsed.parsed?.appliedToSlot),
        rawQuantity: asNumber(parsed.parsed?.rawQuantity),
        requestedQuantity: asNumber(parsed.parsed?.requestedQuantity),
        candidates,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? renderTextPayload(structuredContent)
              : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_storage_spawn_batch",
    {
      title: "Spawn Items Into Storage Batch",
      description: "Gives multiple specific item types by ID or exact name into the chosen storage target through one backend call.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        storageKind: storageKindSchema.default("container").describe("Storage target kind"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID for element-backed storages. When omitted, the player's current construct is used."),
        id: z.number().int().nonnegative().optional().describe("Construct-local element ID inside the chosen construct"),
        name: z.string().trim().min(1).optional().describe("Exact element custom name or exact type name inside the chosen construct"),
        category: z.string().trim().min(1).optional().describe("Optional category filter, for example container or container_hub"),
        targetPlayerId: z.number().int().nonnegative().optional().describe("Optional target player ID for player inventory selectors"),
        entries: z.array(z.object({
          itemTypeId: z.number().int().positive().optional().describe("Explicit item type ID"),
          itemName: z.string().trim().min(1).optional().describe("Exact item definition name"),
          quantity: z.number().int().positive().describe("Gameplay quantity to give")
        })).min(1).describe("Batch entries for one resolved storage target"),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: storageBatchMutationOutputSchema
    },
    async ({ playerId, storageKind, constructId, id, name, category, targetPlayerId, entries, timeoutMs }) => {
      const selector = buildStorageSelector({
        storageKind,
        constructId,
        id,
        name,
        category,
        targetPlayerId
      });
      const batchEntries = entries.map((entry) => ({
        ...(typeof entry.itemTypeId === "number" ? { itemTypeId: entry.itemTypeId } : {}),
        ...(typeof entry.itemName === "string" && entry.itemName.trim().length > 0 ? { itemName: entry.itemName.trim() } : {}),
        quantity: entry.quantity
      }));

      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "spawn_item_batch", [selector, batchEntries], timeoutMs);
      const parsed = parseToolboxOpsPayload(eventResult.payloadJson);
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        storage: compactStorageRef(parsed.storage),
        summary: compactSummary(parsed.summary),
        results: parsed.results.map((entry) => compactBatchResult(entry)),
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? renderTextPayload(structuredContent)
              : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_storage_take",
    {
      title: "Take Item From Storage",
      description: "Removes a specific item type by ID or exact name from the chosen storage target.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        storageKind: storageKindSchema.default("container").describe("Storage target kind"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID for element-backed storages. When omitted, the player's current construct is used."),
        id: z.number().int().nonnegative().optional().describe("Construct-local element ID inside the chosen construct"),
        name: z.string().trim().min(1).optional().describe("Exact element custom name or exact type name inside the chosen construct"),
        category: z.string().trim().min(1).optional().describe("Optional category filter, for example container or container_hub"),
        targetPlayerId: z.number().int().nonnegative().optional().describe("Optional target player ID for player inventory selectors"),
        itemTypeId: z.number().int().positive().optional().describe("Explicit item type ID"),
        itemName: z.string().trim().min(1).optional().describe("Exact item definition name"),
        quantity: z.number().int().positive().describe("Gameplay quantity to remove"),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: storageMutationOutputSchema
    },
    async ({ playerId, storageKind, constructId, id, name, category, targetPlayerId, itemTypeId, itemName, quantity, timeoutMs }) => {
      const selector = buildStorageSelector({
        storageKind,
        constructId,
        id,
        name,
        category,
        targetPlayerId
      });
      const itemSelector = {
        ...(typeof itemTypeId === "number" ? { itemTypeId } : {}),
        ...(typeof itemName === "string" && itemName.trim().length > 0 ? { itemName: itemName.trim() } : {})
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "take_item", [selector, itemSelector, quantity], timeoutMs);
      const parsed = parseToolboxOpsPayload(eventResult.payloadJson);
      const storage = compactStorageRef(parsed.storage);
      const candidates = compactCandidates(parsed.candidates, !parsed.success || storage === null);
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        storage,
        from: compactStorageRef(parsed.from),
        to: compactStorageRef(parsed.to),
        item: compactItemRef(parsed.item),
        result: compactMutationResult(parsed.result),
        slot: compactSlotRef(parsed.slot),
        sourceSlot: compactSlotRef(parsed.sourceSlot),
        appliedToSlot: asInteger(parsed.parsed?.appliedToSlot),
        rawQuantity: asNumber(parsed.parsed?.rawQuantity),
        requestedQuantity: asNumber(parsed.parsed?.requestedQuantity),
        candidates,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? renderTextPayload(structuredContent)
              : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_storage_move_slot",
    {
      title: "Move Slot Between Storages",
      description: "Moves part or all of one occupied source slot into another resolved storage target.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        fromStorageKind: storageKindSchema.describe("Source storage kind"),
        fromConstructId: z.number().int().nonnegative().optional().describe("Optional source construct ID"),
        fromId: z.number().int().nonnegative().optional().describe("Construct-local source element ID"),
        fromName: z.string().trim().min(1).optional().describe("Exact source element custom name or exact type name"),
        fromCategory: z.string().trim().min(1).optional().describe("Optional source category filter"),
        fromTargetPlayerId: z.number().int().nonnegative().optional().describe("Optional source player ID for player inventory selectors"),
        fromSlot: z.number().int().min(0).describe("Occupied source slot index"),
        toStorageKind: storageKindSchema.describe("Destination storage kind"),
        toConstructId: z.number().int().nonnegative().optional().describe("Optional destination construct ID"),
        toId: z.number().int().nonnegative().optional().describe("Construct-local destination element ID"),
        toName: z.string().trim().min(1).optional().describe("Exact destination element custom name or exact type name"),
        toCategory: z.string().trim().min(1).optional().describe("Optional destination category filter"),
        toTargetPlayerId: z.number().int().nonnegative().optional().describe("Optional destination player ID for player inventory selectors"),
        toSlot: z.number().int().min(0).optional().describe("Optional destination slot index. When omitted, the mod picks the first free slot."),
        quantity: z.number().int().positive().describe("Gameplay quantity to move from the source slot"),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: storageMutationOutputSchema
    },
    async ({ playerId, fromStorageKind, fromConstructId, fromId, fromName, fromCategory, fromTargetPlayerId, fromSlot, toStorageKind, toConstructId, toId, toName, toCategory, toTargetPlayerId, toSlot, quantity, timeoutMs }) => {
      const fromSelector = buildStorageSelector({
        storageKind: fromStorageKind,
        constructId: fromConstructId,
        id: fromId,
        name: fromName,
        category: fromCategory,
        targetPlayerId: fromTargetPlayerId
      });
      const toSelector = buildStorageSelector({
        storageKind: toStorageKind,
        constructId: toConstructId,
        id: toId,
        name: toName,
        category: toCategory,
        targetPlayerId: toTargetPlayerId
      });
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "move_slot", [fromSelector, fromSlot, toSelector, quantity, toSlot ?? ""], timeoutMs);
      const parsed = parseToolboxOpsPayload(eventResult.payloadJson);
      const storage = compactStorageRef(parsed.storage);
      const candidates = compactCandidates(parsed.candidates, !parsed.success || storage === null);
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        storage,
        from: compactStorageRef(parsed.from),
        to: compactStorageRef(parsed.to),
        item: compactItemRef(parsed.item),
        result: compactMutationResult(parsed.result),
        slot: compactSlotRef(parsed.slot),
        sourceSlot: compactSlotRef(parsed.sourceSlot),
        appliedToSlot: asInteger(parsed.parsed?.appliedToSlot),
        rawQuantity: asNumber(parsed.parsed?.rawQuantity),
        requestedQuantity: asNumber(parsed.parsed?.requestedQuantity),
        candidates,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? renderTextPayload(structuredContent)
              : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_storage_drop_slot",
    {
      title: "Drop Slot Quantity",
      description: "Removes part or all of one occupied source slot without moving it into another storage.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        storageKind: storageKindSchema.default("container").describe("Storage target kind"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID for element-backed storages. When omitted, the player's current construct is used."),
        id: z.number().int().nonnegative().optional().describe("Construct-local element ID inside the chosen construct"),
        name: z.string().trim().min(1).optional().describe("Exact element custom name or exact type name inside the chosen construct"),
        category: z.string().trim().min(1).optional().describe("Optional category filter, for example container or container_hub"),
        targetPlayerId: z.number().int().nonnegative().optional().describe("Optional target player ID for player inventory selectors"),
        slot: z.number().int().min(0).describe("Occupied source slot index"),
        quantity: z.number().int().positive().describe("Gameplay quantity to drop from the source slot"),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: storageMutationOutputSchema
    },
    async ({ playerId, storageKind, constructId, id, name, category, targetPlayerId, slot, quantity, timeoutMs }) => {
      const selector = buildStorageSelector({
        storageKind,
        constructId,
        id,
        name,
        category,
        targetPlayerId
      });
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "drop_slot", [selector, slot, quantity], timeoutMs);
      const parsed = parseToolboxOpsPayload(eventResult.payloadJson);
      const storage = compactStorageRef(parsed.storage);
      const candidates = compactCandidates(parsed.candidates, !parsed.success || storage === null);
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        storage,
        from: compactStorageRef(parsed.from),
        to: compactStorageRef(parsed.to),
        item: compactItemRef(parsed.item),
        result: compactMutationResult(parsed.result),
        slot: compactSlotRef(parsed.slot),
        sourceSlot: compactSlotRef(parsed.sourceSlot),
        appliedToSlot: asInteger(parsed.parsed?.appliedToSlot),
        rawQuantity: asNumber(parsed.parsed?.rawQuantity),
        requestedQuantity: asNumber(parsed.parsed?.requestedQuantity),
        candidates,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? renderTextPayload(structuredContent)
              : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );
}
