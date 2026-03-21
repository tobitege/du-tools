# RenderScript Coverage TODO

This file tracks what still needs to be implemented or tightened so `rs_emulator` can claim solid coverage of `RenderScript.lua`.

Source of truth for this checklist:

- `rs_emulator/RenderScript.lua`

Status meaning:

- `[x]` present and good enough for current prototype
- `[~]` present but partial / inaccurate / incompatible with real DU behavior
- `[ ]` still missing

Important note:

- The current emulator already exposes most public function names from `RenderScript.lua`.
- The remaining work is mostly about fidelity, state behavior, wrapper compatibility, and real API semantics.

## 1. Wrapper Compatibility (`RenderScript.lua` itself)

- [x] Make the emulator compatible with the actual `RenderScript.lua` wrapper, not only with direct raw global calls
- [x] Support `RenderScript.Instance()` usage end-to-end
- [x] Support `LoadedFont` / `FontHandle` style objects if the wrapper expects object handles rather than plain numeric IDs
- [x] Implement a font object API with `GetID()` if required by the wrapper path
- [x] Verify `GetTextBounds` works correctly when called through the wrapper, not only as a raw global
- [ ] Verify `LoadImage` wrapper-level caching semantics match the real file
- [ ] Verify `RequestAnimationFrame` behavior matches the wrapper expectation that image cache resets per frame

## 2. Layer System Fidelity

- [~] Fix real layer compositing order so layers render by layer index, not by raw command insertion order
- [ ] Separate per-layer command buckets from style-setting bookkeeping more cleanly
- [ ] Verify whether lower layer IDs always draw before higher layer IDs in the real runtime and mirror that exactly
- [ ] Confirm whether empty layers still exist as real render targets and emulate that properly
- [ ] Add explicit tests for cross-layer ordering when commands are interleaved in script execution

## 3. Shape Rendering Commands

### Geometry primitives

- [x] `AddBox`
- [x] `AddBoxRounded`
- [x] `AddCircle`
- [x] `AddLine`
- [x] `AddQuad`
- [x] `AddTriangle`
- [x] `AddBezier`

### Remaining geometry fidelity tasks

- [ ] Verify `AddBezier` control-point semantics against the real DU API and confirm current quadratic interpretation is correct
- [ ] Verify polygon fill/stroke winding behavior for `AddQuad` and `AddTriangle`
- [ ] Verify rounded-box corner clamping matches the real runtime exactly
- [ ] Check anti-aliasing expectations and whether any optional pixel-snapping mode is needed

### Text and image primitives

- [x] `AddText`
- [x] `AddImage`
- [x] `AddImageSub`

### Remaining text/image fidelity tasks

- [~] `AddText`: currently draws text, but alignment/rotation/stroke/shadow behavior is only partial
- [~] `AddImage`: currently draws loaded images, but DU-faithful loading/error behavior is incomplete
- [~] `AddImageSub`: currently draws sub-rectangles, but clipping/rotation/shadow/stroke semantics are incomplete
- [ ] Verify whether text supports stroke in DU and implement it if yes
- [ ] Verify whether image primitives honor shadow and rotation exactly like other renderables
- [ ] Add tests for text anchoring with all horizontal and vertical alignment combinations

## 4. Default Style Commands

- [x] `SetDefaultFillColor`
- [x] `SetDefaultStrokeColor`
- [x] `SetDefaultStrokeWidth`
- [x] `SetDefaultShadow`
- [x] `SetDefaultRotation`
- [x] `SetDefaultTextAlign`

### Remaining default-style tasks

- [ ] Verify style inheritance across all `RSShape` types matches DU exactly
- [ ] Ensure shape types that should ignore fill/stroke/shadow really ignore them
- [ ] Confirm text default style behavior is independent from box/polygon defaults where appropriate
- [ ] Confirm image default style behavior in DU and apply or explicitly suppress unsupported style fields

## 5. Next-Shape Override Commands

