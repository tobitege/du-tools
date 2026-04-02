# RScript Emulator

`RScript Emulator` is the browser-based RenderScript playground in the `rs_emulator` repository for Dual Universe screen code.

It is meant to make RenderScript development faster outside the game: write Lua, run it in a canvas preview, keep sessions around, and save scripts as normal `.lua` files.
However, it is a script emulator, not a debugger!

## Highlights

- canvas preview for RenderScript output
- persistent session history in the sidebar
- drag-and-drop or file-picker import for `.lua` files
- empty-session GitHub URL import for `.lua` files
- local file save and reload when browser file handles are supported
- horizontal/vertical editor-canvas layouts with draggable split
- canvas rotation controls for portrait-oriented scripts
- configurable Lua module search paths for helpers such as `require("rslib")` and project modules like `require("lib.SvgParser")`
- Monaco editor with RenderScript-oriented completions

## Requirements

- modern desktop browser
- JavaScript enabled

Best experience:

- Chromium-based browser for `showSaveFilePicker()`
- browser support for OPFS for stronger temp-session persistence

For development:

- Node.js 20+
- npm

## Getting Started

From `.\rs_emulator`:

```powershell
npm install
npm run dev
```

Production build:

```powershell
npm run build
```

Tests:

```powershell
npm test
```

Preview build:

```powershell
npm run preview
```

## Lua Module Search Paths

The emulator uses an ordered list of module search paths. The first matching module wins.

In the UI you can open `Settings` -> `Edit Paths` to inspect, reorder, add, or remove search paths. The defaults can come from `.env.local`, but they are shown in the dialog instead of staying implicit.

If you want scripts to resolve vanilla DU helpers such as `require("rslib")`, configure additional default search roots in `.env.local`.

1. Copy `.env.example` to `.env.local`
2. Set `DU_LUA_ROOT`

Example:

```text
DU_LUA_ROOT=C:/Program Files/NQ/DualUniverse/Game/data/lua;./
VITE_RS_ENABLE_IMAGE_LOADING=false
VITE_RS_ENABLE_LUA_HOST_IO=false
```

Use `;` between roots. Relative paths are resolved from the `rs_emulator` project folder.

With the example above:

- `require("rslib")` can resolve from the Dual Universe Lua folder
- `require("lib.SilverZeroRsLib")` resolves from `./lib/SilverZeroRsLib.lua`
- `require("lib.SimpleSignSharedAssetsSelective")` resolves from `./lib/SimpleSignSharedAssetsSelective.lua`

Optional runtime flags stay disabled unless you explicitly enable them:

- `VITE_RS_ENABLE_IMAGE_LOADING=false`
- When disabled, every `loadImage(...)` call resolves to the bundled `Images disabled` placeholder image.
- `VITE_RS_ENABLE_LUA_HOST_IO=false`
- When disabled, Lua host-facing I/O access stays blocked. `require(...)` and `include(...)` still work for emulator-managed modules.

## Main Workflow

### Sessions

- `New Session` creates a blank temp session
- `Open File` imports one or more local `.lua` files into new sessions
- session content is persisted in browser-managed storage
- session order in the sidebar is manual and persistent

### Saving

- `Save` writes to a linked local file when file-handle APIs are available
- otherwise it falls back to a normal file download
- `Reload` reloads the active session from its linked source file after confirmation

### Canvas and Editor

- `Run` executes the current script
- `Stop` ends the current animation loop
- the workspace can be switched between horizontal and vertical split
- the splitter is draggable
- editor font size can be adjusted from the toolbar
- the canvas preview can be rotated left, right, or reset without modifying the script

### RenderScript Notes

Animation:

- `requestAnimationFrame(frames)` schedules the next script execution after roughly that many display frames
- each script execution draws one frame only; animate by updating positions over time and then requesting another frame
- static screens should not call `requestAnimationFrame(...)` or `SZ.animLoop(...)`; unnecessary redraw loops are a common source of flicker

Coordinate space:

- RenderScript coordinates are screen pixels
- `(0, 0)` is the top-left corner and `(width, height)` is the bottom-right corner
- use `getResolution()` and write layouts relative to the current screen size

Fonts:

- `loadFont(...)` only accepts the emulator's current preset font list
- query that list with `getAvailableFontCount()` and `getAvailableFontName(index)` instead of hardcoding assumptions
- loaded fonts are tracked per `name + size` combination, so different sizes still count against the font limit within one run

Render cost:

- `getRenderCost()` and `getRenderCostMax()` expose the current frame budget usage
- the emulator estimates cost from drawn screen area, so larger boxes, text blocks, and images cost more than smaller ones
- treat the number as a useful budget signal, not exact in-game parity

Render order:

- layers render bottom to top in creation order, so later layers appear on top
- within one layer the current shape stack is `Text`, `Quads`, `Triangles`, `Lines`, `Circles`, `Rounded Boxes`, `Boxes`, `Beziers`, `Images`
- if something must reliably appear in front, prefer a separate layer instead of relying on same-layer shape order

### Empty Session Import

When a session is empty, the editor shows an import overlay:

- drop `.lua` or plain-text files onto it
- or use the file picker button
- or paste a GitHub blob/raw URL to a single `.lua` file
- each imported file becomes its own new session

## Current Scope

The emulator currently supports a practical subset of the Render API, including:

- layers
- shapes
- text
- images
- default and next-style setters
- layer transforms
- animation frames
- `require("RenderScript")`
- `RenderScript.Instance()`
- `require("native/Vec2")`

It is useful for real script iteration, but it is not full in-game parity yet.

## Storage Model

Session metadata and content are stored separately:

- metadata in IndexedDB
- content in OPFS when available
- IndexedDB fallback when OPFS is unavailable
- browser file handles stored for repeat saves when supported

This keeps draft sessions persistent while still supporting normal file-based workflows.

## Project Layout

```text
rs_emulator/
  examples/
  src/
    components/
      Canvas.tsx
      CodeEditor.tsx
      Sidebar.tsx
    emulator/
      canvasRenderer.ts
      drawBuffer.ts
      luaRuntime.ts
      types.ts
    storage/
      sessionStore.ts
    App.tsx
```

## Example Files

Examples live under [`examples/`](./examples), including:

- [`examples/example1.lua`](./examples/example1.lua)
- [`examples/wrapper-instance.lua`](./examples/wrapper-instance.lua)
- [`examples/fonts.lua`](./examples/fonts.lua)
- `examples/SilverZero/` for larger shared-helper examples

These files are available in the repo but are not bundled into the production app.

### SilverZero SimpleSign Notes

- `examples/SilverZero/SimpleSignS-svg.lua` keeps the red board outline as a manual path for budget reasons.
- White board decals/highlights should come from `SimpleSignBoardPrepared` via `SZ.drawSvgEntry(...)` filtered to `var(--highlight-color)` items, not from a hand-maintained mix of `highlightPaths` and manual quads.
- This keeps all small board decals on the same rendering path as the prepared board asset and avoids drift between emulator and in-game output.
- Important: treat the visual target first, not the current representation. If a shape is really just a sharp filled trapezoid or quad, prefer the simplest native RenderScript primitive such as `addQuad(...)` or `addTriangle(...)` instead of forcing it through SVG-path reconstruction.
- Do not get stuck on one idea just because the current code already uses it. If a path-based approach starts fighting you, stop and switch levels: compare the target shape, identify the minimal native primitive that matches it, and only keep the more complex path/classifier route when it is clearly needed.

## Known Limitations

- not all RenderScript behavior is game-accurate yet
- file saving depends on browser capability and permission
- fallback download mode cannot overwrite an existing file directly
- image loading depends on browser/network/CORS behavior
- no multi-file project model yet

## Testing

Basic validation:

```powershell
npm test
npm run build
```

## License

MIT licensed.

## Resources

[luapower/svg_parser](https://github.com/luapower/svg_parser)
[d6rks1lv3rz3r0/DU-Screen-Flair](https://github.com/d6rks1lv3rz3r0/DU-Screen-Flair)
