# live_lua_coding

This folder is the operator manual and tracked artifact area for live Dual Universe bridge work.
It now separates shared live-coding workflow helpers from concrete examples.

Use it when you need to do any of the following safely:

- orient the camera onto a Screen or Programming Board
- open the correct editor through the bridge
- move code between a local file and the live editor
- inspect live UI state without guessing
- save or cancel safely
- recover from broken or unclear client states

This document is written for a first-time human user or AI assistant.
It is intentionally procedural.
If a step says to verify state first, do that before continuing.

## 0. Folder Layout

The root of `live_lua_coding/` contains the shared workflow documentation, fallback helpers, and test notes for working against Dual Universe through the bridge.

Concrete demos now live under `live_lua_coding/examples/`.

- `examples/form_editor/` — First example. Screen-side form editor where a board restores persisted layout state, renders a reduced screen script, and accepts move or resize deltas back from the screen.
- `examples/form_editor_v2/` — Simplified form editor workflow using a library-onStart pattern.

That split keeps the root folder reusable for future examples without tying every workflow note to one specific demo.

## 1. Canonical Rule Set

Use the MCP bridge surface as the primary control path.

Primary tools:

- `du_camera_move`
- `du_open_editor_native`
- `du_ui_describe`
- `du_ui_wait`
- `du_ui_invoke`
- `du_editor_pull_code`
- `du_editor_push_code`
- `du_editor_save`
- `du_get_last_result`
- `du_tail_runtime_logs`
- `du_list_active_sessions`

Treat local AHK and PowerShell helpers in this folder as fallback or measurement tools.
Do not switch to them just because the MCP path feels slower.

Do not assume any undocumented gameplay hotkey is part of the supported bridge workflow.

## 2. Safety Rules

These rules matter because a wrong action can lose unsaved changes or leave the client in a blocked state.

- Never save unless you have confirmed the correct live editor is open.
- Never trust stale code snapshots as proof of current live editor state.
- Never treat `du_editor_pull_code` or `ide-workspace\...\snippet.lua|snippet.txt` as proof of the exact visible editor buffer.
- Never use `du_editor_push_code` as if it opens the editor. It does not.
- Never use `du_editor_save` as if it chooses the target buffer for you. It does not.
- Never assume a `lua_editor` save or apply causes a Programming Board execution restart. It does not prove that.
- Do not wrap known Dual Universe API calls in `pcall` in live board or screen runtime code. For known calls such as `setRenderScript(...)`, `setScriptInput(...)`, `getInput()`, `system.print(...)`, and normal linked-element methods, use the direct call path.
- For `screen_editor`, a save is only a valid test if the buffer is actually dirty.
- For `lua_editor`, always establish slot and filter before pushing code.
- Prefer structured probe reads first and screenshots second.
- Prefer the simplest transport that can possibly work.
- Before trusting a new live fix, confirm the screen-side result, not only board-side logs.
- If board logs and the visible screen disagree, trust the visible screen first.
- For board-runtime validation, use an explicit board off/on cycle and then verify the visible screen result plus fresh Lua chat lines. Do not treat editor save/apply alone as a restart test.
- Measure the built render-script size before a live push whenever screen code changed.
- Do not keep adding transport layers until the current smallest viable path has been disproven.
- If the current client state is unclear, stop and re-check instead of guessing.

### 2C. PowerShell Command Rules

Small PowerShell syntax mistakes can invalidate a live test just as much as a bad Lua patch.

- Do not wrap variable-containing paths in single quotes if PowerShell must expand them.
- Prefer `Join-Path`, tokenized arguments, or double-quoted strings for paths with variables.
- If a command reads or writes a path derived from `$HOME`, `$PWD`, `$env:...`, or another variable, check the final expanded path before trusting the result.
- If a PowerShell command fails because of quoting, rerun the corrected command end-to-end before drawing conclusions from the failed run.

Correct:

```powershell
$path = Join-Path $HOME 'file.txt'
Get-Content -Path $path
```

Wrong:

```powershell
Get-Content -Path '$HOME/file.txt'
```

## 2A. Code Source Model: Live Buffer vs IDE Sync vs Repo File

This distinction is critical.
Most confusion in live DU work comes from mixing up these different sources of code.

### Live editor buffer

This is the actual code currently visible in the in-game editor.

For `screen_editor`, this means the visible screen CodeMirror instance in the open editor.

For `lua_editor`, this means:

- the Lua editor is visibly open
- the intended slot is actually selected
- the intended filter is actually selected
- the visible CodeMirror content belongs to that slot + filter

Use these tools to reason about the live buffer:

- `du_ui_describe`
- `du_ui_wait`
- `du_ui_invoke(..., method = outer_html, ...)`

For Programming Board work, the live buffer is the source of truth when you need to know what the player is actually looking at right now.

Important:

- Updating or saving the live `lua_editor` buffer does not prove that the board is now executing that code.
- Treat the editor buffer and the executing board runtime as separate things until a real board restart has been validated.
- For board-to-screen work, the minimum valid execution test is:
  - explicit board off/on
  - fresh Lua chat messages from that new run
  - visible screen result after that run

### IDE Sync workspace snapshot

This is the external-editor handoff path added by our mod and probe.

Critical prerequisite:

