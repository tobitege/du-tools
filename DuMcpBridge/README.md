# DuMcpBridge

`DuMcpBridge` is a local MCP server that turns the existing Dual Universe modding pipeline into a bidirectional bridge.

Its job is intentionally narrow:

- accept MCP tool calls from a local agent or editor
- write bridge commands into a file bus
- let `ModUiExtractor` consume those commands inside the game pipeline
- let injected JavaScript operate on the live UI
- receive structured events back from the game client
- expose those results again through MCP tools and resources

In short, `DuMcpBridge` is the transport layer between local automation and the live in-game editor UI.

## Purpose

The bridge exists so that an external programming workflow can do all of the following:

- inspect the currently open Dual Universe Lua editor
- inject code into the open editor
- save code through the live game UI
- receive structured results from Lua-side runtime helpers
- stream those results into the external logger immediately

The design goal is not to make the MCP server “smart”.
The MCP server should remain mostly a transporter.
The UI-specific intelligence belongs in runtime JavaScript that executes inside the actual game UI.

## High-Level Architecture

The current bridge is split into three layers:

1. `DuMcpBridge`
   A local MCP server that exposes tools and resources.

2. `ModUiExtractor`
   The in-game bridge that reads queued commands, injects JavaScript into the HUD client, and writes structured events back out.

3. Lua runtime probe
   A JavaScript probe injected into the Lua editor UI. It can describe the live editor state and perform targeted UI actions without screenshot clicking.

## End-to-End Flow

```text
MCP client
  -> DuMcpBridge
  -> D:\MyDUserver\tmp\ui-dumps\mcp-bridge\commands\*.json
  -> ModUiExtractor
  -> injected JavaScript inside the live Dual Universe UI
  -> D:\MyDUserver\tmp\ui-dumps\mcp-bridge\events\bridge-events.ndjson
  -> DuMcpBridge / logmgr
```

## Current Scope

The current implementation supports:

- MCP over `stdio`
- a file-based command/event bus under `D:\MyDUserver\tmp\ui-dumps\mcp-bridge`
- code push and save commands for active editors
- active code snapshots and last-result lookup
- runtime log tailing
- a Lua runtime-probe API for the open Lua editor

Current in-game targets:

- `lua_editor`
- `screen_editor`

## Runtime Layout

Primary bridge directories:

