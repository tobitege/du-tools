# DU Visual Subagent Workflow

Purpose: define a probe-first workflow for a helper subagent that uses screenshots only when the visible Dual Universe client state matters and the normal structured probe results are not enough.

This is a dev-process document, not a production feature contract.

Screenshot tooling note:

- the screenshot MCP is optional, not required for normal DU work
- if it is not installed, stay probe-first and continue without screenshot-only validation

## Why This Exists

For live DU work, normal `DuMcpBridge` probe calls should stay the default path because they are smaller, faster, and more structured than screenshots.

A screenshot-capable helper subagent is still useful when:

- the visible client state may have drifted from the last probe state
- a native input step such as `Ctrl+L` / `du_open_editor_native` may have hit the wrong UI
- `apply` succeeded structurally, but the visible result is still uncertain
- an overlay, dialog, or in-world state might block the next step

The design goal is:

- main agent stays probe-first
- visual helper subagent handles targeted screenshot checks
- screenshot payloads stay off the main thread unless truly needed

## Core Rules

1. Always try the structured probe path first.
2. Use screenshots only when the visible DU client state is important and probe results do not fully answer the question.
3. Do not capture at every step. Image payloads are much heavier than normal bridge events.
4. The visual subagent should usually return text summaries to the main agent, not raw screenshots unless the case is ambiguous.
5. For the same `playerId`, do not let the main agent and the visual subagent both send live in-game actions at the same time.
6. Treat the visual subagent as the temporary owner of in-game input for the duration of its step sequence.
7. If a screenshot was requested, the subagent must state explicitly whether it actually used the screenshot tool and must include a few concrete visual details from the image. Probe state alone does not count as visual confirmation.
8. For live Dual Universe work in this repo, read `du-tests.md` before the first live MCP step and treat it as authoritative.
9. If a screenshot is too large to return inline, save it under `tmp/` with a deterministic name and report the file path back to the main agent.

## Recommended Ownership Model

When the visual subagent is active for `playerId = X`:

- the main agent may still read repo files, logs, and docs
- the main agent should avoid live editor actions for that same `playerId`
- the visual subagent should perform a small fixed action sequence and then stop
- once the subagent reports back, control returns to the main agent

This avoids races in the live DU UI.

## Fixed Workflow

### Phase 1: Probe First

0. Read `du-tests.md` first and keep its truth model active:
   - visible result wins over chat
   - board runtime validation requires a real off/on cycle
   - session-sensitive live calls for the same `playerId` must stay sequential
   - a visible Lua handler label such as `onStart()` is not a unique identity when duplicate rows exist in the same slot
   - if duplicate Lua names exist, the exact live filter index/key must be verified before the context is treated as proven
   - if no real code change was made, do not assume `Apply` is enabled
   - for `lua_editor` with no real code change, close with `Cancel` or `Escape`
   - with unchanged code visible in `lua_editor`, `Escape` typically requires two taps
   - special case: if no Lua filter is selected at all, one `Escape` tap closes the editor
   - for `screen_editor` with no real code change, close with `Escape`, and expect two taps
   - reinject probe or payload code only with the editor closed
1. Read the latest structured state first:
   - `du_list_active_sessions`
   - `du_ui_describe(uiKind = lua_editor)` or `du_ui_wait(uiKind = lua_editor)`
   - optional `du_tail_runtime_logs` or `du_get_last_result`
2. Decide whether a screenshot is actually needed.

Use a screenshot only if one of these is true:

- editor visibility is unclear
- a native open step is about to happen
- a native open step just happened
- `apply` just happened
- the user explicitly wants visual confirmation

### Phase 2: Visual Confirmation

Preferred screenshot call:

- `ScreenShotNet.capture_window_screenshot`
  - `windowTitle = "Dual Universe"`

If the full window is too large or too noisy, prefer:

- `ScreenShotNet.capture_center_screenshot`
- `ScreenShotNet.capture_screenshot` with a targeted region

If inline image return would exceed tool limits:

- use `savePath`
- then return the saved image path plus a text summary of what is visible

Goal:

- confirm the visible DU client state, not to drive normal UI automation by pixels

Typical states to classify:

- in-world looking at board/screen
- Lua editor open
- screen editor open
- context menu open
- submenu open with expected item ordering
- wrong UI open
- blocked by overlay or dialog
- unclear / ambiguous