- A running `sync-ide.ps1` watcher must already exist for the current live session.
- The in-game `IDE Sync` button does not update `snippet.lua|snippet.txt` or `snippet.json` by itself.
- Without that watcher, the editor can still emit a valid export packet, but the workspace files stay stale.
- In that state it looks as if `IDE Sync` "did nothing" even though the click itself worked.

Typical files:

- `D:\MyDUserver\tmp\ui-dumps\ide-workspace\player-<playerId>\lua_editor\snippet.lua`
- `D:\MyDUserver\tmp\ui-dumps\ide-workspace\player-<playerId>\screen_editor\snippet.txt`
- matching `snippet.json`

How it is produced:

- the player clicks the in-game `IDE Sync` button added by the probe, or
- the bridge stages a file through the same IDE-import contract

What it is for:

- opening the exported code in Cursor or another IDE
- editing that exported file locally
- letting the watcher or MCP write back through `ide_import.player-<playerId>.<targetKind>.json`

What must be true before you trust it:

- the watcher was started explicitly for this session
- the workspace file timestamp changed after the export click
- `snippet.json` also changed and matches the expected slot/filter context
- if either file is missing, treat the workspace snippet pair as invalid

What it is not:

- not a guaranteed fresh live export on demand
- not guaranteed to match the exact visible editor buffer at this moment
- not safe proof that the currently open Lua slot/filter is the one you think it is

The workspace snapshot is a transport artifact for external editing.
It is useful, but it is not the same thing as the live visible editor buffer.

### Pending IDE import payload

This is the file-based write contract used to get local edits back into the open editor.

Typical file:

- `D:\MyDUserver\tmp\ui-dumps\payload-overrides\ide_import.player-<playerId>.<targetKind>.json`

This means "a local edit is staged for import".
It does not by itself prove that the correct editor is open or that the import has already landed in the visible buffer.

### Tracked repo source file

This is the file in the git repo that you intentionally edit and push from, for example:

- `live_lua_coding/examples/form_editor/unit-onStart.lua`
- `live_lua_coding/examples/form_editor/unit-onTimer-UPD.lua`

For deliberate development work, prefer tracked repo files as the stable local source of truth.
Use the IDE workspace as an external-editor exchange path, not as the long-term canonical artifact.

## 2B. form_editor Persistence Path

This is the exact persistence path used by the first `examples/form_editor` example.

High-level flow:

1. `unit.onStart` restores the last persisted ScreenLayoutEditor record from the databank.
2. The board builds a reduced render-only ScreenLayoutEditor script for the linked screen.
3. The restored layout is sent to the screen as a compact startup patch through `setScriptInput(...)`.
4. The screen runs that script, lets the user move or resize elements, and emits only a small delta string through `setOutput(...)`.
5. `unit.onTimer("UPD")` reads that delta with `Screen.getScriptOutput()`, rebuilds the full document board-side, validates it, and writes the compact persisted record back to the databank.
6. On the next board restart, `unit.onStart` restores that persisted record again, so the screen does not fall back to the vanilla layout.

### Detailed data flow

#### 1. Restore on board start

Board side:

- `live_lua_coding/examples/form_editor/unit-onStart.lua`
- helper module embedded from `live_lua_coding/examples/form_editor/ScreenLayoutEditor.lua`

What happens:

- `RestoreScreenLayoutEditorEnvelope(...)` reads the databank key `screen_layout_editor:document`.
- The persisted value is parsed with `readPersistedEnvelope(...)`.
- The board logs restore diagnostics such as:
  - `r ok ...`
  - `r mc=x,y wxh`

Important:

- The databank does not store the full huge screen script.
- It stores a compact persistence record with:
  - revision
  - hash
  - compact layout patch `m`
  - source screen size `sx` / `sy`
  - selected element id `si`

#### 2. Board -> screen startup handoff

What happens:

- `unit.onStart` does not send the full restored document as a huge literal anymore.
- The board restores the canonical document on the board side.
- The board sends a small startup patch through `setScriptInput(...)`.
- The screen reconstructs the restored document from that patch.
- The screen still receives the script through `setRenderScript(...)`.

Important:

- This is the preferred path for this workflow.
- A full embedded startup document can easily push the screen script over the hard 50000-char limit.
- A startup patch is much safer than a full serialized document.
- Only add chunking if the compact patch itself has been proven too large.
- Do not introduce startup ack loops unless a direct patch input has already been ruled out by a real live test.

#### 3. Screen-side editing

Screen side:

- render-only slice of `ScreenLayoutEditor`

What happens:

- The render script reconstructs the initial layout from the embedded startup patch.
- Dragging and resizing update the local document.
- On commit, the screen does not emit the full document.
- It emits a small transport delta through `setOutput(...)` in this form:
  - `d|rev|elementId|x|y|w|h|screenW|screenH`

Important:

- The transport uses the stable element id, not an edit index.
- This avoids `delta_id` failures when element ordering changes.

#### 4. Screen -> board polling

Board side:

- `live_lua_coding/examples/form_editor/unit-onTimer-UPD.lua`

What happens:

- `unit.onTimer("UPD")` polls `Screen.getScriptOutput()`.
- It accepts either:
  - the compact delta transport `d|...`
  - or probe output `p|...`
- For real deltas it rebuilds the full document using the board-side last known document.
- Then it creates the persisted compact record with `buildPersistenceRecord(...)`.

Important:

- The screen has no databank access.
- All validation and all persistence happen on the board.

#### 5. Databank write

What happens:

