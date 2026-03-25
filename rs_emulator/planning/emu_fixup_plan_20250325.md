# RenderScript Emulator Fixup Plan (2025-03-25)

## Goal

Bring `rs_emulator` into much tighter behavioral parity with the Dual Universe RenderScript contract described by:

- `examples/du-mocks/RenderScript.lua`
- `examples/du-mocks/renderScript/verifyEnvironment.lua`
- `examples/du-mocks/renderScript/strokeAlign.lua`
- `examples/du-mocks/renderScript/shapes.lua`
- `examples/du-mocks/renderScript/resolutionCheck.lua`
- `examples/du-mocks/renderScript/layerOperations.lua`
- `examples/du-mocks/renderScript/fontSampler.lua`
- `examples/du-mocks/renderScript/badRequire.lua`

This plan focuses on closing the concrete compatibility gaps that are currently visible in the emulator runtime, draw buffer, renderer, and tests.

## Status Update (2026-03-25)

Current implementation has intentionally shifted to a core-emulator-only pass.

### Completed in code

- `src/emulator/renderScriptCompat.ts` now centralizes DU constants, font catalog data, per-shape defaults, and the implemented render-cost helpers.
- `src/emulator/types.ts` now uses DU vertical alignment numbering, DU render cost max, and per-shape default style construction.
- `src/emulator/drawBuffer.ts` now enforces the DU font catalog, 1-based font lookup, max-8 unique loaded fonts, invalid font-handle failures, negative-descender metrics plumbing, and DU-compatible `createLayer`, `addBox`, and `addText` render-cost logic.
- `src/emulator/textMetrics.ts` now exposes deterministic DU-oriented metrics and text bounds for the emulator API path.
- `src/emulator/canvasRenderer.ts` now distinguishes DU vertical text anchors (`Ascender`, `Top`, `Middle`, `Baseline`, `Bottom`, `Descender`) while continuing to render with an alphabetic canvas baseline.
- Low-level regression coverage was expanded in `test/drawBuffer.test.ts`, `test/canvasRenderer.test.ts`, and `test/renderScriptCompat.test.ts`.

### Intentionally deferred from this pass

- The broader Lua environment surface and validation-shim work in `src/emulator/luaRuntime.ts`.
- Full du-mock script integration coverage centered on `verifyEnvironment.lua`.
- Environment-facing contract cleanup that does not materially change the core draw buffer / metrics / renderer behavior.

## Important Corrections To The Earlier Provisional Gap List

The first pass of the analysis had a few false positives. Do **not** schedule work for these as independent fixes:

- `getAvailableFontName` already has a Lua wrapper in `src/emulator/luaRuntime.ts`.
- `getLocale` already has a Lua wrapper in `src/emulator/luaRuntime.ts`.
- `persistent` does not need a dedicated host-provided table for the current emulator model because globals already persist across executions in one Lua runtime. `fontSampler.lua` can continue to use `persistent = persistent or {...}`.

Those items should be treated as already covered unless a later regression test proves otherwise.

## Compatibility Target

Use the DU mock files as the executable contract for this fixup pass.

That means the emulator should match the mock in these areas first:

1. exported globals and constants
2. font catalog and font-related validation
3. text alignment numeric values and rendering semantics
4. default per-shape styling where the mock is explicit
5. render cost calculations that `verifyEnvironment.lua` checks today
6. script-level behavior when the du-mock fixture scripts are executed through `createLuaEnvironment(...)`

This pass should **not** widen scope into unrelated product changes such as image security policy changes, large UI redesigns, or changing the existing default screen size unless a failing du-mock test specifically requires it.

## Current Gaps To Fix

