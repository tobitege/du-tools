# Bridge Live Test

Use this file as a repeatable test procedure for `DuMcpBridge`.
It is written as a testing manual, not as a test log.

## Scope

- public MCP tools exposed by `DuMcpBridge`
- live paths against an active Dual Universe client
- focus areas covered here:
  - native bridge entry points
  - `screen_editor`
  - chat
  - basic observability

Not covered here:

- undocumented gameplay hotkeys
- assumptions about screen-editor reopen behavior that are not fully verified

## Preconditions

Make sure all of the following are true before starting:

- `DuMcpBridge` is built and reloaded by the MCP host
- any probe or payload changes have been reinjected
- at least one active player session is available
- AutoHotkey v2 is installed and reachable by the bridge
- the target UI is in a state where the documented bridge tools can act on it

## 1. Baseline Checks

Run these checks first to confirm that the bridge is alive and that a live session is available.

1. `du_list_active_sessions(limit = 20)`
Pass criteria:

- returns at least one active session
- a usable `playerId` is available for the following steps

1. `du_get_last_result()`
Pass criteria:

- returns a recent bridge event such as `bridge_status` or another fresh result

1. `du_tail_runtime_logs(playerId = <playerId>, limit = 20..30)`
Pass criteria:

- returns recent `command_result` and bridge log lines

## 2. Native Bridge Helper Checks

1. `du_camera_move(x = 0, y = 0, settleMs = 0)`
Pass criteria:

- the tool returns success
- there is no meaningful side effect beyond focus and centering behavior

1. `du_open_editor_native(playerId = <playerId>, timeoutMs = 12000)`
Pass criteria:

- opens one supported editor
- follow with `du_ui_describe(...)` to confirm which editor opened
- **Recommended**: Use an external screenshot tool (e.g., ScreenShotNet `capture_window_screenshot`) to visually confirm the editor is visible on screen - this provides a human-verifiable confirmation that the native input was received correctly.

## 3. Lua Editor Read Path (and screen_editor adaptation)

Use this section when `lua_editor` (or `screen_editor`) is open. The editor requires both a slot AND a filter with actual code to be selected before the code editor is populated.

### 3a. Confirm editor is open

1. `du_ui_describe(uiKind = lua_editor, playerId = <playerId>)`
Pass criteria:

- `visible = true`
- `title` is populated
- `slots` array contains available slots (e.g., library, system, construct, unit, etc.)
- `selectedSlot` is `null` (no slot selected yet)
- `filters` array is empty or contains filter entries
- `selectedFilter` is `null` (no filter selected yet)
- `codeLength = 0` (no code loaded because nothing selected)

### 3b. Select a slot

1. `du_ui_invoke(uiKind = lua_editor, method = select_slot, slotName = "unit", playerId = <playerId>)`
Pass criteria:

- `selectedSlot` is now "unit"
- `filters` array populates with available filter entries (e.g., onTimer, onStart)
- `codeLength` is still `0` (no filter selected yet)

### 3c. Select a filter with existing code

1. `du_ui_invoke(uiKind = lua_editor, method = select_filter_index, filterIndex = 0, playerId = <playerId>)`
Pass criteria:

- `selectedFilter` is populated (e.g., "onStart()")
- `codeLength > 0` (code is now loaded)
- verify via `du_ui_describe(...)` that codeLength reflects actual code size

### 3d. Wait for editor to be ready

1. `du_ui_wait(uiKind = lua_editor, playerId = <playerId>, requireVisible = true)`
Pass criteria:

- `ready = true`

### 3e. Read DOM content

1. `du_ui_invoke(uiKind = lua_editor, method = outer_html, selector = ".CodeMirror", playerId = <playerId>)`
Pass criteria:

- returns a successful DOM snapshot of the CodeMirror editor
- contains actual Lua code lines

### 3f. Raw eval (debug)

1. `du_ui_invoke(uiKind = lua_editor, method = raw_eval, functionBody = "return { debug = 'test', timestamp = system.getTime() }", playerId = <playerId>)`
Pass criteria:

- returns a structured debug result from the runtime
- Note: requires slot AND filter to be selected first

## 4. Screen Editor Close Path via Cancel

Use this path when the goal is to close the editor without saving.

1. `du_ui_invoke(uiKind = screen_editor, method = cancel, playerId = <playerId>)`
Pass criteria:

- probe cancel succeeds
- delayed native `Escape` cleanup succeeds
- final `describe` result reports `visible = false`

1. Optional screenshot reality check
Pass criteria:

- no editor window remains open
- the client is back in a free in-world state

## 5. Screen Editor Save Path

Use this path only when the buffer has a real pending change.

Important rule:

- A `screen_editor` save without an actual change is not a valid close test.
- Before `du_editor_save(targetKind = screen_editor)`, the buffer must be dirty.

Procedure:

1. Create a local test copy of the current screen code
Recommended approach:

- make a semantically neutral minimal change, for example one extra blank line

1. `du_editor_push_code(playerId = <playerId>, targetKind = screen_editor, sourcePath = <test file>)`
Pass criteria:

- staging succeeds

1. `du_ui_describe(uiKind = screen_editor, playerId = <playerId>)`
Pass criteria:

- `canApply = true`

1. `du_editor_save(playerId = <playerId>, targetKind = screen_editor)`
Pass criteria:

- `command_result` contains `screen_editor save`
- the editor closes
- the bridge runs the delayed native `Escape` cleanup

1. `du_ui_describe(uiKind = screen_editor, playerId = <playerId>)`
Pass criteria:

- `visible = false`

1. Optional screenshot reality check
Pass criteria:

- the client is back in a free in-world state in front of the screen
- no editor remains open

## 6. Screen Editor Negative Checks

Run these checks while the editor is not visible.

1. `du_ui_invoke(uiKind = screen_editor, method = apply, playerId = <playerId>)`
Pass criteria:

- returns `screen_editor_not_visible`

1. `du_ui_invoke(uiKind = screen_editor, method = cancel, playerId = <playerId>)`
Pass criteria:

- returns `screen_editor_not_visible`

## 7. Chat Checks

1. `du_chat_snapshot(playerId = <playerId>)`
Pass criteria:

- returns a snapshot of the currently visible HUD chat channel

1. `du_chat_ai_mentions(playerId = <playerId>)`
Pass criteria:

- returns filtered `@ai` messages from the currently visible HUD chat channel

1. `du_chat_select_channel(playerId = <playerId>, channelId = "2")`
Pass criteria:

- channel `Aphelia` is selected

1. `du_chat_send_message(playerId = <playerId>, channelId = "2", message = "<smoke>")`
Pass criteria:

- returns a successful send result for `Aphelia`

1. `du_chat_create_channel(playerId = <playerId>, channelName = "<3-10 chars>")`
Pass criteria:

- selects a new or existing custom channel successfully

1. Optional switch back to `Aphelia`
`du_chat_select_channel(playerId = <playerId>, channelId = "2")`

## 8. Server Chat Opt-In Check

1. `du_chat_server_snapshot(playerId = <playerId>, limit = 50)`
2. `du_chat_server_mentions(playerId = <playerId>, limit = 50)`

Pass criteria:

- neither call times out
- if server chat support is not enabled in the mod build, the calls return the explicit negative response `server_chat_opt_in_disabled`

## 9. Resource Checks

1. `list_mcp_resource_templates(server = DuMcpBridge)`
Pass criteria:

- templates exist for:
  - `du://session/{playerId}/active-code`
  - `du://session/{playerId}/last-result`
  - `du://session/{playerId}/runtime-log`

1. `list_mcp_resources(server = DuMcpBridge)`
Pass criteria:

- response is valid
- empty output is acceptable if no instantiated resources are currently exposed

## Open Point

- A reliable screen-editor reopen test from the free in-world state using only the bridge steps documented here is still open.
