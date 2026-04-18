# DuMcpBridge

This doc contains all the technical details and is mainly aimed for maintainers, contributors, and AI assistants.

## Current Scope

The current implementation supports:

- MCP over `stdio`
- a file-based command/event bus under `D:\MyDUserver\tmp\ui-dumps\mcp-bridge`
- code push and save commands for active editors
- full UI dump via `du_ui_dump` with targeted `htmlSelector` extraction
- active code snapshots and last-result lookup
- runtime log tailing
- a Lua runtime-probe API for the open Lua editor
- a compact generic UI probe surface built around `du_ui_describe`, `du_ui_invoke`, and `du_ui_wait`
- a dedicated post-bootstrap reinject path for the Lua probe via `du_reinject_lua_probe`
- a chat snapshot path from the active HUD chat into bridge events
- a mention inbox that returns only `@ai` messages (case-insensitive)
- an explicit opt-in server-side chat snapshot path (`server_chat`) for multi-channel reads without the visible HUD tab restriction
- channel-bound chat sending through the real HUD send path
- custom channel create/join through the same `/join <name>` path as the HUD dialog
- read-only construct inspection through `construct_inspector`
- deterministic server-side construct/storage and industry operations through `toolbox_ops`

Current in-game targets:

- `lua_editor`
- `screen_editor`
- `hud_chat`
- `server_chat` (opt-in read path; no UI injection)
- `industry_panel` (payload-backed live panel path)
- `construct_inspector` (server-side construct read path)
- `toolbox_ops` (server-side storage and industry operation path)

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
- `events/archive/`
  rotated or reset bridge-event files moved out of the active scan path
- `state/`
  snapshots used for pull/read operations

IDE-sync paths used by the Lua workflow:

- `D:\MyDUserver\tmp\ui-dumps\payload-overrides\ide_import.player-<playerId>.lua_editor.json`
- `D:\MyDUserver\tmp\ui-dumps\ide-workspace\player-<playerId>\lua_editor\snippet.lua`
- `D:\MyDUserver\tmp\ui-dumps\ide-workspace\player-<playerId>\lua_editor\snippet.json`

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

- [server.ts](src/server.ts)
- [editorTools.ts](src/tools/editorTools.ts)
- [constructTools.ts](src/tools/constructTools.ts)
- [storageTools.ts](src/tools/storageTools.ts)
- [logTools.ts](src/tools/logTools.ts)
- [sessionResources.ts](src/resources/sessionResources.ts)
- [commandQueue.ts](src/bridge/commandQueue.ts)
- [eventStore.ts](src/bridge/eventStore.ts)

### Lua runtime MCP API

Main responsibility:

- inspect the live Lua editor UI at runtime
- select slots and filters by live DOM state
- set code through live editor APIs
- apply changes through the actual in-game editor
- report structured results back to the bridge

Relevant files are in "../ModUiToolbox/payload/lua-editor-probe.modules/" folder.

## Requirements

The bridge only works if all of the following are true:

- `DuMcpBridge` is running locally
- `ModUiToolbox.dll` is deployed and loaded by the game server
- the player is online
- the target editor UI is already open in-game

Important behavioral rules:

- `du_editor_push_code` does not open editors by itself
- `du_editor_save` also assumes the target UI is already open
- hidden `lua_editor` state is treated as stale cache and must not be used as live editor content
- `screen_editor` is still bound only to the currently open active UI
- hidden `screen_editor` state is treated as stale cache and must not be used as live board content
- `boardId` is not yet enforced as a verified in-game board identity
- the workspace snippet is valid only when `snippet.lua|snippet.txt` and `snippet.json` both exist as a pair
- `snippet.json` is the minimal workspace sidecar and carries `context`, `syncId`, and `updatedAtUtc`
- if the pair is missing or invalid, `du_editor_pull_code` returns `reason`, `message`, and `nextStep` instead of silently trusting the snippet

## Visual Verification Fallback

For live DU sessions, an external Windows screenshot MCP server such as `ScreenShotNet` is a useful fallback next to `DuMcpBridge`.

Recommended use:

- use `capture_window_screenshot` for the `Dual Universe` window when you need to confirm what the player actually sees
- use it before native input steps like `du_open_editor_native` if the in-game state is unclear
- use it right after opening an editor or after `apply` when the visible result matters more than the last structured probe response

Important limits:

- do not use screenshots as the primary automation path when a structured probe/tool result already answers the question
- do not capture at every step; image payloads are much larger than normal bridge events and slow down the workflow
- keep `DuMcpBridge` as the main control path and treat screenshots as a targeted reality check for the visible client state

## Transfer Contract

Editor content transfer now has exactly one supported write path:

1. local source file in the workspace
2. `du_editor_push_code` with `sourcePath`
3. bridge writes the player-/target-scoped workspace snapshot plus `ide_import.player-<playerId>.<targetKind>.json`
4. `ModUiToolbox` injects `applyIdeImport(payload)` into the live UI
5. the probe validates target/context/reference metadata and emits `ide_import_result`

