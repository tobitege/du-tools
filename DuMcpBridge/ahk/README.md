# AHK Helpers

This folder contains native Windows input helpers used by `DuMcpBridge`.

Current helper:

- `du_bridge_input.ahk`: headless AutoHotkey v2 CLI helper for targeted Dual Universe window input

Current supported action:

- `ctrl_l`: send explicit left-`Ctrl+L` (`LCtrl`) to the `Dual Universe` window to open the currently targeted element code editor (`lua_editor` or `screen_editor`)
- `camera_move`: move the cursor to the center of the `Dual Universe` client area, then apply one relative camera move with explicit `--x`, `--y`, and `--settle-ms` values

Important behavior note:

- the helper also has a recovery mode that sends `Escape` before `Ctrl+L`
- do not treat that leading `Escape` as neutral; from a normal in-world state it can open the game Options menu
- if that happens, use a second `Escape` to return in-world before retrying an editor-open step

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
AutoHotkey64.exe ".\ahk\du_bridge_input.ahk" camera_move --window-title "Dual Universe" --x -100 --y 120 --settle-ms 1000
```

For testing, AHK v2 is here:
`C:\Program Files\tools\AutoHotkey\v2\`
