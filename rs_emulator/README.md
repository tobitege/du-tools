# rs_emulator

`rs_emulator` is a browser-based RenderScript playground for Dual Universe screen code.

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
- optional DU Lua include resolution for helpers such as `require("rslib")`
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

From `D:\github\du-tobi\rs_emulator`:

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

## Optional DU Include Setup

If you want scripts to resolve vanilla or neighboring DU helper modules such as `require("rslib")`, configure include roots in `.env.local`.

1. Copy `.env.example` to `.env.local`
2. Set `DU_LUA_ROOT`

Example:

```text
DU_LUA_ROOT=D:/MyDualUniverse/Game/data/lua;./examples/du-mocks
VITE_RS_ENABLE_IMAGE_LOADING=false
VITE_RS_ENABLE_LUA_HOST_IO=false
```

Use `;` between roots. Relative paths are resolved from the `rs_emulator` project folder.

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
