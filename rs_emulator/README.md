# rs_emulator

`rs_emulator` is a browser-based RenderScript playground for Dual Universe screen code.

It provides a modern web UI with:

- a Lua-like code editor with syntax highlighting and RenderScript completions
- a canvas that emulates a screen render surface
- session history in a sidebar
- persistent temp sessions that survive reloads
- local file saving, so work is not limited to browser storage alone

The goal is not to mimic the in-game editor visually 1:1.
The goal is to give RenderScript development a fast, practical, file-friendly workflow outside the game.

## What It Does

At the moment, `rs_emulator` can:

- execute RenderScript-like Lua code in the browser
- emulate the Render API on an HTML canvas
- load and run scripts through `require("RenderScript")` and `RenderScript.Instance()`
- resolve extra `require(...)` calls like `require("rslib")` from a user-selected Dual Universe `Game/data/lua` folder
- render boxes, rounded boxes, circles, lines, polygons, text, and images
- support layer transforms, default styles, and next-shape overrides
- provide a Monaco editor with RenderScript-oriented completions/snippets
- keep sessions persistently in browser-managed storage
- create blank temp sessions automatically
- keep animation playback capped to 60 FPS by default
- switch the canvas/editor workspace between vertical and horizontal split layouts
- resize the canvas/editor split with a draggable splitter
- adjust editor font size from the UI without changing browser zoom
- remember separate splitter positions for horizontal and vertical layouts in saved settings
- show an import dropzone over empty editor sessions so one or more `.lua` files can be dropped directly into new sessions
- save a session to a real local `.lua` file via the browser save dialog when supported
- reload the current session from its linked local file with a confirmation modal
- resolve bare `require(...)` / `include(...)` names against the current source file directory first when that source path is known

## What It Is Not Yet

This is still an early emulator, not a complete game-accurate runtime.

Not everything is fully faithful yet:

- rendering cost is simplified
- text metrics now use browser measurement where available, but are still not fully DU-faithful
- some API behavior is emulated rather than reverse-engineered exactly
- the full Screen unit ecosystem is not implemented yet
- in-game data flow, device callbacks, and gameplay integration are outside current scope

## Requirements

### Lua Runtime

- a modern desktop browser
- JavaScript enabled

Best experience:

- Chromium-based browser for `showSaveFilePicker()` support
- browser support for OPFS / Origin Private File System for better temp-session persistence

Fallback behavior:

- if file-picker APIs are unavailable, Save falls back to a normal download
- if OPFS is unavailable, session content falls back to IndexedDB

### Development

- Node.js 20+ recommended
- npm

## Getting Started

From `D:\github\du-tobi\rs_emulator`:

```powershell
npm install
npm run dev
```

Optional DU include setup for vanilla modules like `require("rslib")`:

1. copy `.env.example` to `.env.local`
2. set `DU_LUA_ROOT` to one or more Lua include folders

Example:

```text
DU_LUA_ROOT=D:/MyDualUniverse/Game/data/lua;./examples/du-mocks
```

Use `;` as the separator when you want more than one root. Relative entries are resolved from the `rs_emulator` project folder, and the first matching module wins.

This is resolved by the Vite dev/preview server, so it works without browser file-picker APIs.

Production build:

```powershell
npm run build
```

Run unit/integration tests:

```powershell
npm test
```

Preview production build:

```powershell
npm run preview
```

## How Sessions Work

Each session has two parts:

1. metadata
   - name
   - updated timestamp
   - dirty flag
   - optional linked filename

2. content
   - the actual Lua/RenderScript text

### Temp Sessions

A newly created session starts as a blank internal temp file.

Internally it is stored under a browser-managed temp path like:

```text
rs-sessions/<session-id>.lua
```

This is persistent across reloads, but still belongs to browser-managed storage.

### Saved Sessions

When the Save button in the editor header is used:

- the app tries to open a real local save dialog
- if the browser allows it, the session becomes linked to that chosen file
- later saves reuse that file handle when permission is still available

If the browser does not support this path, the app falls back to downloading a `.lua` file.

### Reloading Sessions

The Reload button in the editor header reloads the active session from its source after a custom confirmation dialog.

- file-backed sessions reload from their linked local file
- dirty sessions show a warning before content is replaced
- browser-native prompts are not used

This design avoids depending only on localStorage, which is too limited for the intended workflow.

## Why File-Backed Sessions Matter