- [x] `SetNextFillColor`
- [x] `SetNextStrokeColor`
- [x] `SetNextStrokeWidth`
- [x] `SetNextShadow`
- [x] `SetNextRotation`
- [x] `SetNextRotationDegrees`
- [x] `SetNextTextAlign`

### Remaining next-style tasks

- [ ] Verify override consumption timing matches DU exactly: one shape only, including all edge cases
- [ ] Verify non-drawing commands do not accidentally consume next-style state
- [ ] Confirm next-rotation works for all supported shape types, especially text and image
- [ ] Confirm next-shadow behavior for text and image
- [ ] Add tests for stacking multiple next-overrides before the next draw call

## 6. Layer Transform Commands

- [x] `SetLayerClipRect`
- [x] `SetLayerOrigin`
- [x] `SetLayerRotation`
- [x] `SetLayerScale`
- [x] `SetLayerTranslation`

### Remaining transform tasks

- [~] Verify transform composition order against DU exactly
- [ ] Verify clip rect is applied in the correct transformed coordinate space
- [ ] Add tests for origin + scale + rotation combinations
- [ ] Confirm whether layer transforms affect shadows exactly the same way as in-game
- [ ] Confirm whether text baseline/alignment is resolved before or after transform in DU

## 7. Font API

- [x] `LoadFont`
- [x] `GetFontSize`
- [x] `SetFontSize`
- [x] `GetFontMetrics`
- [x] `GetAvailableFontCount`
- [x] `GetAvailableFontName`

### Remaining font tasks

- [~] Replace current fake built-in font catalog with a better-defined font availability model
- [~] `GetFontMetrics` is currently approximate only
- [ ] Decide whether fonts should be represented as handles, objects, or both for wrapper compatibility
- [ ] Verify font fallback behavior when a requested family is unavailable
- [ ] Add tests for repeated `LoadFont(name, size)` calls and handle reuse semantics
- [ ] Confirm whether DU reuses loaded fonts internally or returns a new handle every time

## 8. Text Measurement API

- [x] `GetTextBounds`

### Remaining text-measurement tasks

- [~] Current text bounds are approximate and not DU-faithful
- [ ] Replace simple `length * size * 0.6` logic with real canvas-based measurement
- [ ] Verify multiline text behavior
- [ ] Verify whether text bounds depend on loaded font face metrics beyond nominal size
- [ ] Verify wrapper compatibility for `Vec2.New(...)`

## 9. Image API

- [x] `LoadImage`
- [x] `IsImageLoaded`
- [x] `GetImageSize`

### Remaining image tasks

- [~] Improve failed-image handling and expose consistent behavior for bad URLs / CORS failures
- [ ] Add explicit image error state, not only loaded / not loaded
- [ ] Decide whether duplicate `LoadImage(url)` calls should always reuse handles for the whole session or per-frame only
- [ ] Verify real DU semantics for image cache invalidation across frames and wrapper resets
- [ ] Add tests for image redraw after async load completion
- [ ] Add tests for `AddImageSub` bounds and source-rect clipping behavior

## 10. Time and Animation API

- [x] `GetTime`
- [x] `GetDeltaTime`
- [x] `RequestAnimationFrame`

### Remaining time/animation tasks

- [~] `RequestAnimationFrame(frames)` currently behaves like "keep animating if > 0" rather than honoring an exact future frame count contract
- [~] `GetDeltaTime` is still synthetic, not measured from actual render cadence
- [ ] Implement proper frame countdown semantics for `RequestAnimationFrame(n)`
- [ ] Decide whether the runtime should continue redrawing automatically only when the script requests it again each execution
- [ ] Add tests for one-shot, delayed, and continuous animation requests

## 11. Cursor / Input / Locale API

- [x] `GetCursor`
- [x] `GetCursorDown`
- [x] `GetCursorPressed`
- [x] `GetCursorReleased`
- [x] `GetInput`
- [x] `GetLocale`