| Area | Current State | Target State | Primary Files |
|---|---|---|---|
| Lua API constant surface | `_RSVERSION` missing | `_RSVERSION = 2` available globally | `src/emulator/luaRuntime.ts` |
| Vertical alignment constants | `AlignV_Ascender` missing; `AlignV_Top/Middle/Bottom/Descender` numbering does not match DU; `AlignV_Descender` is currently assigned from a missing `RSAlignVer.Descender` entry and ends up `nil` | Full DU numbering: `Ascender=0`, `Top=1`, `Middle=2`, `Baseline=3`, `Bottom=4`, `Descender=5` | `src/emulator/types.ts`, `src/emulator/luaRuntime.ts`, `src/emulator/canvasRenderer.ts` |
| Text alignment semantics | Renderer only handles top/middle/bottom in a simplified way; ascender/descender semantics are not implemented | Distinguish font-wide anchors (`Ascender`, `Descender`, `Baseline`) from text-bounds anchors (`Top`, `Middle`, `Bottom`) | `src/emulator/canvasRenderer.ts`, `src/emulator/textMetrics.ts` |
| `isFontLoaded` global | Not exposed | Exposed and DU-compatible | `src/emulator/luaRuntime.ts`, `src/emulator/drawBuffer.ts` |
| Font list | Returns 5 browser-font names | Return the 12 DU font names from `RenderScript.lua` | `src/emulator/drawBuffer.ts`, new compat module |
| `getAvailableFontName` indexing | Off by one and silently returns `""` for bad indexes | 1-based indexing with `out-of-bounds font index` failure | `src/emulator/drawBuffer.ts` |
| `loadFont` validation | Accepts any name and unlimited unique loads | Accept only DU font names; enforce max 8 loaded fonts | `src/emulator/drawBuffer.ts`, `src/emulator/luaRuntime.ts` |
| Font metrics | Browser-dependent and positive descender | Deterministic DU-style metrics; negative descender from `getFontMetrics` | `src/emulator/textMetrics.ts`, `src/emulator/drawBuffer.ts` |
| Text bounds | Browser-dependent and host-font-sensitive | Deterministic DU-style `getTextBounds` for supported fonts | `src/emulator/textMetrics.ts`, `src/emulator/drawBuffer.ts` |
| Default line/bezier stroke width | Defaults to 0 for all shapes | Line and bezier default stroke width = 1 | `src/emulator/types.ts`, `src/emulator/drawBuffer.ts` |
| Default stroke color | Defaults to black in the emulator | Default stroke color should follow the mock's missing/default behavior (white unless explicitly changed) | `src/emulator/types.ts`, `src/emulator/drawBuffer.ts`, `src/emulator/canvasRenderer.ts` |
| Render cost max | `10000` | `4000000` | `src/emulator/types.ts`, `src/emulator/drawBuffer.ts` |
| Render cost model | Simplified `+1` per draw op | Match the contract exercised by `verifyEnvironment.lua`, especially `createLayer`, `addBox`, and `addText` cost formulas | `src/emulator/drawBuffer.ts`, new compat helpers |
| Script validation parity | Public Lua API mostly calls host functions directly without DU-style argument validation | Add a compatibility validation layer for public globals so bad calls fail predictably | `src/emulator/luaRuntime.ts` |
| Editor guidance | Snippets/completions still point users to `Arial`-style fonts and do not reflect the DU align constants | Update editor completions/snippets to the DU catalog and DU alignment names | `src/components/CodeEditor.tsx` |

## Explicit Non-Goals For This Pass

- Do not weaken or broaden the current image-loading security rules.
- Do not replace the current back-buffer rendering model.
- Do not force the app-wide default screen resolution to match the mock unless a failing du-mock test later proves it is required.
- Do not rewrite the RenderScript module-wrapper compatibility layer unless a failing integration test requires it.

## Recommended Implementation Strategy

Implement this as one compatibility workstream, but split it into seven tightly scoped phases so the behavior can be validated incrementally.

---

## Phase 1: Create A Single Source Of Truth For DU Compatibility Data

### Objective

Remove hard-coded duplication of DU constants and metadata across `types.ts`, `drawBuffer.ts`, `luaRuntime.ts`, renderer logic, editor snippets, and tests.

### New module

Add a new shared module, for example:

- `src/emulator/renderScriptCompat.ts`

### Put these items there

- `DU_RS_VERSION = 2`
- `DU_RENDER_COST_MAX = 4000000`
- `DU_SHAPE` values matching the mock:
  - `Bezier = 0`
  - `Box = 1`
  - `BoxRounded = 2`
  - `Circle = 3`
  - `Image = 4`
  - `Line = 5`
  - `Polygon = 6`
  - `Text = 7`
- `DU_ALIGN_H`
  - `Left = 0`
  - `Center = 1`
  - `Right = 2`
- `DU_ALIGN_V`
  - `Ascender = 0`
  - `Top = 1`
  - `Middle = 2`
  - `Baseline = 3`
  - `Bottom = 4`
  - `Descender = 5`
