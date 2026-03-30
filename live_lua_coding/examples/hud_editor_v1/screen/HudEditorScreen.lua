-- HudEditorScreen.lua
-- Screen script for Paint-with-Lua HUD Editor
-- Renders the current document to the linked screen
-- Project: D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1

local function renderScreen(layer)
    -- The board module handles rendering through onInputReceived
    -- This screen script receives render commands via scriptInput
    local input = Screen.getScriptInput()
    if not input or input == "" then
        -- Just clear and render empty
        addBox(layer, 0, 0, 1920, 1080, 0xFF0A0A14, 0x00000000, 0)
        return
    end

    -- Parse input format: he:cmd|args...
    -- For now, just render based on what the board sets up
    -- The board controls the actual rendering state
end

-- Entry point
function onDraw(layer)
    pcall(renderScreen, layer)
end
