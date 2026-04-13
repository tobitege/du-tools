import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { BridgeCommandQueue } from "../bridge/commandQueue.js";
import { BridgeEventStore, type CommandEventSnapshot } from "../bridge/eventStore.js";
import { clampedIntSchema } from "./schemaUtils.js";

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
  parseError: z.string().nullable()
};

const constructRenameElementOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  target: z.union([jsonRecordSchema, z.null()]),
  result: z.union([jsonRecordSchema, z.null()]),
  parseError: z.string().nullable()
};

const constructRuntimeAvailabilityOutputSchema = {
  found: z.boolean(),
  commandId: z.string(),
  createdAtUtc: z.string().nullable(),
  success: z.boolean(),
  error: z.string().nullable(),
  method: z.string().nullable(),
  currentConstruct: z.union([jsonRecordSchema, z.null()]),
  targetConstruct: z.union([jsonRecordSchema, z.null()]),
  availability: z.union([jsonRecordSchema, z.null()]),
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

function compactObject(entries: Array<[string, unknown]>): Record<string, unknown> | null {
  const compact: Record<string, unknown> = {};

  for (const [key, value] of entries) {
    if (value !== null && value !== undefined) {
      compact[key] = value;
    }
  }

  return Object.keys(compact).length > 0 ? compact : null;
}

function compactElementRef(source: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["id", firstInteger(source, ["localId", "id"])],
    ["name", firstString(source, ["name", "customName", "displayName"])],
    ["typeName", firstString(source, ["typeName", "type"])],
    ["category", firstString(source, ["category"])],
    ["state", firstString(source, ["state"])]
  ]);
}

function compactLinkEndpoint(source: Record<string, unknown> | null, kind: "from" | "to"): Record<string, unknown> | null {
  const nested = kind === "from"
    ? firstRecord(source, ["from", "source", "fromElement", "sourceElement"])
    : firstRecord(source, ["to", "target", "toElement", "targetElement"]);

  if (nested !== null) {
    return compactElementRef(nested);
  }

  const idKeys = kind === "from" ? ["fromLocalId", "sourceLocalId", "fromId", "sourceId"] : ["toLocalId", "targetLocalId", "toId", "targetId"];
  const nameKeys = kind === "from" ? ["fromName", "sourceName"] : ["toName", "targetName"];
  const typeKeys = kind === "from" ? ["fromTypeName", "sourceTypeName", "fromType", "sourceType"] : ["toTypeName", "targetTypeName", "toType", "targetType"];
  const categoryKeys = kind === "from" ? ["fromCategory", "sourceCategory"] : ["toCategory", "targetCategory"];

  return compactObject([
    ["id", firstInteger(source, idKeys)],
    ["name", firstString(source, nameKeys)],
    ["typeName", firstString(source, typeKeys)],
    ["category", firstString(source, categoryKeys)]
  ]);
}

function compactLink(source: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(compactObject([
      ["type", firstString(source, ["linkType", "type"])],
      ["direction", firstString(source, ["direction"])]
    ]) ?? {}),
    ...(compactObject([
      ["from", compactLinkEndpoint(source, "from")],
      ["to", compactLinkEndpoint(source, "to")]
    ]) ?? {})
  };
}

function compactIndustryRuntime(source: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["state", firstString(source, ["state", "status"])],
    ["mode", firstString(source, ["mode"])],
    ["recipeId", firstInteger(source, ["recipeId"])],
    ["nextRecipeId", firstInteger(source, ["nextRecipeId"])],
    ["batchesRequested", firstInteger(source, ["batchesRequested"])],
    ["maintainQuantity", firstInteger(source, ["maintainQuantity", "maintainAmount", "amount"])]
  ]);
}

function compactStorageRuntime(source: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["occupiedSlotCount", firstInteger(source, ["occupiedSlotCount", "itemCount", "occupiedCount"])],
    ["itemLimit", firstInteger(source, ["itemLimit", "slotCount"])],
    ["usedVolumeL", firstInteger(source, ["usedVolumeL", "usedVolume"])],
    ["freeVolumeL", firstInteger(source, ["freeVolumeL", "freeVolume"])],
    ["maxVolumeL", firstInteger(source, ["maxVolumeL", "maxVolume", "capacityL", "capacity"])]
  ]);
}

function compactPattern(source: Record<string, unknown>): Record<string, unknown> {
  const elements = firstRecordArray(source, ["elements", "nodes"]).map((entry) => compactElementRef(entry)).filter((entry): entry is Record<string, unknown> => entry !== null);
  const links = firstRecordArray(source, ["links"]).map((entry) => compactLink(entry));

  return {
    ...(compactObject([
      ["occurrences", firstInteger(source, ["occurrences", "count"])],
      ["elementCount", firstInteger(source, ["elementCount"])],
      ["linkCount", firstInteger(source, ["linkCount"])],
      ["signature", firstString(source, ["signature", "label", "name"])]
    ]) ?? {}),
    ...(elements.length > 0 ? { elements } : {}),
    ...(links.length > 0 ? { links } : {})
  };
}

function compactRenameResult(source: Record<string, unknown> | null): Record<string, unknown> | null {
  return compactObject([
    ["name", firstString(source, ["name", "newName"])],
    ["oldName", firstString(source, ["oldName"])],
    ["status", firstString(source, ["status", "state"])],
    ["message", firstString(source, ["message", "reason", "error"])]
  ]);
}

function renderTextPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

