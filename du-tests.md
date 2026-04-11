# DuMcpBridge & Lua Probe - Live Test Guide

Step-by-step order for manual or agent-driven testing of the MCP tools. The bridge is transport only; real behavior comes from ModUiToolbox plus the injected Lua probe.

---

## Bootstrap Prompt

For a new agent session without access to earlier tool outputs, copy the block below before the first MCP step. Treat this file, `du-tests.md`, as the authority for live steps and expectations.

```text
You are working in repo du-tobi on DuMcpBridge + ModUiToolbox. Use du-tests.md as the authority for live Dual Universe work.

Repo hint:
- repo root is typically `d:\github\du-tobi`
- this repo also contains related live-work docs such as `du-visual-subagent.md`, `live_lua_coding/README.md`, `DuMcpBridge/README.md`, and `ModUiToolbox/README.md`
- when a live task mentions a repo file path, resolve it from this repo root before guessing

Before each run, call du_list_active_sessions and then keep all relevant MCP calls for the same playerId sequential. Do not parallelize session-sensitive live calls.

For Programming Board / lua_editor work:
- preferred context path: du_open_lua_context -> du_push_lua_context_code -> deliberate save/apply step
- du_editor_push_code does not open an editor
- du_editor_save does not choose a buffer for you
- du_editor_pull_code is not automatic proof of the visible live buffer
- if no real code change was made, do not assume `Apply` is enabled
- if no real code change was made in `lua_editor`, close with `Cancel` or `Escape`
- if unchanged code is present in `lua_editor`, closing by `Escape` typically requires two taps
- special case: in `lua_editor`, if no filter is selected at all, a single `Escape` tap closes it
- if unchanged code is present in `screen_editor`, closing by `Escape` requires two taps
- unit timer callbacks only arrive through a real `unit.onTimer(...)` filter; a Lua helper method alone is not enough unless the active unit filter forwards to it

Important truth:
- visible editor buffer and actually running board runtime are different things
- lua_editor save/apply does NOT prove a board restart
- validate board runtime only through a real board off/on cycle
- after that, always verify both fresh Lua chat lines and the visible screen result

For board-to-screen work:
- visible screen result has priority over board logs
- if chat and visible screen disagree, trust the screen
- test the smallest direct transport first instead of adding more layers

For runtime code:
- do NOT wrap known DU API calls in pcall
- use direct calls for known paths such as setRenderScript(...), setScriptInput(...), getInput(), system.print(...), slot.getClass(), slot.getLocalId(), and normal linked-element methods

For visual or targeting steps:
- before Ctrl+L or native inputs, confirm the real client state
- if screenshot tools are available, use targeted screenshots to confirm the visible DU state
- for board vs screen targeting decisions, use centered views and do not guess
- use the calibration image `live_lua_coding/du-ref-board-screen-center.png` before board-vs-screen targeting decisions

Useful debug tools:
- du_ui_describe, du_ui_wait, du_ui_invoke
- du_get_last_result, du_tail_runtime_logs
- bridge-events.ndjson for command_enqueued -> command_result -> probe_result

On timeout or failure:
- validate the probe override
- validate the visible editor state
- do not infer a restart from save/apply
- do not start or stop the MCP server yourself
```

---

## 0. Hard Live Rules

These rules come from real live-debugging failures and take priority over convenience.

- A saved or visibly updated `lua_editor` buffer does not prove that the board is now executing that code.
- `du_editor_save` or `LUAEditorManager.apply()` is not a restart test for Programming Boards.
- Validate board runtime only through a real board off/on cycle.
- After every board off/on, verify two things:
  - fresh Lua chat lines from that exact run
  - visible result on the linked screen
- If chat and visible screen disagree, the visible screen wins.
- Do not wrap known Dual Universe API calls in `pcall`.
- Use direct calls for known live paths, especially:
  - `setRenderScript(...)`
  - `setScriptInput(...)`
  - `getInput()`
  - `system.print(...)`
  - `slot.getClass()`
  - `slot.getLocalId()`
  - `core.getElementNameById(...)`
