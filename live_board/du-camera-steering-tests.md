# DU Camera Steering Tests

Purpose: measure how repeatable the in-world camera steering nudges are when Dual Universe has captured the mouse for first-person look.

This is the next problem after the free-cursor UI tests: the useful interaction target is the screen center, not an unlocked cursor.

## Core Idea

- use relative `mouse_event` nudges through [du_view_nudge.ahk](/d:/github/du-tobi/live_board/du_view_nudge.ahk#L1)
- run controlled step sequences through [Test-DuCameraSteering.ps1](/d:/github/du-tobi/live_board/Test-DuCameraSteering.ps1#L1)
- judge movement by what the center of the DU screen points at before and after each step

Current confirmed behavior from live unattended capture runs:

- direct `du_view_nudge.ahk` calls do move the in-world camera on both axes
- `Test-DuCameraSteering.ps1` now supports unattended `move -> settle -> centered capture` runs through `-CaptureArtifacts`
- `Test-DuCameraSteering.ps1` also supports full-window context captures through `-CaptureFullClient`
- a cumulative `moveY = -35` run (`-5,-10,-20`) shifted the lower console by about `69 px` in the centered crop
- a cumulative `moveX = +35` run (`+5,+10,+20`) shifted the lower console by about `80 px` in the centered crop
- that is roughly `2.0 px/unit` on the `moveY` path and `2.3 px/unit` on the `moveX` path for this live setup

Reference artifacts:

- vertical smoke: [direct-up-smoke-v4](/d:/github/du-tobi/live_board/test-artifacts/du-camera-steering/direct-up-smoke-v4)
- horizontal smoke: [direct-x-smoke-v1](/d:/github/du-tobi/live_board/test-artifacts/du-camera-steering/direct-x-smoke-v1)

The screenshot reticle bug does not block this workflow the same way it blocked checkbox calibration, because the main thing to watch is the screen center and the scene target under it.

## Good Test Modes

### 1. Repeatability

Use the same steering delta multiple times to see whether each step appears to move the aim by the same visible amount.

Example:

```powershell
pwsh -File .\live_board\Test-DuCameraSteering.ps1 -Mode repeatability -MoveX 20 -MoveY 0 -RepeatCount 5 -PauseBetweenSteps
```

What to look for:

- does each `+20` horizontal nudge move the screen center by about the same amount
- does the apparent movement depend on current aim direction or nearby geometry

### 2. Round Trip

Use a delta and then its inverse to check for drift, hysteresis, or hidden acceleration.

Example:

```powershell
pwsh -File .\live_board\Test-DuCameraSteering.ps1 -Mode round_trip -MoveX 40 -MoveY 0 -RepeatCount 5 -PauseBetweenSteps
```

What to look for:

- after `+40` then `-40`, does the screen center return to the same visible spot
- if not, how large is the drift and is it consistent

### 3. Ladder Sweep

Use increasing deltas to find the smallest visibly reliable steering step.

Examples:

```powershell
pwsh -File .\live_board\Test-DuCameraSteering.ps1 -Mode ladder_x -SweepValues 5,10,20,40,80 -ReturnToStart -PauseBetweenSteps

pwsh -File .\live_board\Test-DuCameraSteering.ps1 -Mode ladder_y -SweepValues 5,10,20,40,80 -ReturnToStart -PauseBetweenSteps
```

For unattended live capture runs:

```powershell
pwsh -File .\live_board\Test-DuCameraSteering.ps1 -Mode ladder_y -SweepValues -5,-10,-20 -SettleMs 1000 -CaptureArtifacts -ArtifactDir .\test-artifacts\du-camera-steering\direct-up-smoke-v4 -EmitJsonLog -JsonLogPath .\test-artifacts\du-camera-steering\direct-up-smoke-v4\run.json

pwsh -File .\live_board\Test-DuCameraSteering.ps1 -Mode ladder_x -SweepValues 5,10,20 -SettleMs 1000 -CaptureArtifacts -ArtifactDir .\test-artifacts\du-camera-steering\direct-x-smoke-v1 -EmitJsonLog -JsonLogPath .\test-artifacts\du-camera-steering\direct-x-smoke-v1\run.json

pwsh -File .\live_board\Test-DuCameraSteering.ps1 -Mode ladder_x -SweepValues 5,10,20 -SettleMs 1000 -CaptureArtifacts -CaptureFullClient -ArtifactDir .\test-artifacts\du-camera-steering\direct-x-fullclient-v1 -EmitJsonLog -JsonLogPath .\test-artifacts\du-camera-steering\direct-x-fullclient-v1\run.json
```

What to look for:

- which step size is the first one that is clearly visible and repeatable
- whether horizontal and vertical steering behave differently

## Recommended Visual Workflow

1. Pick a stable in-world target with a clear edge or corner near the screen center.
2. Take one screenshot before the first steering step.
3. Run a step sequence with `-PauseBetweenSteps`.
4. Take another screenshot after each step, or after each forward/reverse pair.
5. Compare where the screen center points.

If you want a more stable reference than terrain, use a board, screen frame, console edge, or text baseline with strong contrast.

## Notes

- Keep these tests in-world. Do not open DU settings for them.
- Prefer one-axis tests first. Mixed `MoveX` + `MoveY` can wait until single-axis behavior looks stable.
- The JSON log option is only for step bookkeeping. The meaningful measurement still comes from what the DU camera visibly points at.
- The unattended capture path is the current reliable workflow: direct AHK nudge call, `SettleMs`, then local centered screenshot save.
- If the centered crop hides too much surrounding context, use `-CaptureFullClient`.

## Practical Steering Estimate

For the current live board/screen setup captured in the smoke runs:

- the screen already occupies the crosshair area in the baseline view
- the top edge of the lower board sits roughly `80 px` below the crosshair in the centered crop
- with the observed `moveY` rate of about `2.0 px/unit`, moving the lower board edge onto the crosshair from the current screen-facing baseline should take about `moveY +40`
- a practical range is `moveY +35` to `+45` to go from the current screen-facing baseline onto the lower board
- moving back from the lower board to the upper screen should usually take a somewhat smaller reverse step because the screen is much taller and more forgiving; a practical starting range is `moveY -20` to `-40` depending on how far into the lower board aim point you are
- horizontal travel is much less critical for board-to-screen transitions because the upper screen spans most of the view and overlaps the lower board strongly in `x`
- still, the confirmed `moveX` rate of about `2.3 px/unit` means that `moveX +/-20` already gives a meaningful lateral correction and `moveX +/-35` gives a clearly visible re-aim

These are live empirical estimates, not hard guarantees. They are good enough for editor-exit recovery and “swing the camera back onto the other element” routines, where only a few pixels of overlap are needed for `use`.
