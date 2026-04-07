# Lua Painter

`LuaPainter` is an in-game Lua Painter for Dual Universe.

The original goal was not "a browser editor". The goal was an in-game script that lets a player paint shapes onto a canvas, manage the layout visually, save that layout on a programming board, and then turn the result into RenderScript-style Lua code for linked screens and signs.

The browser harness in `web/` is only a development and test rig for the same JavaScript editor code. The actual target is the in-game runtime.

## Main Idea

Lua Painter gives you a visual editor for building screen layouts out of:

- boxes
- rounded boxes
- circles
- bezier arcs
- triangles
- quads
- images
- lines
- text

It also supports rotation and glow-style shadow metadata on the editable document model, so the full `renderScript/shapes.lua` demo can be represented as an actual HUD-editor layout instead of only as raw RenderScript.

You edit the layout visually in-game, save the document on the programming board, and export generated Lua for runtime use on screens/signs.

## In-Game Workflow

1. Open Lua Painter in-game (see **Opening Lua Painter via DuMcpBridge** below for an MCP-only path, or use the in-game ModUiToolbox runtime-module UI).
2. Enable the Lua Painter runtime plugin (runtime module id `hud-editor`, display name **Lua Painter**; see build stamp in `build/hud-editor-runtime-module.ingame.json`).
3. Paint and edit shapes on the canvas.
4. Save/load the current layout through the programming board flow.
5. Export generated code for board and screen use.
6. Run the exported RenderScript-style Lua on linked in-game screens/signs.

## Opening Lua Painter via DuMcpBridge (MCP-only)

Use this when you control the client through **DuMcpBridge** MCP tools only (no repo source spelunking). Authoritative live rules, probe behavior, and sequencing are in the repo root file **`du-tests.md`**; follow that first.

**Prerequisites (from `du-tests.md`):** DuMcpBridge running, Dual Universe client logged in, ModUiToolbox + Lua probe as required for `lua_editor` probe calls. Keep all steps **sequential** for the same `playerId` (do not parallelize session-sensitive calls).

**Tool calls (DuMcpBridge):**

1. **`du_list_active_sessions`** — pick a `playerId` with an active session.
2. **`du_ui_describe`** with `uiKind: lua_editor` and that `playerId` — optional baseline; if `visible` is false, the editor is not open yet.
3. **`du_open_lua_context`** — opens the Programming Board Lua editor and selects a slot/filter in one step. Required arguments include `playerId`, `slotName`, and `filterName` (typical board work: e.g. `unit` and `onStart()`). Use this when the Lua editor is not already visible.
4. **`du_ui_invoke`** with `uiKind: lua_editor`, `method: raw_eval`, and `functionBody` set to enable the Lua Painter runtime module (module id `hud-editor`):

   ```text
   return state.runtimeModules.setEnabled("hud-editor", true, "mcp");
   ```

5. **`du_ui_invoke`** again with `method: raw_eval` if the overlay is still hidden — toggle the in-HUD control so the root becomes visible:

   ```text
   var root = document.getElementById("hud-editor-root");
   var btn = document.getElementById("hud-editor-toggle");
   if (btn && root && root.style && root.style.display !== "block") btn.click();
   return root && root.style ? root.style.display : null;
   ```

6. Optional: **`du_ui_describe`** with `uiKind: lua_editor` to confirm editor/probe state after the steps.

**Closing the overlay without clicking:** use **`du_ui_invoke`** with `uiKind: lua_editor`, `method: close_runtime_ui` (see `DuMcpBridge/README.md` and `du-tests.md`).

**Verification outside DuMcpBridge:** optional screenshot MCP (e.g. **ScreenShotNet** `capture_*`) is not part of DuMcpBridge; use only if your environment exposes it.

## What The Project Contains

```text
LuaPainter/
|- js/
|  |- modules/              editor source
|  |- assets/               CSS
|  |- manifest.txt          web build order
|  `- manifest.ingame.txt   in-game build order
|- board/                   programming board Lua files
|- screen/                  screen runtime Lua file
|- build/                   generated bundles
|- scripts/                 build/publish helpers
|- web/                     browser test harness
`- layouts/                 local layout files when used outside game
```

## Important Runtime Pieces

- `board/HudEditorBoard.lua`
  board-side state, persistence, command handling, and linked-screen handoff for library.onStart
- `board/HudEditorBoard-onStart.lua`
  programming board bootstrap entry
- `screen/HudEditorScreen.lua`
  stable linked-screen RenderScript runtime; the board sends the compact current layout through `setScriptInput(...)`
- `js/modules/085-ide-export.js`
  generates manual export code for board/screen editors