- `du_editor_push_code` does not open an editor.
- `du_editor_save` does not choose a target buffer.
- `du_editor_pull_code` is not automatically the visible live buffer.
- If no real code change was made, do not assume `Apply` is enabled just because slot or filter selection changed.
- For `lua_editor` with no real code change, use `Cancel` or `Escape`.
- With unchanged code visible in `lua_editor`, `Escape` typically requires two taps.
- Special case: if no Lua filter is selected at all, one `Escape` tap closes the editor.
- For `screen_editor` with no real code change, close with `Escape`, and expect two taps.
- `unit.setTimer(...)` requires a real active `unit.onTimer(...)` filter in the running board script path. A library helper such as `HudEditorBoard.onTimer(...)` does nothing by itself unless the active `unit` filter forwards to it.
- Before any mutation, confirm the current live state with the documented bridge or UI tools.
- Before native inputs like `Ctrl+L` or `du_open_editor_native`, confirm the visible target state instead of guessing.
- Use the calibration image `live_lua_coding/du-ref-board-screen-center.png` before board-vs-screen targeting decisions.
- Never reinject probe or UI payload code while `lua_editor` or `screen_editor` is open.
- If an editor looks visually closed but input still seems blocked, verify whether MCP-side cleanup already handled it before assuming a free in-world state.
- For live HUD editor recovery, first confirm whether the client is in world mode or UI mode:
  - take a left-side targeted screenshot
  - if the game's vertical left toolbar is visible, you are in UI mode and the mouse should work
  - if the left toolbar is not visible, assume world mode until a visual check proves otherwise
- If the `lua_editor` is closed but the HUD editor overlay is still visible:
  - preferred recovery when available: call `du_ui_invoke` with `uiKind = lua_editor` and `method = close_runtime_ui`
  - expectation: active runtime modules dismiss their own overlay UI without being disabled
- If `close_runtime_ui` is not yet available or does not resolve the overlay:
  - click the top-right `HUD Editor: ON` toggle once to collapse or close the HUD overlay
  - then press `Tab` again to return to in-world mode before trying to reopen the Programming Board editor
- Test the simplest possible transport first. Do not add new transport layers before the direct path is actually disproven.

---

## 1. Prerequisites

### 1.1 Running Components

| Component | Expectation |
| --- | --- |
| Dual Universe server + client | Player is logged in and the relevant editor context can exist |
| ModUiToolbox | Current DLL is deployed in the server Mods folder |
| DuMcpBridge | MCP server is running |
| Environment variables | Optional: `DU_UI_DUMP_ROOT`, `DU_MCP_BRIDGE_ROOT`; otherwise defaults under server `tmp\\ui-dumps` |

### 1.1A Build Configuration Rule

- If `ModUiToolbox.dll` is rebuilt for this workflow, compile it only in `Release`.
- Do not use `Debug` builds for DU live testing, deployment, or handoff.
- The `Release` build should not produce `.pdb` files. If it does, fix the build configuration before using that DLL for live work.
- Canonical command:

```powershell
cd .\ModUiToolbox
dotnet build -c Release -nologo -v:minimal
```

### 1.2 Paths

Default examples from the docs:

- Commands: `D:\MyDUserver\tmp\ui-dumps\mcp-bridge\commands\`
- Events: `D:\MyDUserver\tmp\ui-dumps\mcp-bridge\events\bridge-events.ndjson`
- Probe override modules: `D:\MyDUserver\tmp\ui-dumps\payload-overrides\lua-editor-probe.modules\`
- Build stamp: `lua-editor-probe.build.json`

### 1.3 Lua Probe / Board

1. In the repo, run `ModUiToolbox\tools\build-lua-probe.ps1`.
2. Optionally publish with `tools\publish-lua-probe.ps1` or copy the built module override files manually.
3. In game, inject the Lua probe. The private chat line should include the probe timestamp and short hash.
4. Open the Lua editor on the correct board and context.

Important:

- Do not reinject probe or UI payload code while `lua_editor` or `screen_editor` is open.

### 1.4 `playerId`

- Get it from `du_list_active_sessions`.
- Run all live test steps sequentially for the same `playerId`.

### 1.5 Timeouts

- Most tools: `timeoutMs` around `250` to `15000`.
- For `du_ui_invoke(method = add_filter)`, prefer `10000` to `15000`.

### 1.6 IDE Sync Watcher

If your workflow depends on the file-based IDE Sync path, the watcher may be required.

- Typical helper: `live_lua_coding/Start-DuIdeSyncWatcher.ps1`
- Without the watcher, export or sync actions may appear to work while the workspace files stay stale
- Treat the watcher as session setup, not as proof of a fresh visible live buffer

---

## 2. Baseline Checks

Keep this order.

### Step B0 - Sessions

- Tool: `du_list_active_sessions`
- Expectation: at least one usable session and `playerId`

### Step B1 - Editor Snapshot

- Tool: `du_ui_describe` with `uiKind = lua_editor`
- Expectation: JSON with `visible`, `title`, `slots[]`, `filters[]`, `selectedSlot`, `selectedFilter`, `codeLength`
- On timeout or failure: validate the override, validate that the editor is really open, optionally use `du_ui_wait`
- Optional visual check: if screenshot tools are available, use a targeted screenshot only when probe state and visible state may disagree

### Step B2 - Wait for Editor

- Tool: `du_ui_wait`
- Expectation: `ready = true`, or `ready = false` only after the timeout budget is exhausted

---

## 2A. Truth Model: Buffer vs Workspace vs Running Runtime

This distinction is mandatory. Most live confusion comes from mixing these up.

### Visible Live Buffer

This is the code actually visible in the open in-game editor.

- For `lua_editor`: visible slot + visible filter + visible CodeMirror content
- For `screen_editor`: visible CodeMirror content in the open screen editor

Preferred tools:

- `du_ui_describe`
- `du_ui_wait`
- `du_ui_invoke(... method = outer_html ...)`

### IDE / Workspace File

This is the external file or snippet state outside the visible editor.

Examples:

- `du_editor_pull_code`
- `snippet.lua`
- `snippet.txt`
- `snippet.json`

Useful for file comparison, but not automatically identical to the visible live buffer.

### Running Runtime

This is the code the board or screen is actually executing right now.

Important:

- A new buffer does not automatically mean a new runtime
- Save/apply does not automatically mean a board restart
- A Programming Board runtime is only validated when:
  - a real board off/on happened
  - fresh Lua chat lines from that run exist
  - the visible screen result matches that run

---

## 3. Navigation and Code Path

Recommended order.

### Step N1 - Select Slot and Filter

- Tool: `du_ui_invoke` with `uiKind = lua_editor`, `method = select_context`, `slotName`, `filterName`, optional `settleMs`
- Expectation: `selectedSlot` and `selectedFilter` match the intended context
- Rule: a visible handler label such as `onStart()` is not a unique identity. Duplicate names inside one slot are normal. If the target slot contains duplicates, verify the exact live filter index/key before treating the context as proven.
- Rule: reinject the Lua probe with the editor closed. Do not use open-editor reinject as the normal workflow.

### Step N2 - Push Code

- Tool: `du_editor_push_code` with `targetKind = lua_editor`
- Expectation: import was staged into the already selected live context

### Step N3 - Describe Again

- Tool: `du_ui_describe`
- Expectation: consistency with steps N1 to N3

### Step N4 - Do Not Confuse Runtime with Buffer

- Rule: after `du_editor_push_code` or `du_editor_save`, do not claim the new board code is already running
- Expectation: only claim runtime validation after real board off/on plus fresh chat and screen checks

### Step N5 - Visual Check Before Native Inputs

- Rule: before `Ctrl+L`, `du_open_editor_native`, or similar native inputs, verify the visible DU state
- If screenshot tools are available: use targeted screenshots only for state decisions or when probe and visible state may disagree

---

## 4. Add Filter

- Prerequisite: correct slot is selected and the handler name really exists for that slot
- Tool: `du_ui_invoke` with `uiKind = lua_editor`, `method = add_filter`, `filterName`, usually `timeoutMs = 15000`
- Expectation: new filter appears, or `alreadyPresent = true`

---

## 5. DOM and Debug

### Step D1 - `outer_html`

- Tool: `du_ui_invoke` with `method = outer_html`, `selector` such as `#filters` or `.lua_add_filter_button`
- Expectation: structured HTML snapshot

