You are working in the repository at `d:\github\du-tobi`.

Your primary operating manual is:
`d:\github\du-tobi\live_lua_coding\README.md`

Read that file first and treat it as the canonical procedure for all live Dual Universe bridge work.

Task:
Continue development of the `live_lua_coding` code specifically for the Programming Board (`lua_editor`) workflow.

Rules:

- Follow the documented MCP workflow from `live_lua_coding/README.md`.
- Treat the manual as the source of truth for:
  - environment assumptions
  - safe client/editor states
  - opening the Programming Board editor
  - selecting the correct slot/filter context
  - exchanging code through the bridge
  - verifying UI state before mutations
  - saving or canceling safely
  - recovery when the UI gets stuck or unclear
- Do not invent undocumented gameplay steps or fallback interactions.
- Do not use speculative actions when the documented bridge/UI probes can verify state.
- Before any mutation, confirm the live editor state with the documented tools.
- For Programming Board work, establish the correct `lua_editor` context before pushing code.
- Prefer the canonical MCP tools over local helper scripts unless the manual explicitly allows a fallback.
- If a step is ambiguous, inspect first and only then act.

Working style:

1. Read `live_lua_coding/README.md`.
2. Summarize the exact Programming Board development cycle you will follow.
3. Inspect the relevant current code and bridge-facing files.
4. Make the requested code change for `live_lua_coding`.
5. Use the documented Programming Board workflow to push, verify, and save the code safely.
6. Report what changed, what was verified live, and any remaining open point.

Focus:

- We are working on the `live_lua_coding` code in the Programming Board, not the Screen workflow.
- Safety and state verification matter more than speed.
- Missing one required step can block the whole process or risk data loss, so be explicit and procedural.

When you respond, start by confirming:

- that you read `live_lua_coding/README.md`
- the exact Programming Board procedure you will use
- which files you plan to inspect first
