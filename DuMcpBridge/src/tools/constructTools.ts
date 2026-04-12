import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { BridgeCommandQueue } from "../bridge/commandQueue.js";
import { BridgeEventStore, type CommandEventSnapshot } from "../bridge/eventStore.js";

const jsonRecordSchema = z.record(z.string(), z.any());

const constructDescribeOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  constructId: z.number().int().nonnegative().nullable(),
  constructName: z.string().nullable(),
  usedCurrentConstruct: z.boolean().nullable(),
  elementCount: z.number().int().nonnegative().nullable(),
  linkCount: z.number().int().nonnegative().nullable(),
  categoryCounts: z.array(jsonRecordSchema),
  typeCounts: z.array(jsonRecordSchema),
  payloadJson: z.string().nullable(),
  parseError: z.string().nullable()
};

const constructFindElementsOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  constructId: z.number().int().nonnegative().nullable(),
  constructName: z.string().nullable(),
  usedCurrentConstruct: z.boolean().nullable(),
  query: z.string().nullable(),
  limit: z.number().int().nonnegative().nullable(),
  totalMatches: z.number().int().nonnegative().nullable(),
  matches: z.array(jsonRecordSchema),
  payloadJson: z.string().nullable(),
  parseError: z.string().nullable()
};

const constructInspectElementOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  constructId: z.number().int().nonnegative().nullable(),
  constructName: z.string().nullable(),
  usedCurrentConstruct: z.boolean().nullable(),
  element: z.union([jsonRecordSchema, z.null()]),
  inboundLinks: z.array(jsonRecordSchema),
  outboundLinks: z.array(jsonRecordSchema),
  industryRuntime: z.union([jsonRecordSchema, z.null()]),
  storageRuntime: z.union([jsonRecordSchema, z.null()]),
  payloadJson: z.string().nullable(),
  parseError: z.string().nullable()
};

const constructAnalyzePatternsOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  constructId: z.number().int().nonnegative().nullable(),
  constructName: z.string().nullable(),
  usedCurrentConstruct: z.boolean().nullable(),
  limit: z.number().int().nonnegative().nullable(),
  patterns: z.array(jsonRecordSchema),
  payloadJson: z.string().nullable(),
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

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function parseConstructInspectorPayload(payloadJson: string | null): {
  parsed: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
  method: string | null;
  constructId: number | null;
  constructName: string | null;
  usedCurrentConstruct: boolean | null;
  payloadJson: string | null;
  parseError: string | null;
} {
  if (typeof payloadJson !== "string" || payloadJson.trim().length === 0) {
    return {
      parsed: null,
      success: false,
      error: null,
      method: null,
      constructId: null,
      constructName: null,
      usedCurrentConstruct: null,
      payloadJson: null,
      parseError: null
    };
  }

  try {
    const parsed = JSON.parse(payloadJson) as Record<string, unknown>;
    const construct = asRecord(parsed.construct);
    return {
      parsed,
      success: parsed.success === true,
      error: asString(parsed.error),
      method: asString(parsed.method),
      constructId: asInteger(construct?.constructId ?? null),
      constructName: asString(construct?.constructName),
      usedCurrentConstruct: asBoolean(construct?.usedCurrentConstruct),
      payloadJson: JSON.stringify(parsed, null, 2),
      parseError: null
    };
  } catch (error: unknown) {
    return {
      parsed: null,
      success: false,
      error: null,
      method: null,
      constructId: null,
      constructName: null,
      usedCurrentConstruct: null,
      payloadJson,
      parseError: error instanceof Error ? error.message : String(error)
    };
  }
}

