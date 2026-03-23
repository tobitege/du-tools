# DU Camera Steering Tests

Purpose: measure how repeatable the in-world camera steering moves are when Dual Universe has captured the mouse for first-person look.

This is the next problem after the free-cursor UI tests: the useful interaction target is the screen center, not an unlocked cursor.

## Core Idea

- use the bridge-native `du_camera_move(x, y)` semantics for relative camera movement
- run controlled step sequences through [Test-DuCameraSteering.ps1](/d:/github/du-tobi/live_board/Test-DuCameraSteering.ps1#L1)
- judge movement by what the center of the DU screen points at before and after each step

Current confirmed behavior from live unattended capture runs:

- direct relative camera moves do move the in-world camera on both axes
- the primary camera contract is now generic x/y movement, not named retarget wrappers
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

- does each `+20` horizontal move change the screen center by about the same amount
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

### 4. Iterative Targeting

For real interaction workflows, do not rely on named camera wrappers. Use iterative x/y movement instead.

Example:

```text
capture -> choose x/y delta -> du_camera_move(x, y) -> capture -> adjust -> repeat
```

For the editor workflow, the practical handoff is:

1. steer onto the board or screen you want to interact with using iterative x/y moves
2. open the editor with `du_open_editor_native` or the local `du_open_screen_editor.ahk` fallback
3. make the Lua change
4. apply/save
5. return in-world and continue with iterative x/y moves if the other element needs to be brought back under the crosshair

## Recommended Visual Workflow

1. Pick a stable in-world target with a clear edge or corner near the screen center.
2. Take one screenshot before the first steering step.
3. Treat that first screenshot as the required baseline check before you move.
4. Run a step sequence with `-PauseBetweenSteps`.
5. Take another screenshot after each step, or after each forward/reverse pair.
6. Compare where the screen center points before deciding on the next x/y correction or editor-open attempt.
7. If the target is still not under the crosshair, adjust one or both axes and repeat the same loop.

If you want a more stable reference than terrain, use a board, screen frame, console edge, or text baseline with strong contrast.

## Notes

- Keep these tests in-world. Do not open DU settings for them.
- Prefer one-axis tests first. Mixed `MoveX` + `MoveY` can wait until single-axis behavior looks stable.
- The JSON log option is only for step bookkeeping. The meaningful measurement still comes from what the DU camera visibly points at.
- The unattended capture path is the current reliable workflow: direct camera-move call, `SettleMs`, then local centered screenshot save.
- A screenshot-gated live check on 2026-03-23 confirmed the practical rule here: fixed named retargets are the wrong abstraction for the editor workflow because the needed correction can require both a direction change and a step-size change between iterations.
- If the centered crop hides too much surrounding context, use `-CaptureFullClient`.
- A future "smart retarget" path could estimate the next mouse move from before/after image comparison in window pixels, but that is a separate problem from the current generic `du_camera_move(x, y)` workflow.
- Right-click context menus on elements also free the mouse cursor, so visible state can drift into a cursor-driven UI state without moving the avatar.
- For the current DU screen editor behavior, a plain single `Escape` is not enough to close reliably. Use the dedicated `close_screen_editor` helper or an equivalent two-tap close path.

## Practical Steering Estimate

For the current live board/screen setup captured in the smoke runs:

- the screen already occupies the crosshair area in the baseline view
- the top edge of the lower board sits roughly `80 px` below the crosshair in the centered crop
- with the observed `moveY` rate of about `2.0 px/unit` in that one captured layout, moving the lower board edge onto the crosshair from the current screen-facing baseline took about `moveY +40`
- a practical starting range is `moveY +35` to `+45` to go from the current screen-facing baseline onto the lower board
- moving back from the lower board to the upper screen should usually take a smaller reverse step because the screen is much taller and more forgiving; a practical starting range is `moveY -30` with a range of about `-20` to `-40` depending on how far into the lower board aim point you are
- a small upper-screen refinement is about `moveY -15`
- horizontal travel is much less critical for board-to-screen transitions because the upper screen spans most of the view and overlaps the lower board strongly in `x`
- still, the observed `moveX` rate of about `2.3 px/unit` in that captured layout means that `moveX +/-20` already gives a meaningful lateral correction and `moveX +/-35` gives a clearly visible re-aim

These are live empirical estimates, not hard guarantees. They are good enough for editor-exit recovery and “swing the camera back onto the other element” routines, where only a few pixels of overlap are needed for `use`.
