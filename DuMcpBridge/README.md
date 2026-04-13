# DuMcpBridge

`DuMcpBridge` is a local MCP server that turns the existing Dual Universe modding pipeline into a bidirectional bridge.

This tool acts as the messenger between an external AI/editor and your live Dual Universe UI.
It does not directly modify the game client on its own.
Instead, it drops request files into your `MyDUserver` working folders, waits for the in-game side to pick them up, and then reads the result files that come back.

That means an agent can ask for things like "read the currently open Lua editor", "write this code into the editor", or "send this chat message", and `DuMcpBridge` passes those requests into the existing Dual Universe modding workflow.
The actual UI interaction still happens on the game side through `ModUiToolbox`.

Its job is intentionally narrow:

- accept MCP tool calls from a local agent or editor
- write bridge commands into a file bus
- let `ModUiToolbox` consume those commands inside the game pipeline
- let injected JavaScript operate on the live UI
- receive structured events back from the game client
- expose those results again through MCP tools and resources

In short, `DuMcpBridge` is the transport layer between local automation and the live in-game editor UI.

## Required Setup

Before starting this MCP server, make sure it knows where your `MyDUserver` folder is.
If this path is wrong, the bridge will read and write the wrong bus folders and the server will not work.

`DuMcpBridge` does not talk to the game client by itself.
It exchanges files with `ModUiToolbox`, which is the in-game bridge that reads command files from `MyDUserver\tmp\ui-dumps`, injects JavaScript into the live Dual Universe UI, and writes event files back out.

Important:

- `ModUiToolbox` is not inside `DuMcpBridge`
- it may live in a different folder in this workspace
- it may also live in a separate repository entirely
- both tools must point at the same `MyDUserver` installation, or this MCP server will not work

Default location:

- `D:\MyDUserver`

Override options:

- set `DU_SERVER_ROOT` to your `MyDUserver` folder
- optionally set `DU_UI_DUMP_ROOT` if your UI dump folder is not under `<MyDUserver>\tmp\ui-dumps`
- optionally set `DU_MCP_BRIDGE_ROOT` if you want the MCP bridge bus somewhere other than `<ui-dumps>\mcp-bridge`

PowerShell example:

```powershell
$env:DU_SERVER_ROOT = "E:\MyDUserver"
```

`run-mcp.cmd`:

- `DuMcpBridge\run-mcp.cmd` is the normal launcher for this MCP server
- it changes into the `DuMcpBridge` folder and starts `node dist\server.js`
- if you set `DU_SERVER_ROOT`, set it in the same environment that launches `run-mcp.cmd`
- any extra launch arguments are forwarded to `dist\server.js`

With only `DU_SERVER_ROOT` set, the bridge uses these derived paths:

- `<DU_SERVER_ROOT>\tmp\ui-dumps`
- `<DU_SERVER_ROOT>\tmp\ui-dumps\mcp-bridge`

## High-Level Architecture

The current bridge is split into three layers:

1. `DuMcpBridge`
   A local MCP server that exposes tools and resources.

2. `ModUiToolbox`
   The in-game bridge that reads queued commands, injects JavaScript into the HUD client, and writes structured events back out.

3. Lua runtime probe
   A JavaScript probe injected into the Lua editor UI. It can describe the live editor state and perform targeted UI actions without screenshot clicking.

## End-to-End Flow

```text
MCP client
  -> DuMcpBridge
  -> D:\MyDUserver\tmp\ui-dumps\mcp-bridge\commands\*.json
  -> ModUiToolbox
  -> injected JavaScript inside the live Dual Universe UI
  -> D:\MyDUserver\tmp\ui-dumps\mcp-bridge\events\bridge-events-YYYYMMDD*.ndjson
  -> DuMcpBridge / logmgr
```

Bridge-event files are UTC-dated and roll over at `512 KB` per active file. The MCP bridge also exposes `du_bridge_events_status` and `du_bridge_events_housekeeping` so old event files and processed command files can be inspected, rotated, reset, and pruned explicitly.

## Construct And Storage Tools

The bridge now has two different non-editor tool layers:

- `construct_inspector`
  - read-focused construct and element inspection
  - exposed through tools such as `du_construct_describe`, `du_construct_find_elements`, `du_construct_inspect_element`, and `du_construct_analyze_patterns`
- `toolbox_ops`
  - deterministic server-side construct/storage operations
  - kept separate from the live `industry_panel` payload path
  - intended as the low-level primitive layer that a higher-level agent can combine into workflows

Current `toolbox_ops` MCP tools:

- `du_construct_index_refresh`
- `du_construct_index_query`
- `du_construct_index_related`
- `du_storage_resolve`
- `du_storage_describe`
- `du_storage_spawn`
- `du_storage_take`
- `du_storage_move_slot`
- `du_storage_drop_slot`
- `du_industry_describe_batch`
- `du_industry_resolve_recipes`
- `du_industry_stop_batch`
- `du_industry_set_recipes`
- `du_industry_start_batch`
- `du_industry_configure_batch`

Construct index purpose:

- `du_construct_index_refresh` snapshots one construct into the mod-side SQLite index with elements and links only
- `du_construct_index_query` is the fast static+semantic lookup layer for workflow questions such as ore containers, refiner banks, and exact named branches
- `du_construct_index_related` returns a compact depth-limited subgraph around one construct-local `id` or exact name
- the construct index is not a live runtime layer; questions about what is currently producing or consuming an item still need live backend reads

Important behavior:

- construct index results are user-facing by construct-local `id`; backend/global element ids stay internal
- construct index queries are deterministic only and use exact names plus explicit semantic filters
- construct-backed storage selectors are deterministic only
- for `container` and `container_hub`, pass exactly one of construct-local `id` or exact `name`
- `constructId` is optional and defaults to the player's current construct, but explicit cross-construct selectors are supported
- ambiguous storage or item-name matches return structured candidate lists instead of picking a target
- industry target selectors are deterministic only and accept exactly one of construct-local `id` or exact `name`
- the user-facing industry MCP surface is batch-first; even single-target work is sent as one-entry `entries` lists
- `du_industry_set_recipes` enforces that the target machines are stopped before changing recipes
- for transfer units, the recipe identifier is the product item type id
- these tools are server-side `ModUiToolbox` bridge calls; they do not depend on the live `industry_panel` UI being open

## Live Screen Resolution Note

For live Dual Universe screen work, do not assume that screen units always expose a `1920x1080` rendering surface.

Verified live behavior:

- screen size `M` resolves to `1024x613`
- screen sizes `XS` and `S` should be treated the same as `M` for layout assumptions unless a fresh live check proves otherwise

This matters when validating or designing screen content through `screen_editor`, because text and panel layouts that look fine at `1080p` can overlap or clip on `1024x613`.

## Preferred Lua Workflow

For live Programming Board work, prefer the higher-level Lua tools instead of stitching together multiple low-level calls.

Preferred tools:

- `du_open_lua_context`
  - opens the Lua editor if needed
  - waits for a real live Lua editor snapshot
  - performs one guarded open recovery if the first `Ctrl+L` path fails
  - selects the requested slot and filter
  - returns the final verified live context

- `du_push_lua_context_code`
  - opens the requested Lua context if needed
  - stages a tracked local source file into that exact slot and filter
  - verifies that the visible live buffer matches the expected code hash

Use those as the default path for normal board work such as:

1. open `library.onStart()`
2. push a tracked repo file into that context
3. inspect or save only after the live buffer is verified

Lower-level tools still exist and are useful for diagnostics:

- `du_open_editor_native`
- `du_ui_describe`
- `du_ui_invoke`
- `du_editor_push_code`
- `du_editor_save`

But they should no longer be the normal first choice when the goal is simply "open this Lua slot/filter and work there deterministically."

## Runtime UI Recovery

When a probe runtime module leaves overlay UI open after the editor flow changes, use the generic UI-probe path instead of falling back to screenshot clicking first.

Preferred recovery call:

- `du_ui_invoke`
  - `uiKind = lua_editor`
  - `method = close_runtime_ui`

What this does:

- asks the injected Lua probe to call optional runtime-module UI close hooks
- lets modules such as the HUD editor dismiss their own overlay UI without being disabled
- keeps the recovery path generic for future runtime modules

Current example:

- the HUD editor runtime module exposes a `closeUi(...)` hook, so `close_runtime_ui` can close the HUD overlay before returning to in-world interaction

## Lua Edit And Apply

Use this order for normal live Lua board editing:

1. open the target context with `du_open_lua_context` or `du_ui_invoke(method = select_context)`
2. push code into that exact visible context
3. call `du_editor_save(targetKind = lua_editor)` as the explicit apply step
4. wait for the save cleanup to finish before sending more Lua-editor actions

Important details:

- `du_editor_save(targetKind = lua_editor)` triggers the in-game apply path
- that apply path can close the Lua editor window as part of normal behavior
- after the apply call returns, the bridge still waits about `2250 ms` and then best-effort calls `close_runtime_ui`
- during that short cleanup window, do not send more Lua-editor probe actions and do not judge reopen behavior yet
- if you need to work on another filter after save, reopen the editor and select the target context again
- use `du_open_lua_context` for a deterministic reopen path; a manual `Ctrl+L` immediately after apply can race the cleanup window
- apply success means the editor accepted the save path; it does not prove a board runtime restart

Context identity rules:

- a visible handler name such as `onStart()` is not a unique identity
- the probe now keys Lua editor context from the live manager slot/filter identity instead of the older generic label-based path
- duplicate names in the same slot are normal and must be treated as ambiguous unless the live manager exposes a distinct active filter
- if a slot has multiple matching names, do not assume that `selectedFilter` text alone proves the target
- for diagnostics or exact switching in ambiguous slots, use `select_filter_index` or inspect `LUAEditorManager.currentSlot.filtersList` through `raw_eval`

Selection and reinject rules:

- probe-driven slot/filter selection now uses the same mouse sequence as a real user click so the enhancement code can arm slot auto-open and viewport capture correctly
- `select_slot` is therefore safe again for normal live navigation, but it still does not remove ambiguity between duplicate filter names
- reinject the Lua probe with the editor closed; do not treat open-editor reinject as the normal validation path