### Phase 3: Action Ladder

If the task is to open the looked-at board editor:

1. Probe first.
2. Capture the `Dual Universe` window if the visible state is unclear.
3. Try `du_open_editor_native` without `sendEscapeFirst`.
4. Re-check via probe.
5. If still unclear, capture again.
6. If slot/filter identity is still ambiguous because duplicate Lua names are visible:
   - inspect the live manager filter list or switch by exact filter index
7. Only if the UI appears stuck, blocked, or clearly wrong:
   - retry `du_open_editor_native` with `sendEscapeFirst = true`
8. Re-check via probe.
9. If still unclear, capture again.

This keeps `Escape` as a fallback, not a default.

### Phase 4: Post-Apply Verification

After `du_editor_save` or other live save/apply steps:

1. Read probe/log state first.
2. If the visible result matters, take one targeted screenshot.
3. If the failure pattern is time-based, wait a few seconds and take one more screenshot.
4. Report whether the visible state appears:
   - stable
   - changed as expected
   - still blocked
   - ambiguous

## Suggested Subagent Output Format

The visual subagent should usually return a compact text summary like this:

- `state_before`: what was visibly on screen
- `probe_before`: important structured probe facts
- `actions_taken`: exact actions in order
- `state_after`: what was visibly on screen afterward
- `probe_after`: important structured probe facts afterward
- `result`: success / blocked / ambiguous
- `next_safe_step`: what the main agent can do next

If Lua slot/filter identity matters, include:

- `slot_filter_identity`: visible slot/filter plus exact live filter index/key when available

Example:

```text
state_before: in-world looking at the board, no editor visible
probe_before: lua_editor not visible
actions_taken: capture -> open_editor_native(no ESC) -> probe describe -> capture
state_after: Lua editor visible on Programming board xs [55]
probe_after: selectedSlot=unit selectedFilter=onStart() slot_filter_identity=index 0 key 0 title matches board
result: success
next_safe_step: main agent can now select unit/onStart
```

## Example Runtime Handoff

Do not pass this whole document to the subagent every time.

Use a short task brief instead, for example:

```text
Read du-tests.md first. Probe first. Only use Dual Universe window screenshots if the visible state is unclear or the task is explicitly visual.

For player 10000:
1. check current probe state
2. capture only if needed
3. if editor must be opened, try du_open_editor_native without ESC first
4. probe again
5. if still wrong or stuck, retry once with ESC
6. if apply just happened, optionally wait a few seconds and capture once more

Return text only:
- state_before
- actions_taken
- state_after
- result
- next_safe_step

If you captured images:
- say which screenshot tool you used
- include concrete visual details
- if inline return is too large, save under tmp/ and return the file path

Do not run parallel live in-game actions with the main agent for this player while you own this step.
```

This keeps the runtime handoff small while the full document stays available as the stable reference.

## When Not To Use The Visual Subagent

Do not spawn the visual subagent just because screenshots are available.

Keep work in the main agent when:

- a normal probe call already answers the question
- the step is pure repo/documentation work
- the step is only about code edits or local tests
- the live DU client state is already well understood

## Recommended Trigger Points

Good moments to use this workflow:

- before or after `du_open_editor_native`
- right after `du_editor_save`
- when a user says the visible client behavior does not match the tool result
- when the main agent suspects wrong UI focus, stuck overlays, or accidental `Escape`
- when the task is explicitly about context menus, submenu ordering, or visual-only UI labels

## Editor Exit Rule

- Do not assume a visible `Apply` button means a real edit happened.
- If no real code change was made in `lua_editor`, close with `Cancel` or `Escape`.
- With unchanged code visible in `lua_editor`, `Escape` typically requires two taps.
- Special case: if no Lua filter is selected at all, one `Escape` tap closes the editor.
- If no real code change was made in `screen_editor`, close with `Escape`, and expect two taps.

## Non-Goals

- not a replacement for `DuMcpBridge`
- not a pixel-click automation framework
- not a reason to bypass probe/runtime contracts
- not a reason to capture the game window continuously

## Repo Pointers

- `DuMcpBridge/README.md`
- `du-tests.md`
- `live_lua_coding/README.md`