- `databank.setStringValue(...)` writes the compact persisted record.
- The board immediately reads it back again to verify the write.
- Typical diagnostics are:
  - `db r=... h=... b=...`
  - `dup r=... h=...`
  - `db rb ...`

Important:

- `dup ...` is not an error.
- It means the same revision/hash was already persisted.

### Diagnostics that matter

Useful Lua-chat diagnostics:

- `r ok ...`
  Restore from databank succeeded.
- `r mc=x,y wxh`
  Restored `main_canvas` geometry on the board side.
- `v <build>`
  Running `unit.onStart` build marker.
- `t <build>`
  `setTimer("UPD", 0.1)` succeeded.
- `u <build> ...`
  Running `unit.onTimer("UPD")` build marker.
- `rx b=<n>`
  Board received screen output with `<n>` bytes.
- `pr e=... l=... r=...`
  Probe output from the screen instead of a real delta.
- `db ...`
  Databank write succeeded.
- `dup ...`
  Databank already had the same persisted state.
- `rej: ...`
  Board rejected screen output.

### Log levels

Board-side diagnostics can be throttled with the exported parameter in `live_lua_coding/examples/form_editor/unit-onStart.lua`:

- `SLE_DIAG = true`
  Master switch for ScreenLayoutEditor Lua-chat diagnostics.
- `SLE_LOG_LEVEL = "debug"`
  Show everything, including build markers, receive sizes, probe output, duplicate writes, and restore geometry.
- `SLE_LOG_LEVEL = "info"`
  Balanced mode. Show successful restore and databank writes, but hide the noisy probe and transport chatter.
- `SLE_LOG_LEVEL = "error"`
  Current default. Show only actual problems such as rejected output, databank failures, restore failures, or oversize payloads.

Current message groups:

- `debug`
  `v ...`, `t ...`, `u ...`, `sc ...`, `rx ...`, `pr ...`, `dup ...`, `r mc ...`, `r nk`, `r mt`
- `info`
  `r ok ...`, `db r=...`
- `error`
  `te ...`, `r skip: no db`, `r get`, `r bad: ...`, `r hk`, `db skip: no db`, `db rb ...`, `db err: ...`, `rej: ...`, `long ...`

### What can go wrong

These were the important real failure modes during live work.

- Wrong live Lua filter selected.
  `unit.onTimer("UPD")` and `unit.onStart()` must both be updated in the correct visible context. A save into the wrong filter silently leaves the running code unchanged.

- IDE Sync confusion.
  `snippet.lua` is only a transport file. It is not proof of the actually visible live buffer unless the editor context and watcher state are confirmed.

- Screen script over 50000 chars.
  This is the main reason a screen can appear to ignore new logic and stay on an older script.
  The safe pattern is:
  - render-only screen code
  - compact startup patch
  - compact runtime delta output

- Built screen script size not measured before live push.
  If the measured render build exceeds the safe screen limit, a live test is not trustworthy.
  Check the built size first, then push.

- Startup helpers referenced too early.
  Code inside the board-side render-script builder must not call helpers that are defined later only inside the embedded module source.
  Examples that already failed in practice:
  - `append(...)`
  - `serializeString(...)`
  - `numberOrNil(...)`

- Screen sending only probe output.
  If you only see very small outputs and repeated `pr ...`, the real layout delta is not making it through. Check:
  - render script size
  - startup script actually updated
  - delta transport generation

- Board says restore succeeded, but screen still shows default.
  This means the failure is in the final screen-side import or apply step, not automatically in the DB reader or the board-side restore log.
  In that case:
  - inspect the visible screen text first
  - inspect the screen import path second
  - only revisit DB parsing if the screen import path is already disproven

- Delta keyed by unstable index.
  If the board logs `rej: delta_id`, the screen likely sent an index-like reference instead of a stable element id.

- Timer not actually running.
  If `t ...` is missing, `unit.onTimer("UPD")` will never poll the screen.

- Restore record missing source dimensions.
  The persisted record must carry `sx`, `sy`, and `si`. Without them, restore validation can accept the record but reconstruct the wrong layout.

- `setRenderScript(...)` ordering assumptions.
  Do not assume one big `setScriptInput(...)` payload is safe.
  But also do not jump straight to chunking if a compact startup patch fits.
  Use the smallest proven startup format first.

### Practical rules for future changes

- Keep runtime screen output small.
- Keep startup payload small.
- Let the board own the full canonical document.
- Let the screen own only interaction, restore application, and delta emission.
- If persistence breaks, inspect the visible screen and the Lua chat together before changing transport format again.
- If a change touches startup transport, immediately re-check total render script size.
- If a change touches transport ids, keep stable element ids end-to-end.
- If a simpler existing helper already solves the transport, use it before inventing a larger new path.
- If a fix depends on local reasoning but the screen still shows old behavior, verify the real live screen code and not only the repo file.

## 3. What Must Already Be True

Before starting, make sure all of the following are true:

- `DuMcpBridge` is built.
- The MCP host has reloaded the updated bridge after the build.
- If probe files changed, the updated probe payload has been reinjected.
- The Dual Universe client is running.
- The player is online.
- AutoHotkey v2 is installed and reachable by the bridge.
- At least one active bridge session exists.
- If you plan to use the in-game `IDE Sync` button, `tools\sync-ide.ps1` is already running.

Recommended helper:

- `.\live_lua_coding\Start-DuIdeSyncWatcher.ps1`
- This starts or reuses the `sync-ide.ps1` watcher only.
- It does not start or stop `DuMcpBridge` / the MCP server.

Minimum readiness check:

1. `du_list_active_sessions(limit = 20)`
Expected:
returns at least one session and gives you a usable `playerId`.

2. `du_get_last_result()`
Expected:
returns a recent bridge event.

3. `du_tail_runtime_logs(playerId = <playerId>, limit = 20..30)`
Expected:
shows fresh bridge activity.

4. If you plan to use the in-game `IDE Sync` button, confirm that the sync watcher is already active.
Expected:
the current machine has a running `sync-ide.ps1` process pointed at `D:\MyDUserver\tmp\ui-dumps`.

Recommended local command:

```powershell
.\live_lua_coding\Start-DuIdeSyncWatcher.ps1
```

This helper intentionally does only one thing:

- it starts or reuses the `sync-ide.ps1` watcher
- it does not touch `DuMcpBridge` / the MCP server

If one of those checks fails, do not continue into editor actions.

## 4. Files And Examples In This Folder

Shared workflow helpers in `live_lua_coding/`:

- `du_control_center.ahk`
  Local native helper for focus, fallback editor handling, key sends, and client-pixel actions.
- `du_view_common.ahk`
  Shared AHK helpers used by the local scripts.
- `Test-DuClientPixels.ps1`
  Local smoke test for `ui_calibrate` and `click_client_px`.
- `du-client-pixel-live-tests.md`
  Notes for screenshot-aware client-pixel testing.
- `Test-DuCameraSteering.ps1`
  Local camera steering harness for repeatability and sweep testing.
- `Start-DuIdeSyncWatcher.ps1`
  Starts or reuses the local `sync-ide.ps1` watcher for IDE Sync. It does not manage `DuMcpBridge` / MCP.
- `du-camera-steering-tests.md`
  Notes for measuring visible steering effects by screenshot comparison.

First example in `live_lua_coding/examples/form_editor/`:

- `unit-onStart.lua`
  Exact tracked snapshot of the board `unit.onStart` script for the form-editor example.
- `unit-onTimer-UPD.lua`
  Exact tracked snapshot of the board `unit.onTimer("UPD")` script for the form-editor example.
- `ScreenLayoutEditor.lua`
  Shared module used to build the render script, serialize layout patches, and handle persistence helpers.
- `scripts/Test-ScreenLayoutEditorOffline.ps1`
  Offline check for the ScreenLayoutEditor serialization and persistence pipeline.

Second example in `live_lua_coding/examples/form_editor_v2/`:

- `unit-onStart.lua`
  Board `unit.onStart` script using the simplified library-onStart pattern.
- `unit-onTimer-UPD.lua`
  Board `unit.onTimer("UPD")` script.
- `library-onStart.lua`
  Library-slot onStart entry point.
- `ScreenLayoutEditor.lua`
  Shared ScreenLayoutEditor module.

## 5. Client State Model

You need to think in client states, not just commands.

Common states:

- Free in-world state
  The player is in the world and no editor is open.
- Element targeted under crosshair
  The camera is aligned so that the intended element is the current interaction target.
- `screen_editor` visible
  The screen content editor is live and probe calls act on it.
- `lua_editor` visible
  The programming board editor is live and probe calls act on it.
- Dirty buffer
  The editor has unsaved changes.
- Clean buffer
  The editor has no unsaved changes.
- Mouse-captured blocked state
  The editor looks gone or partly gone, but the client still needs cleanup to return to normal world interaction.
- Options UI accidentally opened
  A recovery `Escape` was sent from a normal in-world state and opened the game Options UI instead of clearing a problem state.

Important reinject safety rule:

- Never reinject probe or UI payload code while `lua_editor` or `screen_editor` is open.
- Treat any visible editor as "UI code is still live" even if you only intend to refresh the probe.
- Before any reinject, first return to a confirmed free in-world state with no editor open.
- If this was not verified, stop and recover the client back to the world before reinjecting anything.

The correct next step depends on the current state.
Do not treat all failures as the same failure.

## 6. How To Look Around Safely

The canonical live camera path is `du_camera_move(x, y)`.

Use it iteratively:

1. Start from a known baseline.
2. Apply a small movement with `du_camera_move`.
3. Re-check the visible result.
4. Repeat until the intended element is under the crosshair.

Example:

```text
capture or inspect
-> decide small x/y adjustment
-> du_camera_move(x, y)
-> capture or inspect again
```

Important limits:

- Visible pixel travel depends on window size, avatar pose, camera distance, and current scene.
- Old observed movement values are not stable calibration constants.
- Do not make large blind repeated guesses if the target is not clearly moving as expected.

When the visible state matters more than the last structured probe result, use a screenshot as a reality check.

## 7. How To Confirm The Bridge Can See A Live Editor

Use these tools:

- `du_ui_describe`
- `du_ui_wait`

For `screen_editor`, a usable visible snapshot usually includes:

- `visible = true`
- non-empty `title`
- non-empty `mode`
- `codeLength > 0`

For `lua_editor`, a usable visible snapshot usually includes:

- `visible = true`
- non-empty `title`
- populated slot information or filter information

If `describe` returns an empty safe snapshot, do not continue as if the editor were open.

## 8. How To Open A Screen Editor

Use this procedure:

1. Confirm a valid `playerId` through the baseline checks.
2. Orient the camera until the intended screen is under the crosshair.
3. Run `du_open_editor_native(playerId = <playerId>, timeoutMs = 12000)`.
4. Immediately confirm with `du_ui_describe(uiKind = screen_editor, playerId = <playerId>)`.

Pass criteria:

- `du_open_editor_native` returns a successful invocation.
- `openedUiKind = screen_editor`, or the follow-up `du_ui_describe` confirms a visible `screen_editor`.

If the editor does not become visible:

- do not continue to push or save
- re-check the visible target and the current client state
- if necessary, use a screenshot to confirm what the player actually sees

## 9. How To Open A Programming Board Editor

Use this procedure:

1. Confirm a valid `playerId` through the baseline checks.
2. Orient the camera until the intended board is under the crosshair.
3. Run `du_open_editor_native(playerId = <playerId>, timeoutMs = 12000)`.
4. Immediately confirm with `du_ui_describe(uiKind = lua_editor, playerId = <playerId>)`.

Pass criteria:

- `du_open_editor_native` succeeds.
- `lua_editor` is visibly open according to the follow-up describe or wait path.

If the editor does not become visible:

- do not continue to slot, filter, push, or save steps
- re-check the visible target first

## 10. Screen Editor Development Cycle

This is the canonical bridge-driven edit cycle for a Screen.

### 10.1 Confirm The Editor Is Live

Run:

- `du_ui_describe(uiKind = screen_editor, playerId = <playerId>)`
- optionally `du_ui_wait(uiKind = screen_editor, playerId = <playerId>, requireVisible = true)`

Do not continue until the screen editor is visibly live.

### 10.2 Pull Existing Code If Needed

Run:

- `du_editor_pull_code(playerId = <playerId>, targetKind = screen_editor)`

Use this as the last known code snapshot for local work.
Do not treat it as guaranteed proof of the exact current live editor buffer.

Important meaning of this pull:

- it reads the last known snapshot available to the bridge
- that snapshot can come from bridge state, IDE-sync workspace files, or a pending IDE import payload
- it does not force a fresh export from the currently visible in-game editor

So for `screen_editor`:

- use `du_editor_pull_code` when you need a convenient recent local snapshot
- use `du_ui_describe` and, when needed, `outer_html` when you need confidence about the actual live visible editor state

### 10.3 Edit A Local Source File

Edit a tracked local file in the repo.

For smoke testing a save path:

- make a semantically neutral minimal change
- example: add one extra blank line

This matters because `screen_editor` save is only a valid close test when the buffer is dirty.

### 10.4 Push Code Into The Live Screen Editor

Run:

- `du_editor_push_code(playerId = <playerId>, targetKind = screen_editor, sourcePath = <local file>)`

Expected:

- staging succeeds
- the workspace and import payload are updated

Then re-check:

- `du_ui_describe(uiKind = screen_editor, playerId = <playerId>)`

Expected for a real pending save:

- `canApply = true`

If `canApply` is still false, do not use `du_editor_save` as a save test yet.

### 10.5 Save

Run:

- `du_editor_save(playerId = <playerId>, targetKind = screen_editor)`

Expected behavior:

- the mod invokes `CPPScreenContentEditor.save(...)`
- the bridge runs delayed native `Escape` cleanup after the save injection
- the editor closes when the save path actually commits changes

Verify:

- `du_ui_describe(uiKind = screen_editor, playerId = <playerId>)`

Pass criteria:

- `visible = false`

Optional:

- use a screenshot to confirm the client is back in a free in-world state

### 10.6 Cancel Instead Of Save

If the goal is to exit without saving, use:

- `du_ui_invoke(uiKind = screen_editor, method = cancel, playerId = <playerId>)`

Expected behavior:

- the probe triggers the live cancel path
- the bridge runs delayed native `Escape` cleanup
- the editor closes

Verify:

- final `du_ui_describe(uiKind = screen_editor, playerId = <playerId>)` reports `visible = false`

### 10.7 Invalid Save Test

This is not a valid save-path test:

- opening the screen editor
- making no change
- running `du_editor_save`
- expecting the editor to close as proof that save works

If the buffer was still clean, that sequence proves nothing useful about the save path.

## 11. Programming Board Development Cycle

This is the canonical bridge-driven edit cycle for a Programming Board.

### 11.1 Confirm The Editor Is Live

Run:

- `du_ui_describe(uiKind = lua_editor, playerId = <playerId>)`
- optionally `du_ui_wait(uiKind = lua_editor, playerId = <playerId>, requireVisible = true)`

Do not continue until the Lua editor is visibly live.

### 11.2 Establish The Correct Slot And Filter

Use the canonical context path:

- `du_ui_invoke(uiKind = lua_editor, method = select_context, slotName = ..., filterName = ..., settleMs = ...)`

Why this matters:

- the Lua editor can have multiple slots and filters
- the active target buffer is not safe to guess
- slot changes are timing-sensitive

The preferred path is:

1. confirm the slot
2. wait for settle
3. resolve the visible filter by real name

Do not skip this step before code push.

Critical identity rule:

- a visible handler name such as `onStart()` is not a unique identity
- the probe now tracks Lua viewport/context memory from the live manager slot/filter identity instead of the older generic label path
- this fixes the common case where sibling filters with the same visible name used to share the wrong viewport memory
- it does not make duplicate names safe to guess from text alone
- if a slot contains duplicate `onStart()` or `onTimer(...)` rows, treat `select_context` as ambiguous until you inspect the live filter list or switch by filter index

