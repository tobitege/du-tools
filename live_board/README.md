# live_board

This folder now holds two kinds of tracked live artifacts:

- live board Lua snapshots captured from the game
- native AutoHotkey and PowerShell helpers for Dual Universe live-window workflows

Current files:

- `unit-onStart.lua`: exact live snapshot of the board `unit.onStart` script.
- `unit-onTimer-UPD.lua`: exact live snapshot of the board `unit.onTimer("UPD")` script.
- `du_control_center.ahk`: headless AutoHotkey CLI entry point for focus, editor-open fallback, key sends, and client-pixel UI actions.
- `du_view_common.ahk`: shared window-focus, client-coordinate, and JSON result helpers used by the AHK scripts.
- `Test-DuClientPixels.ps1`: live Dual Universe smoke test for `ui_calibrate` and `click_client_px`.
- `du-client-pixel-live-tests.md`: MCP screenshot-aware workflow note for interactive live verification of the client-pixel actions.
- `Test-DuCameraSteering.ps1`: live in-world camera steering harness for repeatability, ladder, and round-trip camera-move tests.
- `du-camera-steering-tests.md`: workflow note for measuring in-world steering precision with screenshot comparisons.

Current live steering status:

- the canonical camera path is now `du_camera_move(x, y)` in the bridge surface
- `Test-DuCameraSteering.ps1` now exists only as a sequence test harness around the same underlying camera-move behavior
- `du_open_screen_editor.ahk` now uses the smaller board-to-screen nudge that matches the live smoke runs
- `du_control_center.ahk close_screen_editor` still models the current DU behavior for a local native fallback: two `Escape` taps and then stop
- `Test-DuCameraSteering.ps1` now supports unattended centered screenshot capture through `-CaptureArtifacts`
- if the centered crop is too tight, `Test-DuCameraSteering.ps1` can capture the full DU client through `-CaptureFullClient`
- cumulative `moveY = -35` produced about `69 px` of visible travel in the centered crop
- cumulative `moveX = +35` produced about `80 px` of visible travel in the centered crop
- for the current board/screen layout and avatar pose, a practical first estimate to move from the current screen-facing baseline onto the lower board is about `moveY +40`
- a practical first estimate to move back from the lower board onto the upper screen is about `moveY -30`
- a practical first estimate for a small upper-screen refinement is about `moveY -15`
- a practical lateral correction is about `moveX +/-20`

Important limits:

- the observed pixel travel in old captures is only a temporary observation for that exact window size, avatar pose, and camera distance
- if the game window layout changes, or the avatar/camera moves even slightly, the apparent pixel travel changes too
- treat the old pixel-travel estimates as current observations for this live setup, not as portable calibration constants
- camera targeting is iterative; prefer `capture -> decide x/y -> du_camera_move -> capture` over blind repeated guesses
- right-click context menus on elements also free the mouse cursor, so screenshot or cursor-sensitive checks should account for that
- from a normal in-world state, a single `Escape` opens the game Options UI; if a recovery path sent `Escape` first, the client is not back on a clean slate until a second `Escape` returns to the world

`Test-DuClientPixels.ps1` modes:

- `cursor`: verifies `ui_calibrate` against the real Dual Universe client rect by comparing the requested client point with the actual OS cursor position.
- `checkbox`: expects the game to already show `Options -> Settings -> Controls`, clicks the `Invert Y-axis` checkbox twice with `click_client_px`, and checks that the checkbox region changes and then returns to its original pixels.
- `all`: runs both tests.

Example:

```powershell
pwsh -File .\live_board\Test-DuClientPixels.ps1 -Mode cursor -EnterFreeCursorUi -RestoreAfterFreeCursorUi

pwsh -File .\live_board\Test-DuClientPixels.ps1 -Mode checkbox -CaptureArtifacts
```

For agent-assisted live checks, prefer the screenshot MCP workflow described in [du-client-pixel-live-tests.md](/d:/github/du-tobi/live_board/du-client-pixel-live-tests.md#L1) and [../du-visual-subagent.md](/d:/github/du-tobi/du-visual-subagent.md#L1). Keep `-CaptureArtifacts` as a local fallback, not the default repo workflow.

For bridge-driven editor workflows, keep the MCP surface canonical:

- steer with `du_camera_move(x, y)` until the intended element is under the crosshair
- open the looked-at element editor with `du_open_editor_native`
- close the live `screen_editor` with `du_ui_invoke(uiKind = screen_editor, method = cancel)`
- use the local AHK `close_screen_editor` helper only as a manual or non-MCP fallback when you are intentionally working outside the bridge surface

For the current steering findings and unattended capture examples, see [du-camera-steering-tests.md](/d:/github/du-tobi/live_board/du-camera-steering-tests.md#L1).

Recommended quick commands:

```powershell
pwsh -File .\live_board\Test-DuCameraSteering.ps1 -Mode repeatability -MoveX 20 -MoveY 0 -RepeatCount 5 -CaptureArtifacts -SettleMs 1000
pwsh -File .\live_board\Test-DuCameraSteering.ps1 -Mode ladder_y -SweepValues -5,-10,-20 -CaptureArtifacts -SettleMs 1000
AutoHotkey64.exe ".\DuMcpBridge\ahk\du_bridge_input.ahk" camera_move --window-title "Dual Universe" --x -100 --y 120 --settle-ms 1000
```

Run those commands from a screenshot-confirmed baseline. For real interaction flows, use iterative `du_camera_move(x, y)` adjustments instead of named camera wrappers.

Manual native fallback for a local non-MCP session:

```powershell
& 'C:\Program Files\tools\AutoHotkey\v2\AutoHotkey64.exe' .\live_board\du_control_center.ahk close_screen_editor
```

If a newer live board snapshot supersedes the tracked Lua files, replace them in this folder so the reusable reference stays in git.