- DU available font catalog in the exact order from the mock:
  - `FiraMono`
  - `FiraMono-Bold`
  - `Montserrat`
  - `Montserrat-Bold`
  - `Montserrat-Light`
  - `Play`
  - `Play-Bold`
  - `RefrigeratorDeluxe`
  - `RefrigeratorDeluxe-Light`
  - `RobotoCondensed`
  - `RobotoMono`
  - `RobotoMono-Bold`
- DU font metadata derived from the mock `FontData` table:
  - display family
  - weight
  - ascender multiplier
  - descender multiplier
  - average width multiplier
  - average height multiplier
- per-shape default style data:
  - fill color default
  - stroke color default
  - stroke width default
  - shadow default
  - rotation default
  - text alignment default
- render-cost helper functions:
  - `costCreateLayer()`
  - `costAddBox(...)`
  - `costAddText(...)`

### Why this phase comes first

Every later fix depends on these constants. If the constants stay duplicated, the project will immediately drift again.

### Acceptance criteria

- No DU numeric constant is hard-coded in more than one place without a clear reason.
- `types.ts`, `drawBuffer.ts`, `luaRuntime.ts`, and tests all import from the same compatibility source.

---

## Phase 2: Fix The Public Lua Environment Surface

### Objective

Make the exported Lua globals match the DU mock contract closely enough that `verifyEnvironment.lua` can become the main integration gate.

### Work items

1. Update `src/emulator/types.ts`:
   - extend `RSAlignVer` to the full DU six-value set
   - ensure the exported numeric values match the mock exactly

2. Update `src/emulator/luaRuntime.ts`:
   - expose `_RSVERSION = 2`
   - expose `AlignV_Ascender`
   - correct `AlignV_Top`, `AlignV_Middle`, `AlignV_Bottom`, `AlignV_Descender`
   - make `RSAlignVer` itself contain the same numeric values
   - expose `isFontLoaded`

3. Add a DU-style Lua validation shim layer around public globals.

   Recommended approach:

   - keep the low-level host bindings (`__rsLoadFont`, `__rsGetTextBounds`, etc.)
   - add Lua helper functions in the injected runtime chunk that validate argument types before calling those bindings
   - mirror the mock's behavior where it matters:
     - integer vs number validation
     - string coercion for numeric text arguments where the mock allows it
     - clear failures for invalid font indexes and handles

4. Add or reuse helper functions in the Lua runtime chunk for:
   - `assertInteger(...)`
   - `assertNumber(...)`
   - `assertStringOrCoerceNumber(...)`
   - `assertLayerExists(...)` only if needed on the Lua side; prefer the existing DrawBuffer checks when possible

### Notes

- The host bindings should stay compact and type-stable.
- The compatibility behavior should live in Lua where it can mirror the mock API more naturally.

### Acceptance criteria

- `verifyEnvironment.lua` no longer reports missing functions or missing numbers.
- `AlignV_Descender` is no longer `nil`.
- `isFontLoaded(...)` is callable from user scripts.

---

## Phase 3: Fix Font Catalog, Font Validation, And Font Metrics

### Objective

Make all font-facing APIs behave like the DU mock contract and make metric-dependent behavior deterministic enough for integration tests.

### Work items in `src/emulator/drawBuffer.ts`

1. Replace the current browser-font list with the exact DU catalog.

2. Fix `GetAvailableFontCount()`:
   - return `12`

3. Fix `GetAvailableFontName(index)`:
   - use 1-based indexing
   - throw `out-of-bounds font index` when invalid

4. Fix `LoadFont(name, size)`:
   - reject unknown names with `unknown font <name>`
   - enforce the DU maximum of 8 loaded fonts
   - keep the current handle-reuse behavior for identical `(name, size)` pairs unless a fixture proves that strict new-handle behavior is required
   - only count unique loaded font entries toward the limit

5. Add `IsFontLoaded(fontId)`:
   - validate handle
   - return `true` when the handle exists
   - throw `invalid font handle` when it does not

6. Tighten existing font APIs so invalid font handles fail consistently:
   - `GetFontSize(...)`
   - `SetFontSize(...)`
   - `GetFontMetrics(...)`
   - `GetTextBounds(...)`

### Work items in `src/emulator/textMetrics.ts`

1. Split metrics into two layers:

   - **compatibility metrics** for the API contract and cost calculations
   - **rendering font string generation** for browser drawing

