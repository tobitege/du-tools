import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { BridgeCommandQueue } from "../bridge/commandQueue.js";
import { BridgeEventStore, type CommandEventSnapshot } from "../bridge/eventStore.js";
import { clampedIntSchema } from "./schemaUtils.js";

const jsonRecordSchema = z.record(z.string(), z.any());

const constructIndexRefreshOutputSchema = {
  found: z.boolean(),
  commandId: z.string().nullable(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  construct: z.union([jsonRecordSchema, z.null()]),
  summary: z.union([jsonRecordSchema, z.null()]),
  parseError: z.string().nullable()
};

const constructIndexQueryOutputSchema = {
  found: z.boolean(),
  commandId: z.string().nullable(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  construct: z.union([jsonRecordSchema, z.null()]),
  summary: z.union([jsonRecordSchema, z.null()]),
  results: z.array(jsonRecordSchema),
  parseError: z.string().nullable()
};

const constructIndexRelatedOutputSchema = {
  found: z.boolean(),
  commandId: z.string().nullable(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  construct: z.union([jsonRecordSchema, z.null()]),
  focus: z.union([jsonRecordSchema, z.null()]),
  summary: z.union([jsonRecordSchema, z.null()]),
  nodes: z.array(jsonRecordSchema),
  links: z.array(jsonRecordSchema),
  parseError: z.string().nullable()
};

const relatedSelectorSchema = z.object({
  id: z.number().int().positive().optional().describe("Construct-local element ID"),
  name: z.string().trim().min(1).optional().describe("Exact custom name or exact type name")
}).refine(
  (entry) => (typeof entry.id === "number") !== (typeof entry.name === "string"),
  "Provide exactly one of `id` or `name`."
);

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

function renderTextPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

function parseToolboxOpsPayload(payloadJson: string | null): {
  success: boolean;
  error: string | null;
  method: string | null;
  construct: Record<string, unknown> | null;
  focus: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  results: Record<string, unknown>[];
  nodes: Record<string, unknown>[];
  links: Record<string, unknown>[];
  parseError: string | null;
} {
  if (typeof payloadJson !== "string" || payloadJson.trim().length === 0) {
    return {
      success: false,
      error: null,
      method: null,
      construct: null,
      focus: null,
      summary: null,
      results: [],
      nodes: [],
      links: [],
      parseError: null
    };
  }

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    return {
      success: parsed.success === true,
      error: asString(parsed.error),
      method: asString(parsed.method),
      construct: asRecord(parsed.construct),
      focus: asRecord(parsed.focus),
      summary: asRecord(parsed.summary),
      results: asRecordArray(parsed.results),
      nodes: asRecordArray(parsed.nodes),
      links: asRecordArray(parsed.links),
      parseError: null
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: null,
      method: null,
      construct: null,
      focus: null,
      summary: null,
      results: [],
      nodes: [],
      links: [],
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

  return eventStore.waitForCommandEvent(result.command.commandId, "toolbox_ops_result", timeoutMs);
}

export function registerConstructIndexTools(server: McpServer, commandQueue: BridgeCommandQueue, eventStore: BridgeEventStore): void {
  server.registerTool(
    "du_construct_index_refresh",
    {
      title: "Refresh Construct Index",
      description: "Loads a construct backend snapshot into the mod-side SQLite index using elements and links only.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructIndexRefreshOutputSchema
    },
    async ({ playerId, constructId, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {})
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "refresh_construct_index", [selector], timeoutMs);
      const parsed = parseToolboxOpsPayload(eventResult.payloadJson);
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        construct: parsed.construct,
        summary: parsed.summary,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found ? renderTextPayload(structuredContent) : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_construct_index_query",
    {
      title: "Query Construct Index",
      description: "Queries the mod-side construct SQLite index by static and semantic filters such as category, item, industry family, and exact name.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        category: z.string().trim().min(1).optional().describe("Optional single category filter, for example container, container_hub, industry, or transfer"),
        categories: z.array(z.string().trim().min(1)).max(8).optional().describe("Optional category filter list"),
        exactName: z.string().trim().min(1).optional().describe("Optional exact custom name or exact type name"),
        nameContains: z.string().trim().min(1).optional().describe("Optional normalized name contains search"),
        itemTypeId: z.number().int().positive().optional().describe("Optional semantic item type ID filter"),
        itemName: z.string().trim().min(1).optional().describe("Optional exact semantic item name filter"),
        itemClass: z.string().trim().min(1).optional().describe("Optional semantic item class, for example ore, pure, refined, raw, material, or product"),
        industryFamily: z.string().trim().min(1).optional().describe("Optional industry family, for example refiner, smelter, transfer, or assembly"),
        industryTier: z.number().int().min(1).max(10).optional().describe("Optional industry tier"),
        limit: z.number().int().min(1).max(500).default(100).describe("Maximum number of rows to return"),
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructIndexQueryOutputSchema
    },
    async ({ playerId, constructId, category, categories, exactName, nameContains, itemTypeId, itemName, itemClass, industryFamily, industryTier, limit, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {}),
        ...(typeof category === "string" ? { category } : {}),
        ...(Array.isArray(categories) && categories.length > 0 ? { categories } : {}),
        ...(typeof exactName === "string" ? { exactName } : {}),
        ...(typeof nameContains === "string" ? { nameContains } : {}),
        ...(typeof itemTypeId === "number" ? { itemTypeId } : {}),
        ...(typeof itemName === "string" ? { itemName } : {}),
        ...(typeof itemClass === "string" ? { itemClass } : {}),
        ...(typeof industryFamily === "string" ? { industryFamily } : {}),
        ...(typeof industryTier === "number" ? { industryTier } : {}),
        limit
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "query_construct_index", [selector], timeoutMs);
      const parsed = parseToolboxOpsPayload(eventResult.payloadJson);
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        construct: parsed.construct,
        summary: parsed.summary,
        results: parsed.results,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found ? renderTextPayload(structuredContent) : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_construct_index_related",
    {
      title: "Related Construct Index",
      description: "Returns a compact related subgraph around one construct-local element from the mod-side construct SQLite index.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        id: relatedSelectorSchema.shape.id,
        name: relatedSelectorSchema.shape.name,
        categories: z.array(z.string().trim().min(1)).max(8).optional().describe("Optional output category filter list"),
        maxDepth: z.number().int().min(1).max(4).default(1).describe("Relationship depth from the focus node"),
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructIndexRelatedOutputSchema
    },
    async ({ playerId, constructId, id, name, categories, maxDepth, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {}),
        ...(typeof id === "number" ? { localId: id } : {}),
        ...(typeof name === "string" ? { name } : {}),
        ...(Array.isArray(categories) && categories.length > 0 ? { categories } : {}),
        maxDepth
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "related_construct_index", [selector], timeoutMs);
      const parsed = parseToolboxOpsPayload(eventResult.payloadJson);
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        construct: parsed.construct,
        focus: parsed.focus,
        summary: parsed.summary,
        nodes: parsed.nodes,
        links: parsed.links,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found ? renderTextPayload(structuredContent) : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );
}
