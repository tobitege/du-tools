# DU Client Pixel Live Tests

Purpose: define the live test workflow for `ui_calibrate` and `click_client_px` using the existing screenshot MCP path described in [du-visual-subagent.md](du-visual-subagent.md#L1).

This is a dev-process note for interactive verification against the real Dual Universe window.

## Rule Of Thumb

- use `Test-DuClientPixels.ps1` for live input and coordinate checks
- use `ScreenShotNet.capture_window_screenshot` for visual confirmation when the visible DU state matters
- do not keep taking screenshots at every step

That matches the repo-wide guidance in [du-visual-subagent.md](du-visual-subagent.md#L1):

- probe first when probe state exists
- screenshots are for targeted confirmation
- one owner should hold live input for a given player/window step sequence

## Current Test Cases

### 1. Cursor Accuracy

Goal:

- verify that `ui_calibrate` moves the OS cursor to the exact requested DU client pixel

Recommended sequence:

1. Make sure the `Dual Universe` window is visible.
2. Run:

```powershell
pwsh -File .\live_lua_coding\Test-DuClientPixels.ps1 -Mode cursor -EnterFreeCursorUi -RestoreAfterFreeCursorUi
```

3. If visual proof is needed, take one screenshot of the DU window after a representative point move:

- `ScreenShotNet.capture_window_screenshot`
  - `windowTitle = "Dual Universe"`

Expected result:

- the script reports several `OK` points
- the final screenshot, if taken, shows the cursor/crosshair parked at the requested client point

Why `-EnterFreeCursorUi` matters:

- in-world DU captures the mouse for first-person camera steering
- the strict OS-cursor assertions only make sense on a free-cursor UI surface
- this switch presses `Escape`, runs the cursor checks in the options UI, then presses `Escape` again if `-RestoreAfterFreeCursorUi` is set

### 2. Checkbox Click Smoke Test

Goal:

- verify that `click_client_px` hits the expected UI target on `Options -> Settings -> Controls`

Recommended sequence:

1. Open `Dual Universe`.
2. Navigate to `Options -> Settings -> Controls`.
3. Take one screenshot before the click test:

- `ScreenShotNet.capture_window_screenshot`
  - `windowTitle = "Dual Universe"`

4. Run:

```powershell
pwsh -File .\live_lua_coding\Test-DuClientPixels.ps1 -Mode checkbox
```

5. Take one screenshot after the script completes:

- `ScreenShotNet.capture_window_screenshot`
  - `windowTitle = "Dual Universe"`

Expected result:

- the script reports that the checkbox region changed and then returned to the original pixels
- the before/after screenshots show the same Controls page, with no drift to the wrong menu

The current checkbox target is the `Invert Y-axis` checkbox, clicked twice so the page returns to its starting state.

## When To Add Screenshots

Use MCP screenshots for this workflow when:

- the visible page might not be the Controls page anymore
- you need proof that a click hit the right control
- the script says the pixel region changed, but you still want a human-visible confirmation

Do not add screenshots when:

- the cursor-only script output is already enough
- you are repeating the same known-good step sequence

## Notes

- `Test-DuClientPixels.ps1` still has `-CaptureArtifacts` for standalone local runs, but the preferred repo workflow for agent-assisted live checks is the MCP screenshot path above.
- If the DU UI scale or layout changes, retune `-CheckboxXRatio` and `-CheckboxYRatio` in [Test-DuClientPixels.ps1](live_lua_coding/Test-DuClientPixels.ps1#L1).