2. Use DU font metadata as the primary source for API-returned metrics:
   - `getFontMetrics(...)` should return `(ascender, descender)` with a **negative** descender, matching the mock
   - `getTextBounds(...)` should be deterministic and not depend on whichever host fonts jsdom happens to provide

3. Recommended design:
   - keep `getFontString(...)` for browser rendering
   - add DU-specific helpers such as:
     - `measureCompatFontMetrics(name, size)`
     - `measureCompatTextBounds(name, size, text)`
   - derive those from the DU font metadata table

4. Add room for higher-fidelity overrides later:
   - optional per-string or per-glyph overrides for known DU fonts
   - this is likely needed because `verifyEnvironment.lua` checks exact `addText(...)` costs for `"."`, `"%"`, and `"%%%"`, and those values are stricter than a simple average-width model

### Data acquisition subtask

The exact DU text costs in `verifyEnvironment.lua` imply that simple average metrics may not be enough.

Plan a small compatibility data task:

- create a small DU text metrics fixture table for the specific fonts and strings exercised by the du-mock scripts and tests
- minimum initial scope:
  - `Play`
  - `RobotoMono`
  - the strings used in `verifyEnvironment.lua`
  - the labels used in `strokeAlign.lua` and `fontSampler.lua`
- once that data exists, route cost-sensitive API calls through it first, then fall back to the average multipliers

### Rendering note

Do not block this phase on bundling real DU font files.

Recommended first pass:

- keep API metrics deterministic from the compat table
- render using browser family/weight mappings from the mock metadata
- add real webfonts later only if the assets are available and allowed to ship

### Acceptance criteria

- `getAvailableFontCount()` and `getAvailableFontName(...)` behave exactly as `verifyEnvironment.lua` expects.
- `loadFont(...)` fails on the 9th unique loaded font.
- `getFontMetrics(...)` returns a negative descender.
- text-cost-sensitive integration tests are deterministic across environments.

---

## Phase 4: Fix Default Style Behavior And Text Alignment Semantics

### Objective

Make default style resolution and text placement behave like the DU mock contract, especially for line defaults and vertical text alignment.

### Default style work

Update style creation so the defaults match the mock behavior.

Recommended changes:

1. Replace the current one-size-fits-all `defaultLayerStyle()` with either:
   - `defaultLayerStyleForShape(shape)`
   - or a `buildDefaultLayerStyles()` helper that creates the full per-shape table for one layer

2. Match these DU defaults from the mock:
   - fill color default: white
   - stroke color default: white
   - stroke width default:
     - `Bezier = 1`
     - `Line = 1`
     - all other shapes = `0`
   - text align default: left + baseline
   - rotation default: `0`
   - shadow default should remain compatible with the mock's shape-property behavior

3. Make sure `SetDefaultTextAlign(...)` still only affects `Shape_Text`.

### Text alignment work in `src/emulator/canvasRenderer.ts`

The renderer currently only approximates vertical alignment. It needs a proper DU mapping.

Implement a dedicated text-anchor resolver that distinguishes:

- `Ascender`: anchor to the font-wide ascender line
- `Top`: anchor to the top of the current text bounds
- `Middle`: anchor to the midpoint of the current text bounds
- `Baseline`: anchor to the text baseline
- `Bottom`: anchor to the bottom of the current text bounds
- `Descender`: anchor to the font-wide descender line

Recommended implementation shape:

1. Add a helper that takes:
   - font name
   - font size
   - text string
   - requested vertical align
   - target y

2. Compute both:
   - font-wide metrics (`ascender`, `descender`)
   - text-specific bounds (`ascent`, `descent`, `height`)

3. Convert all DU align modes into a single canvas draw baseline, preferably still drawing with `alphabetic` baseline and an explicit y adjustment.

This avoids mixing canvas-native baseline semantics with DU's semantics.

### Extra renderer checks

- verify that line/bezier default strokes now render without explicit `setNextStrokeWidth(...)`
- ensure same-layer shape bucket order stays unchanged while style defaults change underneath it

### Acceptance criteria

- `strokeAlign.lua` executes successfully.
- `AlignV_Ascender` and `AlignV_Descender` both produce non-error output.
- default lines are visible without explicitly setting stroke width.

---

## Phase 5: Replace The Simplified Render Cost Model With A DU-Compatible One

### Objective

Make `getRenderCost()` and `getRenderCostMax()` behave like the mock contract used by `verifyEnvironment.lua`.