Important consequences:

- no inline editor content in MCP tool arguments
- no bridge `action = set_code` write path for editor content
- no public probe `set_code` write path through `du_ui_invoke`
- `du_editor_save` stays a separate explicit step
- if the correct editor, slot, or filter is not live yet, the import stays on the file path and is retried by the existing IDE-sync contract
- reusable live board artifacts must live on a tracked repo path such as `live_lua_coding/`, not in untracked or temporary folders

For newly added MCP tools after a rebuild, the MCP host must be reloaded so the tool inventory updates.

## Build

```powershell
cd .\DuMcpBridge
npm install
npm run build
```

Useful environment knobs for bridge-event retention and scanning:

- `DU_MCP_BRIDGE_EVENT_FILE_MAX_BYTES`
  max active bridge-event file size before rollover, default `524288` (`512 KB`)
- `DU_MCP_BRIDGE_EVENT_RETENTION_DAYS`
  active/archive event retention, default `3`
- `DU_MCP_BRIDGE_PROCESSED_COMMAND_RETENTION_DAYS`
  processed command retention, default `3`
- `DU_MCP_BRIDGE_MAX_EVENT_FILES_SCANNED`
  newest active event files scanned by the reader, default `12`

## Start

```powershell
npm run start
```

## Windows MCP Launcher

For Windows MCP hosts, the repo includes:

- [run-mcp.cmd](run-mcp.cmd)

This wrapper changes into the project directory and starts `node dist\server.js`.
It exists because some MCP host UIs do not reliably preserve the configured working directory on Windows.

## In-Game Behavior

### `lua_editor`

For editor content, `lua_editor` now accepts only the file-based IDE import path:

1. `DuMcpBridge` stages `ide_import.player-<playerId>.lua_editor.json`
2. `ModUiToolbox` injects `window.__UI_TOOLBOX_LUA_PROBE_STATE__.applyIdeImport(payload)`
3. the probe validates target/context/reference metadata and emits `ide_import_result`
4. a later explicit `du_editor_save` calls `LUAEditorManager.apply()`

Inline `set_code` write paths are intentionally rejected on this target.

Important scope note:

- this path assumes the Lua editor is already open in the client
- when the editor is not visible, `describe` returns a safe empty snapshot
- editor-mutating methods such as `select_slot`, `select_filter`, `add_filter`, and `apply` reject with `lua_editor_not_visible`

### `screen_editor`

For editor content, `screen_editor` now also uses only the file-based IDE import path plus explicit save:

- `window.screenContentEditorPanel`
- the live `.CodeMirror` instance when the editor is visible
- `panel.textEditor.value` / hidden textarea only as a compatibility fallback while the editor is visible
- `CPPScreenContentEditor.save(...)` when save is requested
- the same injected probe surface for `describe`, `apply`, `outer_html`, `raw_eval`
- the same IDE-sync packet path as the Lua editor, now with `targetKind = screen_editor`

Important scope note:

- this path assumes the screen editor is already opening or open in the client
- when the editor is not visible, `describe` returns a safe empty snapshot and `apply` rejects with `screen_editor_not_visible`
- when visible, the injected probe now applies the same shared runtime theming state to `screen_editor` as the Lua editor and themes the content header panel as well; the visible controls are owned by the separate `theming` runtime module, and this remains probe-side UI logic, not MCP-side state
- when visible, the probe also adds its own `IDE Sync` button to the top control row; export goes to `ide-workspace/player-<playerId>/screen_editor/snippet.txt`, and file edits flow back through `payload-overrides/ide_import.player-<playerId>.screen_editor.json`
- when visible, the probe also remembers and restores the screen editor viewport per screen context (`title + subTitle + mode`): top line plus caret line/column return automatically when the same screen is reopened during the active probe session
- opening or toggling a screen through gameplay hotkeys such as `Ctrl+L` or `F` is not currently exposed through MCP
- the generic `du_ui_*` probe envelope now supports `screen_editor` for `describe`, `apply`, `cancel`, `outer_html`, `raw_eval`
- slot/filter/chat methods remain `lua_editor`-only

For the Lua editor IDE-sync path, the runtime probe now blocks file transfer when no filter is actively selected.
That means:

- no `IDE Sync` export from the Lua editor when `selectedFilter = null`
- no IDE import apply into the Lua editor when no filter is active
- the intended workflow is: first confirm slot + filter, then transfer code
- after a slot switch, the client can rebuild the FILTERS panel asynchronously; low-level automation should therefore not guess immediately from stale rows
- preferred MCP path for live work is now `du_ui_invoke(uiKind = lua_editor, method = select_context)`: confirm slot, wait at least 1 second, then resolve the visible filter by name/signature
- that name/signature resolution is only deterministic when the slot has exactly one visible match; duplicate handlers such as two `onStart()` rows are still ambiguous by design
- the probe now keys live Lua contexts from the active manager slot/filter identity instead of the older generic label path, so viewport restore and filter tracking follow the real active filter more closely
- probe-driven slot clicks now dispatch the same mouse sequence as a real user click so the enhancement code can arm slot auto-open and viewport capture on `mousedown`

