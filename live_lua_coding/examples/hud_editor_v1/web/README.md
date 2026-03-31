# Lua Painter Web Harness

This folder contains a browser-based harness for the `hud_editor_v1` payload.

Why it exists:

- The HUD editor is mostly browser/UI code.
- Iterating inside Dual Universe is slow and noisy.
- This harness loads the built payload in a normal browser so layout and interaction bugs can be debugged faster.

## What is here

- `index.html`
  - the browser page for the harness
- `harness.js`
  - bootstraps the built HUD payload and provides a fake runtime-module context
- `server.mjs`
  - tiny static file server for local testing
- `playwright.config.mjs`
  - Playwright config for this harness
- `tests/`
  - Playwright tests
- `fixtures/`
  - reusable test layouts, including `layout-all-shapes.json`

## Install

Use `pnpm` in this folder and ignore parent workspaces.

```powershell
cd D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1\web
pnpm install --ignore-workspace
```

Why `--ignore-workspace`:

- this machine has unrelated pnpm workspace metadata above this repo
- without it, `pnpm` may try to treat this folder as part of a larger external workspace

## Build the payload

Before using the harness, rebuild the HUD payload:

```powershell
cd D:\github\du-tobi
pwsh -File .\live_lua_coding\examples\hud_editor_v1\scripts\build.ps1
```

The harness loads:

- `..\build\hud-editor-probe.js`

## Run the harness manually

```powershell
cd D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1\web
pnpm run serve
```

Then open:

```text
http://127.0.0.1:4173/web/index.html
```

## Run browser tests

```powershell
cd D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1\web
pnpm test
```

Run headed:

```powershell
pnpm run test:headed
```

## Harness behavior

- The harness injects the built payload into a normal browser page.
- It provides a fake `__HUD_EDITOR_RUNTIME_CTX__` so the runtime module can boot without the game.
- Export packets are logged in the harness panel instead of going to the mod/game.
- The `Load Fixture` button imports `fixtures/layout-all-shapes.json` into the editor.

## Current workflow

1. edit HUD editor source in `..\js\modules\` or `..\js\assets\`
2. rebuild with `scripts\build.ps1`
3. use the web harness to debug behavior
4. only validate in-game after the browser behavior is correct