### Key point

Do **not** try to guess a universal DU cost model for every primitive in this pass.

Instead, match the contract the mock actually exercises today.

### Work items

1. Set `renderCostMax` to `4000000`.

2. Remove the current generic `+1` per shape-op accounting.

3. Implement explicit cost increments where the mock is explicit:
   - `CreateLayer()` => `+75000`
   - `AddBox(...)` => `max(16, (width + sizeBump) * (height + sizeBump))`
   - `AddText(...)` => `floor((textWidth + sizeBump) * (textHeight + sizeBump))`

4. Use the mock's `sizeBump` logic:
   - `sizeBump = ((shadowRadius or 0) + (strokeWidth or 0)) * 2`

5. Preserve the explicit zero-cost behavior for operations the mock marks as zero in the exercised path:
   - `get*` queries
   - `set*` property calls
   - `setLayerClipRect(...)`
   - `setLayerRotation(...)`
   - `loadFont(...)`
   - `loadImage(...)`

6. For primitives whose cost is not currently covered by the mock implementation, leave the initial behavior conservative and documented.

Recommended default for this pass:

- keep them at zero cost unless a du-mock test or documented contract proves otherwise

That keeps the first implementation aligned to the checked contract instead of inventing new behavior.

### Acceptance criteria

- `verifyEnvironment.lua` passes all its cost assertions.
- `getRenderCostMax()` returns `4000000`.
- `createLayer()` adds `75000` cost.

---

## Phase 6: Update The Editor Surface So It Stops Teaching The Wrong API

### Objective

Once the runtime is fixed, the in-app editor should stop nudging users toward non-DU fonts and incomplete constants.

### Work items in `src/components/CodeEditor.tsx`

1. Update the `loadFont(...)` completion/snippet defaults from `Arial` to a DU font such as `RobotoMono` or `Play`.

2. Add missing builtins/constants to the editor surface:
   - `isFontLoaded`
   - `_RSVERSION`
   - `AlignV_Ascender`
   - corrected `AlignV_*` names

3. Update any sample boilerplate that currently implies browser-font usage rather than DU font usage.

4. Keep the tokenizer keyword list in sync with the runtime compatibility data where practical.

### Acceptance criteria

- New editor snippets only reference supported DU font names.
- The editor's builtin list reflects the actual runtime surface after the fix.

---

## Phase 7: Add Full Integration Coverage For The DU Mock Scripts

### Objective

Make the du-mock scripts first-class regression tests instead of one-off analysis artifacts.

### Test structure recommendation

The current `test/luaRuntime.test.ts` file is already very large. Do not keep growing it blindly.

Recommended extraction:

- `test/renderScriptCompat.test.ts`
  - environment surface
  - constants
  - font API
  - render cost contract
- `test/duMocks.integration.test.ts`
  - execute the real scripts in `examples/du-mocks/renderScript/`
- keep `test/drawBuffer.test.ts` for low-level buffer rules
- keep `test/canvasRenderer.test.ts` for renderer placement and order

Also extract a shared Lua test helper if needed, for example:

- `test/helpers/luaFileResolver.ts`

so the same include/require resolution logic can be reused across test files.

### Integration tests to add

#### 1. `verifyEnvironment.lua` gate test

Purpose:

- make this the primary contract test for the compatibility surface

Setup:

- import `verifyEnvironment.lua?raw`
- run through `createLuaEnvironment(...)`
- use a `DrawBuffer` configured with image loading disabled to avoid external fetch requirements

Assertions:

- `result.success === true`
- `result.output === ""`
- no log line contains `Missing`, `Unexpected`, or `Expected ... but was ...`

This one test should catch:

- missing globals
- wrong numeric constants
- wrong font count
- wrong render cost max
- wrong `createLayer`, `addBox`, and `addText` costs
- missing `isFontLoaded`

#### 2. `strokeAlign.lua` script integration

Purpose:

- validate the corrected `AlignV_*` constants and text alignment runtime path

Assertions:

- execution succeeds
- the expected text labels are emitted:
  - `Default`
  - `Ascender`
  - `Top`
  - `Middle`
  - `Baseline`
  - `Bottom`
  - `Descender`
  - `Left`
  - `Center`
  - `Right`
  - `Both Center`
- line commands exist without requiring explicit default stroke width setup for every line

Renderer-level follow-up assertions in `canvasRenderer.test.ts`:

- ascender vs top produce different draw y values
- bottom vs descender produce different draw y values

#### 3. `shapes.lua` script integration

Purpose:

- validate full command availability, per-shape defaults, and next/default style behavior

Assertions:

- execution succeeds
- the script emits six instances of each draw primitive used there:
  - `AddImage`
  - `AddBezier`
  - `AddBox`
  - `AddBoxRounded`
  - `AddCircle`
  - `AddLine`
  - `AddTriangle`
  - `AddQuad`
  - `AddText`
- representative commands reflect expected default vs overridden styling
- no command crashes because of missing constants or invalid default line behavior

#### 4. `resolutionCheck.lua` script integration

Purpose:

- validate `getResolution()`, `getInput()`, `addText(...)`, and line defaults together

Setup:

- seed `buffer.input`
- seed `buffer.screen.width` and `buffer.screen.height`

Assertions:

- execution succeeds
- one text command contains the input string
- one text command contains the formatted resolution string
- exactly four border lines are emitted

#### 5. `layerOperations.lua` script integration

Purpose:

- validate transform and clip APIs together rather than in isolation

Assertions at the buffer level:

- execution succeeds
- expected layer count is created
- representative layers contain:
  - translation only
  - rotation only
  - origin + rotation
  - scale only
  - scale + origin
  - clip rect

Assertions at the renderer level:

- `renderBuffer(...)` applies `translate`, `rotate`, `scale`, and `clip` in the expected order for representative layers

#### 6. `fontSampler.lua` script integration

Purpose:

- validate font catalog pagination, `getAvailableFontName(...)`, `getFontMetrics(...)`, `getTextBounds(...)`, `setFontSize(...)`, and runtime persistence across frames

Suggested sequence:

1. run once with `cursorDown = false`
2. run once with `cursorDown = true`
3. run again with `cursorDown = false`

Assertions:

- execution succeeds on all frames
- the first frame renders the first eight DU font names
- the next page advances after `cursorDown`
- page rollover returns to the start when index exceeds font count
- reported font metrics include a negative descender

#### 7. `badRequire.lua` module error integration

Purpose:

- validate that syntax errors inside required modules surface cleanly

Recommended driver script:

- create a small test Lua source that does `pcall(require, "examples.du-mocks.renderScript.badRequire")`

Assertions:

- the require fails
- the error message points to the bad module source, not a generic host failure

### Additional low-level tests to add

#### `test/drawBuffer.test.ts`

Add direct tests for:

- `GetAvailableFontName(1)` returns `FiraMono`
- `GetAvailableFontName(12)` returns `RobotoMono-Bold`
- invalid font index throws `out-of-bounds font index`
- loading the 9th unique font throws
- line default stroke width is `1`
- bezier default stroke width is `1`
- `GetFontMetrics(...)` descender is negative
- `renderCostMax` equals `4000000`
- `CreateLayer()` adds `75000`
- `AddBox(...)` cost formula examples from `verifyEnvironment.lua`
- `AddText(...)` cost formula examples from `verifyEnvironment.lua`

#### `test/canvasRenderer.test.ts`

Add renderer tests for:

- `AlignV_Ascender`
- `AlignV_Top`
- `AlignV_Middle`
- `AlignV_Bottom`
- `AlignV_Descender`
- default line visibility with no explicit stroke width

#### `test/renderScriptCompat.test.ts`

Add API-level tests for:

- `_RSVERSION`
- `isFontLoaded(...)`
- DU `AlignV_*` constant values
- DU font count and names
- invalid font-handle failures

### Regression command sequence

The implementation should not be considered done until these pass:

```bash
npm test
```

Recommended focused loops during implementation:

```bash
npm test -- drawBuffer.test.ts canvasRenderer.test.ts
npm test -- renderScriptCompat.test.ts duMocks.integration.test.ts
```

---

## File-By-File Change Plan

### `src/emulator/renderScriptCompat.ts` (new)

- add DU constants
- add DU font catalog and metadata
- add per-shape default style definitions
- add render-cost helpers

### `src/emulator/types.ts`

- replace the current `RSAlignVer` values with the DU-compatible set
- update style/default helpers to use per-shape defaults rather than one generic default for all shapes
- update `DEFAULT_SCREEN.renderCostMax`

### `src/emulator/drawBuffer.ts`