Browser storage is useful for drafts, but not good enough as the only persistence layer.

Reasons:

- browser quota can be small or inconsistent
- private/incognito modes can restrict storage
- in-game or embedded web views may have hard limits
- real scripts should be easy to keep as normal files in the repo or on disk

`rs_emulator` therefore keeps draft sessions internally, but also supports real local file saving as a first-class workflow.

## Current UI Overview

### Sidebar

- session list/history
- rename/delete session actions
- settings panel
- session switching stops the active script and clears the canvas for the newly selected session until Run is pressed

### Main Area

- screen canvas preview
- Monaco-based code editor
- horizontal workspace as default, with editor on the left and canvas on the right
- vertical workspace available through the layout toggle
- draggable splitter between editor and canvas
- Run / Stop button for animated scripts
- Save button
- Reload button
- editor font decrease/increase buttons
- layout reset button
- layout toggle button
- run status / error feedback
- empty-session import dropzone over the editor for drag-and-drop or file-pick loading

### Editor Header Buttons

- `A-` reduces the Monaco editor font size
- `A+` increases the Monaco editor font size
- `H` / `V` switches between horizontal and vertical workspace layouts
- `R` resets layout orientation, splitter positions, and editor font size to defaults
- Save writes the current session to a local file when file-handle support exists, or falls back to download
- Reload replaces the current editor content from the linked file after confirmation
- Run starts the current script, Stop ends the current animation loop

### Settings

- Resolution: selects a practical screen form factor preset and updates canvas width/height
- Canvas / Editor: selects horizontal or vertical workspace layout
- Show Grid: draws the grid overlay behind the render output without restarting the script
- Show FPS: shows render timing, draw-call count, and text-call count on the canvas HUD
- Dark Background: switches the outer canvas presentation background
- Auto-run on change: reruns the current script after editor changes, except on initial page load
- DU Lua includes: shows the active include path from `.env.local` or the picked folder name; shows a plain message when no include path is configured

### Empty Session Import

- a new blank session shows a centered overlay over the editor area
- `.lua` and plain-text files can be dropped onto that overlay
- the same overlay also provides a file picker button
- each imported file creates a new session named after the file
- import does not auto-run the new sessions

Sessions load into the editor on page open, but scripts do not auto-run on initial page load.
Changing visual-only toggles like `Show Grid` updates the canvas presentation without restarting the running script.

The current resolution presets are practical emulator presets, not yet a final catalog of confirmed in-game DU Screen/Sign sizes.

## RenderScript Coverage

The emulator currently covers a large practical subset of the Render API surface from `RenderScript.lua`, including:

- `createLayer`
- `addBezier`
- `addBox`
- `addBoxRounded`
- `addCircle`
- `addImage`
- `addImageSub`
- `addLine`
- `addQuad`
- `addText`
- `addTriangle`
- `loadFont`
- `loadImage`
- `getResolution`
- `getTime`
- `getDeltaTime`
- `requestAnimationFrame`
- default/next style setters
- layer clip/origin/rotation/scale/translation

Supporting pieces also exist for:

- `RSShape`
- `RSAlignHor`
- `RSAlignVer`
- `require("native/Vec2")`

## Architecture

### Editor

The code editor is Monaco-based and configured for Lua-style editing with RenderScript-focused completions.

Relevant file:

- `src/components/CodeEditor.tsx`

### Runtime

Lua execution runs through `wasmoon` in the browser.

Each app runtime creates an isolated Lua environment wrapper for the current emulator instance instead of sharing one global mutable script state across all sessions.

Within one active session/runtime, Lua globals persist across repeated executions so DU-style stateful render loops can keep their global values between frames/reruns.

Relevant file:

- `src/emulator/luaRuntime.ts`

The runtime also preloads compatibility modules so scripts can use:

- `require("RenderScript")`
- `RenderScript.Instance()`
- `require("native/Vec2")`
- `require("rslib")` and similar DU helper modules when the include folder is configured in Settings

When the current source file path is known, bare `require(...)` and `include(...)` names are resolved against that source file's directory before falling back to the DU include root. This keeps neighboring helpers such as `SilverZeroRsLib.lua` loadable without bundling `.lua` files into the app.

### Render Buffer

Render calls are collected into a draw buffer first, then painted onto canvas.

Relevant files:

- `src/emulator/drawBuffer.ts`
- `src/emulator/canvasRenderer.ts`

### Session Storage

