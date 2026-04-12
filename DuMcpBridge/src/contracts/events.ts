import * as z from "zod/v4";

export const bridgeEventTypeSchema = z.enum([
  "command_enqueued",
  "command_result",
  "runtime_log",
  "editor_state",
  "bridge_status",
  "probe_result",
  "chat_snapshot",
  "chat_send_result",
  "chat_channel_result",
  "server_chat_snapshot",
  "construct_inspector_result"
]);

export const bridgeEventSchema = z.object({
  eventId: z.string().min(1),
  createdAtUtc: z.string().min(1),
  playerId: z.number().int().nonnegative().nullable().optional(),
  source: z.object({
    kind: z.string().min(1),
    boardId: z.string().nullable().optional()
  }),
  type: z.union([bridgeEventTypeSchema, z.string().min(1)]),
  payload: z.record(z.string(), z.any())
});

export type BridgeEvent = z.infer<typeof bridgeEventSchema>;
