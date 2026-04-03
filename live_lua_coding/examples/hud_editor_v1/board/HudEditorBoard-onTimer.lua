-- HudEditorBoard-onTimer.lua
-- Unit onTimer(startup) handler for Paint-with-Lua HUD Editor
-- Project: D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1

if not HudEditorBoard then
    system.print("ERROR: Failed to load HudEditorBoard module")
    return
end

unit.stopTimer("startup")
HudEditorBoard.onTimer(HudEditorBoard.DB_WRITE_TIMER)