Session metadata and content are managed separately:

- metadata in IndexedDB
- content in OPFS when available
- IndexedDB fallback for content when OPFS is unavailable
- file handles stored for repeat saves when supported

Relevant file:

- `src/storage/sessionStore.ts`

## Project Structure

```text
rs_emulator/
  examples/
    example1.lua
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

## Example Script

Standalone example files live in:

- `examples/example1.lua`

Wrapper-oriented example:

- `examples/wrapper-instance.lua`
- `examples/fonts.lua`

`examples/fonts.lua` is based on a Dual Universe programming-board pattern that generates a screen RenderScript payload for linked screen output.

These example files can be loaded into sessions when needed, but `.lua` example files are not bundled into the production app.

### SilverZero Example Helpers

The SilverZero example ports under `examples/SilverZero/` share a local helper module:

- `examples/SilverZero/SilverZeroRsLib.lua`

This helper library is meant for reusable RenderScript-side drawing primitives and layout helpers that are shared across multiple SilverZero example screens.

Current shared helpers include:

- screen/layout conversion helpers such as `layoutForScreen`, `toScreenX`, `toScreenY`, `toScreenW`, `toScreenH`
- text/layout helpers such as `text`, `badge`, `row`, `withClip`
- generic drawing helpers such as `line`, `box`, and `scaleColor`
- SilverZero-specific composition helpers such as `panel`, `frame`, and the hexagon/logo primitives

`line(...)` exists partly to make the RenderScript next-style rule harder to misuse:

- `setNextStrokeColor(...)`
- `setNextStrokeWidth(...)`

These only affect the next single draw call, so repeated line sequences should use a helper that reapplies stroke state before every `addLine(...)`.

`namedSymbolRow(...)` is a shared higher-level helper for strips like the `OreExplorerM.lua` planet row.

Each entry is declarative and can provide:

- `name`
- `shape`
- `size`
- optional `color`, `metaText`, `selected`, `selectedScale`, `selectedMinSize`

The helper currently supports symbol scaling modes:

- `linear`
- `log`
- `auto`

`auto` starts with 1:1-style linear scaling from the smallest declared entry and switches to logarithmic scaling when the size spread becomes large enough to make linear scaling visually awkward.

The current `OreExplorerM.lua` planet strip uses this helper with named entries and size-scaled circle symbols instead of hard-coded per-planet draw logic.

## Known Limitations

- not all RenderScript behavior is game-accurate yet
- file saving depends on browser capability and permission
- fallback download mode cannot silently overwrite an existing file
- image loading is asynchronous and depends on browser/network/CORS behavior
- no full import/open-file workflow yet
- no multi-file project model yet
- no exact in-game Screen API parity yet

## Development Notes

- this is a standalone web project inside the larger repo
- it is not part of the MCP transport layer
- it does not change `DuMcpBridge` architecture
- it is intentionally separate from live in-game probe logic

That separation matters:

- `DuMcpBridge` stays transport-oriented
- `rs_emulator` is a local authoring/emulation tool

## Testing

Basic validation currently means:

```powershell
npm test
npm run build
```

This covers example/runtime tests plus TypeScript compilation and production bundling.

## Changelog

### Current state

- created a standalone Vite + React + TypeScript project
- added Monaco editor with Lua-style syntax support and RenderScript completions
- added canvas-based RenderScript emulator
- added settings sidebar and session history UI
- moved example code into `examples/example1.lua`
- replaced browser-only session storage with persistent temp-session storage
- added local-file Save support with browser file picker when available
- fixed session/runtime isolation issues
- fixed animation timing reset issues
- improved image persistence across reruns
- added direct `RenderScript.lua` wrapper compatibility for `require("RenderScript")`
- added a shared SilverZero helper library workflow for reusable RenderScript drawing/layout helpers under `examples/SilverZero/SilverZeroRsLib.lua`
- added shared SilverZero helpers for generic lines, boxes, scaled colors, and named size-scaled symbol rows

### Next likely steps

- add `Open...` for existing local `.lua` files
- add `Save As`
- improve API fidelity against actual in-game RenderScript behavior
- add more built-in examples
- add import/export helpers for larger script workflows

## License

No dedicated license file is present for `rs_emulator` yet.

Until a repo-level or project-level license is added, treat this project as source available inside the repo but not separately licensed for external reuse.

Add a proper `LICENSE` file before publishing or sharing it more broadly.
