# Dual Universe UI Investigation Notes

## Goal

Document where the game UI (especially mod-related UI) is sourced from, and where styling can actually be changed.

## Screenshot Context (FlightLogger)

The screenshot showing:

- `mod: FlightLogger > Log Telemetry`
- `Set Summary Interval`
- `Stop Session`
- `Start Session`

matches FlightLogger action definitions and is a right-click context menu entry flow, not a custom injected panel.

Evidence:

- `d:\github\du-tobi\ModFlightLogger\ModFlightLogger.cs:175`
- `d:\github\du-tobi\ModFlightLogger\ModFlightLogger.cs:184`
- `d:\github\du-tobi\ModFlightLogger\ModFlightLogger.cs:192`
- `d:\github\du-tobi\ModFlightLogger\ModFlightLogger.cs:200`
- `d:\github\du-tobi\ModFlightLogger\ModFlightLogger.cs:208`

No `modinjectjs` usage was found in FlightLogger.

## What Was Investigated

## 1) Mod source repo (`d:\github\mydu-server-mods`)

### What I looked at

- `d:\github\mydu-server-mods\ModInterchange\ModInterchange.cs`
- `d:\github\mydu-server-mods\MyDU server modding toolkit.md`
- `d:\github\mydu-server-mods\FightForFame\fff.js`
- broad grep for: `modinjectjs`, `MousePage`, `mining_unit_panel`, `generic_button`, `CPPMod.sendModAction`

### What was found

- Mods inject JavaScript via player notifications using event `modinjectjs`.
  - `d:\github\mydu-server-mods\ModInterchange\ModInterchange.cs:284`
- Interchange builds UI directly in client DOM with DU classes:
  - `createElement(document.body, "div", "mining_unit_panel")`
  - `createElement(..., "div", "generic_button")`
  - `d:\github\mydu-server-mods\ModInterchange\ModInterchange.cs:344`
  - `d:\github\mydu-server-mods\ModInterchange\ModInterchange.cs:357`
- Toolkit explicitly states:
  - `modinjectjs` is pre-registered in client and evals payload.
  - `d:\github\mydu-server-mods\MyDU server modding toolkit.md:47`
- Example of custom CSS injection in a mod:
  - `d:\github\mydu-server-mods\FightForFame\fff.js:45`
  - `d:\github\mydu-server-mods\FightForFame\fff.js:53`

### Hint extracted

For injected mod windows, styling can be overridden in the injected JS/CSS itself.

### Example worth emphasizing

This pattern is already demonstrated in a real mod:

- `d:\github\mydu-server-mods\FightForFame\fff.js:45`
- `d:\github\mydu-server-mods\FightForFame\fff.js:53`

It injects a `<style>` element at runtime, which means you can fully override colors, spacing, borders, hover states, and animations for your custom panel content even when DU base classes are ugly.

## 2) Server install (`d:\MyDUserver`)

### 2 What I looked at

- `d:\MyDUserver\nginx-1.27.1\conf\conf.d\http.conf`
- `d:\MyDUserver\config\dual.yaml`
- `d:\MyDUserver\www\index.html`
- running ports/processes and live endpoints (`10000`, `12000`, `9630`, `10111`)

### 2 What was found

- Nginx proxies:
  - `/qs/public/ -> 127.0.0.1:9630/public/`
  - `/orleans/public/ -> localhost:10111/public/`
  - `/public/ -> localhost:9630/public/`
  - `/ -> localhost:12000/`
  - `d:\MyDUserver\nginx-1.27.1\conf\conf.d\http.conf:8`
  - `d:\MyDUserver\nginx-1.27.1\conf\conf.d\http.conf:11`
  - `d:\MyDUserver\nginx-1.27.1\conf\conf.d\http.conf:21`
  - `d:\MyDUserver\nginx-1.27.1\conf\conf.d\http.conf:29`