async function enqueueConstructInspectorCommand(
  commandQueue: BridgeCommandQueue,
  eventStore: BridgeEventStore,
  playerId: number,
  method: string,
  probeArgs: unknown[],
  timeoutMs: number
): Promise<CommandEventSnapshot> {
  const result = await commandQueue.enqueue({
    playerId,
    targetKind: "construct_inspector",
    action: "probe_call",
    probeMethod: method,
    probeArgs
  });

  await eventStore.appendSystemEvent({
    eventId: `evt-${result.command.commandId}`,
    createdAtUtc: new Date().toISOString(),
    playerId,
    source: {
      kind: "construct_inspector",
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

  return eventStore.waitForCommandEvent(result.command.commandId, "construct_inspector_result", timeoutMs);
}

export function registerConstructTools(server: McpServer, commandQueue: BridgeCommandQueue, eventStore: BridgeEventStore): void {
  server.registerTool(
    "du_construct_describe",
    {
      title: "Describe Current Construct",
      description: "Reads the current or specified construct server-side and returns element/link totals plus grouped element counts.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID. When omitted, the player's current construct is used."),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the construct_inspector_result event")
      },
      outputSchema: constructDescribeOutputSchema
    },
    async ({ playerId, constructId, timeoutMs }) => {
      const eventResult = await enqueueConstructInspectorCommand(
        commandQueue,
        eventStore,
        playerId,
        "describe",
        [constructId ?? ""],
        timeoutMs
      );
      const parsed = parseConstructInspectorPayload(eventResult.payloadJson);
      const record = parsed.parsed;
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        constructId: parsed.constructId,
        constructName: parsed.constructName,
        usedCurrentConstruct: parsed.usedCurrentConstruct,
        elementCount: asInteger(record?.elementCount),
        linkCount: asInteger(record?.linkCount),
        categoryCounts: asRecordArray(record?.categoryCounts),
        typeCounts: asRecordArray(record?.typeCounts),
        payloadJson: parsed.payloadJson,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? (parsed.payloadJson ?? eventResult.payloadJson ?? "")
              : `No construct_inspector_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_construct_find_elements",
    {
      title: "Find Construct Elements",
      description: "Searches elements within the current or specified construct by name, type, category, local ID, or element ID.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        query: z.string().default("").describe("Search text. Empty returns the first page of elements."),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID. When omitted, the player's current construct is used."),
        limit: z.number().int().min(1).max(250).default(50).describe("Maximum number of matches to return"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the construct_inspector_result event")
      },
      outputSchema: constructFindElementsOutputSchema
    },
    async ({ playerId, query, constructId, limit, timeoutMs }) => {
      const eventResult = await enqueueConstructInspectorCommand(
        commandQueue,
        eventStore,
        playerId,
        "find_elements",
        [query, constructId ?? "", limit],
        timeoutMs
      );
      const parsed = parseConstructInspectorPayload(eventResult.payloadJson);
      const record = parsed.parsed;
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        constructId: parsed.constructId,
        constructName: parsed.constructName,
        usedCurrentConstruct: parsed.usedCurrentConstruct,
        query: asString(record?.query),
        limit: asInteger(record?.limit),
        totalMatches: asInteger(record?.totalMatches),
        matches: asRecordArray(record?.matches),
        payloadJson: parsed.payloadJson,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? (parsed.payloadJson ?? eventResult.payloadJson ?? "")
              : `No construct_inspector_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_construct_inspect_element",
    {
      title: "Inspect Construct Element",
      description: "Returns inbound/outbound links for a construct element plus live industry or storage state when the element supports it.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        elementId: z.number().int().positive().describe("Element ID to inspect"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID. When omitted, the player's current construct is used."),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the construct_inspector_result event")
      },
      outputSchema: constructInspectElementOutputSchema
    },
    async ({ playerId, elementId, constructId, timeoutMs }) => {
      const eventResult = await enqueueConstructInspectorCommand(
        commandQueue,
        eventStore,
        playerId,
        "inspect_element",
        [elementId, constructId ?? ""],
        timeoutMs
      );
      const parsed = parseConstructInspectorPayload(eventResult.payloadJson);
      const record = parsed.parsed;
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        constructId: parsed.constructId,
        constructName: parsed.constructName,
        usedCurrentConstruct: parsed.usedCurrentConstruct,
        element: asRecord(record?.element),
        inboundLinks: asRecordArray(record?.inboundLinks),
        outboundLinks: asRecordArray(record?.outboundLinks),
        industryRuntime: asRecord(record?.industryRuntime),
        storageRuntime: asRecord(record?.storageRuntime),
        payloadJson: parsed.payloadJson,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? (parsed.payloadJson ?? eventResult.payloadJson ?? "")
              : `No construct_inspector_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_construct_analyze_patterns",
    {
      title: "Analyze Construct Patterns",
      description: "Groups repeated linked element topologies inside the current or specified construct to reveal recurring factory build patterns.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID. When omitted, the player's current construct is used."),
        limit: z.number().int().min(1).max(100).default(25).describe("Maximum number of repeated patterns to return"),
        timeoutMs: z.number().int().min(250).max(15000).default(5000).describe("How long to wait for the construct_inspector_result event")
      },
      outputSchema: constructAnalyzePatternsOutputSchema
    },
    async ({ playerId, constructId, limit, timeoutMs }) => {
      const eventResult = await enqueueConstructInspectorCommand(
        commandQueue,
        eventStore,
        playerId,
        "analyze_patterns",
        [constructId ?? "", limit],
        timeoutMs
      );
      const parsed = parseConstructInspectorPayload(eventResult.payloadJson);
      const record = parsed.parsed;
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        constructId: parsed.constructId,
        constructName: parsed.constructName,
        usedCurrentConstruct: parsed.usedCurrentConstruct,
        limit: asInteger(record?.limit),
        patterns: asRecordArray(record?.patterns),
        payloadJson: parsed.payloadJson,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? (parsed.payloadJson ?? eventResult.payloadJson ?? "")
              : `No construct_inspector_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );
}
