# Lua Probe Runtime Modules

Each subdirectory in this folder is treated as one toggleable runtime module.

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
- The function receives `ctx`, a helper object with cleanup, DOM, timer, storage, logging, and packet helpers.
- Enabled/disabled state is persisted by the mod in `payload-overrides/lua-editor-runtime-modules.state.json`.