### Remaining cursor/input/locale tasks

- [~] All of these are currently basically static placeholders unless manually wired later
- [ ] Wire real pointer coordinates from the canvas into `GetCursor()`
- [ ] Return `(-1, -1)` when pointer is outside the screen area, matching the API contract
- [ ] Track pointer-down state for `GetCursorDown()`
- [ ] Track edge-triggered pressed/released states per execution for `GetCursorPressed()` and `GetCursorReleased()`
- [ ] Add a UI control or script-input field for `GetInput()`
- [ ] Add locale selection in app settings and feed it into `GetLocale()`
- [ ] Verify coordinate scaling when canvas is visually resized but internal render resolution differs

## 12. Render Cost API

- [x] `GetRenderCost`
- [x] `GetRenderCostMax`

### Remaining render-cost tasks

- [~] Cost model is currently a trivial per-draw-call counter, not a real DU-style cost budget
- [ ] Research or estimate a more realistic cost model per primitive type
- [ ] Enforce render-cost limit behavior instead of just reporting a number
- [ ] Decide what the emulator should do when the limit is exceeded: partial render, error, or warning banner
- [ ] Add diagnostics in the UI for current render cost vs limit

## 13. Background / Logging / Output API

- [x] `SetBackgroundColor`
- [x] `Log`
- [x] `SetOutput`

### Remaining misc-output tasks

- [~] `Log` currently only feeds the local log panel, not a DU-like Lua channel
- [~] `SetOutput` stores output internally but has no strong UI yet
- [ ] Add a visible output panel for `SetOutput`
- [ ] Add a clearer distinction between script logs and runtime/system errors
- [ ] Add optional structured log timestamps or execution numbers

## 14. Resolution API

- [x] `GetResolution`

### Remaining resolution tasks

- [ ] Verify resolution values against real DU screen sizes or intended emulator presets
- [ ] Add non-square resolution presets if needed
- [ ] Confirm how pointer coordinates and text metrics should behave across varying resolution choices

## 15. Enumerations and Type Surface

- [x] `RSShape`
- [x] `RSAlignHor`
- [x] `RSAlignVer`
- [x] `Vec2` shim

### Remaining type-surface tasks

- [ ] Confirm enum values exactly match DU and stay in sync with `RenderScript.lua`
- [ ] Decide whether more native helper modules beyond `native/Vec2` are needed
- [ ] Add a compatibility test that loads `RenderScript.lua` directly inside the emulator runtime

## 16. App-Level Features Needed for Real Coverage Work

These are not RenderScript commands themselves, but they are needed to verify and iterate on API coverage efficiently.

- [ ] Add `Open...` so a real local `.lua` file can become a session directly
- [ ] Add `Save As`
- [ ] Add a side panel showing `output`, current resolution, render cost, and image/font handles
- [ ] Add an API inspector view that shows which functions were called during the last execution
- [ ] Add a small test/example suite for one script per API area
- [ ] Add regression examples that use `RenderScript.Instance()` directly

## 17. Suggested Implementation Order

Recommended order from highest leverage to lower leverage:

1. [ ] Wrapper compatibility with `RenderScript.lua`
2. [ ] Proper layer ordering
3. [ ] Proper `RequestAnimationFrame(frames)` semantics
4. [ ] Real cursor/input plumbing
5. [ ] Better `GetTextBounds` and font metrics
6. [ ] Better image loading/error behavior
7. [ ] Render-cost enforcement
8. [ ] DU-fidelity cleanup for text/image styles and transforms

## 18. Definition of Done for "Full Coverage"

`rs_emulator` should only claim full RenderScript coverage when all of the following are true:

- [ ] every public API entry from `RenderScript.lua` exists
- [ ] every API entry behaves closely enough to the real DU runtime to be useful for development
- [ ] the wrapper file itself works without compatibility hacks
- [ ] there are example scripts or regression checks for each major API area
- [ ] the remaining differences from real DU behavior are documented explicitly
