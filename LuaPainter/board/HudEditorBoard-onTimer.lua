-- HudEditorBoard-onTimer.lua
-- Unit onTimer(startup) handler for Lua Painter
-- Project: LuaPainter

if not HudEditorBoard then
    system.print("ERROR: Failed to load HudEditorBoard module")
    return
end

unit.stopTimer("startup")
HudEditorBoard.onTimer(HudEditorBoard.DB_WRITE_TIMER)
