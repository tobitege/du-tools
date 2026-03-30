-- HudEditorBoard.lua
-- Board script for Paint-with-Lua HUD Editor
-- Handles: command processing, element state, databank persistence, screen rendering
-- Project: D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1

local HudEditorBoard = {}
HudEditorBoard.__index = HudEditorBoard

-- ─── Constants ───────────────────────────────────────────────────────

HudEditorBoard.COMMAND_PREFIX = "he:"  -- All HUD editor commands start with "he:"
HudEditorBoard.DB_KEY_DOC = "hud_editor:document"
HudEditorBoard.DB_KEY_INDEX = "hud_editor:index"

-- ─── Command types ──────────────────────────────────────────────────

local CMD = {
    PING = "ping",
    SYNC = "sync",
    NEW = "new",
    LOAD = "load",
    SAVE = "save",
    LIST = "list",
    ADD = "add",
    UPD = "upd",
    DEL = "del",
    SEL = "sel",
    MOV = "mov",
    RES = "res",
    RENDER = "rend",
}

-- ─── Utility functions ───────────────────────────────────────────────

local function dp(msg)
    if type(system) == "table" and type(system.print) == "function" then
        pcall(system.print, "[HE-Board] " .. tostring(msg))
    end
end

local function split(input, sep)
    local parts = {}
    for part in string.gmatch(input, "[^" .. (sep or "|") .. "]+") do
        parts[#parts + 1] = part
    end
    return parts
end

local function deepCopy(orig)
    if type(orig) ~= "table" then return orig end
    local copy = {}
    for k, v in pairs(orig) do
        copy[k] = deepCopy(v)
    end
    return copy
end

local function rgbaToArgb(rgba)
    if not rgba or #rgba < 4 then return 0xFFFFFFFF end
    local a = math.floor((rgba[4] or 1) * 255)
    local r = math.floor((rgba[1] or 0) * 255)
    local g = math.floor((rgba[2] or 0) * 255)
    local b = math.floor((rgba[3] or 0) * 255)
    return (a << 24) | (r << 16) | (g << 8) | b
end

local function generateId()
    return "el_" .. string.format("%08x", math.floor(math.random() * 0xFFFFFFFF))
end

-- ─── State ─────────────────────────────────────────────────────────

local state = {
    mode = "start",           -- "start", "loaded", "editing"
    document = nil,           -- Current document
    selectedId = nil,        -- Currently selected element
    isDirty = false,         -- Unsaved changes
    undoStack = {},
    redoStack = {},
    databankAvailable = false,
    linkedScreens = {},       -- Linked screen elements
    renderRevision = 0,       -- Incremented on each render change
}

-- ─── Document operations ────────────────────────────────────────────

function HudEditorBoard.newDocument(screenW, screenH)
    screenW = screenW or 1920
    screenH = screenH or 1080
    return {
        version = 1,
        revision = 0,
        screenWidth = screenW,
        screenHeight = screenH,
        elements = {
            {
                id = "main_panel",
                type = "boxRounded",
                x = math.floor(screenW * 0.05),
                y = math.floor(screenH * 0.05),
                w = math.floor(screenW * 0.9),
                h = math.floor(screenH * 0.9),
                radius = 20,
                fill = {0.10, 0.11, 0.12, 0.98},
                stroke = {0.70, 0.72, 0.76, 1.0},
                strokeWidth = 3,
                textLines = {"HUD Editor"},
                textColor = {0.86, 0.88, 0.92, 1.0},
                textSize = 24,
                textAlign = "center",
            }
        }
    }
end

function HudEditorBoard.pushUndo()
    if not state.document then return end
    table.insert(state.undoStack, deepCopy(state.document))
    state.redoStack = {}
    if #state.undoStack > 50 then
        table.remove(state.undoStack, 1)
    end
end

function HudEditorBoard.undo()
    if #state.undoStack == 0 then return nil end
    table.insert(state.redoStack, deepCopy(state.document))
    state.document = table.remove(state.undoStack)
    state.isDirty = true
    state.renderRevision = state.renderRevision + 1
    return state.document
end

function HudEditorBoard.redo()
    if #state.redoStack == 0 then return nil end
    table.insert(state.undoStack, deepCopy(state.document))
    state.document = table.remove(state.redoStack)
    state.isDirty = true
    state.renderRevision = state.renderRevision + 1
    return state.document
end

function HudEditorBoard.findElementById(id)
    if not state.document or not state.document.elements then return nil end
    for i, el in ipairs(state.document.elements) do
        if el.id == id then return el, i end
    end
    return nil
end

function HudEditorBoard.addElement(element)
    if not state.document or not state.document.elements then return nil end
    element.id = element.id or generateId()
    table.insert(state.document.elements, element)
    state.document.revision = (state.document.revision or 0) + 1
    state.isDirty = true
    state.renderRevision = state.renderRevision + 1
    return element
end

function HudEditorBoard.updateElement(id, updates)
    local el = HudEditorBoard.findElementById(id)
    if not el then return nil end
    for k, v in pairs(updates) do
        el[k] = v
    end
    state.document.revision = (state.document.revision or 0) + 1
    state.isDirty = true
    state.renderRevision = state.renderRevision + 1
    return el
end

function HudEditorBoard.deleteElement(id)
    if not state.document or not state.document.elements then return false end
    for i, el in ipairs(state.document.elements) do
        if el.id == id then
            table.remove(state.document.elements, i)
            if state.selectedId == id then
                state.selectedId = nil
            end
            state.document.revision = (state.document.revision or 0) + 1
            state.isDirty = true
            state.renderRevision = state.renderRevision + 1
            return true
        end
    end
    return false
end

-- ─── Persistence ───────────────────────────────────────────────────

function HudEditorBoard.persistToDatabank()
    if type(databank) ~= "userdata" or type(databank.setValue) ~= "function" then
        dp("Databank not available, skipping persist")
        return false
    end
    if not state.document then return false end

    local docJson = string.format("%q", HudEditorBoard.serializeDocument(state.document))
    databank.setValue(HudEditorBoard.DB_KEY_DOC, docJson)
    dp("Persisted document revision " .. tostring(state.document.revision))
    return true
end

function HudEditorBoard.restoreFromDatabank()
    -- Check if databank is available
    if type(databank) ~= "userdata" then
        return nil
    end

    -- Check if databank has the required methods
    if type(databank.getValue) ~= "function" then
        return nil
    end

    local docJson = databank.getValue(HudEditorBoard.DB_KEY_DOC)
    if not docJson or docJson == "" then
        return nil
    end

    local ok, doc = pcall(HudEditorBoard.deserializeDocument, docJson)
    if ok and doc then
        dp("Restored document revision " .. tostring(doc.revision))
        return doc
    end
    dp("Failed to restore document: " .. tostring(doc))
    return nil
end

function HudEditorBoard.serializeDocument(doc)
    local parts = {}
    local function serializeValue(v, indent)
        indent = indent or ""
        if type(v) == "nil" then
            return "null"
        elseif type(v) == "boolean" then
            return tostring(v)
        elseif type(v) == "number" then
            return tostring(v)
        elseif type(v) == "string" then
            return string.format("%q", v)
        elseif type(v) == "table" then
            local items = {}
            local isArray = #v > 0 or next(v) == nil
            for i, item in ipairs(v) do
                items[i] = serializeValue(item, indent .. "  ")
            end
            for k, item in pairs(v) do
                if type(k) ~= "number" or k < 1 or k > #v then
                    local key = type(k) == "string" and string.format("%q", k) or tostring(k)
                    items[#items + 1] = "[" .. key .. "]=" .. serializeValue(item, indent .. "  ")
                end
            end
            if isArray and #items > 0 then
                return "{" .. table.concat(items, ",") .. "}"
            else
                return "{" .. table.concat(items, ",") .. "}"
            end
        else
            return "null"
        end
    end
    return serializeValue(doc)
end

function HudEditorBoard.deserializeDocument(json)
    if not json or json == "" then return nil end
    local func = load("return " .. json)
    if not func then return nil end
    local ok, result = pcall(func)
    if not ok then return nil end
    return result
end

-- ─── Command processing ──────────────────────────────────────────────

function HudEditorBoard.processCommand(input)
    if not input or type(input) ~= "string" then
        return nil, "invalid input"
    end

    -- Strip command prefix if present
    local cmd = input
    if string.sub(cmd, 1, #HudEditorBoard.COMMAND_PREFIX) == HudEditorBoard.COMMAND_PREFIX then
        cmd = string.sub(cmd, #HudEditorBoard.COMMAND_PREFIX + 1)
    end

    local parts = split(cmd, "|")
    local action = parts[1]

    -- Route command
    if action == CMD.PING then
        return { status = "ok", type = "pong", version = "hud-editor-v1" }

    elseif action == CMD.SYNC then
        return HudEditorBoard.cmdSync()

    elseif action == CMD.NEW then
        local w = tonumber(parts[2]) or 1920
        local h = tonumber(parts[3]) or 1080
        return HudEditorBoard.cmdNew(w, h)

    elseif action == CMD.LOAD then
        return HudEditorBoard.cmdLoad()

    elseif action == CMD.SAVE then
        return HudEditorBoard.cmdSave()

    elseif action == CMD.LIST then
        return HudEditorBoard.cmdList()

    elseif action == CMD.ADD then
        local elementJson = parts[2]
        return HudEditorBoard.cmdAdd(elementJson)

    elseif action == CMD.UPD then
        local id = parts[2]
        local updatesJson = parts[3]
        return HudEditorBoard.cmdUpdate(id, updatesJson)

    elseif action == CMD.DEL then
        local id = parts[2]
        return HudEditorBoard.cmdDelete(id)

    elseif action == CMD.SEL then
        local id = parts[2]
        return HudEditorBoard.cmdSelect(id)

    elseif action == CMD.MOV then
        local id = parts[2]
        local x = tonumber(parts[3])
        local y = tonumber(parts[4])
        return HudEditorBoard.cmdMove(id, x, y)

    elseif action == CMD.RES then
        local id = parts[2]
        local x = tonumber(parts[3])
        local y = tonumber(parts[4])
        local w = tonumber(parts[5])
        local h = tonumber(parts[6])
        return HudEditorBoard.cmdResize(id, x, y, w, h)

    elseif action == CMD.RENDER then
        return HudEditorBoard.cmdRender()
    end

    return nil, "unknown command: " .. tostring(action)
end

function HudEditorBoard.cmdSync()
    local doc = state.document
    if not doc then
        doc = HudEditorBoard.restoreFromDatabank()
        if doc then
            state.document = doc
            state.mode = "loaded"
        end
    end
    return {
        status = "ok",
        type = "sync_response",
        mode = state.mode,
        selectedId = state.selectedId,
        isDirty = state.isDirty,
        document = doc,
        revision = state.renderRevision,
    }
end

function HudEditorBoard.cmdNew(w, h)
    HudEditorBoard.pushUndo()
    state.document = HudEditorBoard.newDocument(w, h)
    state.selectedId = nil
    state.isDirty = false
    state.mode = "editing"
    HudEditorBoard.persistToDatabank()
    return {
        status = "ok",
        type = "new_response",
        document = state.document,
    }
end

function HudEditorBoard.cmdLoad()
    local doc = HudEditorBoard.restoreFromDatabank()
    if not doc then
        return { status = "error", message = "no document found" }
    end
    state.document = doc
    state.selectedId = nil
    state.isDirty = false
    state.mode = "loaded"
    return {
        status = "ok",
        type = "load_response",
        document = state.document,
    }
end

function HudEditorBoard.cmdSave()
    local ok = HudEditorBoard.persistToDatabank()
    if ok then
        state.isDirty = false
        return { status = "ok", type = "save_response" }
    end
    return { status = "error", message = "save failed" }
end

function HudEditorBoard.cmdList()
    -- For now, just return basic info
    return {
        status = "ok",
        type = "list_response",
        scripts = {
            { id = "_current", name = "Current Layout", modified = state.document and state.document.revision or 0 }
        }
    }
end

function HudEditorBoard.cmdAdd(elementJson)
    if not state.document then
        return { status = "error", message = "no document loaded" }
    end
    HudEditorBoard.pushUndo()
    local ok, element = pcall(HudEditorBoard.deserializeDocument, elementJson)
    if not ok or not element then
        return { status = "error", message = "invalid element JSON" }
    end
    local added = HudEditorBoard.addElement(element)
    return {
        status = "ok",
        type = "add_response",
        element = added,
    }
end

function HudEditorBoard.cmdUpdate(id, updatesJson)
    if not state.document then
        return { status = "error", message = "no document loaded" }
    end
    HudEditorBoard.pushUndo()
    local ok, updates = pcall(HudEditorBoard.deserializeDocument, updatesJson)
    if not ok or not updates then
        return { status = "error", message = "invalid updates JSON" }
    end
    local updated = HudEditorBoard.updateElement(id, updates)
    if not updated then
        return { status = "error", message = "element not found: " .. tostring(id) }
    end
    return {
        status = "ok",
        type = "update_response",
        element = updated,
    }
end

function HudEditorBoard.cmdDelete(id)
    if not state.document then
        return { status = "error", message = "no document loaded" }
    end
    HudEditorBoard.pushUndo()
    local ok = HudEditorBoard.deleteElement(id)
    if not ok then
        return { status = "error", message = "element not found: " .. tostring(id) }
    end
    return { status = "ok", type = "delete_response" }
end

function HudEditorBoard.cmdSelect(id)
    state.selectedId = id
    return {
        status = "ok",
        type = "select_response",
        selectedId = state.selectedId,
    }
end

function HudEditorBoard.cmdMove(id, x, y)
    if not state.document then
        return { status = "error", message = "no document loaded" }
    end
    HudEditorBoard.pushUndo()
    local updated = HudEditorBoard.updateElement(id, { x = x, y = y })
    if not updated then
        return { status = "error", message = "element not found: " .. tostring(id) }
    end
    return {
        status = "ok",
        type = "move_response",
        element = updated,
    }
end

function HudEditorBoard.cmdResize(id, x, y, w, h)
    if not state.document then
        return { status = "error", message = "no document loaded" }
    end
    HudEditorBoard.pushUndo()
    local updated = HudEditorBoard.updateElement(id, { x = x, y = y, w = w, h = h })
    if not updated then
        return { status = "error", message = "element not found: " .. tostring(id) }
    end
    return {
        status = "ok",
        type = "resize_response",
        element = updated,
    }
end

function HudEditorBoard.cmdRender()
    return {
        status = "ok",
        type = "render_response",
        revision = state.renderRevision,
        document = state.document,
    }
end

-- ─── Screen rendering ──────────────────────────────────────────────

function HudEditorBoard.renderElement(layer, element)
    if not element then return end

    local x = element.x or 0
    local y = element.y or 0
    local w = element.w or 100
    local h = element.h or 100
    local fill = element.fill or {0.5, 0.5, 0.5, 1}
    local stroke = element.stroke or {1, 1, 1, 1}
    local strokeWidth = element.strokeWidth or 0

    local fillArgb = rgbaToArgb(fill)
    local strokeArgb = rgbaToArgb(stroke)

    local etype = element.type or "box"

    if etype == "boxRounded" or etype == "box" then
        local radius = element.radius or 0
        addBoxRounded(layer, x, y, w, h, radius, fillArgb, strokeArgb, strokeWidth)

    elseif etype == "circle" then
        addCircle(layer, x + w/2, y + h/2, math.min(w, h)/2, fillArgb, strokeArgb, strokeWidth)

    elseif etype == "line" then
        addLine(layer, x, y, x + w, y + h, strokeArgb, strokeWidth)

    elseif etype == "text" then
        local textLines = element.textLines or {}
        local textColor = element.textColor or {1, 1, 1, 1}
        local textSize = element.textSize or 16
        local textAlign = element.textAlign or "left"
        local textArgb = rgbaToArgb(textColor)

        local text = table.concat(textLines, "\n")
        if text == "" then return end

        local tx = x
        if textAlign == "center" then
            tx = x + w / 2
        elseif textAlign == "right" then
            tx = x + w
        end

        addText(layer, "Intro", text, tx, y + h/2, textSize, textArgb)
    end
end

function HudEditorBoard.render(layer)
    if not state.document or not state.document.elements then return end

    local sw = state.document.screenWidth or 1920
    local sh = state.document.screenHeight or 1080

    -- Clear with transparent background
    addBox(layer, 0, 0, sw, sh, 0x00000000, 0x00000000, 0)

    -- Render all elements
    for _, element in ipairs(state.document.elements) do
        HudEditorBoard.renderElement(layer, element)
    end

    -- Render selection overlay for selected element
    if state.selectedId then
        local el = HudEditorBoard.findElementById(state.selectedId)
        if el then
            local selColor = 0xFF0EE9E7  -- Cyan
            addBoxRounded(layer, el.x - 2, el.y - 2, el.w + 4, el.h + 4, 4, 0x00000000, selColor, 2)
        end
    end
end

-- ─── Input handling ────────────────────────────────────────────────

function HudEditorBoard.onInputReceived(input)
    local ok, result = pcall(HudEditorBoard.processCommand, input)
    if not ok then
        dp("Command error: " .. tostring(result))
        return { status = "error", message = tostring(result) }
    end
    return result
end

-- ─── Lifecycle ─────────────────────────────────────────────────────

function HudEditorBoard.init()
    dp("Initializing HUD Editor Board")

    -- Debug: report what's available for screen linking
    dp("DEBUG: type(Screens)=" .. tostring(type(Screens)))
    dp("DEBUG: Screens=" .. tostring(Screens))
    dp("DEBUG: type(Screen)=" .. tostring(type(Screen)))
    dp("DEBUG: Screen=" .. tostring(Screen))
    if type(Screens) == "table" then
        dp("DEBUG: #Screens=" .. #Screens)
    end

    -- Try to restore last document (before checking databank)
    -- This allows working even without databank initially
    local doc = HudEditorBoard.restoreFromDatabank()
    if doc then
        state.document = doc
        state.mode = "loaded"
        dp("Restored document from databank")
    else
        -- Create empty document if nothing to restore
        state.document = HudEditorBoard.newDocument(1920, 1080)
        state.mode = "editing"
        dp("Created new empty document")
    end

    -- Link screens if available
    -- Screens (plural) is an array of all linked screens
    -- Screen (singular) is the first/only linked screen
    state.linkedScreens = {}
    if type(Screens) == "table" and #Screens > 0 then
        state.linkedScreens = Screens
        dp("Linked " .. #Screens .. " screen(s)")
    elseif type(Screen) == "userdata" then
        state.linkedScreens = {Screen}
        dp("Linked 1 screen")
    else
        dp("No screen linked - render output disabled")
    end

    -- Start render loop only if we have screens and unit
    if #state.linkedScreens > 0 and type(unit) == "userdata" then
        unit.setTimer("render", 0.5)  -- Slower initial render
        dp("Render loop started")
    end
end

function HudEditorBoard.onTimer(timerName)
    if timerName == "render" then
        -- Only render if we have linked screens
        if #state.linkedScreens == 0 then
            unit.setTimer("render", 1.0)  -- Check again in 1 second
            return
        end
        -- Re-render to linked screens
        for _, screen in ipairs(state.linkedScreens) do
            if type(screen) == "userdata" and type(screen.getRenderScript) == "function" then
                screen.clearScriptOutput()
                local script = HudEditorBoard.buildRenderScript()
                screen.setRenderScript(script)
            end
        end
        unit.setTimer("render", 0.1)  -- ~10fps render updates
    end
end

function HudEditorBoard.buildRenderScript()
    local script = [=[
local function renderLayer(layer)
]=] .. "    local HudEditorBoard = HUDEditorBoard\n"
    script = script .. [=[
    if not HudEditorBoard then return end
    HudEditorBoard.render(layer)
end
]=]
    return script
end

-- ─── Public API for screen script ──────────────────────────────────

HudEditorBoard.renderLayer = function(layer)
    HudEditorBoard.render(layer)
end

-- ─── Module export ─────────────────────────────────────────────────

if _ENV then
    _ENV.HudEditorBoard = HudEditorBoard
end
if package and package.loaded then
    package.loaded["HudEditorBoard"] = HudEditorBoard
end

return HudEditorBoard