- `D:\MyDUserver\tmp\ui-dumps\mcp-bridge\commands\`
- `D:\MyDUserver\tmp\ui-dumps\mcp-bridge\events\`
- `D:\MyDUserver\tmp\ui-dumps\mcp-bridge\state\`

Meaning:

- `commands/`
  queued JSON command files for the game-side consumer
- `events/`
  structured NDJSON events written by the bridge and the mod
- `state/`
  snapshots used for pull/read operations

Legacy paths still used by the Lua workflow:

- `D:\MyDUserver\tmp\ui-dumps\payload-overrides\ide_import.json`
- `D:\MyDUserver\tmp\ui-dumps\ide-workspace\snippet.lua`

Lua probe override path:

- `D:\MyDUserver\tmp\ui-dumps\payload-overrides\lua-editor-probe.modules\`

## Components

### `DuMcpBridge`

Main responsibility:

- accept MCP calls
- validate inputs
- enqueue commands
- read bridge events
- expose structured outputs to the MCP client

Relevant files:

- [server.ts](/d:/github/du-tobi/DuMcpBridge/src/server.ts)
- [editorTools.ts](/d:/github/du-tobi/DuMcpBridge/src/tools/editorTools.ts)
- [logTools.ts](/d:/github/du-tobi/DuMcpBridge/src/tools/logTools.ts)
- [sessionResources.ts](/d:/github/du-tobi/DuMcpBridge/src/resources/sessionResources.ts)
- [commandQueue.ts](/d:/github/du-tobi/DuMcpBridge/src/bridge/commandQueue.ts)
- [eventStore.ts](/d:/github/du-tobi/DuMcpBridge/src/bridge/eventStore.ts)

### `ModUiExtractor`

Main responsibility:

- poll the bridge command folder
- translate bridge commands into injected JavaScript
- call into the active game UI
- receive probe packets back from the client
- write bridge events into `bridge-events.ndjson`

Relevant file:

- [ModUIExtractor.cs](/d:/github/du-tobi/ModUiExtractor/ModUIExtractor.cs)

### Lua runtime probe

Main responsibility:

- inspect the live Lua editor UI at runtime
- select slots and filters by live DOM state
- set code through live editor APIs
- apply changes through the actual in-game editor
- report structured results back to the bridge

Relevant files:

- [035-lua-mcp-runtime.js](/d:/github/du-tobi/ModUiExtractor/payload/lua-editor-probe.modules/035-lua-mcp-runtime.js)
- [manifest.txt](/d:/github/du-tobi/ModUiExtractor/payload/lua-editor-probe.modules/manifest.txt)

## Requirements

The bridge only works if all of the following are true:

- `DuMcpBridge` is running locally
- `ModUiExtractor.dll` is deployed and loaded by the game server
- the player is online
- the target editor UI is already open in-game

Important behavioral rules:

- `du_editor_push_code` does not open editors by itself
- `du_editor_save` also assumes the target UI is already open
- `waitForEditor` only waits for the UI to appear
- `waitForEditor` does not open the editor
- `screen_editor` is still bound only to the currently open active UI
- `boardId` is not yet enforced as a verified in-game board identity

For newly added MCP tools after a rebuild, the MCP host must be reloaded so the tool inventory updates.

## Build

```powershell
cd D:\github\du-tobi\DuMcpBridge
npm install
npm run build
```

## Start

```powershell
npm run start
```

## Windows MCP Launcher

For Windows MCP hosts, the repo includes:

- [run-mcp.cmd](/d:/github/du-tobi/DuMcpBridge/run-mcp.cmd)

This wrapper changes into the project directory and starts `node dist\server.js`.
It exists because some MCP host UIs do not reliably preserve the configured working directory on Windows.

## In-Game Behavior

### `lua_editor`

When a command targets `lua_editor`, `ModUiExtractor` currently tries the following in order:

1. `window.__UI_EXTRACTOR_LUA_PROBE_STATE__.applyIdeCode(code)`
2. fallback to `LUAEditorManager.getLuaEditor().setValue(code)`
3. if `save: true`, call `LUAEditorManager.apply()`

This is the same base path already used by the existing IDE sync workflow.

### `screen_editor`

When a command targets `screen_editor`, `ModUiExtractor` works against:

- `window.screenContentEditorPanel`
- `panel.textEditor.value`
- the optional HTML/Lua mode switch
- `CPPScreenContentEditor.save(...)` when save is requested

If `waitForEditor: true` is enabled, the mod retries until the editor UI appears or the retry budget is exhausted.

### Lua runtime probe

The Lua runtime probe adds a more dynamic path for the Lua editor.

Instead of hardcoding editor logic into the MCP server, the runtime probe lets the live UI describe itself and execute targeted UI actions.

The runtime probe attaches its API to:

- `window.__UI_EXTRACTOR_LUA_PROBE_STATE__.mcp`

Currently supported probe methods:

- `describe`
- `select_slot`
- `select_filter`
- `set_code`
- `apply`

The probe emits `lua_mcp_result` packets.
`ModUiExtractor` converts those packets into bridge events of type `probe_result`.

This means the final roundtrip is:

```text
MCP tool call
  -> bridge command
  -> injected probe call
  -> live Lua editor UI action
  -> lua_mcp_result packet
  -> probe_result event
  -> MCP response