- import the compatibility tables/helpers
- fix font count and font name lookup
- add bounds checking and errors for font APIs
- add `IsFontLoaded(...)`
- replace generic `+1` render-cost logic with explicit DU formulas
- update per-shape default style construction

### `src/emulator/textMetrics.ts`

- add deterministic DU metric helpers
- return negative descenders for the API path
- support text-specific bounds needed for `Top/Middle/Bottom`

### `src/emulator/canvasRenderer.ts`

- import corrected vertical alignment constants
- implement proper DU vertical alignment y-resolution
- ensure text draw positions reflect DU anchor semantics
- verify line/bezier defaults render correctly with the updated styles

### `src/emulator/luaRuntime.ts`

- export `_RSVERSION`
- export corrected `RSAlignVer` and `AlignV_*` constants
- export `isFontLoaded`
- add DU-style Lua-side validation wrappers

### `src/components/CodeEditor.tsx`

- update snippets/completions to DU font names
- add missing builtins/constants to the editor model

### `test/helpers/luaFileResolver.ts` (recommended new helper)

- extract the resolver logic currently embedded in `luaRuntime.test.ts`
- reuse it for du-mock fixture integration tests

### `test/renderScriptCompat.test.ts` (new)

- add compatibility surface tests

### `test/duMocks.integration.test.ts` (new)

- add script execution tests for the du-mock fixture folder

### `test/drawBuffer.test.ts`

- add low-level font/default-style/cost tests

### `test/canvasRenderer.test.ts`

- add vertical alignment and default-line rendering tests

---

## Suggested Execution Order

1. Add the new compatibility constants/data module.
2. Fix `types.ts` and `luaRuntime.ts` constants.
3. Fix `drawBuffer.ts` font catalog, font validation, and `isFontLoaded(...)`.
4. Fix deterministic metrics in `textMetrics.ts`.
5. Replace render-cost accounting in `drawBuffer.ts`.
6. Fix renderer vertical alignment behavior.
7. Update editor snippets/completions.
8. Add `renderScriptCompat.test.ts`.
9. Add `duMocks.integration.test.ts`.
10. Run the full test suite and clean up any parity regressions in existing example integrations.

This order is recommended because:

- the constants unblock everything else
- the font metrics unblock text costs and alignment
- `verifyEnvironment.lua` only becomes trustworthy after the font and cost fixes land

---

## Acceptance Checklist

The fixup is done when all of the following are true:

- `_RSVERSION == 2` is present in the runtime
- all DU `AlignV_*` constants exist and match the mock values exactly
- `isFontLoaded(...)` exists and behaves correctly
- `getAvailableFontCount()` returns `12`
- `getAvailableFontName(...)` is 1-based and bounds-checked
- `loadFont(...)` accepts only DU font names and enforces max 8 unique loaded fonts
- `getFontMetrics(...)` returns a negative descender
- line and bezier defaults render without explicitly setting stroke width
- `getRenderCostMax()` returns `4000000`
- `createLayer()` adds `75000` cost
- `verifyEnvironment.lua` passes cleanly
- `strokeAlign.lua`, `shapes.lua`, `resolutionCheck.lua`, `layerOperations.lua`, `fontSampler.lua`, and the `badRequire.lua` driver test all pass
- `npm test` passes end-to-end

## Risks And Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Exact DU text metrics are not fully available from the mock | `verifyEnvironment.lua` text-cost assertions may still fail | Add a small compatibility metric fixture table for known DU fonts/strings first; expand only as needed |
| Changing `RSAlignVer` values may break existing renderer tests | Short-term test churn | Update the renderer tests in the same branch as the constant fix |
| Enforcing the DU font list may break existing non-DU example scripts | Existing examples may fail if they still use browser fonts | Update the affected examples or keep compatibility aliases only where explicitly intended |
| Adding Lua-side validation wrappers may surface hidden bad-call behavior in existing tests | More failures during rollout | Land the wrapper changes together with focused API tests so failures are intentional and explainable |

## Final Recommendation

Treat `verifyEnvironment.lua` as the top-level contract and build outward from it.

If there is a tradeoff during implementation, prefer:

1. exact DU constants
2. exact DU font catalog behavior
3. exact DU cost behavior for the cases the mock exercises
4. deterministic metrics for API behavior
5. best-effort browser rendering appearance

That ordering gives the emulator a reliable compatibility core without blocking on perfect visual font fidelity.
