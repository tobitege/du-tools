# DuMcpBridge

`DuMcpBridge` is a local MCP server that turns the existing Dual Universe modding pipeline into a bidirectional bridge.

Important batch limit:

- for batched industry operations, `parallelism` must be `10` or lower
- any value above `10` is a command rejection
- do not retry with the same invalid value, because that only creates avoidable repeat tool calls

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
$env:DU_SERVER_ROOT = "D:\MyDUserver"
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
- `du_construct_index_nearby`
- `du_construct_index_related`
- `du_construct_index_describe_industry_branch`
- `du_construct_index_trace`
- `du_construct_index_describe_bank_from_anchor`
- `du_construct_index_describe_consumer_bank_branches`
- `du_construct_index_industry_supports`
- `du_construct_index_industry_support_storage`
- `du_construct_runtime_availability`
- `du_construct_rename_elements` (batch-only; accepts an `entries` list of `{id?, name?, newName}`)
- `du_element_add`
- `du_element_delete`
- `du_element_destroy`
- `du_element_replace`
- `du_element_link_create`
- `du_element_link_delete`
- `du_storage_resolve`
- `du_storage_describe`
- `du_storage_spawn`
- `du_storage_spawn_batch`
- `du_storage_take`
- `du_storage_move_slot`
- `du_storage_drop_slot`
- `du_query_item_bank`
- `du_list_item_bank_groups`
- `du_industry_describe_batch`
- `du_industry_resolve_recipes`
- `du_industry_stop_batch`
- `du_industry_set_recipes`
- `du_industry_start_batch`
- `du_industry_configure_batch`

Practical workflow:

1. Refresh the construct index when topology may be stale.
   - Use `du_construct_index_refresh` once per construct before heavy topology work.

2. Find one exact anchor first.
   - Use `du_construct_index_query` for exact names, semantic item classes, family filters, or recipe-capability filters such as `producesItemName` / `consumesItemName`.
   - Use `du_construct_index_nearby` when the workflow starts from one known local element and needs the surrounding bank.
   - Use `du_construct_index_related` when you already know one element and want its compact linked subgraph with typed edges.

3. Switch to a packaged branch query when the workflow is really about one branch type.
   - Use `du_construct_index_describe_industry_branch` when the branch kind itself matters and the caller needs to distinguish direct producer, support/refill, and distribution-TU layouts.
   - Use `du_construct_index_trace` for bounded upstream/downstream walking with `maxHops` and stop conditions.
   - Use `du_construct_index_describe_bank_from_anchor` to expand one anchor into a repeated bank.
   - Use `du_construct_index_describe_consumer_bank_branches` when one consumer bank has several grouped upstream inputs.
   - Use `du_construct_index_industry_supports` for support-buffer topology: support storage, refill target, downstream consumers, feeder TUs, and feeder source storages.
   - Use `du_construct_index_industry_support_storage` when you need the same branch plus live storage snapshots for the support buffers and feeder sources.

4. Use live backend reads only for current runtime and current stock.
   - Use `du_construct_runtime_availability` first when the player may not be at the target construct.
   - Use `du_industry_describe_batch` for the current state, recipe, and maintain quantities of one or more industry elements.
   - Use `du_storage_describe` for current storage contents.
   - `du_storage_describe` is batchable by default through `entries`, so one call can read many storages.

5. Mutate in batches, then confirm in batches.
   - Use `du_industry_configure_batch` for recipe plus mode plus amount.
   - Use `du_industry_stop_batch`, `du_industry_set_recipes`, and `du_industry_start_batch` only when the workflow needs those split steps explicitly.
   - Use `du_element_add`, `du_element_delete`, `du_element_destroy`, `du_element_replace`, `du_element_link_create`, and `du_element_link_delete` for direct backend element-management mutations.
   - Use `du_storage_spawn`, `du_storage_take`, `du_storage_move_slot`, and `du_storage_drop_slot` for deterministic storage mutations.

Typical patterns:

- Rebuild one support branch from a known support container:
  1. `du_construct_index_industry_supports`
  2. `du_construct_index_industry_support_storage`
  3. `du_industry_describe_batch` on the returned feeder TUs
  4. `du_industry_configure_batch` on the feeder TUs

- Configure a local feeder wall from one known TU:
  1. `du_construct_index_nearby`
  2. `du_industry_describe_batch`
  3. `du_industry_configure_batch`

- Check many buffers at once:
  1. `du_storage_describe` with `entries`
  2. inspect `summary` and per-entry `results`

Trace one producer upstream to pures and ores:

Use the bounded trace tool first, then switch to packaged branch queries only where needed:

1. find one exact producer anchor
2. run `du_construct_index_trace` with `direction: upstream`
3. stop at `pure` or `ore`, or anchor a second trace from one discovered branch node
4. when one upstream storage is clearly a support branch, switch to `du_construct_index_industry_support_storage`

Example: start from one known producer or product line

```json
{
  "tool": "du_construct_index_query",
  "playerId": 126152,
  "constructId": 1002090,
  "category": "industry",
  "producesItemName": "Warp Cell",
  "timeoutMs": 15000
}
```

If the product semantic name is not reliable enough, anchor by exact machine or line name instead:

```json
{
  "tool": "du_construct_index_query",
  "playerId": 126152,
  "constructId": 1002090,
  "exactName": "Warp Cell S1",
  "timeoutMs": 15000
}
```

Then run a bounded upstream trace:

