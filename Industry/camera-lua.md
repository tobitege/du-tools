# Camera Lua Notes

Source checked: `D:\github\du-yfs\util\Codex.lua`

Goal: keep the useful client-side Lua camera and screen APIs in one place so we do not need to re-scan the codex again.

## Main Result

The in-game Lua API does expose real camera state.

It does not appear to expose a single direct "what is under screen center" or `screenToWorld` API, but it gives enough data to build useful inference on the client side.

Best practical path:

1. Read camera pose and FOV from `system`.
2. Read player and head pose from `player` as fallback/reference.
3. For known world-space targets, project them onto the screen with `library.getPointOnScreen(worldPos)`.
4. Compare projected `x,y` against screen center `(0.5, 0.5)`.
5. Use `depth` to reject points behind the camera or otherwise non-visible points.

That is enough for:

- determining whether a known element or point is on screen
- determining which known target is closest to screen center
- building a client-side helper board that reports likely camera target candidates

Practical board-code split used on `PB70`:

- put reusable helper functions in `library/onStart()`
- keep `unit/onStart()` only for unit-specific startup
- use `system/onUpdate()` for the periodic runtime reporting loop

Important scope comment:

- although the Lua camera path is now proven to work on a `ProgrammingBoard`, a full client-side construct scan plus projection/raycast math is not the preferred next step for placement work
- backend element deployment already gives exact transforms without client-side snap mechanics
- the better next step for precise stacking is backend-side element box data keyed by `elementId`, not a large Lua-side target search

## Camera APIs

These are the important calls from `System`:

- `System.getCameraHorizontalFov()`
- `System.getCameraVerticalFov()`
- `System.getCameraMode()`
- `System.isFirstPerson()`
- `System.getCameraPos()`
- `System.getCameraWorldPos()`
- `System.getCameraWorldForward()`
- `System.getCameraWorldRight()`
- `System.getCameraWorldUp()`
- `System.getCameraForward()`
- `System.getCameraRight()`
- `System.getCameraUp()`

Relevant codex section:

- `Codex.lua:8558-8594`

Interpretation:

- `getCameraWorldPos()` is the active camera position in world coordinates.
- `getCameraWorldForward()` is the active camera forward direction in world coordinates.
- `getCameraWorldRight()` and `getCameraWorldUp()` complete the world-space camera basis.
- `getCameraPos()`, `getCameraForward()`, `getCameraRight()`, and `getCameraUp()` are the same idea in construct-local coordinates.
- `getCameraMode()` distinguishes first-person vs follow/look-around modes.
- `isFirstPerson()` is the simplest guard if a helper only makes sense in first-person mode.

Important consequence:

- this is stronger than the backend player-rotation path, because it is real camera state, not just inferred player orientation

## Player APIs

Useful fallback/reference calls from `Player`:

- `Player.getPosition()`
- `Player.getWorldPosition()`
- `Player.getHeadPosition()`
- `Player.getWorldHeadPosition()`
- `Player.getForward()`
- `Player.getRight()`
- `Player.getUp()`
- `Player.getWorldForward()`
- `Player.getWorldRight()`
- `Player.getWorldUp()`

Relevant codex section:

- `Codex.lua:6007-6045`

Interpretation:

- `getWorldHeadPosition()` is useful if camera and head should be compared.
- `getWorldForward()` is a fallback if camera calls are not available in a given context.
- `getPosition()` and `getForward()` are useful when the logic should stay construct-local.

## World To Screen Projection

The most important connective API is:

- `Library.getPointOnScreen(worldPos)`

Relevant codex section:

- `Codex.lua:5175-5178`

Return value:

- `vec3 { x, y, depth }`
- `x` and `y` are normalized screen coordinates from `0` to `1`
- `depth` is the returned projection depth

Why this matters:

- it gives `world -> screen`
- if we already know candidate world positions for targets, we can rank them by distance to screen center
- a target near `(0.5, 0.5)` is likely under the crosshair / screen center

Typical use:

