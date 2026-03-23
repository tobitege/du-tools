# live_board

This folder now holds two kinds of tracked live artifacts:

- live board Lua snapshots captured from the game
- native AutoHotkey and PowerShell helpers for Dual Universe live-window workflows

Current files:

- `unit-onStart.lua`: exact live snapshot of the board `unit.onStart` script.
- `unit-onTimer-UPD.lua`: exact live snapshot of the board `unit.onTimer("UPD")` script.
- `du_control_center.ahk`: headless AutoHotkey CLI entry point for focus, view nudges, key sends, and client-pixel UI actions.
- `du_view_common.ahk`: shared window-focus, client-coordinate, and JSON result helpers used by the AHK scripts.
- `Test-DuClientPixels.ps1`: live Dual Universe smoke test for `ui_calibrate` and `click_client_px`.
- `du-client-pixel-live-tests.md`: MCP screenshot-aware workflow note for interactive live verification of the client-pixel actions.
- `Test-DuCameraSteering.ps1`: live in-world camera steering harness for repeatability, ladder, and round-trip nudge tests.
- `du-camera-steering-tests.md`: workflow note for measuring in-world steering precision with screenshot comparisons.

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

If a newer live board snapshot supersedes the tracked Lua files, replace them in this folder so the reusable reference stays in git.