```json
{
  "tool": "du_construct_index_trace",
  "playerId": 126152,
  "constructId": 1002090,
  "id": 1234,
  "direction": "upstream",
  "stopAtItemClass": "pure",
  "maxHops": 4,
  "timeoutMs": 15000
}
```

If you need the local subgraph shape as well, `du_construct_index_related` still works and now returns typed edges such as `industry_output_to_storage` and `storage_to_transfer_input`.

Batch-read the storages you just found instead of one `du_storage_describe` call per container:

```json
{
  "tool": "du_storage_describe",
  "playerId": 126152,
  "constructId": 1002090,
  "storageKind": "container",
  "itemLimit": 10,
  "entries": [
    { "id": 760 },
    { "id": 755 },
    { "id": 6629 }
  ],
  "timeoutMs": 15000
}
```

If one upstream storage is clearly a support branch, switch to the packaged branch query instead of manually reconstructing that part from many calls:

```json
{
  "tool": "du_construct_index_industry_support_storage",
  "playerId": 126152,
  "constructId": 1002090,
  "id": 755,
  "includeFeederSources": true,
  "itemLimit": 10,
  "timeoutMs": 15000
}
```

Then read the returned feeder TUs in one batch:

```json
{
  "tool": "du_industry_describe_batch",
  "playerId": 126152,
  "constructId": 1002090,
  "entries": [
    { "id": 880 },
    { "id": 881 }
  ],
  "timeoutMs": 15000
}
```

Repeat the same pattern from the next upstream container or producer:

- use `du_construct_index_trace` when you need one more bounded upstream/downstream step from a new anchor
- use `du_construct_index_related` when you need the compact local subgraph with typed edges
- use `du_storage_describe.entries` when you need current stock for several storages
- use `du_construct_index_industry_support_storage` when the current node is a support/refill branch
- stop when the upstream semantic item class is already `pure` or `ore`

Practical rule:

- `du_construct_index_industry_supports` and `du_construct_index_industry_support_storage` are branch-packaging tools, not arbitrary whole-factory graph walkers
- `du_construct_index_trace` is the generic bounded walker for “follow this upstream/downstream from here”
- `du_construct_index_related` remains the compact local-subgraph tool when you need the surrounding typed edges
- a full producer-to-pure or producer-to-ore trace is still a short repeated workflow, just with a dedicated bounded trace primitive now

Construct index purpose:

- `du_construct_index_refresh` snapshots one construct into the mod-side SQLite index with elements and links only
- `du_construct_index_query` is the fast static+semantic lookup layer for workflow questions such as ore containers, refiner banks, exact named branches, and product-capability lookups
- `du_construct_index_nearby` returns indexed elements near one anchor element using stored construct-local positions, with optional category, industry-family, radius, and vertical-tolerance filters
- `du_construct_index_related` returns a compact depth-limited subgraph around one construct-local `id` or exact name, and its edges now carry typed meanings
- `du_construct_index_describe_industry_branch` packages recognized branch kinds around one anchor
- `du_construct_index_trace` walks the graph in one direction with bounded hops and stop conditions
- `du_construct_index_describe_bank_from_anchor` expands one anchor into a repeated same-role bank
- `du_construct_index_describe_consumer_bank_branches` summarizes a consumer bank plus grouped upstream input anchors
- `du_construct_index_industry_supports` returns the packaged support-feeder branch data that a full industry-support workflow needs: support storage, refill target, downstream industry consumers, upstream feeder TUs, feeder source storages, and compact feeder runtime
- `du_construct_index_industry_supports` also accepts an optional downstream `industryFamily` filter when the caller wants one family such as `smelter`
- `du_construct_index_industry_support_storage` is the reusable storage-focused workflow tool on top of that support query and adds live snapshots for the support buffers plus optional feeder source storages
- `du_construct_runtime_availability` checks whether live backend reads should work for the target construct from the player's current position
- the construct index is not a live runtime layer; questions about what is currently producing or consuming an item still need live backend reads

Important behavior:

- construct index results are user-facing by construct-local `id`; backend/global element ids stay internal
- construct index queries are deterministic only and use exact names plus explicit semantic filters
- `producesItemName` / `consumesItemName` are capability filters based on recipe semantics, not current runtime state
- if a needed topology workflow is not expressed cleanly by the existing construct-index tools, the fix belongs in a new mod-owned `toolbox_ops` primitive rather than external inspection of the construct-index database
- construct-backed storage selectors are deterministic only
- for `container` and `container_hub`, pass exactly one of construct-local `id` or exact `name`
- `constructId` is optional and defaults to the player's current construct, but explicit cross-construct selectors are supported
- `du_storage_describe` is batchable by default through an optional `entries` list; single-target calls keep the old `storage` plus `snapshot` shape, while batched calls return `summary` plus compact per-entry `results`
- ambiguous storage or item-name matches return structured candidate lists instead of picking a target
- `du_construct_rename_elements` is batch-only; each entry selects by construct-local `id` or exact `name` and assigns `newName`
- industry target selectors are deterministic only and accept exactly one of construct-local `id` or exact `name`
- the user-facing industry MCP surface is batch-first; even single-target work is sent as one-entry `entries` lists
- `du_industry_set_recipes` enforces that the target machines are stopped before changing recipes
- for transfer units, the recipe identifier is the product item type id
- compact industry runtime payloads now carry `maintainQuantity`, `currentQuantity`, `productItemTypeId`, and `productItemName` for the active product instead of forcing callers to infer display quantities from raw backend fields
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
