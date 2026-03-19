import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { BridgeEventStore } from "../bridge/eventStore.js";

const lastResultOutputSchema = {
  found: z.boolean(),
  eventId: z.string().nullable(),
  type: z.string().nullable(),
  playerId: z.number().int().nonnegative().nullable(),
  targetKind: z.string().nullable(),
  createdAtUtc: z.string().nullable(),
  payloadJson: z.string().nullable()
};

const runtimeLogOutputSchema = {
  count: z.number().int().nonnegative(),
  lines: z.array(z.string())
};

const sessionSummaryOutputSchema = {
  count: z.number().int().nonnegative(),
  sessions: z.array(
    z.object({
      playerId: z.number().int().nonnegative(),
      lastActivityUtc: z.string().nullable(),
      sources: z.array(z.string())
    })
  )
};

export function registerLogTools(server: McpServer, eventStore: BridgeEventStore): void {
  server.registerTool(
    "du_get_last_result",
    {
      title: "Get Last Bridge Result",
      description: "Returns the latest matching bridge event.",
      inputSchema: {
        playerId: z.number().int().nonnegative().optional().describe("Optional player filter"),
        targetKind: z.string().optional().describe("Optional target kind filter, e.g. lua_editor"),
        eventType: z.string().optional().describe("Optional event type filter, e.g. command_result")
      },
      outputSchema: lastResultOutputSchema
    },
    async ({ playerId, targetKind, eventType }) => {
      const event = await eventStore.getLastResult(playerId, targetKind, eventType);
      const structuredContent = event
        ? {
            found: true,
            eventId: event.eventId,
            type: event.type,
            playerId: event.playerId ?? null,
            targetKind: event.source.kind,
            createdAtUtc: event.createdAtUtc,
            payloadJson: JSON.stringify(event.payload, null, 2)
          }
        : {
            found: false,
            eventId: null,
            type: null,
            playerId: null,
            targetKind: null,
            createdAtUtc: null,
            payloadJson: null
          };

      return {
        content: [
          {
            type: "text",
            text: structuredContent.found
              ? structuredContent.payloadJson ?? ""
              : "No matching bridge event found."
          }
        ],
        structuredContent
      };
    }
  );

  server.registerTool(
    "du_tail_runtime_logs",
    {
      title: "Tail Bridge Runtime Logs",
      description: "Returns recent bridge runtime lines from the event store.",
      inputSchema: {
        playerId: z.number().int().nonnegative().optional().describe("Optional player filter"),
        limit: z.number().int().min(1).max(200).default(20).describe("Maximum number of lines to return")
      },
      outputSchema: runtimeLogOutputSchema
    },
    async ({ playerId, limit }) => {
      const lines = await eventStore.tailRuntimeLogs(playerId, limit);
      return {
        content: [
          {
            type: "text",
            text: lines.length > 0 ? lines.join("\n") : "No runtime log lines found."
          }
        ],
        structuredContent: {
          count: lines.length,
          lines
        }
      };
    }
  );

  server.registerTool(
    "du_list_active_sessions",
    {
      title: "List Active Sessions",
      description: "Lists players seen in the bridge event stream or legacy IDE sync files.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of sessions to return")
      },
      outputSchema: sessionSummaryOutputSchema
    },
    async ({ limit }) => {
      const sessions = await eventStore.listActiveSessions(limit);
      return {
        content: [
          {
            type: "text",
            text: sessions.length > 0
              ? sessions.map((session) => `player=${session.playerId} last=${session.lastActivityUtc ?? "n/a"} sources=${session.sources.join(",")}`).join("\n")
              : "No bridge sessions found."
          }
        ],
        structuredContent: {
          count: sessions.length,
          sessions
        }
      };
    }
  );
}
