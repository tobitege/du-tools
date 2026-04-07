# HUD Editor E2E Testing

This document is the full start-to-finish validation flow for `LuaPainter`.

Use it together with [du-tests.md](/d:/github/du-tobi/du-tests.md). `du-tests.md` remains the live safety authority.

## Goal

Prove all of the following in one pass:

1. the HUD editor runtime module is current and loaded
2. the live editor UI works
3. a tracked snippet can be loaded in the live editor
4. board export writes the generated boot document into `unit.onStart()`
5. a real board off/on cycle happens
6. the linked screen visibly updates to the edited layout
7. fresh Lua chat lines from that same restart are present

## Files Involved

- `js/modules/*`
- `board/HudEditorBoard.lua`
- `screen/HudEditorScreen.lua`
- `scripts/publish.ps1` (runs `build.ps1` for web + ingame)
- `render-shape-snippet-plan.md`

## Local Preparation

### 1. Build and publish the project

```powershell
pwsh -File .\LuaPainter\scripts\publish.ps1
```

Expected (under `build/`):

- `lua-painter-probe.js`
- `lua-painter-probe.ingame.js`
- `lua-painter-runtime-module.ingame.js`
- `lua-painter-runtime-module.ingame.json`

### 2. Run browser regression tests

```powershell
cd .\LuaPainter\web
pnpm test
```

Expected:

- Playwright suite passes before live mutation work

### 3. Publish the in-game payload

```powershell
pwsh -File .\LuaPainter\scripts\publish.ps1
```

Expected:

- the HUD editor runtime module is copied into `ModUiToolbox\payload\lua-editor-runtime-modules\lua-painter`
- ModUiToolbox publish completes

## Live Validation

All MCP calls for the same `playerId` must stay sequential.

### 4. Confirm the active session

Tool:

- `du_list_active_sessions`

Expected:

- one usable live DU session
- capture the real `playerId`

### 5. Confirm the current visible state before any native input

Use targeted screenshots when state matters.

Checks:

- centered screenshot when deciding board vs screen interaction
- left-side screenshot when you need to distinguish UI mode vs world mode

Important:

- visible left toolbar means UI mode
- no left toolbar means likely world mode

### 6. Open the Programming Board Lua editor

Preferred:

- `du_open_lua_context`

Typical target:

- `slotName = unit`
- `filterName = onStart()`

Expected:

- `lua_editor` visible
- selected slot and filter match the requested context

### 7. If the probe/runtime is stale, reinject cleanly

Only do this while editors are closed.

Tool:

- `du_reinject_lua_probe`

Expected after reopen:

- fresh probe state
- no stale runtime-module registry

### 8. Confirm runtime-module state in the live Lua editor

Use `du_ui_invoke` with `method = raw_eval` to check:

- `window.HudEditor`
- `document.getElementById("lua-painter-root")`
- runtime-module checkbox state
- `window.HudEditor.shapeSnippets`
- `window.HudEditor.screenCommands`
- `window.HudEditor.ideExport`

Expected:

- all required HUD editor runtime surfaces are present

### 9. Enable the HUD editor runtime module if needed

Use the real runtime-module checkbox inside the live Lua editor.

Expected:

- the top-right `HUD Editor: OFF/ON` toggle exists
- the HUD editor root exists

### 10. Open the HUD editor

Use the top-right HUD editor toggle.

Expected:

- HUD editor overlay visible
- start screen or editor screen visible

### 11. Load a tracked snippet into the live editor

Preferred live probe check:

```js
window.HudEditor.shapeSnippets.loadDocument("overlap_same_type_boxes")
```

Validate:

- `window.HudEditor.state.currentScreen === "editor"`
- `window.HudEditor.state.document.id === "overlap_same_type_boxes"`
- `window.HudEditor.state.document.elements.length === 3`

Expected:

- visible overlap-box layout on the HUD editor canvas

### 12. Validate the live editor shell

Check at minimum:

- `Shapes` dropdown exists
- the dropdown contains the expected tool entries
- the dropdown closes after selection
- current tool updates correctly

### 13. Validate export generation in the live runtime

Use `raw_eval` to inspect:

- `window.HudEditor.ideExport.buildScreenCommandDocument(...)`
- `window.HudEditor.ideExport.buildScreenCode(...)`

Expected:

- generated command document uses `doc.c`
- command list matches the loaded snippet
- screen export uses the shared command path and not the legacy direct element branch

### 14. Export the board code from the live HUD editor

Use the real `Export Board` or save/apply flow from the live HUD editor.

Expected:

- a real export request is emitted
- the current layout becomes a board boot document

### 15. Verify the visible `unit.onStart()` buffer

Open or stay in:

- `unit.onStart()`

Validate the live buffer with `raw_eval`.

Minimum proof:

- buffer contains `local HUD_EDITOR_BOOT_DOCUMENT =`
- buffer contains the tracked snippet id
- buffer contains `HudEditorBoard.init(HUD_EDITOR_BOOT_DOCUMENT)`

Important:

- this proves the visible board buffer
- this still does not prove the board runtime is already executing it

### 16. Close editor-side plugin UI before leaving the editor

Preferred:

- `du_ui_invoke` with `uiKind = lua_editor`, `method = close_runtime_ui`

Expected:

- runtime modules dismiss their overlay UI without being disabled
- HUD editor overlay is no longer blocking the screen

Fallback only if needed:

- left-side screenshot to confirm UI mode
- click `HUD Editor: ON` once
- press `Tab` to return to world mode

### 17. Close the Lua editor and verify the actual client state

Expected:

- `du_ui_describe(lua_editor)` reports `visible = false`
- targeted screenshot confirms whether the client is in world mode

### 18. Perform a real board restart

This is mandatory.

Use:

- centered view on the board
- real in-world interaction such as `F`

Expected:

- the board actually turns on or restarts
- do not substitute editor save/apply for this step

### 19. Validate the linked screen visually

This is the primary runtime proof.

Expected:

- the linked screen visibly changes to the exported layout
- for the overlap-box snippet, the screen must show that specific overlap-box result, not the previous demo state

Capture a screenshot for evidence.

### 20. Validate fresh Lua chat from the same run

Use:

- `du_chat_snapshot`

Expected fresh lines from that exact restart, for example:

- `Initializing HUD Editor Board`
- `Loaded boot document from exported HUD layout`
- `Linked 1 screen(s)`
- `Initial screen publish complete`
- `HudEditorBoard initialized`

Important:

- if chat and visible screen disagree, trust the screen

### 21. Cleanup

Return to a safe idle state:

- HUD editor closed
- `lua_editor` closed
- no unexpected plugin overlay left open

## Minimum Evidence Set

For a good validation report, keep at least:

- build success
- browser test success
- active session confirmation
- live runtime-module presence check
- live snippet load proof
- visible `unit.onStart()` boot document proof
- linked-screen screenshot after real board restart
- Lua chat snapshot from the same restart

## Known Failure Patterns

### Saved buffer but old screen result

Meaning:

- you proved the editor buffer
- you did not yet prove a real board restart

Fix:

- close editor-side UI
- return to world mode
- perform a real board off/on
- re-check screen first, then chat

### Lua editor closed but HUD editor overlay still visible

Preferred fix:

- `du_ui_invoke(uiKind = lua_editor, method = close_runtime_ui)`

Fallback:

- confirm UI mode with a left-side screenshot
- click `HUD Editor: ON`
- `Tab` back to world mode

### Stale runtime-module registry after publish

Fix:

- ensure the editor is closed
- reinject the Lua probe
- reopen the editor and verify the runtime module again
