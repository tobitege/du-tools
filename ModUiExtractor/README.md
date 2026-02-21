# ModUIExtractor

Embedded myDU DLL mod that injects a defensive JavaScript payload into the DU client UI and stores returned packets on the server as NDJSON dumps.

## Start Here

Most important workflow in this project:

- `## Hot-Reload Workflow (Lua Probe)` -> jump to [`Hot-Reload Workflow (Lua Probe)`](#hot-reload-workflow-lua-probe)

This repo now includes:

- robust full CSS extraction (`ALL .css files (full)`)
- full script-body extraction (`ALL .js files (full)`)
- NDJSON reassembly into per-section files
- automatic HTML splitting (`html.html` -> `html\*.html`)

## Known Open Issues

| Area | Status | Symptom | Current Workaround | Verify With |
| --- | --- | --- | --- | --- |
| Lua quick `Edit Lua script` menu item | Mitigated (native bridge) | Previously intermittent open failures from quick menu | Keep native-path resolver enabled (`Advanced -> Edit Lua script`) | `lua_quick_menu_edit_lua_result.bridgeInvoked=true` + `lua_editor_opened` |
| Lua editor slot/filter auto-load + per-filter position restore | Mitigated (settle-gated) | Earlier regressions: stale slot auto-open races, restore clamped to line 1, one-filter-only memory | Keep stable slot-key auto-open + CodeMirror settle gate + target-snippet gate enabled | `lua_slot_auto_open.status=clicked` + `lua_cm_settle_signal.kind=target-snippet` + `lua_snippet_switch_begin.targetHasRememberedTopLine=true` on revisit |

## Changes And Wins

### 2026-02-20

- Added `UI Extractor\Inject LUA editor probe` (Action `5`) to instrument the Lua editor from the element context menu.
- Confirmed the Lua editor entrypoint path in-game: context menu item `Edit Lua script (Ctrl + L)` opens `#dpu_editor`.
- Added a visible probe payload test in the Lua editor header: three dots (green/yellow/red, top-left) that recolor editor chrome on click.
- Verified probe event capture with `lua-probe-*.ndjson` files (`lua_menu_click`, `lua_editor_opened`, and manager calls).
- Fixed a client lockup regression by removing attribute-level global MutationObserver feedback loops and using periodic maintenance scans instead.
- Added runtime-editable payload overrides in `tmp/ui-dumps/payload-overrides` so injections can pick up JS changes without rebuilding the DLL.
- Added probe reinjection hot-reload so override JS edits can be applied in-session on the next inject.
- Added Lua editor QoL probe features: per-context top-line restore, and a caret-line highlight toggle next to font size controls.
- Removed compile-time assembly conflict warnings by aligning Orleans/Microsoft.Extensions references to DU runtime DLLs while keeping the mod target at `net6.0`.
- Increased probe control visibility: larger `LINE HL` toggle button and larger top-right `LUA PROBE ACTIVE` badge.

### 2026-02-21 (Lua Probe Hardening Session)

- Reworked slot -> filter -> code-load flow to be observer-driven and resilient to Cohtml async DOM rebuilds.
- Added pending slot auto-open logic with guarded retries and explicit telemetry packet `lua_slot_auto_open` (`armed`, `no-candidate`, `stale-selected`, `clicked`, `expired`).
- Restored full synthetic click sequence (`mousedown` + `mouseup` + `click`) for legacy client compatibility.
- Added one-shot post-switch editor focus handoff (`forceEditorFocusOnNextSwitch`) so slot-driven loads can restore caret visibility and line highlight behavior.
- Added fresh-open stateless guard:
  - no top-line/caret restore before first real user slot/filter interaction,
  - viewport/caret clamped to top while `suppressRestoreUntilInteraction=true`,
  - guard removed immediately after first explicit editor navigation interaction.
- Quick context menu injection updated:
  - injected entries are left-aligned and styled from native menu template structure,
  - quick `Edit Lua script` now resolves the real top-level `Advanced -> Edit Lua script` path, extracts `helperid` (for example `menu_item_30`), and executes the native bridge action using `CPPMainContextMenu/CPPContextMenu.executeAction(<numeric helper index>)`,
  - bridge-first path now waits for editor open before fallback and only keeps a lightweight `Ctrl + L` fallback,
  - emits `lua_quick_menu_edit_lua_result` telemetry steps for debugging.
- **Breakthrough:** `executeAction` expects a numeric first argument (type conversion fails for string/object signatures). Converting `helperid` (`menu_item_30`) to numeric index (`30`) is the reliable trigger.
- Final Lua editor stabilization points (what made slot/filter sync reliable):
  - switched slot auto-open matching from volatile DOM identity to a stable slot key (`id/data/index`) so `.selected` class churn does not break matching,
  - required target-slot convergence before auto-open click (`waiting-target-slot` / `waiting-slot-switch` states),
  - replaced timer-only restore loop with CodeMirror settle gating (`changes`/`scroll`/`viewportChange`/`refresh`/`update` + quiet window),
  - added target-snippet gate (restore is allowed only after CodeMirror contains the expected `targetSnippetKey`),
  - bounded all waits (`5s` max wait, `250ms` quiet window) to avoid hangs and infinite retries.
- Added persistence for `LINE HL` toggle using `localStorage` key `ModUiExtractor.lua.caret-highlight-enabled.v1` so preference survives reinject/reopen.

## In-Game Actions

- `UI Extractor\Run UI Dump (Safe)`
- `UI Extractor\Run UI Dump (Deep)`
- `UI Extractor\Extract Stylesheet\ALL .css files (full)`
- `UI Extractor\Extract Stylesheet\From target-stylesheet-url.txt`
- `UI Extractor\Extract Scripts\ALL .js files (full)`
- `UI Extractor\Inject LUA editor probe` (Element context menu)

## Action IDs

- `1`: safe full dump
- `2`: deep full dump
- `3`: extract all linked `.css` stylesheets
- `4`: extract one stylesheet URL from `tmp/ui-dumps/target-stylesheet-url.txt`
- `5`: inject Lua editor probe (context-menu / Lua editor instrumentation)
- `6`: extract all script bodies (`.js`) from loaded script tags
- `900001`: payload packet ingest (internal)

## Current Reliable All-CSS Profile (Action 3)

Action `3` currently injects:

- `mode=all_stylesheets`
- `chunkSize=9000`
- `allStylesheetPacketDelayMs=25`
- `phaseDelayMs=20`
- `allStylesheetOnlyCssHref=true`
- `allStylesheetMaxSheets=512`
- `allStylesheetMaxSheetChars=12000000`

These settings were tuned to avoid packet loss and reliably receive `ui_dump_complete`.

## Current Reliable All-JS Profile (Action 6)

Action `6` currently injects:

- `mode=all_scripts`
- `chunkSize=9000`
- `allScriptsPacketDelayMs=25`
- `phaseDelayMs=20`
- `allScriptsOnlyJsSrc=true`
- `allScriptsMaxScripts=1024`
- `allScriptsMaxScriptChars=16000000`

This writes `all_scripts_manifest.json` plus `all_script_js_*.js` sections after reassembly.

## Project Files

- `ModUIExtractor.csproj`: C# mod project
- `ModUIExtractor.cs`: mod implementation (`GetName() == NQ.UIExtractor`)
- `payload/ModUiExtractor-payload.js`: embedded payload
- `payload/lua-editor-probe.modules/`: source modules for Lua probe (manifest-driven)
- `payload/lua-editor-probe.js`: composed Lua probe payload (generated from modules)
- `tools/build-lua-probe.ps1`: compose `lua-editor-probe.modules` into `payload/lua-editor-probe.js`
- `tools/publish-lua-probe.ps1`: compose + publish probe to runtime override paths
- `tools/reassemble-ui-dump.ps1`: reassemble NDJSON to files
- `tools/split-html-dump.py`: split `html.html` by direct `<body>` root elements

## Build Requirements

- Target framework for the mod is `net6.0` (configured in `Directory.Build.props`). Keep this as-is for game/runtime compatibility.
- SDK selection is pinned via `global.json` to a stable SDK (`8.0.418`, `allowPrerelease=false`) so local/TUI builds do not drift to preview SDKs (`NETSDK1057`).
- External DU runtime assemblies are resolved from `DUExternalLibDir` (default: `D:\MyDUserver\wincs\all`).
- Keep Orleans + Microsoft.Extensions dependencies aligned to the DU runtime DLL graph. Mixing additional NuGet Orleans/Extensions package trees on top can reintroduce `MSB3277` assembly conflict warnings.
- Build from the `ModUiExtractor` folder so `global.json` is respected.

## Build

```powershell
cd D:\github\du-tobi\ModUiExtractor
dotnet build -c Release -nologo -v:minimal
```

With custom runtime DLL directory:

```powershell
dotnet build -c Release -nologo -v:minimal -p:DUExternalLibDir="D:\SomeOtherPath\wincs\all"
```

## Deploy

Target mod path:

- `D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll`

If the server is stopped, copy normally:

```powershell
Copy-Item `
  'D:\github\du-tobi\ModUiExtractor\bin\Release\net6.0\win-x64\ModUIExtractor.dll' `
  'D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll' -Force
```

If the server is running, the DLL is usually locked:

1. Copy new build to `ModUIExtractor.dll.new`
2. Restart/stop server
3. Swap files

```powershell
Copy-Item `
  'D:\github\du-tobi\ModUiExtractor\bin\Release\net6.0\win-x64\ModUIExtractor.dll' `
  'D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll.new' -Force

Move-Item 'D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll' 'D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll.bak' -Force
Move-Item 'D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll.new' 'D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll' -Force
```

## Output

Default dump directory:

- `D:\MyDUserver\tmp\ui-dumps`

Runtime payload override directory (read fresh on every injection):

- `D:\MyDUserver\tmp\ui-dumps\payload-overrides`
- `ModUiExtractor-payload.override.js`
- `lua-editor-probe.override.js`
- `lua-editor-probe.modules\manifest.txt` (optional module override mode)

Each run writes:

- `<dumpId>.ndjson`

## Hot-Reload Workflow (Lua Probe)

Use this when you want to tweak Lua editor UI behavior live without rebuilding the DLL.

Edit one of these for live changes:

- `D:\MyDUserver\tmp\ui-dumps\payload-overrides\lua-editor-probe.override.js`
- `D:\MyDUserver\tmp\ui-dumps\payload-overrides\lua-editor-probe.modules\*.js` (with `manifest.txt`)

Probe override resolution order on each inject:

1. `payload-overrides\lua-editor-probe.modules\manifest.txt` + listed module files
2. `payload-overrides\lua-editor-probe.override.js`
3. embedded `payload/lua-editor-probe.js` in DLL

After each edit:

1. Save changed module or `lua-editor-probe.override.js`.
2. In-game, open element context menu.
3. Click `UI Extractor\Inject LUA editor probe`.
4. Re-open or refocus Lua editor (`Edit Lua script (Ctrl + L)`).
5. Confirm probe is active (`LUA PROBE ACTIVE` badge in top-right).

No DLL rebuild needed for:

- JS/CSS behavior changes inside `lua-editor-probe.override.js`
- JS changes in module mode (`lua-editor-probe.modules`)
- probe button sizes, colors, toggles, line-highlight styling

DLL rebuild required for:

- `ModUIExtractor.cs` changes
- action/menu wiring changes
- payload loader/ingest C# logic changes

Useful sync commands:

```powershell
# Compose modules -> payload/lua-editor-probe.js
.\tools\build-lua-probe.ps1

# Compose + publish single-file + modules to runtime override directory
.\tools\publish-lua-probe.ps1

# Source extractor payload -> live override
Copy-Item `
  'D:\github\du-tobi\ModUiExtractor\payload\ModUiExtractor-payload.js' `
  'D:\MyDUserver\tmp\ui-dumps\payload-overrides\ModUiExtractor-payload.override.js' -Force

# Source payload -> live override
Copy-Item `
  'D:\github\du-tobi\ModUiExtractor\payload\lua-editor-probe.js' `
  'D:\MyDUserver\tmp\ui-dumps\payload-overrides\lua-editor-probe.override.js' -Force

# Source module payloads -> live module override dir
Copy-Item `
  'D:\github\du-tobi\ModUiExtractor\payload\lua-editor-probe.modules\*' `
  'D:\MyDUserver\tmp\ui-dumps\payload-overrides\lua-editor-probe.modules' -Force

# Live extractor override -> source payload (persist your live tweaks in repo)
Copy-Item `
  'D:\MyDUserver\tmp\ui-dumps\payload-overrides\ModUiExtractor-payload.override.js' `
  'D:\github\du-tobi\ModUiExtractor\payload\ModUiExtractor-payload.js' -Force

# Live override -> source payload (persist your live tweaks in repo)
Copy-Item `
  'D:\MyDUserver\tmp\ui-dumps\payload-overrides\lua-editor-probe.override.js' `
  'D:\github\du-tobi\ModUiExtractor\payload\lua-editor-probe.js' -Force
```

## Lua Editor Stabilization Runbook (Reproducible)

This is the exact sequence that reproduces the currently working behavior.

### 1) Prepare the active probe override

Recommended (module-first) prep before testing:

```powershell
.\tools\publish-lua-probe.ps1
```

### 2) Inject and open editor

1. In-game open element context menu.
2. Click `UI Extractor\Inject LUA editor probe`.
3. Open editor from `Edit Lua script`.
4. Confirm `LUA PROBE ACTIVE` badge is visible.

Expected telemetry:

- `lua_quick_menu_edit_lua_result.bridgeInvoked=true`
- `lua_editor_opened`

### 3) Execute slot/filter restore validation

Reference validation that proved working:

1. In `library`, open first filter block (`onStart`) and scroll to around line `300`.
2. Switch to `unit`, open first filter block, scroll to around line `100`.
3. Switch back and forth between those two blocks.

Expected behavior:

- slot switch auto-loads target filter,
- each filter restores to its own previous position (not line 1 unless first time).

### 4) Verify with NDJSON packets

Inspect newest `lua-probe-*.ndjson` and confirm:

1. `lua_slot_auto_open`:
   - starts with `status="armed"`,
   - may emit transient `waiting-target-slot` / `waiting-slot-switch`,
   - reaches `status="clicked"` within wait budget.
2. `lua_snippet_switch_begin`:
   - includes `targetSnippetKey`,
   - on revisits shows `targetHasRememberedTopLine=true`.
3. `lua_cm_settle_signal`:
   - includes `kind="target-snippet"` before final switch settle.
4. `lua_snippet_switch_end` / `lua_snippet_switch_settled`:
   - include `settleReason` (normally `quiet-window`),
   - `after.cursor.line` and `afterViewport.topLine` match remembered area.

### 5) Wait budgets and limits (current defaults)

- slot auto-open max lifetime: `5000ms` (`expiresAt`)
- CodeMirror settle max wait: `5000ms`
- settle quiet window: `250ms`
- settle polling tick: `40ms`

No wait path is unbounded.

### 6) Why this works

The successful combination is:

1. stable slot key (`id/data/index`) instead of class-based identity,
2. slot-convergence guard before auto-open click,
3. CodeMirror settle gate (event-driven, not blind delay),
4. target-snippet presence gate before restore,
5. per-snippet memory key restore (`snippet:<len>:<hash>`) plus context fallback,
6. bounded wait windows to prevent lockups.

## IDE 2-Way Sync (Lua Probe)

The Lua probe supports exporting the current script to a local file, automatically opening it in your IDE (e.g. Cursor), and syncing changes back into the game in real-time.

1. Inject the Lua probe in-game.
2. Run the sync script in PowerShell:

   ```powershell
   .\tools\sync-ide.ps1 -DumpDir "D:\MyDUserver\tmp\ui-dumps" -IdePath "cursor"
   ```

3. In the game's Lua editor, click the `IDE Sync` button in the top header.
4. The script will be chunked, written to the server's dump directory, reassembled into `tmp\ui-dumps\ide-workspace\snippet.lua`, and opened in your IDE.
5. Edit `snippet.lua` in your IDE and save.
6. The sync script watches for file changes and writes them to a semaphore file (`ide_import.json`).
7. The C# mod detects the semaphore and hot-loads the updated code back into the active Lua editor instance instantly.

Mode note:

- Default behavior is live-tail mode: existing NDJSON content is ignored on startup, and only new packets are processed.
- Use `-ReplayFromStart` only for replay/backfill scenarios (for example tests that pre-seed NDJSON before watcher startup).

## Local Lua Editor Rig (No Game Client)

Use this when iterating on Lua probe + IDE sync without launching the game.

1. Terminal A: Start the local rig server:

   ```powershell
   cd ModUiExtractor
   .\tools\lua-editor-rig.ps1 -DumpDir "D:\MyDUserver\tmp\ui-dumps" -Port 8765 -PlayerId 10000
   ```

2. Terminal B: In another PowerShell window, start IDE sync:

   ```powershell
   cd ModUiExtractor
   .\tools\sync-ide.ps1 -DumpDir "D:\MyDUserver\tmp\ui-dumps" -IdePath "cursor"
   ```

3. Open the local editor in your browser:

   - `http://localhost:8765/`

4. In the editor header, click `IDE Sync`.
5. The packet is written to `rig-lua-editor.ndjson`, reassembled into `ide-workspace\snippet.lua`, and opened in your IDE.
6. Edit `snippet.lua` and save.
7. `sync-ide.ps1` writes `payload-overrides\ide_import.json`, and the local rig applies it back into the editor via `applyIdeCode`.

Notes:

- The local rig injects `payload\lua-editor-probe.js` and bridges `CPPMod.sendModAction` to `/api/mod-action`.
- This rig exercises the same file-based sync loop (`*.ndjson` + `ide_import.json`) as the in-game workflow.
- Automated smoke test: `.\tests\test-lua-editor-rig.ps1`

### TUI Command Center

You can also run a Textual-based command center to control the rig and checks:

```powershell
python .\tools\telemetry_tui.py
```

In the `UI Rig` tab you can:

- Start/stop the local rig server
- Start/stop the sync watcher
- Open the local rig in browser
- Run `dotnet build`
- Run sync test suite and rig smoke tests

## Reassemble Dumps

```powershell
.\tools\reassemble-ui-dump.ps1 `
  -InputNdjson "D:\MyDUserver\tmp\ui-dumps\ui-<id>.ndjson" `
  -OutDir "D:\MyDUserver\tmp\ui-dumps\reassembled"
```

Per dump folder (`<OutDir>\<dumpId>`), reassemble writes:

- `manifest.json`
- `events_start.json` (if present)
- `events_complete.json` (if present)
- `events_fatal.json` (if present)
- `all_stylesheets_manifest.json` (all-css mode)
- `all_stylesheet_css_*.css` (all-css mode)
- `all_scripts_manifest.json` (all-scripts mode)
- `scripts\all_script_js_*.js` (all-scripts mode)
- `stylesheet_extract_meta.json` (single stylesheet mode)
- `stylesheet_extract_css.css` (single stylesheet mode)
- `html.html` (if captured)

If `html.html` exists, reassemble automatically calls `split-html-dump.py` and also creates:

- `html\index.md`
- `html\index.json`
- `html\*.html` (one file per direct `<body>` child/root area)

## Targeted Stylesheet Extraction (Action 4)

Edit:

- `D:\MyDUserver\tmp\ui-dumps\target-stylesheet-url.txt`

Use the first non-empty, non-comment line, for example:

```text
coui://data/gui/hud/dpu_editor/css/dpu_editor.css
```

Then run:

- `UI Extractor\Extract Stylesheet\From target-stylesheet-url.txt`

## Quick Workflow (Full CSS + HTML Areas)

1. In-game run `UI Extractor\Extract Stylesheet\ALL .css files (full)`.
2. Take newest `D:\MyDUserver\tmp\ui-dumps\ui-*.ndjson`.
3. Run `reassemble-ui-dump.ps1`.
4. Open `<dumpId>\manifest.json` and verify:
   - `completes = 1`
   - no `missingParts`
5. Use:
   - `<dumpId>\all_stylesheet_css_*.css`
   - `<dumpId>\html\index.md`
   - `<dumpId>\html\*.html`

## Quick Workflow (All JS Files)

1. In-game run `UI Extractor\Extract Scripts\ALL .js files (full)`.
2. Take newest `D:\MyDUserver\tmp\ui-dumps\ui-*.ndjson`.
3. Run `reassemble-ui-dump.ps1`.
4. Open `<dumpId>\all_scripts_manifest.json`.
5. Use extracted scripts:
   - `<dumpId>\scripts\all_script_js_*.js`

## Safety Notes

- **IMPORTANT: Cohtml/Awesomium Bug:** Be extremely careful with `node.insertBefore(newNode, referenceNode)`. If `referenceNode` is `null`, modern browsers treat it as `appendChild(newNode)`, but the game's older embedded browser engine (Cohtml/Awesomium) will hard-lock or crash the client! Always check for a truthy reference node and explicitly fallback to `appendChild` if it's null (e.g., `if (ref) { parent.insertBefore(node, ref); } else { parent.appendChild(node); }`).
- Payload and mod both use exception handling to avoid hard failures.
- Payload uses chunking and bounded limits to reduce hitching and packet loss.
- Ingest path tolerates malformed payloads and preserves raw packet data when parsing fails.

## Troubleshooting (Do's and Don'ts)

When modifying the UI extractor payloads (especially `lua-editor-probe.js`), be aware that the game client uses an older embedded browser engine (Cohtml/Awesomium) which lacks many modern safeguards and behaves differently than modern Chrome/Firefox.

- **DO NOT** use `node.insertBefore(newNode, referenceNode)` when `referenceNode` might be `null`. Modern browsers treat this as an `appendChild(newNode)`, but Cohtml will freeze or crash the game client. Always explicitly check `if (referenceNode) { parent.insertBefore(node, referenceNode); } else { parent.appendChild(node); }`.
- **DO NOT** attempt to constantly re-sort or re-order DOM elements inside a `MutationObserver` or `setInterval` using `previousElementSibling` or `nextElementSibling`. Text nodes and whitespace can cause these checks to fail in Cohtml, resulting in infinite layout recalculation loops that instantly freeze the client.
- **DO** use `position: absolute` or safely append to normal flow containers instead of trying to manipulate dynamically sized `display: flex` containers if inserting children causes layout invalidation crashes.
- **DO** use `try { ... } catch (_ignore) {}` blocks liberally around DOM manipulation (like `removeLineClass` or `removeChild`), especially when the editor is closing or elements are destroyed, as Cohtml handles node cleanup unpredictably.
- **DO NOT** target context-menu actions by caption/text match alone (for example just `"Advanced"` or `"Edit Lua script"`). Different branches can reuse the same labels. Resolve from the real top-level menu structure first, then navigate to the intended submenu path before dispatching clicks.
- **DO** prefer native context-menu bridge invocation when available: `executeAction(<numeric helper index>)` where index is derived from menu entry `helperid` (for example `menu_item_30` -> `30`). Passing caption strings or object payloads to `executeAction` causes Cohtml type conversion errors.
- **DO NOT** use `ConvertTo-Json` inside a pipeline in PowerShell 5.1 scripts (e.g. `$data | ConvertTo-Json`) when dealing with large code strings. It can hang or fail silently. Format simple JSON strings manually and escape characters explicitly.
- **DO** be aware of PowerShell's file property caching. When watching for file changes, use `[System.IO.File]::GetLastWriteTime($path)` instead of `(Get-Item $path).LastWriteTime` to guarantee you get the actual real-time file system timestamp.
- **DO** expect some clients to block script-body reads from `coui://...` URLs with `InvalidAccessError`/`permission_blocked`. The extractor now uses async XHR and multiple URL fallbacks, but Cohtml security can still deny access depending on the page context.
- **DO NOT** key slot convergence checks on volatile class strings (for example `.selected` in `className`). In Cohtml, class flags can lag or flap during rebuilds. Use stable slot identity (`id`/`data-*`/parent index) for state-machine matching.
- **DO NOT** apply top-line restore before the target snippet is actually present in CodeMirror. Wait for the expected snippet key (`targetSnippetKey`) and settle signals first, otherwise restores clamp to line `1`.
- **DO** keep wait paths bounded and explicit. Current probe defaults are `5000ms` max wait and `250ms` quiet window; avoid unbounded loops or implicit retries.

### Probe Diagnostics (Lua Editor)

When resuming work or debugging regressions, inspect the newest `lua-probe-*.ndjson` and check these packets:

- `lua_slot_auto_open`: verifies slot auto-open state machine and where it failed.
- `lua_cm_settle_signal`: verifies CodeMirror settle gate progression (`cm-attached`, `start`, `viewport`, `scroll`, `target-snippet`).
- `lua_quick_menu_edit_lua`: confirms quick menu edit entry activation was attempted.
- `lua_quick_menu_edit_lua_result`: shows quick edit path outcome (`native-target-inspect`, `native-click`, `native-opened`, `fallback-ctrl-l`) and bridge status (`bridgeInvoked`, `bridgeAttempts`).
- `lua_editor_opened`: confirms editor was opened after quick-menu action.

`lua_slot_auto_open.status` meanings:

- `armed`: slot auto-open sequence started
- `waiting-target-slot`: selected slot has not converged to target slot yet
- `waiting-target-slot-identity`: legacy identity fallback mismatch while waiting for target slot
- `waiting-slot-switch`: selected slot still equals previous slot during early switch window
- `waiting-slot-switch-identity`: legacy identity fallback still equals previous slot during early switch window
- `no-candidate`: no eligible filter node found yet
- `stale-selected`: candidate still points to old selected filter during rebuild
- `clicked`: auto-open click dispatched to selected candidate filter
- `expired`: auto-open timed out and aborted

`lua_snippet_switch_*` settle meanings:

- `quiet-window`: stable editor state observed and restore applied
- `timeout`: settle timed out after max wait with target snippet seen
- `timeout-no-target`: settle timed out before target snippet appeared in editor
