# rs_emulator Progress

## 2026-03-21

- Added real `RenderScript.lua` module loading in the Lua runtime so scripts can use `require("RenderScript")` instead of only raw globals.
- Enabled `RenderScript.Instance()` end-to-end by preloading the wrapper and recreating its module state on each execution.
- Added wrapper-path font compatibility by returning `LoadedFont`-style objects with `GetID()` from `render.LoadFont(...)` while still resolving those objects back into raw font ids for draw and metric calls.
- Verified wrapper-path `GetTextBounds(...)` can return `Vec2` objects through the real wrapper contract, not just raw width/height tuples.
- Added `examples/wrapper-instance.lua` as a regression/example script for wrapper-based usage.

## Next High-Value Slice

- Fix layer compositing so interleaved commands render by layer order instead of raw insertion order.
- After that, tighten `RequestAnimationFrame(frames)` countdown semantics to match DU expectations more closely.