- Process mapping while running:
  - `10000 -> nginx.exe`
  - `12000 -> Backoffice.exe`
  - `9630 -> QueueingService.exe`
  - `10111 -> Grains.exe`
- `http://127.0.0.1:10000/` returns Backoffice signin page with `/dist/theme/dark.css` and `/dist/base.css` (Backoffice web app styling), not in-game HUD styling.
- `d:\MyDUserver\www\index.html` is stack manager page UI, also not the in-game HUD UI used by mod-injected client windows.

### 2 Hint extracted

Server web assets seen on localhost are mostly Backoffice/stack manager assets. They do not control the in-game HUD panel classes (`mining_unit_panel`, `generic_button`) used by injected mod JS.

## 3) Game client install (`d:\MyDualUniverse`)

### 3 What I looked at

- `d:\MyDualUniverse\Html\...`
- `d:\MyDualUniverse\Game\data\...`
- `d:\MyDualUniverse\Game\Bin\Dual.exe`
- string searches for: `modinjectjs`, `CPPMod`, `sendModAction`, `MousePage`, `mining_unit_panel`, `generic_button`, `CustomWindow`, `HudPanel`

### 3 What was found

- `Html` folder is launcher UI (not in-game HUD).
- `Game\data\gui\hud` contains media files (`.webm`) but not plain JS/CSS sources for the mod HUD system.
- `Dual.exe` contains client HUD bridge strings:
  - `CPPMod`
  - `sendModAction`
  - `CustomWindow`
  - `HudPanel`
- `Dual.exe` also contains references to internal client source paths such as:
  - `...Source\ui\views\hud\customWindows\CustomWindow.cpp`
  - `...Source\ui\views\hud\panels\HudPanel.cpp`

### 3 Hint extracted

The mod UI bridge and base HUD behavior are implemented in client binaries/runtime, not as simple editable server files.

## Bottom Line

## For your FlightLogger screenshot menu styling

That menu is a native game context menu rendered by the client. It is populated by action labels from the mod (`GetModInfoFor`), but the menu visuals (colors/layout) are client-side style/theme.

## For custom mod windows/panels

You can style those by injecting your own CSS/inline styles in mod JS payloads (for example with a `<style>` tag injection pattern), because those are generated by your mod code.

## Practical next steps

1. Keep using `GetModInfoFor` labels for context menu entries (functionality only).
2. If you want better visuals, open a custom panel/window via JS injection and apply your own CSS (instead of relying on DU default panel classes only).
3. Reuse a style injection helper like in `d:\github\mydu-server-mods\FightForFame\fff.js:45`.

## Can we export live game CSS/JS/HTML to logs?

Yes, partially, and this is a useful debugging technique.

### What is feasible

From injected JS (`modinjectjs`), you can collect at runtime:

1. `document.documentElement.outerHTML` (or selected subtree HTML)
2. loaded script tag list (`document.scripts`)
3. CSSOM rules from `document.styleSheets` (when readable)
4. computed styles for chosen elements/classes (via `getComputedStyle`)

Then send this data back with `CPPMod.sendModAction(...)` as JSON chunks and store it server-side (for example with FlightLogger NDJSON).

### Important limitations

1. Some stylesheets may throw on `cssRules` access (security/restriction cases). Catch and log errors per stylesheet.
2. Data can be large, so chunk payloads (for example 8-16 KB chunks).
3. Client-native menu visuals (like right-click context menu skin) may not be fully represented as plain HTML/CSS files you can edit; parts are runtime/client-native.
4. Injected payloads should avoid sensitive data and avoid excessive frequency.

### Suggested chunked export shape

Use JSON object chunks like:

- `type: "ui_dump"`
- `dumpId: "<timestamp-or-guid>"`
- `part: <index>`
- `total: <parts>`
- `kind: "html" | "css" | "scripts" | "computed"`
- `data: "<string chunk>"`

This structure makes reconstruction from NDJSON straightforward.
