import * as z from "zod/v4";

export const targetKindSchema = z.enum(["lua_editor", "screen_editor"]);
export const commandActionSchema = z.enum(["set_code", "save", "probe_call"]);
export const commandPayloadSchema = z.object({
  code: z.string().optional(),
  language: z.enum(["lua", "html"]).optional(),
  save: z.boolean().optional(),
  isHtmlMode: z.boolean().optional(),
  waitForEditor: z.boolean().optional(),
  maxAttempts: z.number().int().positive().optional(),
  retryDelayMs: z.number().int().positive().optional(),
  probeMethod: z.string().min(1).optional(),
  probeArgs: z.array(z.any()).optional()
});

export const bridgeCommandSchema = z.object({
  commandId: z.string().min(1),
  createdAtUtc: z.string().min(1),
  playerId: z.number().int().nonnegative(),
  target: z.object({
    kind: targetKindSchema,
    boardId: z.string().nullable().optional()
  }),
  action: commandActionSchema,
  payload: commandPayloadSchema.default({})
});

export type TargetKind = z.infer<typeof targetKindSchema>;
export type CommandAction = z.infer<typeof commandActionSchema>;
export type BridgeCommand = z.infer<typeof bridgeCommandSchema>;
