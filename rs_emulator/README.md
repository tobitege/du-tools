# rs_emulator

`rs_emulator` is a browser-based RenderScript playground for Dual Universe screen code.

It gives you a modern web UI with:

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
- render boxes, rounded boxes, circles, lines, polygons, text, and images
- support layer transforms, default styles, and next-shape overrides
- provide a Monaco editor with RenderScript-oriented completions/snippets
- keep sessions persistently in browser-managed storage
- create blank temp sessions automatically
- save a session to a real local `.lua` file via the browser save dialog when supported

## What It Is Not Yet

This is still an early emulator, not a complete game-accurate runtime.

Not everything is fully faithful yet:

- rendering cost is simplified
- text metrics are approximated
- some API behavior is emulated rather than reverse-engineered exactly
- the full Screen unit ecosystem is not implemented yet
- in-game data flow, device callbacks, and gameplay integration are outside current scope

## Requirements

### Runtime

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

Production build:

```powershell
npm run build
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

When you click the Save button in the editor header:

- the app tries to open a real local save dialog
- if the browser allows it, the session becomes linked to that chosen file
- later saves reuse that file handle when permission is still available

If the browser does not support this path, the app falls back to downloading a `.lua` file.

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

### Main Area

- screen canvas preview
- Monaco-based code editor
- Run button
- Save button
- run status / error feedback

### Settings

- Resolution
- Show Grid
- Show FPS
- Dark Background
- Auto-run on change

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

Relevant file:

- `src/emulator/luaRuntime.ts`

The runtime also preloads compatibility modules so scripts can use:

- `require("RenderScript")`
- `RenderScript.Instance()`
- `require("native/Vec2")`

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

The current built-in example lives in:

- `examples/example1.lua`

Wrapper-oriented example:

- `examples/wrapper-instance.lua`

It is imported into the app as raw text and used to bootstrap the first session.

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
npm run build
```

This confirms TypeScript compilation and production bundling.

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

### Next likely steps

- add `Open...` for existing local `.lua` files
- add `Save As`
- improve API fidelity against actual in-game RenderScript behavior
- add more built-in examples
- add import/export helpers for larger script workflows

## License

No dedicated license file is present for `rs_emulator` yet.

Until a repo-level or project-level license is added, treat this project as source available inside the repo but not separately licensed for external reuse.

If you want, add a proper `LICENSE` file before publishing or sharing it more broadly.
