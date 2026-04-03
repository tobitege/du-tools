-- HudEditorBoard.lua
-- Library onStart handler Board script for Paint-with-Lua HUD Editor
-- Handles: command processing, element state, databank persistence, screen rendering
-- Project: D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1

HudEditorBoard = type(HudEditorBoard) == "table" and HudEditorBoard or {}
HudEditorBoard.__index = HudEditorBoard

--  Constants

HudEditorBoard.COMMAND_PREFIX = "he:"  -- All HUD editor commands start with "he:"
HudEditorBoard.DB_KEY_INDEX = "hud_editor:index"
HudEditorBoard.DB_KEY_DOC_PREFIX = "hud_editor:document:"
HudEditorBoard.DB_WRITE_TIMER = "dbwrite"
HudEditorBoard.DB_WRITE_INTERVAL = 0.05

--  Command types

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

--  Utility functions

local function dp(msg)
    if type(system) == "table" and type(system.print) == "function" then
        system.print("[HE-Board] " .. tostring(msg))
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

local function append(parts, value)
    if value == nil then
        return
    end
    parts[#parts + 1] = value
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

local function generateLayoutId()
    return "ly_" .. string.format("%08x", math.floor(math.random() * 0xFFFFFFFF))
end

local function urlEncode(value)
    return (tostring(value or ""):gsub("([^%w%-_%.~])", function(ch)
        return string.format("%%%02X", string.byte(ch))
    end))
end

local function encodeColor(rgba)
    rgba = rgba or { 0, 0, 0, 1 }
    return table.concat({
        tostring(rgba[1] or 0),
        tostring(rgba[2] or 0),
        tostring(rgba[3] or 0),
        tostring(rgba[4] or 1),
    }, ",")
end

local function encodeTextLines(textLines)
    if type(textLines) ~= "table" or #textLines == 0 then
        return ""
    end
    local parts = {}
    for i, line in ipairs(textLines) do
        parts[i] = tostring(line or "")
    end
    return table.concat(parts, "\n")
end

local function encodeElementForBridge(element)
    if type(element) ~= "table" then
        return ""
    end
    return table.concat({
        urlEncode(element.id or ""),
        urlEncode(element.type or "box"),
        element.visible == false and "0" or "1",
        tostring(math.floor(element.x or 0)),
        tostring(math.floor(element.y or 0)),
        tostring(math.floor(element.w or 0)),
        tostring(math.floor(element.h or 0)),
        tostring(math.floor(element.radius or 0)),
        encodeColor(element.fill),
        encodeColor(element.stroke),
        tostring(element.strokeWidth or 0),
        urlEncode(encodeTextLines(element.textLines)),
        encodeColor(element.textColor),
        tostring(element.textSize or 16),
        urlEncode(element.textAlign or "left")
    }, "~")
end

local function encodeDocumentForBridge(doc)
    if type(doc) ~= "table" then
        return ""
    end
    local encodedElements = {}
    for i, element in ipairs(doc.elements or {}) do
        encodedElements[i] = encodeElementForBridge(element)
    end
    return table.concat({
        tostring(doc.version or 1),
        tostring(doc.revision or 0),
        tostring(doc.screenWidth or 1920),
        tostring(doc.screenHeight or 1080),
        urlEncode(doc.id or ""),
        urlEncode(doc.name or ""),
        table.concat(encodedElements, "^")
    }, "~")
end

local function encodeScriptsForBridge(scripts)
    local encoded = {}
    for i, script in ipairs(scripts or {}) do
        encoded[i] = table.concat({
            urlEncode(script.id or ""),
            urlEncode(script.name or script.id or ""),
            tostring(script.modified or 0)
        }, "~")
    end
    return table.concat(encoded, "^")
end

local function hasMethod(target, methodName)
    local targetType = type(target)
    return (targetType == "table" or targetType == "userdata")
        and type(target[methodName]) == "function"
end

local function hasDatabankIo(target)
    return hasMethod(target, "setStringValue") and hasMethod(target, "getStringValue")
end

local function databankSet(target, key, value)
    local payload = tostring(value or "")
    local ok, err = pcall(target.setStringValue, target, key, payload)
    if ok then
        return true
    end
    return false, err
end

local function databankGet(target, key)
    return target.getStringValue(key)
end

local function normalizeDocumentName(value)
    local name = tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
    if name == "" then
        return "Layout"
    end
    return name
end

local function normalizeDocumentId(value)
    local id = tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
    if id == "" then
        return nil
    end
    return id
end

local function normalizeDocumentMeta(doc)
    if type(doc) ~= "table" then
        return nil
    end
    doc.name = normalizeDocumentName(doc.name)
    doc.id = normalizeDocumentId(doc.id)
    if not doc.id then
        return nil
    end
    return doc
end

local function getDocumentStorageKey(docId)
    local id = normalizeDocumentId(docId)
    if not id then
        return nil
    end
    return HudEditorBoard.DB_KEY_DOC_PREFIX .. id
end

local function loadDocumentFromDatabankKey(db, docId)
    if not db then
        return nil
    end
    local docKey = getDocumentStorageKey(docId)
    if not docKey then
        return nil
    end
    local docJson = databankGet(db, docKey)
    if not docJson or docJson == "" then
        return nil
    end
    local ok, doc = pcall(HudEditorBoard.deserializeDocument, docJson)
    if ok and type(doc) == "table" then
        return normalizeDocumentMeta(doc)
    end
    return nil
end

local function readDatabankIndex(db)
    local raw = databankGet(db, HudEditorBoard.DB_KEY_INDEX)
    if not raw or raw == "" then
        return { activeId = nil, scripts = {} }
    end
    local ok, index = pcall(HudEditorBoard.deserializeDocument, raw)
    if ok and type(index) == "table" then
        index.scripts = type(index.scripts) == "table" and index.scripts or {}
        return index
    end
    return { activeId = nil, scripts = {} }
end

local function writeDatabankIndex(db, index)
    databankSet(db, HudEditorBoard.DB_KEY_INDEX, HudEditorBoard.serializeDocument(index))
end

local function upsertDatabankIndex(index, docId, doc)
    local scripts = index.scripts or {}
    local found = false
    for i, script in ipairs(scripts) do
        if script.id == docId then
            script.name = doc.name
            script.modified = doc.revision or 0
            found = true
            break
        end
    end
    if not found then
        scripts[#scripts + 1] = {
            id = docId,
            name = doc.name,
            modified = doc.revision or 0
        }
    end
    table.sort(scripts, function(a, b)
        local aName = string.lower(tostring(a.name or a.id or ""))
        local bName = string.lower(tostring(b.name or b.id or ""))
        if aName ~= bName then
            return aName < bName
        end
        return tostring(a.id or "") < tostring(b.id or "")
    end)
    index.activeId = docId
    index.scripts = scripts
    return index
end

local function getNumericSuffix(value)
    local match = tostring(value or ""):match("(%d+)$")
    return match and tonumber(match) or nil
end

local function getElementClass(slot)
    if not hasMethod(slot, "getClass") then
        return nil
    end
    local className = slot.getClass()
    if type(className) == "string" and className ~= "" then
        return string.lower(className)
    end
    return nil
end

local function getElementId(slot)
    if not hasMethod(slot, "getLocalId") then
        return nil
    end
    local id = slot.getLocalId()
    if id ~= nil then
        return id
    end
    return nil
end

local function resolveElementName(core, localId)
    if localId == nil or not hasMethod(core, "getElementNameById") then
        return nil
    end
    local name = core.getElementNameById(localId)
    if type(name) == "string" and name ~= "" then
        return name
    end
    return nil
end

local function compareLinkedSlots(a, b)
    local aDbg = type(a.elementName) == "string" and a.elementName:match("^dbg_screen_([1-9])$")
    local bDbg = type(b.elementName) == "string" and b.elementName:match("^dbg_screen_([1-9])$")
    if aDbg and bDbg and aDbg ~= bDbg then
        return tonumber(aDbg) < tonumber(bDbg)
    end
    if aDbg and not bDbg then
        return true
    end
    if bDbg and not aDbg then
        return false
    end
    local aSlot = getNumericSuffix(a.slotName)
    local bSlot = getNumericSuffix(b.slotName)
    if aSlot ~= nil and bSlot ~= nil and aSlot ~= bSlot then
        return aSlot < bSlot
    end
    local aName = string.lower(tostring(a.elementName or a.slotName or ""))
    local bName = string.lower(tostring(b.elementName or b.slotName or ""))
    if aName ~= bName then
        return aName < bName
    end
    return tostring(a.localId or "") < tostring(b.localId or "")
end

local function addLinkedScreen(target, seen, screen)
    if not hasMethod(screen, "setRenderScript") then
        return
    end
    if seen[screen] then
        return
    end
    seen[screen] = true
    target[#target + 1] = screen
end

local function resolveLinkedScreens(links, fallbackScreens, fallbackScreen)
    local resolved = {}
    local seen = {}
    for _, screen in ipairs((links and links.screens) or {}) do
        addLinkedScreen(resolved, seen, screen)
    end
    if #resolved == 0 then
        if type(fallbackScreens) == "table" then
            for _, screen in ipairs(fallbackScreens) do
                addLinkedScreen(resolved, seen, screen)
            end
        end
        addLinkedScreen(resolved, seen, fallbackScreen)
    end
    return resolved
end

local function countRenderableScreens(screens)
    local count = 0
    if type(screens) ~= "table" then
        return 0
    end
    for _, screen in ipairs(screens) do
        if hasMethod(screen, "setRenderScript") then
            count = count + 1
        end
    end
    return count
end

local function scanUnitLinks()
    local links = {
        core = nil,
        screens = {},
        databanks = {},
        slots = {},
    }
    if type(unit) ~= "table" and type(unit) ~= "userdata" then
        return links
    end
    for slotName, slot in pairs(unit) do
        if type(slot) == "table" and type(slot.export) == "table" then
            local elementClass = getElementClass(slot)
            if elementClass then
                slot.slotName = slotName
                slot.elementClass = elementClass
                slot.localId = getElementId(slot)
                table.insert(links.slots, slot)
                if string.find(elementClass, "coreunit", 1, true) then
                    links.core = slot
                elseif string.find(elementClass, "screen", 1, true) then
                    table.insert(links.screens, slot)
                elseif string.find(elementClass, "databankunit", 1, true) then
                    table.insert(links.databanks, slot)
                end
            end
        end
    end
    for _, slot in ipairs(links.slots) do
        slot.elementName = resolveElementName(links.core, slot.localId)
    end
    table.sort(links.screens, compareLinkedSlots)
    table.sort(links.databanks, compareLinkedSlots)
    links.primaryScreen = links.screens[1]
    links.primaryDatabank = links.databanks[1]
    return links
end

--  State

local state = {
    mode = "start",           -- "start", "loaded", "editing"
    document = nil,           -- Current document
    selectedId = nil,         -- Currently selected element
    isDirty = false,          -- Unsaved changes
    undoStack = {},
    redoStack = {},
    databankAvailable = false,
    databank = nil,
    links = nil,
    linkedScreens = {},       -- Linked screen elements
    renderRevision = 0,       -- Incremented on each render change
    renderTick = 0,
    lastRenderPublishTick = 0,
    lastRenderedScript = nil,
    lastRenderError = nil,
    pendingDatabankWrites = nil,
}

--  Document operations

function HudEditorBoard.newDocument(screenW, screenH)
    screenW = screenW or 1920
    screenH = screenH or 1080
    return {
        version = 1,
        revision = 1,
        id = generateLayoutId(),
        name = "Layout",
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
                textLines = {"Lua Painter"},
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

--  Persistence

function HudEditorBoard.refreshLinks(verbose)
    local existingScreen = nil
    local existingScreens = nil
    local existingDatabank = nil
    if type(_G) == "table" then
        existingScreen = rawget(_G, "Screen")
        existingScreens = rawget(_G, "Screens")
        existingDatabank = rawget(_G, "databank")
    else
        existingScreen = Screen
        existingScreens = Screens
        existingDatabank = databank
    end
    local links = scanUnitLinks()
    state.links = links
    state.linkedScreens = resolveLinkedScreens(links, existingScreens, existingScreen)
    if not links.primaryScreen then
        links.primaryScreen = state.linkedScreens[1]
    end
    state.databank = links.primaryDatabank or existingDatabank
    state.databankAvailable = hasDatabankIo(state.databank)
    if type(_G) == "table" then
        rawset(_G, "HudEditorLinks", links)
        rawset(_G, "Screens", state.linkedScreens)
        rawset(_G, "Screen", links.primaryScreen)
        rawset(_G, "Databanks", links.databanks)
        rawset(_G, "databank", state.databank)
    else
        HudEditorLinks = links
        Screens = state.linkedScreens
        Screen = links.primaryScreen
        Databanks = links.databanks
        databank = state.databank
    end
    if verbose then
        local screenInfo = tostring(#state.linkedScreens)
        local dbInfo = tostring(#(links.databanks or {}))
        dp("Link scan: " .. screenInfo .. " screen(s), " .. dbInfo .. " databank(s)")
        dp("Screen vars: S=" .. (hasMethod(existingScreen, "setRenderScript") and "1" or "0")
            .. " Ss=" .. tostring(countRenderableScreens(existingScreens))
            .. " scan=" .. tostring(#(links.screens or {}))
            .. " use=" .. screenInfo)
        if links.primaryScreen then
            dp("Primary screen: " .. tostring(links.primaryScreen.elementName or links.primaryScreen.slotName))
        end
    end
    return links
end

function HudEditorBoard.getDatabank()
    if hasDatabankIo(state.databank) then
        return state.databank
    end
    HudEditorBoard.refreshLinks(false)
    if hasDatabankIo(state.databank) then
        return state.databank
    end
    return nil
end

local function stopDatabankWriteTimer()
    if hasMethod(unit, "setTimer") then
        unit.setTimer(HudEditorBoard.DB_WRITE_TIMER, 0)
    end
end

local function scheduleDatabankWriteTimer()
    if hasMethod(unit, "setTimer") then
        unit.setTimer(HudEditorBoard.DB_WRITE_TIMER, HudEditorBoard.DB_WRITE_INTERVAL)
        return true
    end
    return false
end

local function flushNextDatabankWrite()
    local pending = state.pendingDatabankWrites
    if type(pending) ~= "table" or #pending == 0 then
        state.pendingDatabankWrites = nil
        stopDatabankWriteTimer()
        return true
    end

    local write = table.remove(pending, 1)
    local ok, err = databankSet(write.target, write.key, write.value)
    if not ok then
        state.pendingDatabankWrites = nil
        stopDatabankWriteTimer()
        return false, err
    end

    if #pending == 0 then
        state.pendingDatabankWrites = nil
        stopDatabankWriteTimer()
        return true
    end

    state.pendingDatabankWrites = pending
    scheduleDatabankWriteTimer()
    return true
end

function HudEditorBoard.persistToDatabank()
    local db = HudEditorBoard.getDatabank()
    if not db then
        dp("Databank not available, skipping persist")
        return false
    end
    if not state.document then return false end

    local doc = normalizeDocumentMeta(state.document)
    if not doc then
        dp("Document missing id, skipping persist")
        return false
    end
    local docKey = getDocumentStorageKey(doc.id)
    local stored = loadDocumentFromDatabankKey(db, doc.id)
    local revision = tonumber(doc.revision) or 0
    if stored and type(stored.revision) == "number" and stored.revision > revision then
        revision = stored.revision
    end
    if revision < 1 then
        revision = 1
    end
    doc.revision = revision

    local docPayload = HudEditorBoard.serializeDocument(doc)
    local nextIndex = upsertDatabankIndex(readDatabankIndex(db), doc.id, doc)
    local indexPayload = HudEditorBoard.serializeDocument(nextIndex)
    state.pendingDatabankWrites = {
        { target = db, key = docKey, value = docPayload },
        { target = db, key = HudEditorBoard.DB_KEY_INDEX, value = indexPayload },
    }
    if not scheduleDatabankWriteTimer() then
        local ok, err = flushNextDatabankWrite()
        if ok then
            ok, err = flushNextDatabankWrite()
        end
        if not ok then
            dp("Databank write failed while flushing immediately: " .. tostring(err))
            return false
        end
    end
    state.document = doc
    return true
end

function HudEditorBoard.restoreFromDatabank(scriptId)
    local db = HudEditorBoard.getDatabank()
    if not db then
        return nil
    end

    local doc = nil
    if type(scriptId) == "string" and scriptId ~= "" and scriptId ~= "_current" then
        doc = loadDocumentFromDatabankKey(db, scriptId)
    end
    if not doc then
        local index = readDatabankIndex(db)
        if type(index.activeId) == "string" and index.activeId ~= "" then
            doc = loadDocumentFromDatabankKey(db, index.activeId)
        end
    end
    if doc then
        dp("Restored document revision " .. tostring(doc.revision))
        return doc
    end

    return nil
end

function HudEditorBoard.listStoredScripts()
    local db = HudEditorBoard.getDatabank()
    if not db then
        return {}
    end
    local index = readDatabankIndex(db)
    local scripts = {}
    for i, script in ipairs(index.scripts or {}) do
        if normalizeDocumentId(script.id) then
            scripts[#scripts + 1] = {
                id = script.id,
                name = script.name or "Layout",
                modified = script.modified or 0
            }
        end
    end
    return scripts
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
    if type(result) == "string" and result ~= "" then
        local nested = load("return " .. result)
        if nested then
            local nestedOk, nestedResult = pcall(nested)
            if nestedOk and type(nestedResult) == "table" then
                return nestedResult
            end
        end
    end
    return result
end

--  Command processing

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
        return HudEditorBoard.cmdLoad(parts[2])

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
    return table.concat({
        "sync_response",
        "ok",
        urlEncode(state.mode or "start"),
        urlEncode(state.selectedId or ""),
        state.isDirty and "1" or "0",
        tostring(state.renderRevision or 0),
        encodeDocumentForBridge(doc)
    }, "|")
end

function HudEditorBoard.cmdNew(w, h)
    HudEditorBoard.pushUndo()
    state.document = HudEditorBoard.newDocument(w, h)
    state.selectedId = nil
    state.isDirty = false
    state.mode = "editing"
    HudEditorBoard.persistToDatabank()
    return "new_response|ok|" .. encodeDocumentForBridge(state.document)
end

function HudEditorBoard.cmdLoad(scriptId)
    local doc = nil
    if type(scriptId) == "string" and scriptId ~= "" and scriptId ~= "_current" then
        doc = HudEditorBoard.restoreFromDatabank(scriptId)
    elseif state.document then
        doc = state.document
    else
        doc = HudEditorBoard.restoreFromDatabank()
    end
    if not doc then
        return "load_response|error|no%20document%20found"
    end
    state.document = doc
    state.selectedId = nil
    state.isDirty = false
    state.mode = "loaded"
    return "load_response|ok|" .. encodeDocumentForBridge(state.document)
end

function HudEditorBoard.cmdSave()
    local ok = HudEditorBoard.persistToDatabank()
    if ok then
        state.isDirty = false
        return "save_response|ok"
    end
    return "save_response|error"
end

function HudEditorBoard.cmdList()
    local scripts = HudEditorBoard.listStoredScripts()
    if #scripts == 0 and state.document then
        local doc = normalizeDocumentMeta(state.document)
        if doc then
            scripts[1] = {
                id = doc.id,
                name = doc.name or "Layout",
                modified = doc.revision or 0
            }
        end
    elseif #scripts == 0 then
        scripts[1] = {
            id = "_current",
            name = "Current Layout",
            modified = 0
        }
    end
    return "list_response|ok|" .. encodeScriptsForBridge(scripts)
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

--  Screen rendering

local SCREEN_SCRIPT_LIMIT = 50000
local SCREEN_REPUBLISH_TICKS = 50
local SCREEN_DEFAULT_FILL = { 0.20, 0.20, 0.20, 1.0 }
local SCREEN_DEFAULT_STROKE = { 1.00, 1.00, 1.00, 1.0 }
local SCREEN_DEFAULT_TEXT = { 1.00, 1.00, 1.00, 1.0 }
local SCREEN_DEFAULT_SHADOW = { 0.00, 0.00, 0.00, 0.0 }

local function luaNumber(value, fallback)
    local numeric = tonumber(value)
    if numeric == nil or numeric ~= numeric or numeric == math.huge or numeric == -math.huge then
        numeric = fallback or 0
    end
    if math.floor(numeric) == numeric then
        return tostring(numeric)
    end
    local text = string.format("%.4f", numeric)
    text = text:gsub("0+$", ""):gsub("%.$", "")
    if text == "-0" then
        return "0"
    end
    return text
end

local function luaString(value)
    return string.format("%q", tostring(value or ""))
end

local function serializeScreenColor(color, fallback)
    local source = type(color) == "table" and color or fallback
    return string.format(
        "{%s,%s,%s,%s}",
        luaNumber(source[1], fallback[1]),
        luaNumber(source[2], fallback[2]),
        luaNumber(source[3], fallback[3]),
        luaNumber(source[4], fallback[4])
    )
end

local function hasVisibleScreenColor(color)
    return type(color) == "table" and tonumber(color[4]) and tonumber(color[4]) > 0
end

local function serializeScreenTextLines(lines)
    if type(lines) ~= "table" or #lines == 0 then
        return nil
    end
    local parts = { "{" }
    for index = 1, #lines do
        if index > 1 then
            append(parts, ",")
        end
        append(parts, luaString(lines[index]))
    end
    append(parts, "}")
    return table.concat(parts)
end

local function normalizeScreenElementType(rawType)
    local elementType = tostring(rawType or "box")
    if elementType == "rounded" then
        return "boxRounded"
    end
    return elementType
end

local function serializeScreenTextCommand(element)
    local textLines = serializeScreenTextLines(element.textLines)
    local parts
    if not textLines then
        return nil
    end
    parts = { "{" }
    append(parts, "o=")
    append(parts, luaString("text"))
    append(parts, ",x=")
    append(parts, luaNumber(element.x, 0))
    append(parts, ",y=")
    append(parts, luaNumber(element.y, 0))
    append(parts, ",w=")
    append(parts, luaNumber(element.w, 0))
    append(parts, ",h=")
    append(parts, luaNumber(element.h, 0))
    append(parts, ",l=")
    append(parts, textLines)
    append(parts, ",tc=")
    append(parts, serializeScreenColor(element.textColor, SCREEN_DEFAULT_TEXT))
    append(parts, ",s=")
    append(parts, serializeScreenColor({ 0, 0, 0, 0 }, SCREEN_DEFAULT_SHADOW))
    append(parts, ",sw=")
    append(parts, luaNumber(0, 0))
    append(parts, ",ts=")
    append(parts, luaNumber(element.textSize, 16))
    append(parts, ",ta=")
    append(parts, luaString(element.textAlign or "left"))
    append(parts, ",tv=")
    append(parts, luaString(element.textVAlign or "center"))
    if tonumber(element.rotation) and tonumber(element.rotation) ~= 0 then
        append(parts, ",rot=")
        append(parts, luaNumber(element.rotation, 0))
    end
    if tonumber(element.shadowBlur) and tonumber(element.shadowBlur) > 0 then
        append(parts, ",sh={b=")
        append(parts, luaNumber(element.shadowBlur, 0))
        append(parts, ",c=")
        append(parts, serializeScreenColor(element.shadowColor, SCREEN_DEFAULT_SHADOW))
        append(parts, "}")
    end
    append(parts, "}")
    return table.concat(parts)
end

local function serializeScreenShapeCommand(element, elementType)
    local parts = { "{" }
    append(parts, "o=")
    append(parts, luaString("shape"))
    append(parts, ",k=")
    append(parts, luaString(elementType))
    append(parts, ",x=")
    append(parts, luaNumber(element.x, 0))
    append(parts, ",y=")
    append(parts, luaNumber(element.y, 0))
    append(parts, ",w=")
    append(parts, luaNumber(element.w, 0))
    append(parts, ",h=")
    append(parts, luaNumber(element.h, 0))
    append(parts, ",f=")
    append(parts, serializeScreenColor(element.fill, SCREEN_DEFAULT_FILL))
    append(parts, ",s=")
    append(parts, serializeScreenColor(element.stroke, SCREEN_DEFAULT_STROKE))
    append(parts, ",sw=")
    append(parts, luaNumber(element.strokeWidth, 0))
    if elementType == "boxRounded" then
        append(parts, ",r=")
        append(parts, luaNumber(element.radius, 0))
    elseif elementType == "quad" then
        append(parts, ",qi=")
        append(parts, luaNumber(element.quadInset, 0.125))
    end
    if tonumber(element.rotation) and tonumber(element.rotation) ~= 0 then
        append(parts, ",rot=")
        append(parts, luaNumber(element.rotation, 0))
    end
    if tonumber(element.shadowBlur) and tonumber(element.shadowBlur) > 0 then
        append(parts, ",sh={b=")
        append(parts, luaNumber(element.shadowBlur, 0))
        append(parts, ",c=")
        append(parts, serializeScreenColor(element.shadowColor, SCREEN_DEFAULT_SHADOW))
        append(parts, "}")
    end
    append(parts, "}")
    return table.concat(parts)
end

local function serializeScreenLineCommand(element)
    if type(element) ~= "table" then
        return nil
    end
    local parts = { "{" }
    append(parts, "o=")
    append(parts, luaString("line"))
    append(parts, ",x=")
    append(parts, luaNumber(element.x, 0))
    append(parts, ",y=")
    append(parts, luaNumber(element.y, 0))
    append(parts, ",w=")
    append(parts, luaNumber(element.w, 0))
    append(parts, ",h=")
    append(parts, luaNumber(element.h, 0))
    append(parts, ",s=")
    append(parts, serializeScreenColor(element.stroke, SCREEN_DEFAULT_STROKE))
    append(parts, ",sw=")
    append(parts, luaNumber(element.strokeWidth, 2))
    if tonumber(element.rotation) and tonumber(element.rotation) ~= 0 then
        append(parts, ",rot=")
        append(parts, luaNumber(element.rotation, 0))
    end
    if tonumber(element.shadowBlur) and tonumber(element.shadowBlur) > 0 then
        append(parts, ",sh={b=")
        append(parts, luaNumber(element.shadowBlur, 0))
        append(parts, ",c=")
        append(parts, serializeScreenColor(element.shadowColor, SCREEN_DEFAULT_SHADOW))
        append(parts, "}")
    end
    append(parts, "}")
    return table.concat(parts)
end

local function serializeScreenBezierCommand(element)
    if type(element) ~= "table" then
        return nil
    end
    local parts = { "{" }
    append(parts, "o=")
    append(parts, luaString("bezier"))
    append(parts, ",x=")
    append(parts, luaNumber(element.x, 0))
    append(parts, ",y=")
    append(parts, luaNumber(element.y, 0))
    append(parts, ",w=")
    append(parts, luaNumber(element.w, 0))
    append(parts, ",h=")
    append(parts, luaNumber(element.h, 0))
    append(parts, ",s=")
    append(parts, serializeScreenColor(element.stroke, SCREEN_DEFAULT_STROKE))
    append(parts, ",sw=")
    append(parts, luaNumber(element.strokeWidth, 2))
    if tonumber(element.rotation) and tonumber(element.rotation) ~= 0 then
        append(parts, ",rot=")
        append(parts, luaNumber(element.rotation, 0))
    end
    if tonumber(element.shadowBlur) and tonumber(element.shadowBlur) > 0 then
        append(parts, ",sh={b=")
        append(parts, luaNumber(element.shadowBlur, 0))
        append(parts, ",c=")
        append(parts, serializeScreenColor(element.shadowColor, SCREEN_DEFAULT_SHADOW))
        append(parts, "}")
    end
    append(parts, "}")
    return table.concat(parts)
end

local function serializeScreenImageCommand(element)
    if type(element) ~= "table" then
        return nil
    end
    local parts = { "{" }
    append(parts, "o=")
    append(parts, luaString("image"))
    append(parts, ",x=")
    append(parts, luaNumber(element.x, 0))
    append(parts, ",y=")
    append(parts, luaNumber(element.y, 0))
    append(parts, ",w=")
    append(parts, luaNumber(element.w, 0))
    append(parts, ",h=")
    append(parts, luaNumber(element.h, 0))
    if hasVisibleScreenColor(element.fill) then
        append(parts, ",f=")
        append(parts, serializeScreenColor(element.fill, SCREEN_DEFAULT_FILL))
    end
    append(parts, ",src=")
    append(parts, luaString(element.imageSrc or ""))
    append(parts, ",fit=")
    append(parts, luaString(element.imageFit or "contain"))
    if tonumber(element.rotation) and tonumber(element.rotation) ~= 0 then
        append(parts, ",rot=")
        append(parts, luaNumber(element.rotation, 0))
    end
    if tonumber(element.shadowBlur) and tonumber(element.shadowBlur) > 0 then
        append(parts, ",sh={b=")
        append(parts, luaNumber(element.shadowBlur, 0))
        append(parts, ",c=")
        append(parts, serializeScreenColor(element.shadowColor, SCREEN_DEFAULT_SHADOW))
        append(parts, "}")
    end
    append(parts, "}")
    return table.concat(parts)
end

local function appendScreenElementCommands(parts, element, isFirst)
    if type(element) ~= "table" or element.visible == false then
        return isFirst
    end
    local elementType = normalizeScreenElementType(element.type)
    local commands = {}
    if elementType == "text" then
        commands[#commands + 1] = serializeScreenTextCommand(element)
    elseif elementType == "bezierArc" then
        commands[#commands + 1] = serializeScreenBezierCommand(element)
        commands[#commands + 1] = serializeScreenTextCommand(element)
    elseif elementType == "image" then
        commands[#commands + 1] = serializeScreenImageCommand(element)
        commands[#commands + 1] = serializeScreenTextCommand(element)
    elseif elementType == "line" then
        commands[#commands + 1] = serializeScreenLineCommand(element)
        commands[#commands + 1] = serializeScreenTextCommand(element)
    else
        commands[#commands + 1] = serializeScreenShapeCommand(element, elementType)
        commands[#commands + 1] = serializeScreenTextCommand(element)
    end
    for _, command in ipairs(commands) do
        if command then
            if not isFirst then
                append(parts, ",")
            end
            append(parts, command)
            isFirst = false
        end
    end
    return isFirst
end

function HudEditorBoard.buildScreenDocument(document)
    local doc = type(document) == "table" and document or state.document
    if type(doc) ~= "table" then
        return nil
    end
    local parts = {
        "{w=",
        luaNumber(doc.screenWidth, 1920),
        ",h=",
        luaNumber(doc.screenHeight, 1080),
        ",c={"
    }
    local elements = type(doc.elements) == "table" and doc.elements or {}
    local isFirst = true
    for index = 1, #elements do
        isFirst = appendScreenElementCommands(parts, elements[index], isFirst)
    end
    append(parts, "}}")
    return table.concat(parts)
end

function HudEditorBoard.publishRenderState(script, options)
    if type(script) ~= "string" or script == "" then
        return false, "no_render_script"
    end
    if #state.linkedScreens == 0 then
        return false, "no_linked_screens"
    end
    local announce = type(options) == "table" and options.announce == true
    local skipped = 0
    local published = 0
    for index, screen in ipairs(state.linkedScreens) do
        if hasMethod(screen, "setRenderScript") then
            if hasMethod(screen, "clearScriptOutput") then
                screen.clearScriptOutput()
            end
            screen.setRenderScript(script)
            published = published + 1
        else
            skipped = skipped + 1
        end
    end
    state.lastRenderedScript = script
    state.lastRenderPublishTick = state.renderTick or 0
    if announce and published > 0 then
        dp("Screen publish complete (" .. tostring(published) .. " screen(s))")
    end
    if skipped > 0 then
        dp("Skipped " .. tostring(skipped) .. " linked screen(s) without setRenderScript")
    end
    return published > 0, published > 0 and nil or "no_publish_target"
end

--  Input handling

function HudEditorBoard.onInputReceived(input)
    local ok, result = pcall(HudEditorBoard.processCommand, input)
    if not ok then
        dp("Command error: " .. tostring(result))
        return { status = "error", message = tostring(result) }
    end
    return result
end

--  Lifecycle

function HudEditorBoard.init(bootDocument)
    dp("Initializing HUD Editor Board")
    HudEditorBoard.refreshLinks(true)

    -- If boot document is provided, it overrides persisted state and becomes the new base document.
    if type(bootDocument) == "table" then
        state.document = normalizeDocumentMeta(deepCopy(bootDocument))
        if not state.document then
            error("boot document missing id")
        end
        state.mode = "editing"
        state.selectedId = nil
        state.isDirty = false
        if type(state.document.revision) ~= "number" then
            state.document.revision = 1
        end
        state.renderRevision = state.renderRevision + 1
        HudEditorBoard.persistToDatabank()
    else
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
    end

    if #state.linkedScreens > 0 then
        dp("Linked " .. tostring(#state.linkedScreens) .. " screen(s)")
        local startupScript, startupError = HudEditorBoard.buildRenderScript()
        if startupScript then
            local published = HudEditorBoard.publishRenderState(startupScript, { announce = true })
            if published then
                state.lastRenderError = nil
            end
        else
            state.lastRenderError = startupError or "no_render_script"
            dp("Initial screen publish skipped: " .. tostring(state.lastRenderError))
        end
    else
        dp("No screen linked - render output disabled")
    end

    if hasMethod(unit, "setTimer") then
        unit.setTimer("render", 0.5)  -- Slower initial render
        dp("Render loop armed")
    end
end

function HudEditorBoard.onTimer(timerName)
    if timerName == HudEditorBoard.DB_WRITE_TIMER then
        local ok, err = flushNextDatabankWrite()
        if not ok then
            dp("Databank queued write failed: " .. tostring(err))
        end
        return
    elseif timerName == "render" then
        state.renderTick = (state.renderTick or 0) + 1
        if #state.linkedScreens == 0 then
            HudEditorBoard.refreshLinks(false)
            unit.setTimer("render", 1.0)  -- Check again in 1 second
            return
        end
        local script, renderError = HudEditorBoard.buildRenderScript()
        if not script then
            renderError = renderError or "no_render_script"
            if state.lastRenderError ~= renderError then
                dp("Screen render skipped: " .. tostring(renderError))
                state.lastRenderError = renderError
            end
            unit.setTimer("render", 1.0)
            return
        end
        state.lastRenderError = nil
        local scriptChanged = script ~= state.lastRenderedScript
        local forcePublish = ((state.renderTick or 0) - (state.lastRenderPublishTick or 0)) >= SCREEN_REPUBLISH_TICKS
        local republishScript = scriptChanged or forcePublish
        if republishScript then
            local published = HudEditorBoard.publishRenderState(script)
            if published then
                state.lastRenderError = nil
            end
        end
        unit.setTimer("render", 0.1)  -- ~10fps render updates
    end
end

function HudEditorBoard.buildRenderScript(document)
    local commandDoc = HudEditorBoard.buildScreenDocument(document)
    if not commandDoc then
        return nil, "no_document"
    end
    local script = "local D=" .. commandDoc .. [=[
local F={}
local I={}
local function G(s)
    s=math.max(1,math.floor(tonumber(s) or 16))
    local f=F[s]
    if not f then
        f=loadFont("Play",s)
        F[s]=f
    end
    return f
end
local function IM(path)
    if type(path)~="string" or path=="" then
        return nil
    end
    local image=I[path]
    if not image then
        image=loadImage(path)
        I[path]=image
    end
    return image
end
local function FC(l,c,d)
    c=c or d
    setNextFillColor(l,tonumber(c[1]) or d[1],tonumber(c[2]) or d[2],tonumber(c[3]) or d[3],tonumber(c[4]) or d[4])
end
local function SC(l,c,d)
    c=c or d
    setNextStrokeColor(l,tonumber(c[1]) or d[1],tonumber(c[2]) or d[2],tonumber(c[3]) or d[3],tonumber(c[4]) or d[4])
end
local function SX(v,s)
    return (tonumber(v) or 0)*s
end
local function ST(l,c,sc)
    local r=tonumber(c.rot) or 0
    if r~=0 then
        setNextRotation(l,r)
    end
    local sh=c.sh
    local sca=sh and sh.c or nil
    local blur=sh and tonumber(sh.b) or 0
    if sca and blur and blur>0 then
        setNextShadow(
            l,
            math.max(0, blur*sc),
            tonumber(sca[1]) or 0,
            tonumber(sca[2]) or 0,
            tonumber(sca[3]) or 0,
            tonumber(sca[4]) or 0
        )
    end
end
local function TX(l,c,sc,sx,sy)
    local lines=c.l
    if not lines or #lines==0 then return end
    ST(l,c,sc)
    SC(l,c.s,{0,0,0,0})
    setNextStrokeWidth(l,math.max(0,(tonumber(c.sw) or 0)*sc))
    local s=math.max(1,math.floor((tonumber(c.ts) or 16)*sc+0.5))
    local f=G(s)
    if not f then return end
    local a=c.ta or "left"
    local va=c.tv or "center"
    local x=SX(c.x,sx)+12*sc
    local h=AlignH_Left
    local v=AlignV_Middle
    local w=SX(c.w,sx)
    if a=="center" then
        x=SX(c.x,sx)+w*0.5
        h=AlignH_Center
    elseif a=="right" then
        x=SX(c.x,sx)+w-12*sc
        h=AlignH_Right
    end
    if va=="top" then
        v=AlignV_Top
    elseif va=="bottom" then
        v=AlignV_Bottom
    end
    local g=math.max(2,math.floor(s*0.2))
    local blockHeight=#lines*s+(#lines-1)*g
    local y=SX(c.y,sy)+SX(c.h,sy)*0.5-(blockHeight-s)*0.5
    if va=="top" then
        y=SX(c.y,sy)+12*sc
    elseif va=="bottom" then
        y=SX(c.y,sy)+SX(c.h,sy)-12*sc-(blockHeight-s)
    end
    local tc=c.tc or {1,1,1,1}
    for i=1,#lines do
        setNextTextAlign(l,h,v)
        FC(l,tc,{1,1,1,1})
        addText(l,f,tostring(lines[i] or ""),x,y+(i-1)*(s+g))
    end
end
local function SH(l,c,sc,sx,sy)
    ST(l,c,sc)
    FC(l,c.f,{0.2,0.2,0.2,1})
    SC(l,c.s,{1,1,1,1})
    setNextStrokeWidth(l,math.max(0,(tonumber(c.sw) or 0)*sc))
    local x=SX(c.x,sx)
    local y=SX(c.y,sy)
    local w=SX(c.w,sx)
    local h=SX(c.h,sy)
    local k=c.k or "box"
    if k=="circle" then
        addCircle(l,x+w*0.5,y+h*0.5,math.min(w,h)*0.5)
    elseif k=="boxRounded" then
        addBoxRounded(l,x,y,w,h,math.max(0,(tonumber(c.r) or 0)*sc))
    elseif k=="triangle" then
        addTriangle(l,x,y,x+w,y,x,y+h)
    elseif k=="quad" then
        local qi=tonumber(c.qi) or 0.125
        addQuad(l,x,y,x+w*(1-qi),y+h*qi,x+w,y+h,x+w*qi,y+h*(1-qi))
    else
        addBox(l,x,y,w,h)
    end
end
local function BZ(l,c,sc,sx,sy)
    ST(l,c,sc)
    SC(l,c.s,{1,1,1,1})
    setNextStrokeWidth(l,math.max(1,(tonumber(c.sw) or 2)*sc))
    local x=SX(c.x,sx)
    local y=SX(c.y,sy)
    local w=SX(c.w,sx)
    local h=SX(c.h,sy)
    addBezier(l,x,y+h,x+w*0.5,y,x+w,y+h)
end
local function LN(l,c,sc,sx,sy)
    ST(l,c,sc)
    SC(l,c.s,{1,1,1,1})
    setNextStrokeWidth(l,math.max(1,(tonumber(c.sw) or 2)*sc))
    local x=SX(c.x,sx)
    local y=SX(c.y,sy)
    addLine(l,x,y,x+SX(c.w,sx),y+SX(c.h,sy))
end
local function IG(l,c,sc,sx,sy)
    if c.f then
        FC(l,c.f,{0.2,0.2,0.2,1})
    end
    ST(l,c,sc)
    local image=IM(c.src)
    if not image then
        return
    end
    addImage(l,image,SX(c.x,sx),SX(c.y,sy),SX(c.w,sx),SX(c.h,sy))
end
local rx,ry=getResolution()
setBackgroundColor(0,0,0)
local dw=math.max(1,tonumber(D.w) or rx)
local dh=math.max(1,tonumber(D.h) or ry)
local sx=rx/dw
local sy=ry/dh
local sc=math.min(sx,sy)
local layer=createLayer()
for i=1,#(D.c or {}) do
    local c=D.c[i]
    if c then
        local op=c.o or "shape"
        if op=="text" then
            TX(layer,c,sc,sx,sy)
        elseif op=="line" then
            LN(layer,c,sc,sx,sy)
        elseif op=="bezier" then
            BZ(layer,c,sc,sx,sy)
        elseif op=="image" then
            IG(layer,c,sc,sx,sy)
        else
            SH(layer,c,sc,sx,sy)
        end
    end
end
]=]
    if #script > SCREEN_SCRIPT_LIMIT then
        return nil, "screen_script_too_long:" .. tostring(#script)
    end
    return script, nil
end