function parseConstructInspectorPayload(payloadJson: string | null): {
  parsed: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
  method: string | null;
  constructId: number | null;
  constructName: string | null;
  usedCurrentConstruct: boolean | null;
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
      parseError: error instanceof Error ? error.message : String(error)
    };
  }
}

function parseToolboxOpsPayload(payloadJson: string | null): {
  parsed: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
  method: string | null;
  target: Record<string, unknown> | null;
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
      result: null,
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

export function registerConstructTools(server: McpServer, commandQueue: BridgeCommandQueue, eventStore: BridgeEventStore): void {
  server.registerTool(
    "du_construct_runtime_availability",
    {
      title: "Construct Runtime Availability",
      description: "Checks whether live industry and storage reads are expected to work for the target construct from the player's current position.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional target construct ID; defaults to the player's current construct when available"),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructRuntimeAvailabilityOutputSchema
    },
    async ({ playerId, constructId, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {})
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "construct_runtime_availability", [selector], timeoutMs);
      const parsed = parseToolboxOpsPayload(eventResult.payloadJson);
      const payload = parsed.parsed;
      const structuredContent = {
        found: eventResult.found,
        commandId: eventResult.commandId,
        createdAtUtc: eventResult.createdAtUtc,
        success: parsed.success,
        error: parsed.error,
        method: parsed.method,
        currentConstruct: asRecord(payload?.currentConstruct),
        targetConstruct: asRecord(payload?.targetConstruct),
        availability: asRecord(payload?.availability),
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
    "du_construct_rename_element",
    {
      title: "Rename Construct Element",
      description: "Renames one construct element through the backend toolbox path using exactly one deterministic selector.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Requester player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID. When omitted, the player's current construct is used."),
        id: z.number().int().nonnegative().optional().describe("Construct-local element ID"),
        name: z.string().trim().min(1).optional().describe("Exact element custom name or exact type name"),
        newName: z.string().trim().min(1).describe("New exact custom name to assign"),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the toolbox_ops_result event")
      },
      outputSchema: constructRenameElementOutputSchema
    },
    async ({ playerId, constructId, id, name, newName, timeoutMs }) => {
      const selector: Record<string, unknown> = {
        ...(typeof constructId === "number" ? { constructId } : {}),
        ...(typeof id === "number" ? { localId: id } : {}),
        ...(typeof name === "string" && name.trim().length > 0 ? { name: name.trim() } : {})
      };
      const eventResult = await enqueueToolboxOpsCommand(commandQueue, eventStore, playerId, "rename_element", [selector, newName.trim()], timeoutMs);
      const parsed = parseToolboxOpsPayload(eventResult.payloadJson);
      const payload = {
        target: compactElementRef(parsed.target),
        result: compactRenameResult(parsed.result)
      };
      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? renderTextPayload(payload)
              : `No toolbox_ops_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent: {
          found: eventResult.found,
          commandId: eventResult.commandId,
          createdAtUtc: eventResult.createdAtUtc,
          success: parsed.success,
          error: parsed.error,
          method: parsed.method,
          target: payload.target,
          result: payload.result,
          parseError: parsed.parseError
        }
      };
    }
  );

  server.registerTool(
    "du_construct_describe",
    {
      title: "Describe Current Construct",
      description: "Reads the current or specified construct server-side and returns element/link totals plus grouped element counts.",
      inputSchema: {
        playerId: z.number().int().nonnegative().describe("Target player ID"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID. When omitted, the player's current construct is used."),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the construct_inspector_result event")
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
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? renderTextPayload(structuredContent)
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
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the construct_inspector_result event")
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
      const matches = asRecordArray(record?.matches).map((entry) => compactElementRef(entry)).filter((entry): entry is Record<string, unknown> => entry !== null);
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
        matches,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? renderTextPayload(structuredContent)
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
        id: z.number().int().positive().describe("Construct-local element ID to inspect"),
        constructId: z.number().int().nonnegative().optional().describe("Optional construct ID. When omitted, the player's current construct is used."),
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the construct_inspector_result event")
      },
      outputSchema: constructInspectElementOutputSchema
    },
    async ({ playerId, id, constructId, timeoutMs }) => {
      const eventResult = await enqueueConstructInspectorCommand(
        commandQueue,
        eventStore,
        playerId,
        "inspect_element",
        [id, constructId ?? ""],
        timeoutMs
      );
      const parsed = parseConstructInspectorPayload(eventResult.payloadJson);
      const record = parsed.parsed;
      const inboundLinks = asRecordArray(record?.inboundLinks).map((entry) => compactLink(entry));
      const outboundLinks = asRecordArray(record?.outboundLinks).map((entry) => compactLink(entry));
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
        element: compactElementRef(asRecord(record?.element)),
        inboundLinks,
        outboundLinks,
        industryRuntime: compactIndustryRuntime(asRecord(record?.industryRuntime)),
        storageRuntime: compactStorageRuntime(asRecord(record?.storageRuntime)),
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? renderTextPayload(structuredContent)
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
        timeoutMs: clampedIntSchema(250, 15000, 5000).describe("How long to wait for the construct_inspector_result event")
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
      const patterns = asRecordArray(record?.patterns).map((entry) => compactPattern(entry));
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
        patterns,
        parseError: parsed.parseError
      };

      return {
        content: [
          {
            type: "text",
            text: eventResult.found
              ? renderTextPayload(structuredContent)
              : `No construct_inspector_result event received within ${timeoutMs}ms.`
          }
        ],
        structuredContent
      };
    }
  );
}
