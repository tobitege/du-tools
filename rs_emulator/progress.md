# rs_emulator Progress

## 2026-03-21

- Added real `RenderScript.lua` module loading in the Lua runtime so scripts can use `require("RenderScript")` instead of only raw globals.
- Enabled `RenderScript.Instance()` end-to-end by preloading the wrapper and recreating its module state on each execution.
- Added wrapper-path font compatibility by returning `LoadedFont`-style objects with `GetID()` from `render.LoadFont(...)` while still resolving those objects back into raw font ids for draw and metric calls.
- Verified wrapper-path `GetTextBounds(...)` can return `Vec2` objects through the real wrapper contract, not just raw width/height tuples.
- Added `examples/wrapper-instance.lua` as a regression/example script for wrapper-based usage.
- Stopped clearing loaded font handles on every execution so DU-style globals can keep font ids alive across reruns within the same session runtime.
- Added configurable DU include-folder support so scripts can resolve vanilla modules such as `require("rslib")` from a picked `Game/data/lua` directory.
- Added a simpler Vite-backed include path via `.env.local` and `DU_LUA_ROOT`, so DU helper modules can be loaded from disk even when the browser does not expose file-picker APIs.
- Added legacy DU alias globals such as `Shape_Line`, `Shape_Text`, `AlignH_Center`, and `AlignV_Descender` so `rslib.lua` can execute more naturally.
- Expanded `examples/example1.lua` into a richer animated test scene that exercises more draw commands and reports whether `rslib` loaded successfully.
- Added a real `test/` suite with emulator integration coverage for `example1.lua`, runtime state persistence, and canvas text rendering.
- Changed the main action button to behave like an animation control: `Run` for idle scripts, `Stop` while an animation loop is active.
- Tightened text rendering by using safer browser font fallbacks and switched the built-in example to common desktop font names.
- Fixed the canvas viewport sizing bug that was clipping the visible render area and hiding text/HUD output.
- Capped the browser animation loop to 60 FPS by default and changed the FPS HUD to report actual frame cadence instead of raw render-time throughput.
- Stopped auto-running scripts on initial page load; sessions now open loaded but idle until explicitly run.
- Improved text measurement by switching `GetTextBounds` and `GetFontMetrics` to browser-backed canvas metrics when available, instead of only `length * size * 0.6` approximations.
- Added descender-aware vertical text placement so bottom HUD labels like the `rslib` render-cost line stop clipping against the lower edge.
- Expanded the built-in example with animated text rails, pulsing colors, and guarded font-size changes so labels can move around the scene without drifting off-screen.
- Fixed `SetNext*` style bleed by snapshotting effective draw styles at command creation time, so later overrides no longer recolor earlier shapes during animation.
- Reworked the main workspace so canvas and editor can switch between vertical and horizontal layouts, with a draggable splitter to resize the panels.
- Added explicit editor font-size controls in the toolbar so Monaco zoom can be adjusted independently of browser page zoom.
- Replaced the old square-only resolution setting with reusable form-factor presets (HD landscape, HD portrait, square, and FHD variants) as a stepping stone toward real DU Screen/Sign size presets.
- Splitter positions are now persisted separately for horizontal and vertical layouts, instead of sharing one value between both workspace modes.
- `Show Grid` remains a presentation-only toggle and does not restart the active script/runtime when changed.
- Added a one-click layout reset in the editor toolbar to restore default split orientation, splitter positions, and editor font size.
- Empty editor sessions now show a centered import dropzone overlay so `.lua` files can be dropped or picked directly into the current session.
- Added `examples/fonts.lua`, extracted from the programming-board screen-output pattern, as a standalone font preview script for linked-screen style text rendering.
- Added `examples/SilverZero/` with local copies of selected DU-Screen-Flair source files plus a `convert-ideas.md` plan for RenderScript conversions built around a future shared helper library.
- Added `examples/SilverZero/SimpleSignXS.lua` as the next converted static sign and updated runtime tests to execute SilverZero library-backed examples (`SimpleSignS`, `SimpleSignXS`).
- Added `examples/SilverZero/WelcomeScreenM.lua` static conversion and expanded test coverage for SilverZero examples.
- Verified conversion order from `convert-ideas.md` remains on track: `lib/SilverZeroRsLib.lua`, `SimpleSignS`, `SimpleSignXS`, then `WelcomeScreenM`.
- Added static conversions for `ShipFrameM` and `DispenserSignS`; both are now runnable and use the shared helper library.
- Added static conversions for `HubPanelS` and `HubPanelL` and expanded Lua runtime tests to cover SilverZero examples `ShipStatsS`, `ShipFrameM`, `DispenserSignS`, `HubPanelS`, and `HubPanelL`.
- Added static conversion for `ContainerSignM` with a table-style manifest layout and added runtime coverage in `luaRuntime.test.ts`.
- Added static conversion for `ContainerHubHubM` with a full dashboard-style mock layout (hub bars, item cards, and browser strip), and added runtime coverage in `luaRuntime.test.ts`.
- Added static conversion for `IndustrySelectorM` with control pad and schematics grid prototype, plus runtime coverage in `luaRuntime.test.ts`.
- Added static conversion for `OreExplorerM` with a large solar map + resource browser layout prototype, plus runtime coverage in `luaRuntime.test.ts`.
- Changed empty-session import to support multi-file drop/pick, with each imported file creating its own named session instead of overwriting the current editor buffer.
- Added bundled-example module resolution relative to the calling script path, and applied the same path-based lookup to both `require(...)` and `include(...)`.
- Added a Reload action with a custom confirmation modal so sessions can be refreshed safely from bundled example sources or linked local files without using browser-native prompts.
- Updated the editor header to show the active session name instead of a hard-coded `RenderScript.lua` title.
- Tuned `lib/SilverZeroRsLib.lua` font scaling and added shared animation helpers (`time`, `animLoop`, `pulse`, `wave`, `saw`, `breatheColor`) for RenderScript-side motion work.
- Switched the converted SilverZero example scripts from one-shot static execution to frame-based rerendering and updated Lua runtime tests to expect `requestAnimationFrame(1)` for those examples.
- Reworked `examples/SilverZero/WelcomeScreenM.lua` away from the earlier static mockup and toward the original HTML intent, including the right-side helix/perlenketten motion, revised panel composition, and a first pass at the original circuit-style backdrop.
- Updated `README.md` to reflect multi-file import, reload behavior, and bundled example-relative `require(...)` / `include(...)` resolution.
- Reworked `examples/SilverZero/OreExplorerM.lua` toward the original `OreExplorerM.json` intent: subdued left-offset sun, aligned planet row without invented drift animation, and Alioth-focused ore cards instead of the previous sector-table mockup.
- Verified the updated `OreExplorerM.lua` in the browser via reload/run screenshot workflow and kept the remaining simplifications explicit (no sprite textures, no photographic background assets).
- Confirmed the SilverZero regression still passes with `npm run test -- test/luaRuntime.test.ts` (`16` tests green).
- Added new shared SilverZero helper methods in `lib/SilverZeroRsLib.lua` for generic layout-space lines, generic boxes, and scaled colors.
- Replaced duplicated local helper logic in `examples/SilverZero/OreExplorerM.lua` and `examples/SilverZero/WelcomeScreenM.lua` with the shared library methods.
- Fixed `WelcomeScreenM.lua` line drawing so repeated line segments no longer rely on stale `setNextStroke*` state across multiple `addLine(...)` calls.
- Added a shared `namedSymbolRow(...)` helper in `lib/SilverZeroRsLib.lua` for labeled entries with size-scaled symbols and `linear` / `log` / `auto` scaling modes.
- Reworked the `OreExplorerM.lua` planet strip to use `namedSymbolRow(...)` with explicit entry data (`name`, `shape`, `size`, color, meta label, selected state) instead of hard-coded per-planet drawing logic.
- Removed `.lua` files from the production bundle and switched the app bootstrap back to empty temp sessions.
- Restored relative `require(...)` / `include(...)` lookup for source-backed scripts by resolving bare module names against the current source file directory first, then falling back to `DU_LUA_ROOT`.

## Next High-Value Slice

- Fix layer compositing so interleaved commands render by layer order instead of raw insertion order.
- After that, tighten `RequestAnimationFrame(frames)` countdown semantics to match DU expectations more closely.
