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
