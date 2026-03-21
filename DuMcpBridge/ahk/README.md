# AHK Helpers

This folder contains native Windows input helpers used by `DuMcpBridge`.

Current helper:

- `du_bridge_input.ahk`: headless AutoHotkey v2 CLI helper for targeted Dual Universe window input

Current supported action:

- `ctrl_l`: send explicit left-`Ctrl+L` (`LCtrl`) to the `Dual Universe` window to open the currently targeted element code editor (`lua_editor` or `screen_editor`)

The bridge resolves the AutoHotkey executable in this order:

1. bridge launch argument `--ahk-path` as exe or directory
2. MCP tool input `ahkPath` as exe or directory
3. `DU_AHK_EXE`
4. `DU_MCP_BRIDGE_AHK_EXE`
5. `DU_AHK_DIR`
6. `DU_MCP_BRIDGE_AHK_DIR`
7. common AutoHotkey v2 install paths

Recommended for Cursor MCP config on machines where environment variables are unreliable:

```json
{
  "command": "D:\\github\\du-tobi\\DuMcpBridge\\run-mcp.cmd",
  "args": [
    "--ahk-path",
    "C:\\Program Files\\tools\\AutoHotkey\\v2\\AutoHotkey64.exe"
  ]
}
```

Example manual call:

```powershell
AutoHotkey64.exe ".\ahk\du_bridge_input.ahk" ctrl_l --window-title "Dual Universe" --activate true
```

For testing, AHK v2 is here:
`C:\Program Files\tools\AutoHotkey\v2\`