Minimum timing rule:

- after any Lua filter change, the bridge must still wait at least 1 second before pushing code
- if a caller passes a shorter `settleMs`, the bridge should clamp it internally instead of rejecting the tool call
- `settleMs = 2000` on `select_context` is the safer default for live board work
- pushing immediately after a filter click can race the editor and leave the old buffer active
- probe-driven slot changes now send a full mouse sequence so the enhancement code can arm slot auto-open and viewport capture exactly like a manual click

Important naming trap:

- the generic `selectedFilter` label can still show `onTimer(timerId)` in the UI
- for this board, the real persistence handler is `onTimer(upd)`
- when there are multiple `onTimer(...)` filters, use a trusted probe that exposes `filterDetails` and confirm the real `signature`
- if the timer target is ambiguous, do not push yet

Why this matters even if `snippet.lua` exists already:

- the IDE Sync workspace can contain a previous export
- that previous export can still be useful for local editing
- but it is not enough to prove which Lua buffer is currently visible in-game
- and if no watcher was running when `IDE Sync` was clicked, the workspace can stay on an even older export although the live click succeeded

For Programming Board work, treat `slot + filter + visible CodeMirror content` as the verified live context.

### 11.2A Understand What `du_editor_pull_code` Means For Lua

`du_editor_pull_code(playerId = <playerId>, targetKind = lua_editor)` reads the last known Lua snapshot available to the bridge.

That snapshot is often the IDE-sync workspace file:

- `D:\MyDUserver\tmp\ui-dumps\ide-workspace\player-<playerId>\lua_editor\snippet.lua`

This usually reflects the latest IDE Sync workspace export.
It does not guarantee that the currently visible Lua editor buffer is the same code.

If the sync watcher was not running at export time, this file can remain unchanged even after a real in-game `IDE Sync` click.
That failure mode is especially misleading because the click can still produce a valid live `lua_ide_sync` packet while the workspace snapshot stays old.

This difference matters more for `lua_editor` than for `screen_editor` because:

- the Programming Board has multiple slots
- each slot can have multiple filters
- the player can be looking at one filter while the workspace still reflects another export

So when you need to answer "what code is live on screen right now?", use:

- `du_ui_describe(uiKind = lua_editor, playerId = <playerId>)`
- `du_ui_wait(uiKind = lua_editor, playerId = <playerId>, requireVisible = true)`
- `du_ui_invoke(uiKind = lua_editor, method = outer_html, selector = ".CodeMirror", playerId = <playerId>)`

Use `du_editor_pull_code` only as a recent local snapshot for external work, not as proof of current live slot/filter content.
If you need to inspect what is currently staged to be written back into the editor, use `du_editor_pending_import` instead of inferring from `du_editor_pull_code`.

### 11.3 Push Code

Run:

- `du_editor_push_code(playerId = <playerId>, targetKind = lua_editor, sourcePath = <local file>)`

Use this only after the correct slot and filter are established.

What this actually does:

- it stages the local file through the same file-based IDE-import contract used by the in-game `IDE Sync` workflow
- it updates the player-scoped workspace/import artifacts
- it relies on the correct live Lua context already being visible

This is different from a manual in-game `IDE Sync` click:

- `du_editor_push_code` writes the file-based artifacts directly
- the in-game `IDE Sync` button depends on the external `sync-ide.ps1` watcher to reassemble export packets into the workspace

What it does not do:

- it does not open the editor
- it does not choose the slot for you
- it does not choose the filter for you
- it does not make `du_editor_pull_code` become a guaranteed mirror of the visible live buffer

Critical routing detail:

- `du_editor_push_code` stages code using the last known Lua IDE-sync metadata
- in practice this means `snippet.json` must describe the same live context as the visible editor before you trust the workspace snippet
- if `snippet.json` still says `onStart()` while the live target should be `onTimer(upd)`, the workspace snippet is stale and must be refreshed before staging
- the export-side fix for this is now in the Lua probe: IDE Sync metadata is expected to carry the resolved active filter signature, for example `onTimer(UPD)`, plus a Lua-specific `contextKey` like `lua:...|filter=ontimer(upd)` instead of the older generic DOM label

Before a sensitive push, verify or refresh:

- `snippet.json`
- `reference.currentFilterSignature`
- `contextKey`

If those metadata are stale, use one of these paths:

- refresh them from a fresh export of the correct live filter
- or, if necessary for recovery, temporarily patch the metadata to the exact target filter, push once, then restore the metadata to the normal state

### 11.3A Verify The Import Landed Before Save

Do not save just because `du_editor_push_code` returned `staged`.

Check one of these before `du_editor_save`:

- `du_ui_describe` shows the expected `codeLength` change in the visible buffer
- `raw_eval` / CodeMirror readback matches the expected code
- the visible live buffer contains an unmistakable marker you intentionally changed

This matters because:

- the import file can exist
- the bridge can report `staged`
- and the visible editor can still show the previous buffer for that slot or filter

### 11.4 Save

Run:

- `du_editor_save(playerId = <playerId>, targetKind = lua_editor)`

Expected:

- the live Lua apply path is triggered

Note:

