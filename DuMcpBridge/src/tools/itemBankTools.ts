import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { BridgeCommandQueue } from "../bridge/commandQueue.js";
import { BridgeEventStore, type CommandEventSnapshot } from "../bridge/eventStore.js";
import { clampedIntSchema } from "./schemaUtils.js";

const jsonRecordSchema = z.record(z.string(), z.any());

const queryItemBankOutputSchema = {
  found: z.boolean(),
  commandId: z.string().nullable(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  count: z.number().nullable(),
  results: z.array(jsonRecordSchema),
  parseError: z.string().nullable()
};

const listItemBankGroupsOutputSchema = {
  found: z.boolean(),
  commandId: z.string().nullable(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  count: z.number().nullable(),
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

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function renderTextPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

function parseItemBankPayload(payloadJson: string | null): {
  success: boolean;
  error: string | null;
  method: string | null;
  count: number | null;
  results: Record<string, unknown>[];
  parseError: string | null;
} {
  if (typeof payloadJson !== "string" || payloadJson.trim().length === 0) {
    return {
      success: false,
      error: null,
      method: null,
      count: null,
      results: [],
      parseError: null
    };
  }

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    return {
      success: parsed.success === true,
      error: asString(parsed.error),
      method: asString(parsed.method),
      count: asNumber(parsed.count),
      results: asRecordArray(parsed.results),
      parseError: null
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: null,
      method: null,
      count: null,
      results: [],
      parseError: error instanceof Error ? error.message : String(error)
    };
  }
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

  return eventStore.waitForCommandEvent(
    result.command.commandId,
    "toolbox_ops_result",
    timeoutMs
  );
}

export function registerItemBankTools(
  server: McpServer,
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore
): void {
  server.registerTool(
    "du_query_item_bank",
    {
      title: "Query Item Bank",
      description:
        "Queries the mod-side item bank SQLite database by item name, group, level, NqId, or industry. " +
        "Returns matching items with their tier, group, and optionally products and ingredients. " +
        "Use this to look up item tiers, find which group an item belongs to, or discover what a recipe produces/consumes.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        groupName: z.string().trim().min(1).optional().describe("Exact item group name filter (e.g. 'Pure', 'Ore', 'Decorative Element')"),
        itemName: z.string().trim().min(1).optional().describe("Exact item name filter"),
        itemNameContains: z.string().trim().min(1).optional().describe("Partial item name match filter"),
        level: z.number().int().min(0).optional().describe("Item tier/level filter (1-5)"),
        nqId: z.number().int().positive().optional().describe("NqId (core element ID) filter"),
        industry: z.string().trim().min(1).optional().describe("Industry name filter (e.g. 'Basic Assembly Line xs')"),
        includeProducts: z.boolean().optional().describe("Whether to include recipe products in results"),
        includeIngredients: z.boolean().optional().describe("Whether to include recipe ingredients in results"),
        limit: clampedIntSchema(1, 1000, 100).describe("Maximum number of rows to return"),
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: queryItemBankOutputSchema
    },
    async ({ playerId, groupName, itemName, itemNameContains, level, nqId, industry, includeProducts, includeIngredients, limit, timeoutMs }) => {
      const selector: Record<string, unknown> = {};
      if (groupName !== undefined) selector.groupName = groupName;
      if (itemName !== undefined) selector.itemName = itemName;
      if (itemNameContains !== undefined) selector.itemNameContains = itemNameContains;
      if (level !== undefined) selector.level = level;
      if (nqId !== undefined) selector.nqId = nqId;
      if (industry !== undefined) selector.industry = industry;
      if (includeProducts !== undefined) selector.includeProducts = includeProducts;
      if (includeIngredients !== undefined) selector.includeIngredients = includeIngredients;
      if (limit !== undefined) selector.limit = limit;

      const eventResult = await enqueueToolboxOpsCommand(
        commandQueue, eventStore, playerId,
        "query_item_bank",
        [selector],
        timeoutMs
      );

      const parsed = parseItemBankPayload(eventResult.payloadJson);

      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        count: parsed.count,
        results: parsed.results,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text" as const,
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
    "du_list_item_bank_groups",
    {
      title: "List Item Bank Groups",
      description:
        "Lists item groups from the mod-side item bank SQLite database. " +
        "Returns group IDs and names. Optionally filter by group name substring. " +
        "Use this to discover available group names before querying items by group.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        groupName: z.string().trim().min(1).optional().describe("Optional group name substring filter"),
        limit: clampedIntSchema(1, 2000, 500).describe("Maximum number of rows to return"),
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: listItemBankGroupsOutputSchema
    },
    async ({ playerId, groupName, limit, timeoutMs }) => {
      const selector: Record<string, unknown> = {};
      if (groupName !== undefined) selector.groupName = groupName;
      if (limit !== undefined) selector.limit = limit;

      const eventResult = await enqueueToolboxOpsCommand(
        commandQueue, eventStore, playerId,
        "list_item_bank_groups",
        [selector],
        timeoutMs
      );

      const parsed = parseItemBankPayload(eventResult.payloadJson);

      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        count: parsed.count,
        results: parsed.results,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text" as const,
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