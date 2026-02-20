# ModUIExtractor

Embedded myDU DLL mod that injects a defensive JavaScript payload into the DU client UI and stores returned packets on the server as NDJSON dumps.

## Start Here

Most important workflow in this project:

- `## Hot-Reload Workflow (Lua Probe)` -> jump to [`Hot-Reload Workflow (Lua Probe)`](#hot-reload-workflow-lua-probe)

This repo now includes:

- robust full CSS extraction (`ALL .css files (full)`)
- NDJSON reassembly into per-section files
- automatic HTML splitting (`html.html` -> `html\*.html`)

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
- Removed compile-time assembly conflict warnings by aligning Orleans/Microsoft.Extensions references to DU runtime DLLs and targeting `net8.0`.
- Increased probe control visibility: larger `LINE HL` toggle button and larger top-right `LUA PROBE ACTIVE` badge.

## In-Game Actions

- `UI Extractor\Run UI Dump (Safe)`
- `UI Extractor\Run UI Dump (Deep)`
- `UI Extractor\Extract Stylesheet\ALL .css files (full)`
- `UI Extractor\Extract Stylesheet\From target-stylesheet-url.txt`
- `UI Extractor\Inject LUA editor probe` (Element context menu)

## Action IDs

- `1`: safe full dump
- `2`: deep full dump
- `3`: extract all linked `.css` stylesheets
- `4`: extract one stylesheet URL from `tmp/ui-dumps/target-stylesheet-url.txt`
- `5`: inject Lua editor probe (context-menu / Lua editor instrumentation)
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

## Project Files

- `ModUIExtractor.csproj`: C# mod project
- `ModUIExtractor.cs`: mod implementation (`GetName() == NQ.UIExtractor`)
- `payload/ui-extractor-payload.js`: embedded payload
- `tools/reassemble-ui-dump.ps1`: reassemble NDJSON to files
- `tools/split-html-dump.py`: split `html.html` by direct `<body>` root elements

## Build

```powershell
cd D:\github\du-tobi\ui-extractor
dotnet build -c Release
```

With custom runtime DLL directory:

```powershell
dotnet build -c Release -p:DUExternalLibDir="D:\SomeOtherPath\wincs\all"
```

## Deploy

Target mod path:

- `D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll`

If the server is stopped, copy normally:

```powershell
Copy-Item `
  'D:\github\du-tobi\ui-extractor\bin\Release\net8.0\win-x64\ModUIExtractor.dll' `
  'D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll' -Force
```

If the server is running, the DLL is usually locked:

1. Copy new build to `ModUIExtractor.dll.new`
2. Restart/stop server
3. Swap files

```powershell
Copy-Item `
  'D:\github\du-tobi\ui-extractor\bin\Release\net8.0\win-x64\ModUIExtractor.dll' `
  'D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll.new' -Force

Move-Item 'D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll' 'D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll.bak' -Force
Move-Item 'D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll.new' 'D:\MyDUserver\wincs\all\Mods\ModUIExtractor.dll' -Force
```

## Output

Default dump directory:

- `D:\MyDUserver\tmp\ui-dumps`

Runtime payload override directory (read fresh on every injection):

- `D:\MyDUserver\tmp\ui-dumps\payload-overrides`
- `ui-extractor-payload.override.js`
- `lua-editor-probe.override.js`

Each run writes:

- `<dumpId>.ndjson`

## Hot-Reload Workflow (Lua Probe)

Use this when you want to tweak Lua editor UI behavior live without rebuilding the DLL.

Edit this file for live changes:

- `D:\MyDUserver\tmp\ui-dumps\payload-overrides\lua-editor-probe.override.js`

After each edit:

1. Save `lua-editor-probe.override.js`.
2. In-game, open element context menu.
3. Click `UI Extractor\Inject LUA editor probe`.
4. Re-open or refocus Lua editor (`Edit Lua script (Ctrl + L)`).
5. Confirm probe is active (`LUA PROBE ACTIVE` badge in top-right).

No DLL rebuild needed for:

- JS/CSS behavior changes inside `lua-editor-probe.override.js`
- probe button sizes, colors, toggles, line-highlight styling

DLL rebuild required for:

- `ModUIExtractor.cs` changes
- action/menu wiring changes
- payload loader/ingest C# logic changes

Useful sync commands:

```powershell
# Source payload -> live override
Copy-Item `
  'D:\github\du-tobi\ui-extractor\payload\lua-editor-probe.js' `
  'D:\MyDUserver\tmp\ui-dumps\payload-overrides\lua-editor-probe.override.js' -Force

# Live override -> source payload (persist your live tweaks in repo)
Copy-Item `
  'D:\MyDUserver\tmp\ui-dumps\payload-overrides\lua-editor-probe.override.js' `
  'D:\github\du-tobi\ui-extractor\payload\lua-editor-probe.js' -Force
```

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

## Safety Notes

- Payload and mod both use exception handling to avoid hard failures.
- Payload uses chunking and bounded limits to reduce hitching and packet loss.
- Ingest path tolerates malformed payloads and preserves raw packet data when parsing fails.