- Lua editor apply/save behavior can close the editor panel as part of the normal path
- after `apply()` returns, the Lua close path is still not fully done yet
- `du_editor_save(targetKind = lua_editor)` now waits about `2250 ms` and then best-effort calls `close_runtime_ui` for lingering runtime-module UI
- during that short cleanup window, do not send more Lua-editor probe actions
- do not treat an immediate manual `Ctrl+L` reopen as a stable signal yet
- do not assume a Lua close always returns the client to a usable free in-world state
- if a verified board-target `Ctrl+L` fails immediately after a Lua close, treat that as a recovery case for the open-editor path instead of sending unconditional close-time `Escape`
- do not parallelize additional probe calls on the same editor while saving
- if you need to update another Lua filter after a save, reopen the editor and re-establish slot + filter from scratch

### 11.5 Validate

After push or save, use:

- `du_ui_describe`
- `du_get_last_result`
- `du_tail_runtime_logs`

Use a screenshot only when the visible state matters more than the structured probe state.

For DU visual verification, do not default to a full-window capture.
The preferred reality-check capture is:

- left-middle area of the client
- up to about three quarters of the client width

Why:

- in UI mode, the left edge can show the game's green options/sidebar strip
- that left-edge signal is enough to prove you are in UI mode
- include enough width that the visual center of the client is still visible in the same capture
- in UI mode, do not assume the visual center of the client still points at the board, screen, or current target
- a centered capture can therefore miss the important state cue and create a false interpretation

MUST READ before any visual board-target decision:

- view `live_lua_coding/du-ref-board-screen-center.png`
- treat it as the calibration reference for this setup
- the large dark element at the top is the screen
- the upper console-like element is the programming board
- the smaller stacked box near the bottom is the databank
- the red `+` marks the real client center in that reference image

For board interaction, use this rule with no exceptions:

- the only valid reference point for `Ctrl+L` is the real client center
- use a centered capture when you need to decide whether `Ctrl+L` is allowed
- `Ctrl+L` is allowed only if that centered capture shows the programming board at the real client center
- if the centered capture does not show the board at the real client center, `Ctrl+L` is not allowed
- if you changed state yourself, for example with `Tab` or `du_camera_move`, capture again before the next decision
- after every camera move, treat the previous visual conclusion as invalid until a new centered capture confirms the new state
- do not infer board targeting from nearby geometry, side captures, or a rough visual impression
- do not assume a camera move helped; verify the exact result after every move

Use a left-middle capture to answer the mode question.
Use a centered capture to answer the board-target question.
If the camera is not on the board, re-aim first and verify again.
Do not confuse the programming board with nearby linked elements.
In the current HUD editor setup, the upper console-like element is the programming board.
The smaller stacked box element below it is a databank, not the board, and must not be used for `Ctrl+L`.
Board targeting is confirmed only when the real client center is on the upper board element itself.

For `lua_editor`, validation has two different questions:

- "Did the bridge file-transfer path stage or apply what I expected?"
- "Is the player actually looking at the intended live slot/filter buffer right now?"

Use these signals intentionally:

- `du_get_last_result` and `du_tail_runtime_logs` answer the bridge/import/apply question
- `du_ui_describe` and `outer_html` answer the visible live-buffer question
- `du_editor_pull_code` only answers "what is the last known snapshot on the file-based exchange path?"

Time note:

- bridge runtime logs and many stored bridge events are in UTC
- do not compare them to local in-game observations as if they were local time
- when correlating actions, always treat those timestamps as UTC first

## 12. How To Inspect Live UI Safely

Use these methods intentionally:

### `du_ui_describe`

Use when you need the current structured live snapshot.

### `du_ui_wait`

Use when the UI may still be opening or settling and you need a readiness gate.

### `du_ui_invoke(..., method = outer_html, ...)`

Use when you need a bounded DOM snapshot for debugging or selector confirmation.

### `du_ui_invoke(..., method = raw_eval, ...)`

Use only for trusted debugging.
This executes arbitrary JavaScript in the live HUD context.
It is not a normal workflow step.

## 13. Chat Workflow

The bridge also exposes live HUD chat and optional server-side chat helpers.

Canonical HUD chat checks:

1. `du_chat_snapshot(playerId = <playerId>)`
2. `du_chat_ai_mentions(playerId = <playerId>)`
3. `du_chat_select_channel(playerId = <playerId>, channelId = "2")`
4. `du_chat_send_message(playerId = <playerId>, channelId = "2", message = "<smoke>")`
5. `du_chat_create_channel(playerId = <playerId>, channelName = "<3-10 chars>")`

Important:

- HUD reads are limited to the visible or active HUD context
- server-side chat reads are a separate opt-in path

Server chat opt-in check:

- `du_chat_server_snapshot(playerId = <playerId>, limit = 50)`
- `du_chat_server_mentions(playerId = <playerId>, limit = 50)`

If the mod build does not support server chat reads, expect the explicit negative response:

- `server_chat_opt_in_disabled`

## 14. Local Helper Scripts In This Folder

These are not the canonical bridge path, but they are useful in the right situations.

### `Test-DuCameraSteering.ps1`

Use when you need repeatability checks or sweep measurements for visible camera motion.

Examples:

```powershell
pwsh -File .\live_lua_coding\Test-DuCameraSteering.ps1 -Mode repeatability -MoveX 20 -MoveY 0 -RepeatCount 5 -CaptureArtifacts -SettleMs 1000
pwsh -File .\live_lua_coding\Test-DuCameraSteering.ps1 -Mode ladder_y -SweepValues -5,-10,-20 -CaptureArtifacts -SettleMs 1000
```