- `js/modules/090-databank-sync.js`
  in-game save/load flow through the programming board Lua editor

## Editor Features

- visual shape creation
- extended DU primitive creation (`bezierArc`, `triangle`, `quad`, `image`)
- move and resize
- multi-select
- grouping and ungrouping
- alignment tools
- clone
- undo and redo
- property editing
- rotation and glow/shadow editing
- save/load
- board export
- screen export
- tracked `demo_shapes_lua_full` snippet mirroring the DU `shapes.lua` sample

## Build and publish

Build web and in-game bundles and publish the in-game runtime module through ModUiToolbox:

```powershell
pwsh -File .\LuaPainter\scripts\publish.ps1
```

This runs the bundle build (web + ingame), copies the module into ModUiToolbox's runtime-module folder, and then runs ModUiToolbox's normal publish step. Generated files go into `build/`.

`scripts/build.ps1` remains the low-level builder; you normally do not need to invoke it directly.

## Web Harness

The `web/` folder exists so the JavaScript editor can be tested quickly outside the game. It is useful for UI work, regression tests, and iteration speed, but it is not the end product.

Install:

```powershell
cd .\LuaPainter\web
pnpm install --ignore-workspace
```

Run:

```powershell
pnpm run serve
```

Test:

```powershell
pnpm test
```

More harness details are in `web/README.md`.

## Key Files

| File | Role |
|------|------|
| `js/modules/000-core.js` | Core app lifecycle and mode handling |
| `js/modules/010-start-screen.js` | Start screen and new/load flow |
| `js/modules/020-editor-shell.js` | Main editor UI |
| `js/modules/030-canvas-renderer.js` | Canvas preview rendering |
| `js/modules/040-tool-handlers.js` | Shape creation tools |
| `js/modules/050-selection-manager.js` | Selection, drag, resize, grouping |
| `js/modules/060-shapes-panel.js` | Shape insert panel |
| `js/modules/070-properties-panel.js` | Property editing |
| `js/modules/080-bridge-commands.js` | Bridge/runtime command flow |
| `js/modules/082-shape-snippets.js` | Tracked snippet catalog for repeatable demo families |
| `js/modules/083-screen-commands.js` | Shared screen draw-command normalization for export/runtime parity |
| `js/modules/085-ide-export.js` | Generated Lua export for board/screen editors |
| `js/modules/090-databank-sync.js` | In-game save/load integration |
| `js/modules/100-file-sync.web.js` | Web-only file/export helpers |
| `js/modules/110-undo-redo.js` | History stack |
| `js/modules/120-dialogs.js` | Dialogs and confirmations |
| `e2e_testing.md` | Full local + live end-to-end validation runbook |
| `render-shape-snippet-plan.md` | Snippet-catalog roadmap for expanding primitive and effect coverage |
| `scripts/build.ps1` | Bundle builder (used by `publish.ps1`) |
| `scripts/publish.ps1` | Build web + ingame and publish runtime module |
| `web/harness.js` | Browser harness bootstrap |
| `web/tests/hud-editor.spec.js` | Playwright coverage |

## Shortcuts

- Lua Painter availability in-game: ModUiToolbox runtime-module UI (kebab menu), or the **Opening Lua Painter via DuMcpBridge** MCP sequence above
- `V` select
- `B` box
- `R` rounded box
- `C` circle
- `A` bezier arc
- `Y` triangle
- `Q` quad
- `I` image
- `L` line
- `T` text
- `Ctrl+Z` undo
- `Ctrl+Y` redo
- `Ctrl+S` save
- `Ctrl+G` group
- `Ctrl+Shift+G` ungroup
- `Ctrl+D` clone
- `Delete` delete selection
- `Escape` clear selection or close from the start screen

## Notes

- This project is self-contained inside `LuaPainter`.
- The browser harness is secondary; the real deliverable is the in-game Lua Painter workflow.
- `build/` contains generated files.
- `layouts/` may be empty until local saves exist.
- Linked live screens now publish a pure standalone RenderScript through `setRenderScript(...)`.
- `Export Screen` now defaults to a `default` RenderScript mode with ordered painter calls such as `P.br(...)` and `P.tx(...)`.
- Both `default` and `compact` screen code target the shared painter module `lib.painterlib`; place `LuaPainter/lib/painterlib.lua` in the game's `lua/lib/` folder when you want to run those exports directly in Dual Universe.
- Compact screen code is still available through the exporter API via `buildScreenCode(doc, { mode: "compact" })`.
- In Dual Universe, most `setNext...` render methods apply to the single next draw command only. If draw code loops over multiple `addText(...)` or similar calls, repeat the relevant `setNext...` call inside that loop.