1. get world positions for candidate elements or points
2. call `library.getPointOnScreen(pos)` for each
3. discard bad projections
4. score the rest by squared distance to `(0.5, 0.5)`
5. choose the smallest score

## Screen-Specific Cursor APIs

These are not generic world-target APIs. They are for screen interaction when the player is actually raycasting a screen.

From `RenderScript`:

- `RenderScript.getCursor()`
- `RenderScript.getCursorDown()`
- `RenderScript.getCursorPressed()`
- `RenderScript.getCursorReleased()`

Relevant codex section:

- `Codex.lua:6752-6763`

From `Screen`:

- `Screen.getMouseX()`
- `Screen.getMouseY()`
- `Screen.getMouseState()`
- `Screen.onMouseDown`
- `Screen.onMouseUp`

Relevant codex section:

- `Codex.lua:7376-7400`

Interpretation:

- these only help when the player is pointing at a screen element
- they do not solve generic world or voxel targeting
- they are still useful for screen-board helper UIs and screen interaction diagnostics

## Telemeter APIs

From `Telemeter`:

- `Telemeter.raycast()`
- `Telemeter.getRayOrigin()`
- `Telemeter.getRayWorldOrigin()`
- `Telemeter.getRayAxis()`
- `Telemeter.getRayWorldAxis()`
- `Telemeter.getMaxDistance()`

Relevant codex section:

- `Codex.lua:8915-8929`

Interpretation:

- this is a real raycast, but it is the telemeter's ray, not the camera ray
- it may still be useful for specialized setups where a telemeter is aligned with the desired look direction
- by itself it is not a generic replacement for camera-center targeting

## Custom HUD / Screen Output APIs

Useful if a board/control-unit script should display diagnostics live:

- `System.showScreen(bool)`
- `System.setScreen(content)`
- `System.createWidgetPanel(label)`
- `System.createWidget(panelId, type)`

Relevant codex section:

- `Codex.lua:8476-8499`

Interpretation:

- a helper script can display camera vectors, FOV, current mode, and projected target scores directly in-game
- this makes it practical to prototype the targeting helper without a separate external UI first

## What Was Not Found

No obvious generic Lua API was found for:

- `screenToWorld`
- `getMouseTarget`
- `getCrosshairTarget`
- `camera raycast from screen center`
- generic element or voxel hit under the active camera

So the likely intended approach is:

- direct camera state from `system`
- projection via `library.getPointOnScreen`
- domain-specific helpers such as screen cursor APIs or telemeter raycasts where applicable

## Practical Design Notes

For a programming-board helper that provides extra client data, the most useful minimal payload is probably:

- camera mode
- first-person flag
- camera world position
- camera world forward/right/up
- horizontal and vertical FOV
- player world head position
- projected screen position of a supplied candidate target list

Then the board can output:

- nearest projected target to screen center
- whether that target is on screen
- how far off-center it is
- whether the camera basis and player basis are aligned or drifting

## Confidence / Limits

High confidence:

- real camera transform is available in Lua
- world-to-screen projection is available in Lua

Lower confidence / still unproven:

- whether `library.getPointOnScreen` behaves cleanly for every in-world target type and every camera mode
- whether build-mode hover / voxel-preview information is exposed anywhere else in Lua
- whether any hidden or undocumented API exists beyond this codex

## Build-Mode Overlay Calibration

Follow-up live calibration on `TestCore_Thades1` with a `Static Core Unit 256` and a manually placed `ProgrammingBoard`:

- the build overlay coordinates shown while aiming at voxels are centered around the construct center, not around backend local origin
- in this overlay, `Z` is the vertical axis
- overlay coordinates snap to `0.5 voxel`
- `0.5 voxel = 0.125 m`
- `1 voxel = 0.25 m`
- backend element placement uses exact local meters

For this `256 m` construct, the working conversion from build overlay coordinates to backend local meters was:

```text
backendMeters = overlayVoxels / 4 + 128
```

with the important correction:

- vertical offset must be applied on `Z`, not `Y`

Example from the live placement test:

