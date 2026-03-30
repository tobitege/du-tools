# Lua Probe Runtime Modules

Each subdirectory in this folder is treated as one toggleable runtime module.

Current modules in this folder:

- `example-module`
  - Tiny reference module used to verify runtime discovery, toggling, cleanup, and persistence.
  - It shows a small badge in the HUD when enabled.
- `hud-editor`
  - Paint-with-Lua HUD layout editor.
  - Adds the HUD Editor toggle button and the editor UI for building layouts.
  - This is the main WYSIWYG-style editor experiment moved out of the probe core.
- `chat-plain-copy`
  - Adds a button to copy the currently selected chat channel as plain text.
  - Uses the active chat view / chat DOM to build a readable transcript.
- `lua-editor-enhancements`
  - Restores the full Lua editor enhancement layer that used to be built into core.
  - Covers the Lua editor and screen editor QoL features such as:
    - theme switcher
    - quick menu helpers/actions
    - caret highlight toggle
    - IDE sync button
    - code size badges
    - editor facelift / visual polish
    - persisted editor view preferences like wrap lines and font size

Architecture note:

- The bare probe core should stay as small as possible.
- Its job is to provide lifecycle, packet/MCP bridge support, runtime module loading, and the kebab menu.
- Higher-level UX features should live here as runtime modules whenever practical.

Required files per module:

- `module.json`
- the entry file referenced by `module.json.entry` (defaults to `module.js`)

Example `module.json`:

```json
{
  "id": "example-module",
  "name": "Example Module",
  "description": "Shows how runtime modules are discovered.",
  "version": "0.1.0",
  "order": 100,
  "defaultEnabled": false,
  "entry": "module.js",
  "config": {
    "message": "Hello"
  }
}
```

Expected `module.js` shape:

```js
function (ctx) {
  var root = null;

  return {
    install: function () {
      root = document.createElement("div");
      root.textContent = ctx.config.message || "Hello";
      document.body.appendChild(root);
      ctx.trackNode(root);
    },
    uninstall: function () {
      root = null;
    }
  };
}
```

Notes:

- The source must evaluate to a function.
- The function receives `ctx`, a helper object with cleanup, DOM, timer, logging, packet helpers, and module state helpers.
- Use `ctx.getState(key, fallback)`, `ctx.setState(key, value)`, or `ctx.replaceState(obj)` for module-owned persisted state.
- Enabled/disabled state and per-module state are persisted by the mod in `payload-overrides/lua-editor-runtime-modules.state.json`.

Persistence model:

- The mod owns one persisted JSON container for runtime module state.
- Each module gets its own isolated block under `modules.<moduleId>`.
- That block typically contains:
  - `enabled`
  - `state`
- Modules should store their own persistent preferences through `ctx.getState(...)`, `ctx.setState(...)`, and `ctx.replaceState(...)` instead of inventing ad-hoc storage keys.