### `Test-DuClientPixels.ps1`

Use when you need local smoke checks for client-pixel calibration or client-pixel click behavior.

Modes:

- `cursor`
- `checkbox`
- `all`

Examples:

```powershell
pwsh -File .\live_lua_coding\Test-DuClientPixels.ps1 -Mode cursor -EnterFreeCursorUi -RestoreAfterFreeCursorUi
pwsh -File .\live_lua_coding\Test-DuClientPixels.ps1 -Mode checkbox -CaptureArtifacts
```

### `du_control_center.ahk`

Use only as a local non-MCP fallback when you intentionally need to work outside the bridge surface.

Example:

```powershell
& 'C:\Program Files\tools\AutoHotkey\v2\AutoHotkey64.exe' .\live_lua_coding\du_control_center.ahk close_screen_editor
```

## 15. Recovery Cookbook

### No Active Session

Symptoms:

- `du_list_active_sessions` returns nothing usable

Action:

- confirm the player is online
- confirm the bridge is running
- confirm the MCP host has reloaded the current bridge build

### Editor Did Not Open

Symptoms:

- `du_open_editor_native` returns success, but the follow-up editor describe is empty

Action:

- verify the visible target under the crosshair
- verify the current client state with a screenshot if needed
- do not continue into push or save

### Editor Closed But Client State Still Feels Wrong

Symptoms:

- the editor looks closed, but interaction state still feels blocked

Action:

- use the canonical close path first
- for `screen_editor`, prefer `cancel` or a real dirty-buffer `save`
- verify with `du_ui_describe` that the editor is actually gone

### Save Had No Effect In `screen_editor`

Symptoms:

- the editor stayed open after `du_editor_save`

Likely cause:

- the buffer was not dirty

Action:

- confirm with `du_ui_describe` whether `canApply = true`
- make a real minimal change
- retry the push and save cycle

### `screen_editor_not_visible`

Symptoms:

- `apply` or `cancel` returns `screen_editor_not_visible`

Action:

- stop mutating actions
- reopen the editor and re-verify visibility first

### `lua_editor_not_visible`

Symptoms:

- Lua mutating probe methods fail because the editor is not visible

Action:

- reopen and re-verify `lua_editor`
- then repeat slot/filter establishment

### Wrong Slot Or Filter In `lua_editor`

Symptoms:

- pushed code does not land in the intended target

Likely cause:

- slot or filter was not explicitly established
- or `snippet.json` still points at a different filter than the one you mean to update

Action:

- use `select_context`
- verify slot and filter
- if there are duplicate visible names in the slot, verify the exact live filter index/key through the manager state instead of trusting the label
- verify the staged import metadata if the push still lands in the wrong handler
- then push again

### `server_chat_opt_in_disabled`

Symptoms:

- server-side chat tools return that explicit error

Action:

- treat it as a configuration state, not as a timeout mystery
- use HUD chat tools or rebuild the mod with the opt-in server chat support

### Options UI Opened Unexpectedly

Symptoms:

- a recovery `Escape` from a normal in-world state opened the game Options UI

Action:

- recognize that the client is now in Options, not in a clean baseline
- send another `Escape` to return to the world
- re-check state before continuing

## 16. Do This, Not That

- Do: verify editor visibility before push or save.
- Do not: assume the editor is open because a previous step said it should be.

- Do: use `select_context` for Lua editing.
- Do not: guess the active slot or filter.

- Do: wait at least 1 second after a Lua filter change before push/save.
- Do not: click a filter and push immediately.

- Do: treat duplicate names such as two `onStart()` rows as ambiguous until the live manager filter list proves which one is active.
- Do not: assume the visible `selectedFilter` text is enough to identify the handler.

- Do: verify the real timer signature when multiple `onTimer(...)` filters exist.
- Do not: trust the generic `selectedFilter` text alone.

- Do: treat `snippet.json` as part of the workspace snippet validity contract.
- Do not: assume visible selection alone is always enough for `du_editor_push_code`.

- Do: close the editor before reinjecting the Lua probe.
- Do not: use open-editor reinject as the normal workflow.

- Do: make a real minimal change before a screen save test.
- Do not: treat a clean-buffer save attempt as a meaningful validation.

- Do: use iterative `du_camera_move(x, y)` adjustments.
- Do not: treat old movement observations as fixed calibration constants.

- Do: use local helper scripts as fallback or measurement tooling.
- Do not: let them replace the canonical MCP workflow without a reason.

## 17. Related Documents

- [DuMcpBridge README](../DuMcpBridge/README.md)
- [Bridge Live Test](../DuMcpBridge/bridge-live-test.md)
- [Client Pixel Live Tests](du-client-pixel-live-tests.md)
- [Camera Steering Tests](du-camera-steering-tests.md)
- [DU Visual Subagent Notes](../du-visual-subagent.md)
- [LuaPainter](LuaPainter/README.md)

## 18. Maintaining The Tracked Live Snapshots

If a newer live board snapshot replaces the tracked Lua snapshots in one of the example folders, such as `live_lua_coding/examples/form_editor/`:

- update the tracked file
- keep the file path stable when possible
- commit the new snapshot so the reusable reference stays in git