- aimed floor point from overlay: `X=-12.5 Y=155.5 Z=-7.5`
- desired placement: `1 m` above that point
- since vertical is `Z`, add `+4 voxels` to `Z`

Correct converted backend position:

```text
x = -12.5 / 4 + 128 = 124.875
y = 155.5 / 4 + 128 = 166.875
z = (-7.5 + 4) / 4 + 128 = 127.125
```

So the corrected backend placement target is:

```json
{ "x": 124.875, "y": 166.875, "z": 127.125 }
```

Important caution:

- this `+128` shift is specific to a construct whose center-to-origin offset is `128 m` on each axis
- do not blindly reuse it for other core sizes; use the matching half-size for the current construct

## Raw Backend Placement Limits

The MCP/backend `element_add` path is a raw placement primitive, not the full in-game deploy UX.

Observed behavior and implications:

- the backend add uses an exact element origin transform
- it does not perform the normal in-game snap-to-voxel or snap-to-element attachment logic
- element pivots can be offset from the visible mesh
- a placement can therefore end up on the opposite side of a voxel surface even when the converted target point is basically correct

Live `ProgrammingBoard` result:

- coordinate conversion was close enough
- the board still landed under the voxel floor because the visible board body is offset from the element origin/pivot

Practical consequence:

- camera/build overlay conversion gets us close
- exact final placement may still require an element-specific offset or an in-game manual move after raw add

## Source Storage Behavior

The important backend distinction is:

- `PlayerInventory` can resolve through the active primary container
- `PlayerInventoryWithoutPrimary` is the raw nanopack inventory only

For build/deploy behavior this means:

- the game places elements from the active primary container when one is linked and valid
- for practical build operations, treat the active primary container as the real deploy inventory
- MCP deploy slot resolution must therefore use the active primary path, not only the raw nanopack inventory

Live test result:

- the `ProgrammingBoard` stack used for placement was in `player_primary_container`, slot `9`
- raw nanopack inventory did not contain the board
- after fixing MCP slot resolution, `du_element_add` successfully deployed directly from that primary-container slot

## Linking Follow-Up

After placement, the new board was successfully linked to the static core as:

- source: `ProgrammingBoard`
- destination: `CoreUnitStatic256`
- plug type: `PLUG_CONTROL`

Observed direction and allocation behavior:

- existing `ProgrammingBoard` elements on the construct already had outbound links
- the `CoreUnitStatic256` had inbound links
- that established the correct direction as `ProgrammingBoard -> CoreUnitStatic256`
- the board source plug used was `fromPlug = 0`
- the core destination plugs `0..3` were already occupied
- probing the next destination plug indices showed that `toPlug = 4` was the first free one

Practical linking rule from this test:

1. infer direction from existing topology when possible
2. try the standard plug type first
3. if link creation fails with `LinkDestinationAlreadyOccupied`, probe the next destination plug index until one succeeds

Exact successful live link:

```text
from: ProgrammingBoard localId 70
to:   CoreUnitStatic256 localId 1
plugType: PLUG_CONTROL
fromPlug: 0
toPlug: 4
```

## Minimal Lua Skeleton

```lua
local function screenDistSq(p)
    local dx = p.x - 0.5
    local dy = p.y - 0.5
    return dx * dx + dy * dy
end

local camera = {
    mode = system.getCameraMode(),
    firstPerson = system.isFirstPerson(),
    worldPos = system.getCameraWorldPos(),
    worldForward = system.getCameraWorldForward(),
    worldRight = system.getCameraWorldRight(),
    worldUp = system.getCameraWorldUp(),
    fovH = system.getCameraHorizontalFov(),
    fovV = system.getCameraVerticalFov(),
}

local playerInfo = {
    worldHeadPos = player.getWorldHeadPosition(),
    worldForward = player.getWorldForward(),
}

local candidateWorldPos = { x = 0, y = 0, z = 0 }
local projected = library.getPointOnScreen(candidateWorldPos)

local result = {
    projected = projected,
    centerDistSq = projected and screenDistSq(projected) or nil,
}
```

This is not yet a hit-test. It is the base for ranking known candidates against screen center.
