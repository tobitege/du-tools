# DU Camera Steering Tests

Purpose: measure how repeatable the in-world camera steering nudges are when Dual Universe has captured the mouse for first-person look.

This is the next problem after the free-cursor UI tests: the useful interaction target is the screen center, not an unlocked cursor.

## Core Idea

- use relative `mouse_event` nudges through [du_view_nudge.ahk](/d:/github/du-tobi/live_board/du_view_nudge.ahk#L1)
- run controlled step sequences through [Test-DuCameraSteering.ps1](/d:/github/du-tobi/live_board/Test-DuCameraSteering.ps1#L1)
- judge movement by what the center of the DU screen points at before and after each step

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