```

## Command Model

Bridge commands are written as JSON files into `commands/`.

Typical shape:

```json
{
  "commandId": "cmd-123",
  "createdAtUtc": "2026-03-19T12:00:00Z",
  "playerId": 10000,
  "target": {
    "kind": "lua_editor",
    "boardId": null
  },
  "action": "probe_call",
  "payload": {
    "probeMethod": "describe",
    "probeArgs": []
  }
}
```

Supported actions today:

- `set_code`
- `save`
- `probe_call`

## Event Model

Bridge events are written into:

- `D:\MyDUserver\tmp\ui-dumps\mcp-bridge\events\bridge-events.ndjson`

Currently relevant event types:

- `bridge_status`
- `command_enqueued`
- `command_result`
- `probe_result`

Typical `command_result` payload:

```json
{
  "commandId": "cmd-123",
  "status": "injected",
  "action": "probe_call",
  "summary": "lua_editor probe_call describe"
}
```

Typical `probe_result` payload:

```json
{
  "commandId": "cmd-123",
  "method": "describe",
  "success": true,
  "result": {
    "visible": true,
    "title": "Lua editor - Programming board xs [55]",
    "selectedSlot": "library",
    "selectedFilter": "onStart"
  },
  "error": null
}
```

## MCP Tools

### `du_editor_push_code`

Purpose:

- queue code injection into the currently open active editor
- optionally save immediately afterward

Inputs:

- `playerId`
- `targetKind`
- `code`
- `save`
- `boardId`
- `isHtmlMode`
- `waitForEditor`
- `maxAttempts`
- `retryDelayMs`

Behavior:

1. `DuMcpBridge` writes a command file
2. `ModUiExtractor` picks it up
3. the mod injects JavaScript into the player HUD client
4. the live editor is updated
5. a `command_result` event is written back

Return fields:

- `commandId`
- `status`
- `targetKind`
- `playerId`
- `queuePath`
- `saveRequested`
- `waitForEditor`
- `maxAttempts`
- `retryDelayMs`

Important:

- this only works against an already open UI
- it does not guarantee a verified board identity for `screen_editor`

### `du_lua_probe_call`

Purpose:

- call a targeted runtime function inside the open Lua editor UI
- wait briefly for the matching structured result

Inputs:

- `playerId`
- `method`
- `slotName`
- `filterEvent`
- `code`
- `timeoutMs`

Supported methods:

- `describe`
- `select_slot`
- `select_filter`
- `set_code`
- `apply`

Behavior:

1. `DuMcpBridge` queues `action = probe_call`
2. `ModUiExtractor` injects `window.__UI_EXTRACTOR_LUA_PROBE_STATE__.mcp.invoke(...)`
3. the probe executes against the live Lua editor
4. the probe emits `lua_mcp_result`
5. `ModUiExtractor` writes a `probe_result`
6. `DuMcpBridge` waits for that result and returns it

Return fields:

- `found`
- `commandId`
- `method`
- `success`
- `createdAtUtc`
- `resultJson`
- `error`

### Verified probe results (live session example)

These shapes were verified end-to-end with `playerId = 10000`, `DuMcpBridge` writing `mcp-bridge/commands/*.json`, and `ModUiExtractor` appending matching rows to `mcp-bridge/events/bridge-events.ndjson`. `commandId` values are unique per call.

- **`select_slot`** — requires `slotName`. On success, `result` is a full editor snapshot (same fields as `describe`): `visible`, `title`, `wrapLines`, `canApply`, `codeLength`, `selectedSlot`, `selectedFilter`, `slots[]`, `filters[]`.
- **`set_code`** — requires `code`. This replaces the **entire** editor buffer (`LUAEditorManager.setCodeLuaEditor`, with IDE-import fallback). For quick tests, use a slot that is empty or disposable (for example `system` when `codeLength` is `0`) so you do not overwrite a large `library` script by mistake.
- **`apply`** — calls `LUAEditorManager.apply()`. On success, `result` is only `{"applied": true}` (no repeated `describe` snapshot in the probe result).

**`visible` caveat:** snapshots use a DOM visibility heuristic (`display`, `offsetParent`). After some slot or filter transitions, `visible` can read `false` while the editor is still open; treat `title`, `selectedSlot`, and `slots` as the primary signals.

This tool is the first concrete step toward a “transport-only” MCP server with runtime UI intelligence in the probe.

### `du_editor_pull_code`

Purpose:

- read the last known code snapshot for a session

Lookup order:

1. `state/{targetKind}-{playerId}.json`
2. for `lua_editor`, also `ide-workspace/snippet.lua`
3. for `lua_editor`, also `payload-overrides/ide_import.json`

Return fields:

- `found`
- `targetKind`
- `playerId`
- `code`
- `source`
- `path`
- `lastModifiedUtc`

This reads the last known snapshot. It does not force a fresh export from the game client.

### `du_editor_save`

Purpose:

- queue a save action for the active editor

Inputs:

- `playerId`
- `targetKind`
- `boardId`
- `waitForEditor`
- `maxAttempts`
- `retryDelayMs`

Behavior:

- for `lua_editor`, the mod calls `LUAEditorManager.apply()`
- for `screen_editor`, the mod calls `CPPScreenContentEditor.save(...)`

This only makes sense when the target editor UI is already open.

### `du_get_last_result`

Purpose:

- return the latest matching bridge event

Filters:

- `playerId`
- `targetKind`
- `eventType`

Source:

- `bridge-events.ndjson`

### `du_tail_runtime_logs`

Purpose:

- return recent runtime and bridge lines

Included event types:

- `runtime_log`
- `command_result`
- `bridge_status`

### `du_list_active_sessions`

Purpose:

- list currently known bridge sessions

Sources:

- recent bridge events
- legacy fallback from `ide_import.json`

## MCP Resources

### `du://session/{playerId}/active-code`

Returns the latest known code snapshot for that session.

### `du://session/{playerId}/last-result`

Returns the latest known bridge event for that session.

### `du://session/{playerId}/runtime-log`

Returns recent runtime and bridge lines for that session.

## Why the Runtime Probe Matters

The runtime probe is the key architectural shift.

Without it, the bridge is limited to:

- dumping static files
- pushing plain code into the active editor
- reacting after the fact

With the runtime probe, the bridge can:

- describe the live UI state
- inspect selected slots and filters
- navigate by semantic names instead of pixel positions
- act on the actual editor widgets and manager objects

That is why the preferred long-term direction is:

- keep `DuMcpBridge` simple
- move editor-specific behavior into the runtime probe
- use structured events as the shared contract

## Logging

`logmgr` can read bridge events from:

- `D:\MyDUserver\tmp\ui-dumps\mcp-bridge\events`

The registered source name is:

- `ui-mcp-bridge`

That makes command results and probe results visible outside the game immediately.

## Verified Status

Verified locally:

- `npm run build` in `DuMcpBridge`
- `dotnet build -c Release -nologo -v:minimal` in `ModUiExtractor`
- `pwsh -ExecutionPolicy Bypass -File tools/build-lua-probe.ps1`

Verified live:

- a manual `probe_call describe` for `playerId = 10000`
- successful `command_result`
- successful `probe_result`
- returned Lua editor snapshot including:
  - `visible = true`
  - `selectedSlot = library`
  - `selectedFilter = onStart`
  - the visible slot list
  - the visible filter list

## Current Limitations

- the bridge does not open editor windows on its own
- `screen_editor` still depends on the user having the correct editor UI open
- `boardId` is not yet enforced as a verified board selection
- `du_editor_pull_code` returns the last known snapshot, not necessarily the exact live editor state
- newly added MCP tools require an MCP host reload after rebuild
- newly added probe modules require the override folder to contain the updated module set

## Recommended Next Steps

The next practical validation steps are:

1. test `select_slot`
2. test `set_code`
3. test `apply`
4. expose the new runtime-probe path through the active MCP host tool inventory
5. add more runtime-probe methods only after the current contract is stable

The guiding principle should stay the same:

- MCP server as transport
- runtime JavaScript as UI intelligence
- structured events as the contract between both sides
