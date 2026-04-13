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

const constructIndexIndustrySupportsOutputSchema = {
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

const constructIndexNearbyOutputSchema = {
  found: z.boolean(),
  commandId: z.string().nullable(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  construct: z.union([jsonRecordSchema, z.null()]),
  focus: z.union([jsonRecordSchema, z.null()]),
  summary: z.union([jsonRecordSchema, z.null()]),
  results: z.array(jsonRecordSchema),
  parseError: z.string().nullable()
};

const constructIndexFocusedResultsOutputSchema = {
  found: z.boolean(),
  commandId: z.string().nullable(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  construct: z.union([jsonRecordSchema, z.null()]),
  focus: z.union([jsonRecordSchema, z.null()]),
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

const constructIndexTraceOutputSchema = {
  found: z.boolean(),
  commandId: z.string().nullable(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  construct: z.union([jsonRecordSchema, z.null()]),
  focus: z.union([jsonRecordSchema, z.null()]),
  summary: z.union([jsonRecordSchema, z.null()]),
  steps: z.array(jsonRecordSchema),
  branchNodes: z.array(jsonRecordSchema),
  parseError: z.string().nullable()
};

const constructIndexConsumerBankOutputSchema = {
  found: z.boolean(),
  commandId: z.string().nullable(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  construct: z.union([jsonRecordSchema, z.null()]),
  focus: z.union([jsonRecordSchema, z.null()]),
  summary: z.union([jsonRecordSchema, z.null()]),
  consumerBank: z.array(jsonRecordSchema),
  inputBranches: z.array(jsonRecordSchema),
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
  steps: Record<string, unknown>[];
  branchNodes: Record<string, unknown>[];
  consumerBank: Record<string, unknown>[];
  inputBranches: Record<string, unknown>[];
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
      steps: [],
      branchNodes: [],
      consumerBank: [],
      inputBranches: [],
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
      steps: asRecordArray(parsed.steps),
      branchNodes: asRecordArray(parsed.branchNodes),
      consumerBank: asRecordArray(parsed.consumerBank),
      inputBranches: asRecordArray(parsed.inputBranches),
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
      steps: [],
      branchNodes: [],
      consumerBank: [],
      inputBranches: [],
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
        producesItemName: z.string().trim().min(1).optional().describe("Optional exact product item name filter based on recipe semantics"),
        consumesItemName: z.string().trim().min(1).optional().describe("Optional exact ingredient item name filter based on recipe semantics"),
        industryFamily: z.string().trim().min(1).optional().describe("Optional industry family, for example refiner, smelter, transfer, or assembly"),
        industryTier: z.number().int().min(1).max(10).optional().describe("Optional industry tier"),
        limit: z.number().int().min(1).max(500).default(100).describe("Maximum number of rows to return"),
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructIndexQueryOutputSchema
    },
    async ({ playerId, constructId, category, categories, exactName, nameContains, itemTypeId, itemName, itemClass, producesItemName, consumesItemName, industryFamily, industryTier, limit, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {}),
        ...(typeof category === "string" ? { category } : {}),
        ...(Array.isArray(categories) && categories.length > 0 ? { categories } : {}),
        ...(typeof exactName === "string" ? { exactName } : {}),
        ...(typeof nameContains === "string" ? { nameContains } : {}),
        ...(typeof itemTypeId === "number" ? { itemTypeId } : {}),
        ...(typeof itemName === "string" ? { itemName } : {}),
        ...(typeof itemClass === "string" ? { itemClass } : {}),
        ...(typeof producesItemName === "string" ? { producesItemName } : {}),
        ...(typeof consumesItemName === "string" ? { consumesItemName } : {}),
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
    "du_construct_index_describe_industry_branch",
    {
      title: "Describe Industry Branch",
      description: "Packages nearby industry/storage/transfer topology around one anchor into recognized branch kinds such as direct producer, support refill, or distribution TU branches.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        id: relatedSelectorSchema.shape.id,
        name: relatedSelectorSchema.shape.name,
        limit: z.number().int().min(1).max(100).default(12).describe("Maximum number of storage anchors to package from the focus"),
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructIndexFocusedResultsOutputSchema
    },
    async ({ playerId, constructId, id, name, limit, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {}),
        ...(typeof id === "number" ? { localId: id } : {}),
        ...(typeof name === "string" ? { name } : {}),
        limit
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "describe_industry_branch", [selector], timeoutMs);
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
    "du_construct_index_trace",
    {
      title: "Trace Construct Index",
      description: "Walks upstream or downstream from one construct-index anchor with bounded hops and optional stop conditions.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        id: relatedSelectorSchema.shape.id,
        name: relatedSelectorSchema.shape.name,
        direction: z.enum(["upstream", "downstream"]).default("upstream").describe("Trace direction from the anchor"),
        stopAtItemClass: z.string().trim().min(1).optional().describe("Optional semantic item class stop condition, for example pure, ore, or refined"),
        stopAtIndustryFamily: z.string().trim().min(1).optional().describe("Optional industry family stop condition, for example smelter or electronics"),
        maxHops: z.number().int().min(1).max(12).default(4).describe("Maximum trace depth"),
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructIndexTraceOutputSchema
    },
    async ({ playerId, constructId, id, name, direction, stopAtItemClass, stopAtIndustryFamily, maxHops, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {}),
        ...(typeof id === "number" ? { localId: id } : {}),
        ...(typeof name === "string" ? { name } : {}),
        direction,
        ...(typeof stopAtItemClass === "string" ? { stopAtItemClass } : {}),
        ...(typeof stopAtIndustryFamily === "string" ? { stopAtIndustryFamily } : {}),
        maxHops
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "trace_construct_index", [selector], timeoutMs);
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
        steps: parsed.steps,
        branchNodes: parsed.branchNodes,
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
    "du_construct_index_describe_bank_from_anchor",
    {
      title: "Describe Bank From Anchor",
      description: "Expands one machine or storage anchor into repeated same-role machine banks, optionally grouped by shared output storage or shared input/support pattern.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        id: relatedSelectorSchema.shape.id,
        name: relatedSelectorSchema.shape.name,
        groupBy: z.enum(["shared_output_storage", "shared_input_support_pattern", "none"]).default("shared_output_storage").describe("How to expand peer machines from the anchor"),
        limit: z.number().int().min(1).max(50).default(8).describe("Maximum number of bank prototypes to return from the anchor"),
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructIndexFocusedResultsOutputSchema
    },
    async ({ playerId, constructId, id, name, groupBy, limit, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {}),
        ...(typeof id === "number" ? { localId: id } : {}),
        ...(typeof name === "string" ? { name } : {}),
        groupBy,
        limit
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "describe_bank_from_anchor", [selector], timeoutMs);
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
    "du_construct_index_describe_consumer_bank_branches",
    {
      title: "Describe Consumer Bank Branches",
      description: "Summarizes a consumer bank plus its grouped upstream input branches by item and storage anchor.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        id: relatedSelectorSchema.shape.id,
        name: relatedSelectorSchema.shape.name,
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructIndexConsumerBankOutputSchema
    },
    async ({ playerId, constructId, id, name, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {}),
        ...(typeof id === "number" ? { localId: id } : {}),
        ...(typeof name === "string" ? { name } : {})
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "describe_consumer_bank_branches", [selector], timeoutMs);
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
        consumerBank: parsed.consumerBank,
        inputBranches: parsed.inputBranches,
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
    "du_construct_index_industry_supports",
    {
      title: "Describe Industry Supports",
      description: "Describes industry support buffers, their refill target, downstream industry consumers, and upstream feeder transfer units through the mod-side construct index.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        id: z.number().int().positive().optional().describe("Optional construct-local support buffer ID"),
        name: z.string().trim().min(1).optional().describe("Optional exact support buffer name"),
        industryFamily: z.string().trim().min(1).optional().describe("Optional downstream industry family filter, for example smelter, refiner, transfer, or assembly"),
        limit: z.number().int().min(1).max(500).default(200).describe("Maximum number of support buffers to return"),
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructIndexIndustrySupportsOutputSchema
    },
    async ({ playerId, constructId, id, name, industryFamily, limit, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {}),
        ...(typeof id === "number" ? { localId: id } : {}),
        ...(typeof name === "string" ? { name } : {}),
        ...(typeof industryFamily === "string" ? { industryFamily } : {}),
        limit
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "describe_industry_supports", [selector], timeoutMs);
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
    "du_construct_index_industry_support_storage",
    {
      title: "Describe Industry Support Storage",
      description: "Describes industry support branches and also returns live storage snapshots for the support buffers and, optionally, feeder source storages.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        id: z.number().int().positive().optional().describe("Optional construct-local support buffer ID"),
        name: z.string().trim().min(1).optional().describe("Optional exact support buffer name"),
        industryFamily: z.string().trim().min(1).optional().describe("Optional downstream industry family filter, for example smelter, refiner, chemical, or assembly"),
        includeFeederSources: z.boolean().default(true).describe("When true, include live snapshots for feeder source storages"),
        itemLimit: z.number().int().min(1).max(500).default(50).describe("Maximum number of occupied slots to return for each storage snapshot"),
        limit: z.number().int().min(1).max(500).default(200).describe("Maximum number of support buffers to return"),
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructIndexIndustrySupportsOutputSchema
    },
    async ({ playerId, constructId, id, name, industryFamily, includeFeederSources, itemLimit, limit, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {}),
        ...(typeof id === "number" ? { localId: id } : {}),
        ...(typeof name === "string" ? { name } : {}),
        ...(typeof industryFamily === "string" ? { industryFamily } : {}),
        includeFeederSources,
        itemLimit,
        limit
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "describe_industry_support_storage", [selector], timeoutMs);
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
    "du_construct_index_nearby",
    {
      title: "Nearby Construct Index",
      description: "Returns construct elements near one anchor element using mod-owned indexed element positions.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID; defaults to the player's current construct"),
        id: relatedSelectorSchema.shape.id,
        name: relatedSelectorSchema.shape.name,
        category: z.string().trim().min(1).optional().describe("Optional single category filter, for example container, container_hub, industry, or transfer"),
        categories: z.array(z.string().trim().min(1)).max(8).optional().describe("Optional category filter list"),
        industryFamily: z.string().trim().min(1).optional().describe("Optional industry family filter, for example transfer, smelter, refiner, or assembly"),
        radiusMeters: z.number().positive().max(500).default(20).describe("3D search radius in meters from the anchor element"),
        verticalToleranceMeters: z.number().min(0).max(500).optional().describe("Optional absolute vertical delta limit in meters"),
        limit: z.number().int().min(1).max(500).default(100).describe("Maximum number of nearby rows to return"),
        timeoutMs: clampedIntSchema(250, 30000, 15000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructIndexNearbyOutputSchema
    },
    async ({ playerId, constructId, id, name, category, categories, industryFamily, radiusMeters, verticalToleranceMeters, limit, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {}),
        ...(typeof id === "number" ? { localId: id } : {}),
        ...(typeof name === "string" ? { name } : {}),
        ...(typeof category === "string" ? { category } : {}),
        ...(Array.isArray(categories) && categories.length > 0 ? { categories } : {}),
        ...(typeof industryFamily === "string" ? { industryFamily } : {}),
        radiusMeters,
        ...(typeof verticalToleranceMeters === "number" ? { verticalToleranceMeters } : {}),
        limit
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "nearby_construct_index", [selector], timeoutMs);
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