### Lua runtime probe

The Lua runtime probe adds a more dynamic path for the Lua editor.

Instead of hardcoding editor logic into the MCP server, the runtime probe lets the live UI describe itself and execute targeted UI actions.

The runtime probe attaches its API to:

- `window.__UI_TOOLBOX_LUA_PROBE_STATE__.mcp`

Currently supported probe methods:

- `describe`
- `list_filters`
- `select_slot`
- `select_context`
- `select_filter`
- `select_filter_index`
- `apply`
- `add_filter`
- `outer_html`
- `raw_eval` (trusted-debug only: arbitrary JS body with parameter `state`)

Current runtime caveat:


The dedicated MCP chat tools still use the runtime probe internally, but they now run against the distinct `hud_chat` bridge target instead of piggybacking on `lua_editor`. Chat methods are not exposed through the generic `du_ui_invoke` method enum.

The probe emits `lua_mcp_result` packets for editor actions plus `chat_snapshot`, `chat_send_result`, and `chat_channel_result` packets for chat-specific actions.
`ModUiToolbox` converts those packets into bridge events of type `probe_result`, `chat_snapshot`, `chat_send_result`, and `chat_channel_result`.

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

For chat snapshots, the roundtrip is:

```text
du_chat_snapshot
  -> bridge command
  -> injected probe call
  -> live HUD chat snapshot
  -> chat_snapshot packet
  -> chat_snapshot event
  -> MCP response
```

For chat sending, the roundtrip is:

```text
du_chat_send_message
  -> bridge command
  -> injected probe call
  -> live HUD chat send path
  -> chat_send_result packet
  -> chat_send_result event
  -> MCP response
```

For custom channel create/join, the roundtrip is:

```text
du_chat_create_channel
  -> bridge command
  -> injected probe call
  -> live HUD "/join <name>" path
  -> chat_channel_result packet
  -> chat_channel_result event
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

- `save`
- `probe_call`
- `ui_dump`

## Event Model

Bridge events are written into:

- `D:\MyDUserver\tmp\ui-dumps\mcp-bridge\events\bridge-events-YYYYMMDD.ndjson`
- rollover files for the same UTC day use `bridge-events-YYYYMMDD-001.ndjson`, `-002`, and so on
- the active event reader ignores `events/archive/` and reads only the newest active files in `events/`

Current rollover / retention behavior:

- both `DuMcpBridge` and `ModUiToolbox` append into UTC-dated bridge-event files
- active files roll over at `512 KB`
- the bridge reader scans newest-first and stops after enough recent events have been collected
- reset/rotate operations move old files into `events/archive/` so they stop inflating normal MCP reads
- housekeeping can also prune old files from `events/`, `events/archive/`, and `state/processed-commands/`

Currently relevant event types:

- `bridge_status`
- `command_enqueued`
- `command_result`
- `probe_result`
- `chat_snapshot`
- `chat_send_result`
- `chat_channel_result`
- `server_chat_snapshot`

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

Typical `chat_snapshot` payload:

```json
{
  "commandId": "cmd-456",
  "snapshot": {
    "visible": true,
    "open": false,
    "source": "chat_manager",
    "selectedChannelId": "0",
    "selectedChannelName": "General",
    "messageCount": 1,
    "messages": [
      {
        "fromName": "tobitege",
        "text": "Hallo"
      }
    ]
  }
}
```

## MCP Tools

### `du_open_lua_context`

Purpose:

- open the Programming Board Lua editor if needed
- wait for a real live Lua editor snapshot
- select the requested slot and filter
- return the final verified live context

Inputs:

- `playerId`
- `slotName`
- `filterName`
- `settleMs`
- `timeoutMs`
- `probeTimeoutMs`
- `activateWindow`
- `windowTitle`
- `ahkPath`

Behavior:

1. checks whether `lua_editor` is already visibly open and usable
2. if not, sends the native `Ctrl+L` open path
3. waits for a live Lua-editor snapshot
4. if the first open path fails, performs one guarded `Escape` recovery and retries
5. runs `select_context` with the requested slot/filter
6. returns the final verified slot/filter state from the live probe

Important:

- this is now the preferred open path for normal Programming Board Lua work
- it replaces the routine `open -> describe -> select_context -> describe` tool chain
- it does not save anything by itself

### `du_push_lua_context_code`

Purpose:

- open the requested Programming Board Lua context if needed
- stage a tracked local source file into that exact slot/filter
- verify that the visible live buffer matches the expected file hash

Inputs:

- `playerId`
- `sourcePath`
- `slotName`
- `filterName`
- `settleMs`
- `timeoutMs`
- `probeTimeoutMs`
- `verifyTimeoutMs`
- `verifyPollIntervalMs`
- `activateWindow`
- `windowTitle`
- `ahkPath`

Behavior:

1. calls the same deterministic open/select path as `du_open_lua_context`
2. stages the IDE import against the verified live Lua context
3. polls the visible editor buffer through `raw_eval`
4. compares the live buffer hash and length to the staged source file
5. returns only when the visible buffer matches or the verify timeout expires

Important:

- this is now the preferred push path for normal Programming Board Lua work
- a successful return means more than "staged"; it means the visible buffer matched the expected source hash
- saving is still explicit; use `du_editor_save` separately after the verified push if you want to commit the change

### `du_editor_push_code`

Purpose:

- stage editor content through the file-based IDE import contract

Inputs:

- `playerId`
- `targetKind`
- `sourcePath`

Behavior:

1. `DuMcpBridge` reads the local source file
2. `DuMcpBridge` writes the player-/target-scoped workspace snapshot
3. `DuMcpBridge` writes `ide_import.player-<playerId>.<targetKind>.json`
4. `ModUiToolbox` picks up that import file and injects `applyIdeImport(payload)`
5. the live probe validates the active target and acks with `ide_import_result`

Return fields:

- `requestId`
- `status`
- `targetKind`
- `playerId`
- `sourcePath`
- `workspacePath`
- `metadataPath`
- `importPath`
- `codeCharLength`
- `codeUtf8Bytes`
- `codeHash32`
- `codeSha256`
- `hasContextMetadata`
- `contextSource`

Important:

- this only works against an already open and correctly targeted UI
- it does not guarantee a verified board identity for `screen_editor`
- for normal Programming Board Lua work, prefer `du_push_lua_context_code`
- saving is not implicit; use `du_editor_save` separately after the import path has landed

### Compact Tool Model

The live MCP surface is intentionally centered on a small set of tool families:

- `du_ui_describe`, `du_ui_invoke`, `du_ui_wait`
  Canonical live UI read, action, and readiness paths for `lua_editor` and `screen_editor`.
- `du_open_lua_context`, `du_push_lua_context_code`
  Preferred high-level Programming Board Lua workflow tools for deterministic open/select and open/push/verify behavior.
- `du_reinject_lua_probe`
  Stable post-bootstrap reinject path for an already-present Lua probe. Uses the live page's own `CPPMod.sendModAction(...)` path instead of menu clicks.
- `du_editor_push_code`, `du_editor_pull_code`, `du_editor_save`
  File-based IDE import, last-known snapshot reads, and explicit save/apply.
- `du_ui_dump`
  Full UI dump via ModUiToolbox (chunked NDJSON). Supports full-document dumps and `htmlSelector` fragment dumps with explicit completeness metadata.
- `du_chat_*`
  Dedicated chat read/write helpers that add structured semantics beyond a raw probe result.
- `du_camera_move`
  The single native entry point for explicit in-world camera steering through relative `x` / `y` movement.
- `du_send_key_native`
  The native key-send entry point for a small supported whitelist such as `F`, `Escape`, function keys, and `Ctrl+L`.
- `du_open_editor_native`
  The single native entry point for opening supported element editors through `Ctrl+L`.
- `du_get_last_result`, `du_tail_runtime_logs`, `du_list_active_sessions`
  Observability and session discovery.
- `du_bridge_events_status`, `du_bridge_events_housekeeping`
  Bridge-event observability and explicit file maintenance.

Wrapper tools such as `du_lua_*` and `du_ui_eval_raw` are intentionally no longer part of the public surface. The generic UI path now owns the semantics that mattered in practice:

- `du_ui_invoke(uiKind = lua_editor, method = select_context)` now uses `slotName`, `filterName`, and `settleMs` directly and stretches the timeout budget to cover the settle delay.
- If a caller passes a very short `settleMs`, the bridge now clamps it to its safe minimum instead of rejecting the tool call. The wait still happens inside the bridge.
- `du_ui_invoke(uiKind = screen_editor, method = cancel)` keeps the one correct current live exit path: probe cancel first, then delayed native `Escape` cleanup.
- `du_editor_save(targetKind = screen_editor)` now performs the same delayed native `Escape` cleanup after the save command has been injected, so the close path does not leave the client stuck with mouse capture.

### `du_ui_describe`

Purpose:

- read the current live UI snapshot for `lua_editor` or `screen_editor`

Inputs:

- `uiKind`
- `playerId`
- `timeoutMs`

Behavior:

- queues `probe_call describe`
- returns the raw structured snapshot from the live probe

### `du_ui_invoke`

Purpose:

- run the canonical live UI action path for `lua_editor` or `screen_editor`

Inputs:

- `uiKind`
- `playerId`
- `method`
- method-specific fields:
  - `slotName` for `select_slot` or `select_context`
  - `filterName` for `select_filter`, `select_context`, or `add_filter`
  - `filterIndex` for `select_filter_index`
  - `settleMs` for `select_context`
  - `selector` for `outer_html`
  - `functionBody` for `raw_eval`
  - `timeoutMs`

Supported methods today:

- `lua_editor`: `describe`, `list_filters`, `select_slot`, `select_context`, `select_filter`, `select_filter_index`, `apply`, `add_filter`, `outer_html`, `raw_eval`
- `screen_editor`: `describe`, `apply`, `cancel`, `outer_html`, `raw_eval`

Important built-in semantics:

- `select_context` is the preferred Lua-editor workflow because it confirms the slot, waits at least `settleMs`, then resolves the visible filter by real name/signature.
- For Lua context tools, `settleMs` is a requested delay, not a sharp lower-bound contract. Short values are accepted and raised internally to the bridge minimum.
- `select_slot` now drives a full mouse sequence and waits for the slot transition to settle. If the slot has filters, the enhancement path is allowed to auto-open the active filter before the probe returns.
- `select_context` still cannot safely guess between duplicate visible names in the same slot. In those cases use `select_filter_index` or inspect the live manager filter list first.
- `cancel` on `screen_editor` automatically performs the required native cleanup after the probe close. This is not an optional flag.
- `raw_eval` remains a trusted-debug escape hatch only.

### `du_ui_wait`

Purpose:

- poll `describe` until the chosen UI looks ready

Inputs:

- `uiKind`
- `playerId`
- `maxWaitMs`
- `pollIntervalMs`
- `timeoutMs`
- `requireVisible`

Behavior:

- polls `du_ui_describe` semantics with target-specific readiness checks for `lua_editor` and `screen_editor`

### `du_reinject_lua_probe`

Purpose:

- tell an already-injected Lua probe page to reinject itself without reopening the context menu

Inputs:

- `playerId`
- `openEditorAfter`
- `timeoutMs`
- `reopenDelayMs`
- `reopenTimeoutMs`
- `activateWindow`
- `ahkPath`
- `windowTitle`

Behavior:

- runs a trusted `raw_eval` against `lua_editor`
- reads `window.__UI_TOOLBOX_LUA_PROBE_CONFIG`
- calls `window.CPPMod.sendModAction(modName, injectActionId, [], "")`
- optionally reopens the Lua editor through the existing native `Ctrl+L` helper and returns the follow-up describe snapshot

Important scope note:

- this is a post-bootstrap path only
- it works only when a Lua probe is already present on the current page
- it is the preferred reinject workflow after JS/module edits because it does not depend on menu geometry, window size, or submenu hover behavior
- the very first probe injection for a fresh page/construct still has to happen through the in-game action menu

### `du_ui_dump`

Purpose:

- queue a full UI dump via ModUiToolbox (Action 1/2)
- outputs chunked NDJSON to `tmp/ui-dumps/`
- use `htmlSelector` to target a specific DOM element instead of the full document
- useful for extracting the F1/Help codex or other overlay UIs

Inputs:

- `playerId`
- `deep` (default `true`): deep mode captures more stylesheets/scripts
- `initialDelayMs` (default `0`): delay before dump starts (e.g. 3000ms to wait for F1/Help to load)
- `htmlSelector` (default `""`): CSS selector to target a specific element (e.g. `"#dashboard_panel"`)

Behavior:

1. `DuMcpBridge` queues `action = ui_dump` with config
2. `ModUiToolbox` injects the extractor payload with `htmlSelector` support
3. the payload collects HTML, stylesheets, scripts, and metadata in chunks without silently clipping the HTML section first
4. results are written to `tmp/ui-dumps/ui-<id>.ndjson`
5. use `reassemble-ui-dump.ps1` to reassemble into `reassembled/<id>/`

After reassembly, the HTML is split by `body` root elements into `html/*.html` files.
`manifest.json` now records per-section completeness, truncation flags, source kind (`document` vs `fragment`), selector info, and length comparisons.
`check-ui-dump.ps1` is the fast sanity-check helper for one reassembled dump.

Return fields:

- `commandId`
- `status` ("queued")
- `targetKind`
- `playerId`
- `queuePath`

Known limitations:

- deep mode can stall on heavy HUD sessions; use `deep = false` for faster safe dumps
- very large full-document dumps can still be slow, but they must now report incomplete state explicitly instead of looking successful after silent clipping
- `htmlSelector` targets the HUD document root, not the Lua editor probe context
- F1/Help codex topics use `section#bm_<topic>` IDs (e.g. `section#bm_renderscript`, `section#bm_scripting_element_API`); use `raw_eval` to discover the correct ID: `document.querySelectorAll('section[id^="bm_"]')` to list all available topics

### Live Lua workflow

For normal editor edits, use this order:

1. `du_open_lua_context(playerId, slotName, filterName)` to establish the target buffer deterministically.
2. `du_push_lua_context_code(playerId, sourcePath, slotName, filterName)` when the goal is to land a tracked file into that exact live context and verify the visible buffer.
3. `du_editor_save` to commit the change explicitly.

Lower-level diagnostic path:

1. `du_ui_describe` or `du_ui_wait`
2. `du_ui_invoke(uiKind = lua_editor, method = select_context, slotName, filterName, settleMs)`
3. `du_editor_push_code`
4. `du_editor_save`

If you bypass the higher-level tools and issue lower-level calls manually, you must still account for the post-slot redraw delay and live-buffer verification yourself.

### `du_chat_snapshot`

Purpose:

- queue a read-only chat snapshot against the active HUD chat
- wait for the matching `chat_snapshot` bridge event

Inputs:

- `playerId`
- `timeoutMs`

Behavior:

1. `DuMcpBridge` queues `action = probe_call` with `probeMethod = chat_snapshot`
2. `ModUiToolbox` injects the runtime probe call into the HUD
3. the probe reads the selected channel plus recent messages from the existing chat UI state
4. the probe emits a `chat_snapshot` packet
5. `ModUiToolbox` writes a `chat_snapshot` event
6. `DuMcpBridge` waits for that event and returns the snapshot

Return fields:

- `found`
- `commandId`
- `createdAtUtc`
- `visible`
- `open`
- `source`
- `selectedChannelId`
- `selectedChannelName`
- `messageCount`
- `snapshotJson`
- `parseError`

Chat message note:

- if the structured message objects contain a `date` field, that timestamp comes from the in-game chat model in UTC

### `du_chat_ai_mentions`

Purpose:

- read the active HUD chat snapshot
- return only messages that contain `@ai` case-insensitively
- optionally route targeted mentions like `@ai:helper` to one specific MCP-side agent
- ignore messages that already start with a machine-readable AI prefix like `[AI:helper]`
- keep the original sender information from the HUD snapshot, including messages marked as `fromMe`

Inputs:

- `playerId`
- `agentId` optional, e.g. `helper`
- `includeGenericMentions` optional, default `true`
- `timeoutMs`

Behavior:

1. `DuMcpBridge` queues the same `chat_snapshot` probe call as `du_chat_snapshot`
2. the probe returns the selected channel plus recent messages
3. `DuMcpBridge` filters the returned messages to plain `@ai` or, if `agentId` is set, to `@ai:<agentId>`
4. messages with a leading `[AI:<agentId>]` prefix are ignored to avoid self-loops across multiple MCP-side agents

Return fields:

- `found`
- `commandId`
- `createdAtUtc`
- `agentId`
- `includeGenericMentions`
- `source`
- `selectedChannelId`
- `selectedChannelName`
- `count`
- `messages`
- `snapshotJson`
- `parseError`

Chat message note:

- returned messages keep the same `date` semantics as `du_chat_snapshot`
- if present, `date` is an in-game UTC timestamp
- recommended multi-agent contract: outgoing AI replies should be prefixed as `[AI:<agentId>]` and incoming targeted requests use `@ai:<agentId>`

### `du_chat_server_snapshot`

Purpose:

- read recent chat messages across server-side channels relevant to the player
- avoid the visible HUD tab restriction of the normal `du_chat_snapshot` path
- use an explicit opt-in path that requires a `ModUiToolbox` build with server chat support

Inputs:

- `playerId`
- `limit`
- `timeoutMs`

Behavior:

1. `DuMcpBridge` queues a server-side read command instead of a HUD probe call
2. `ModUiToolbox` executes the opt-in `server_chat` read path in the server process
3. the mod writes a `server_chat_snapshot` bridge event
4. `DuMcpBridge` waits for that event and returns the structured snapshot

Return fields:

- `found`
- `commandId`
- `createdAtUtc`
- `success`
- `error`
- `visible`
- `open`
- `source`
- `selectedChannelId`
- `selectedChannelName`
- `messageCount`
- `messages`
- `snapshotJson`
- `parseError`

Chat message note:

- if the structured message objects contain a `date` field, that timestamp comes from the in-game chat model or the server-side read payload and is returned unchanged

### `du_chat_server_mentions`

Purpose:

- read the same opt-in server-side chat snapshot as `du_chat_server_snapshot`
- return only messages that contain `@ai` case-insensitively
- optionally route targeted mentions like `@ai:helper` to one specific MCP-side agent

Inputs:

- `playerId`
- `agentId` optional, e.g. `helper`
- `includeGenericMentions` optional, default `true`
- `limit`
- `timeoutMs`

Behavior:

1. `DuMcpBridge` queues the same server-side snapshot read as `du_chat_server_snapshot`
2. `ModUiToolbox` writes a `server_chat_snapshot` bridge event
3. `DuMcpBridge` filters the returned messages to plain `@ai` or, if `agentId` is set, to `@ai:<agentId>`
4. messages with a leading `[AI:<agentId>]` prefix are ignored to avoid self-loops across multiple MCP-side agents

Return fields:

- `found`
- `commandId`
- `createdAtUtc`
- `success`
- `error`
- `agentId`
- `includeGenericMentions`
- `source`
- `selectedChannelId`
- `selectedChannelName`
- `count`
- `messages`
- `snapshotJson`
- `parseError`

### `du_chat_send_message`

Purpose:

- send one chat message through the real HUD chat path
- use the currently selected channel by default
- optionally override the channel via explicit `channelId`

Inputs:

- `playerId`
- `message`
- `channelId` (optional)
- `timeoutMs`

Behavior:

1. `DuMcpBridge` queues `action = probe_call` with `probeMethod = chat_send`
2. the probe resolves the active channel (or uses the explicit `channelId`)
3. the probe calls `chatManager.sendMessageToCPP(channelId, message)`
4. the probe emits `chat_send_result`
5. `DuMcpBridge` waits for that event and returns the structured result

Important:

- this send path uses the real HUD/player chat path
- messages therefore appear in-game under the current player identity
- it is not a separate system-sender path

Return fields:

- `found`
- `commandId`
- `createdAtUtc`
- `success`
- `channelId`
- `channelName`
- `message`
- `usedExplicitChannel`
- `resultJson`
- `error`
- `parseError`

### `du_chat_create_channel`

Purpose:

- create or join a custom chat channel through the same HUD path as the `+` dialog
- validate the requested channel name on the MCP side before the bridge call

Inputs:

- `playerId`
- `channelName` (`^[A-Za-z0-9+_-]{3,10}$`)
- `timeoutMs`

Behavior:

1. `DuMcpBridge` queues `action = probe_call` with `probeMethod = chat_join_channel`
2. the probe validates the custom name again in the HUD context
3. if the channel already exists, the probe selects it
4. otherwise the probe sends `/join <name>` through the active chat channel
5. the probe waits for `room_<lowercase>` to appear, selects it, and emits `chat_channel_result`
6. `DuMcpBridge` waits for that event and returns the structured result

Sender identity note:

- channel creation/join also stays on the HUD/player path
- the `/join <name>` message flow therefore runs as the current player session, not as `Aphelia`

Return fields:

- `found`
- `commandId`
- `createdAtUtc`
- `success`
- `requestedChannelName`
- `expectedChannelId`
- `existed`
- `selected`
- `channelId`
- `channelName`
- `resultJson`
- `error`
- `parseError`

### `du_chat_select_channel`

Purpose:

- select an existing HUD chat channel by channel ID
- never create or join a channel implicitly

Inputs:

- `playerId`
- `channelId`
- `timeoutMs`

Behavior:

1. `DuMcpBridge` queues `action = probe_call` with `probeMethod = chat_select_channel`
2. the probe checks whether that channel already exists in the active HUD chat state
3. if present, the probe selects it and emits `chat_channel_result`
4. if absent, the probe fails instead of sending `/join`

Why this exists:

- responder logic must not use `du_chat_create_channel` for ordinary channel switching
- otherwise an old or already-left custom channel can be re-joined implicitly
- `du_chat_select_channel` is the safe path for "switch there and answer"

### Notes

- For normal Lua editing, use `du_open_lua_context` first and prefer `du_push_lua_context_code` for tracked-file pushes.
- Run probe calls sequentially per `playerId`. Parallel calls can race on the file bus.
- `apply` uses the in-game confirm path and can close the whole Lua editor.
- After `lua_editor` apply/save, the bridge still runs a short post-close cleanup window. The current bridge delay is about `2250 ms` before the best-effort `close_runtime_ui` call.
- During that cleanup window, do not send more Lua-editor probe actions and do not treat an immediate manual `Ctrl+L` reopen as a stable signal yet.
- If you need to continue editing after save, use `du_open_lua_context` and reselect the target context instead of chaining low-level actions into the close window.
- `select_context` remains the preferred low-level Lua probe action because it confirms the slot, waits for settle, then resolves the visible filter by name.
- duplicate Lua handler names are normal in real boards. If multiple rows share the same visible name, treat `select_context` as ambiguous and switch by filter index or verified manager identity instead.
- viewport/caret restore for the Lua editor is now keyed from the live slot/filter manager identity for the active probe session, not from the old generic label-only path.
- `outer_html` and `raw_eval` are debug-oriented escape hatches and should be used sparingly.
- `du_open_editor_native` uses `DuMcpBridge/ahk/du_bridge_input.ahk` and AutoHotkey v2. You can pass `--ahk-path` on `run-mcp.cmd` or use `DU_AHK_EXE`, `DU_MCP_BRIDGE_AHK_EXE`, `DU_AHK_DIR`, or `DU_MCP_BRIDGE_AHK_DIR`.
- `sendEscapeFirst` is a fallback only. From a normal in-world state it can open the Options UI.
- `screen_editor cancel` and `screen_editor save` both include the delayed native `Escape` cleanup path.
- `lua_editor save` now also waits out the probe-side apply/close hold and then best-effort calls `close_runtime_ui` to dismiss lingering runtime-module UI.

### `du_editor_pull_code`

Purpose:

- read the last known workspace snippet for a session

Lookup order:

1. `ide-workspace/player-<playerId>/<targetKind>/snippet.lua|snippet.txt`

Return fields:

- `found`
- `targetKind`
- `playerId`
- `code`
- `source`
- `path`
- `lastModifiedUtc`

This reads the last known workspace snippet. It does not force a fresh export from the game client.
It does not fall back to pending `ide_import` payloads, because those are staged write artifacts, not proof of current editor content.

### `du_editor_pending_import`

Purpose:

- read the currently staged IDE import payload for a session

Lookup path:

1. `payload-overrides/ide_import.player-<playerId>.<targetKind>.json`

Useful fields:

- `found`
- `requestId`
- `code`
- `codeCharLength`
- `codeUtf8Bytes`
- `codeHash32`
- `codeSha256`
- `contextKey`
- `sourceSyncId`
- `workspaceCodePath`
- `workspaceMetaPath`
- `requestCreatedAtUtc`
- `exportedAtUtc`
- `lastModifiedUtc`

Use this when you explicitly want to inspect what is staged for import. It is a pending write artifact, not proof of current visible editor content.

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
- after `lua_editor` save injection, the bridge waits past the Lua apply-close hold and then best-effort calls `close_runtime_ui`
- after `screen_editor` save injection, the bridge also sends one delayed native `Escape` as the same cleanup path already used by `screen_editor cancel`
- for `lua_editor`, treat the save call as a two-step close path: apply returns first, then the bridge cleanup finishes about `2250 ms` later
- do not send more Lua-editor probe actions during that short gap
- if you need the editor again right away, reopen it explicitly after the cleanup window and reselect the context

This only makes sense when the target editor UI is already open.

### `du_get_last_result`

Purpose:

- return the latest matching bridge event

Filters:

- `playerId`
- `targetKind`
- `eventType`

Source:

- newest active `bridge-events-YYYYMMDD*.ndjson` files in `events/`

### `du_tail_runtime_logs`

Purpose:

- return recent runtime and bridge lines

Included event types:

- `runtime_log`
- `command_result`
- `bridge_status`
- `chat_snapshot`
- `chat_send_result`
- `chat_channel_result`
- `server_chat_snapshot`

### `du_list_active_sessions`

Purpose:

- list currently known bridge sessions

Sources:

- recent bridge events
- player-scoped IDE import files such as `ide_import.player-<playerId>.lua_editor.json`

### `du_bridge_events_status`

Purpose:

- report the current active bridge-event file, retention settings, byte totals, and whether legacy `bridge-events.ndjson` is still present

Return fields include:

- current writable file path/name and current size
- latest active file
- active/archive/processed-command file counts and byte totals
- retention settings
- largest active files

### `du_bridge_events_housekeeping`

Purpose:

- rotate or reset the active bridge-event file
- prune event files older than a chosen age
- prune processed command files older than a chosen age
- support `dryRun` before destructive cleanup

Important behavior:

- `rotateNow` archives the latest active event file immediately
- `resetCurrent` archives the latest active event file and starts a fresh current file
- pruning applies to both `events/` and `events/archive/`
- processed-command pruning applies to `state/processed-commands/`
- housekeeping returns the post-action bridge-event status snapshot

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

## Current Limitations

- the bridge now exposes three Windows-native input helpers: `du_camera_move` for explicit relative camera steering, `du_send_key_native` for a small supported key whitelist such as `F` / `Escape`, and `du_open_editor_native` for the shared element-editor `Ctrl+L` case
- `du_reinject_lua_probe` is not a cold-start injector; without an already-present Lua probe page, it has nothing to call into
- normal reinject workflow is still: close editor, reinject, reopen. Reinject with the editor already open can leave mixed old/new page state and is not the preferred validation path.
- `screen_editor` still depends on the user having the correct editor UI open
- `boardId` is not yet enforced as a verified board selection
- `du_editor_pull_code` returns the last known snapshot, not necessarily the exact live editor state
- newly added MCP tools require an MCP host reload after rebuild
- newly added probe modules require the override folder to contain the updated module set
- Lua-editor slot changes are still timing-sensitive in the live client if you bypass the canonical `select_context` path
- normal HUD mention reads are intentionally limited to the currently selected client tab; cross-channel reads require the opt-in `server_chat` path
- there is still no arbitrary raw hotkey contract: native key input is intentionally limited to the `du_send_key_native` whitelist rather than free-form key strings
- `sendEscapeFirst = true` is not a harmless preflight: from a normal in-world state it can open the game Options menu. If that happens, the next recovery step is another `Escape` to get back in-world before you assume a clean retry state.
- legacy `bridge-events.ndjson` can still exist from older runs; status/housekeeping will report it, but older files are not auto-migrated into the dated naming scheme
