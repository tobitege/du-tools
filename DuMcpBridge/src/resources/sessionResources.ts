import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { BridgeEventStore } from "../bridge/eventStore.js";

function getSingleVariable(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? null;
  }
  return null;
}

function parsePlayerId(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function registerSessionResources(server: McpServer, eventStore: BridgeEventStore): void {
  server.registerResource(
    "du-session-active-code",
    new ResourceTemplate("du://session/{playerId}/active-code", { list: undefined }),
    {
      title: "DU Session Active Code",
      description: "Current exported code snapshot for a player session",
      mimeType: "text/plain"
    },
    async (uri, variables) => {
      const playerId = parsePlayerId(getSingleVariable(variables.playerId));
      const snapshot = await eventStore.readActiveCode("lua_editor", playerId);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: snapshot.found ? snapshot.code ?? "" : `No active code snapshot found for player ${playerId}.`
          }
        ]
      };
    }
  );

  server.registerResource(
    "du-session-last-result",
    new ResourceTemplate("du://session/{playerId}/last-result", { list: undefined }),
    {
      title: "DU Session Last Result",
      description: "Latest bridge event for a player session",
      mimeType: "application/json"
    },
    async (uri, variables) => {
      const playerId = parsePlayerId(getSingleVariable(variables.playerId));
      const event = await eventStore.getLastResult(playerId);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(event ?? { found: false, message: `No event found for player ${playerId}.` }, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    "du-session-runtime-log",
    new ResourceTemplate("du://session/{playerId}/runtime-log", { list: undefined }),
    {
      title: "DU Session Runtime Log",
      description: "Recent runtime log lines for a player session",
      mimeType: "text/plain"
    },
    async (uri, variables) => {
      const playerId = parsePlayerId(getSingleVariable(variables.playerId));
      const lines = await eventStore.tailRuntimeLogs(playerId, 50);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: lines.length > 0 ? lines.join("\n") : `No runtime log lines found for player ${playerId}.`
          }
        ]
      };
    }
  );
}
