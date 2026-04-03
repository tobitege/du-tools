-- HudEditorBoard-onStart.lua
-- Unit onStart handler for Paint-with-Lua HUD Editor
-- Project: D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1

-- Bootstrap

-- Note: unit and library is always available on a programming board
-- Screen is optional - render output will be disabled if not linked

-- Load the board module (2 different ways!)
-- ONLY IF PLACED OUTSIDE GAME: local HudEditorBoard = require("board/HudEditorBoard")
-- OTHERWISE the "HudEditorBoard" code should be put in a library.onStart filter!
if not HudEditorBoard then
    system.print("ERROR: Failed to load HudEditorBoard module")
    return
end

-- Initialize
system.print("[HE-Boot] pre-init")
HudEditorBoard.init()
system.print("[HE-Boot] post-init")

function onInputReceived(input)
    return HudEditorBoard.onInputReceived(input)
end

function onTimer(timerName)
    HudEditorBoard.onTimer(timerName)
end

-- Hide widget after init

unit.hideWidget()
unit.setTimer("startup", 0.2)

system.print("HudEditorBoard initialized")