### Step D2 - Low-Level Probe

- Tool: `du_ui_invoke` with the exact `method` and method-specific fields
- Expectation: direct access to the canonical probe path

### Step D3 - `raw_eval`

- Tool: `du_ui_invoke` with `method = raw_eval`
- `functionBody` should be a strict body using the provided `state` parameter
- Risk: this runs arbitrary JS in the HUD; do not feed it untrusted content

---

## 6. Generic `du_ui_*` Tools

Canonical live path:

- `du_ui_describe`
- `du_ui_invoke`
- `du_ui_wait`

Minimal generic test:

- call `du_ui_invoke` with `method = describe`
- expect a result equivalent to `du_ui_describe`

---

## 7. Bridge Checks Without Direct Probe Calls

### Step R1 - Last Event

- Tool: `du_get_last_result`
- Expectation: latest `probe_result` or other recent event

### Step R2 - Runtime Logs

- Tool: `du_tail_runtime_logs`

### Step R3 - Active Code from Workspace

- Tool: `du_editor_pull_code`
- Note: this may reflect the file workspace or snippet state, not the per-filter visible live CodeMirror content
- If you need the staged write payload instead, use `du_editor_pending_import`

---

## 8. Save / Apply

- Tool: `du_editor_save` with `targetKind = lua_editor`
- Note: in practice this often follows the same save/apply path and may close the whole Lua editor
- Very important: for `lua_editor`, save/apply is not proof of board restart or new running runtime
- Optional visual check: a targeted screenshot after apply can help distinguish "editor saved" from "screen actually changed"
- If nothing was actually edited, do not use save/apply as an exit path just because a different slot or filter was selected.
- For `lua_editor` with no real code change, exit with `Cancel` or `Escape`.
- With unchanged code visible in `lua_editor`, expect two `Escape` taps to close.
- Special case: if no Lua filter is selected at all, one `Escape` tap closes the editor.
- For `screen_editor` with no real code change, exit with `Escape`, and expect two taps.

### 8A. Valid Board Runtime Test

A valid Programming Board runtime test requires all three:

1. real board off/on
2. fresh Lua chat lines from that exact run
3. visible screen result from that exact run

If one is missing, the runtime validation is incomplete.

### 8B. `pcall` Rule for Live Runtime

Do not introduce `pcall` wrappers around known DU runtime API calls.

This especially applies to:

- `setRenderScript(...)`
- `setScriptInput(...)`
- `getInput()`
- `system.print(...)`
- known linked-element methods

If a direct known API call fails, the failure should be visible instead of being hidden or distorted by `pcall`.

---

## 9. NDJSON Cross-Check

1. Tail or open the latest lines of `bridge-events.ndjson`.
2. For each MCP call, expect `command_enqueued` -> `command_result` -> `probe_result`.
3. If `probe_result` is missing, check the mod logs, the command file processing, and the visible game state.

---

## 10. Build / Release Checklist

- [ ] `DuMcpBridge`: `npm run build`
- [ ] `ModUiToolbox`: `dotnet build -c Release` and deploy the DLL
- [ ] Build the Lua probe, publish the override, inject it, and verify the chat hash line
- [ ] Restart or reload the MCP client if tool schemas changed

---

## 11. Repo References

- [README.md](/d:/github/du-tobi/DuMcpBridge/README.md)
- [README.md](/d:/github/du-tobi/ModUiToolbox/README.md)
- [README.md](/d:/github/du-tobi/live_lua_coding/README.md)
- [du-visual-subagent.md](/d:/github/du-tobi/du-visual-subagent.md)

---

Adjust paths, `playerId`, and board context details as needed for the current environment.
