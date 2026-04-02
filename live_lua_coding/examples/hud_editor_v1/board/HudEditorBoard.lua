-- HudEditorBoard.lua
-- Library onStart handler Board script for Paint-with-Lua HUD Editor
-- Handles: command processing, element state, databank persistence, screen rendering
-- Project: D:\github\du-tobi\live_lua_coding\examples\hud_editor_v1

local HudEditorBoard = {}
HudEditorBoard.__index = HudEditorBoard

--  Constants

HudEditorBoard.COMMAND_PREFIX = "he:"  -- All HUD editor commands start with "he:"
HudEditorBoard.DB_KEY_DOC = "hud_editor:document"
HudEditorBoard.DB_KEY_INDEX = "hud_editor:index"
HudEditorBoard.DB_KEY_DOC_PREFIX = "hud_editor:document:"

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
    target.setStringValue(key, tostring(value or ""))
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
    local ok, className = pcall(slot.getClass, slot)
    if ok and type(className) == "string" and className ~= "" then
        return string.lower(className)
    end
    return nil
end

local function getElementId(slot)
    if not hasMethod(slot, "getLocalId") then
        return nil
    end
    local ok, id = pcall(slot.getLocalId, slot)
    if ok then
        return id
    end
    return nil
end

local function resolveElementName(core, localId)
    if localId == nil or not hasMethod(core, "getElementNameById") then
        return nil
    end
    local ok, name = pcall(core.getElementNameById, core, localId)
    if ok and type(name) == "string" and name ~= "" then
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
    lastRenderedInput = nil,
    lastRenderError = nil,
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
    local links = scanUnitLinks()
    state.links = links
    state.linkedScreens = links.screens or {}
    state.databank = links.primaryDatabank
    state.databankAvailable = hasDatabankIo(state.databank)
    if _ENV then
        _ENV.HudEditorLinks = links
        _ENV.Screens = state.linkedScreens
        _ENV.Screen = links.primaryScreen
        _ENV.Databanks = links.databanks
        _ENV.databank = state.databank
    end
    if verbose then
        local screenInfo = tostring(#state.linkedScreens)
        local dbInfo = tostring(#(links.databanks or {}))
        dp("Link scan: " .. screenInfo .. " screen(s), " .. dbInfo .. " databank(s)")
        if links.primaryScreen then
            dp("Primary screen: " .. tostring(links.primaryScreen.elementName or links.primaryScreen.slotName))
        end
        if state.databank then
            dp("Primary databank: " .. tostring(state.databank.elementName or state.databank.slotName))
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
    databankSet(db, HudEditorBoard.DB_KEY_DOC, docPayload)
    databankSet(db, docKey, docPayload)
    writeDatabankIndex(db, upsertDatabankIndex(readDatabankIndex(db), doc.id, doc))
    state.document = doc
    dp("Persisted document revision " .. tostring(doc.revision))
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

    local docJson = databankGet(db, HudEditorBoard.DB_KEY_DOC)
    if not docJson or docJson == "" then
        return nil
    end

    local ok, loadedDoc = pcall(HudEditorBoard.deserializeDocument, docJson)
    if ok and loadedDoc then
        loadedDoc = normalizeDocumentMeta(loadedDoc)
        if loadedDoc then
            dp("Restored document revision " .. tostring(loadedDoc.revision))
            return loadedDoc
        end
    end
    dp("Failed to restore document: " .. tostring(loadedDoc))
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

local function serializeScreenElement(element)
    if type(element) ~= "table" then
        return nil
    end
    local parts = { "{" }
    append(parts, "t=")
    append(parts, luaString(element.type or "box"))
    append(parts, ",x=")
    append(parts, luaNumber(element.x, 0))
    append(parts, ",y=")
    append(parts, luaNumber(element.y, 0))
    append(parts, ",w=")
    append(parts, luaNumber(element.w, 0))
    append(parts, ",h=")
    append(parts, luaNumber(element.h, 0))
    if element.visible == false then
        append(parts, ",v=false")
    end
    if element.radius ~= nil then
        append(parts, ",r=")
        append(parts, luaNumber(element.radius, 0))
    end
    if element.fill ~= nil then
        append(parts, ",f=")
        append(parts, serializeScreenColor(element.fill, SCREEN_DEFAULT_FILL))
    end
    if element.stroke ~= nil then
        append(parts, ",s=")
        append(parts, serializeScreenColor(element.stroke, SCREEN_DEFAULT_STROKE))
    end
    if element.strokeWidth ~= nil then
        append(parts, ",sw=")
        append(parts, luaNumber(element.strokeWidth, 0))
    end
    local textLines = serializeScreenTextLines(element.textLines)
    if textLines then
        append(parts, ",l=")
        append(parts, textLines)
    end
    if element.textColor ~= nil then
        append(parts, ",tc=")
        append(parts, serializeScreenColor(element.textColor, SCREEN_DEFAULT_TEXT))
    end
    if element.textSize ~= nil then
        append(parts, ",ts=")
        append(parts, luaNumber(element.textSize, 16))
    end
    if type(element.textAlign) == "string" and element.textAlign ~= "" then
        append(parts, ",ta=")
        append(parts, luaString(element.textAlign))
    end
    append(parts, "}")
    return table.concat(parts)
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
        ",e={"
    }
    local elements = type(doc.elements) == "table" and doc.elements or {}
    for index = 1, #elements do
        if index > 1 then
            append(parts, ",")
        end
        append(parts, serializeScreenElement(elements[index]) or "{}")
    end
    append(parts, "}}")
    return table.concat(parts)
end

function HudEditorBoard.buildRenderInput(document)
    return HudEditorBoard.buildScreenDocument(document)
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
        dp("Loaded boot document from exported HUD layout")
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
    else
        dp("No screen linked - render output disabled")
    end

    if hasMethod(unit, "setTimer") then
        unit.setTimer("render", 0.5)  -- Slower initial render
        dp("Render loop armed")
    end
end

function HudEditorBoard.onTimer(timerName)
    if timerName == "render" then
        state.renderTick = (state.renderTick or 0) + 1
        if #state.linkedScreens == 0 then
            HudEditorBoard.refreshLinks(false)
            unit.setTimer("render", 1.0)  -- Check again in 1 second
            return
        end
        local script, renderError = HudEditorBoard.buildRenderScript()
        local renderInput = script and HudEditorBoard.buildRenderInput() or nil
        if not script or not renderInput then
            renderError = renderError or "no_render_input"
            if state.lastRenderError ~= renderError then
                dp("Screen render skipped: " .. tostring(renderError))
                state.lastRenderError = renderError
            end
            unit.setTimer("render", 1.0)
            return
        end
        state.lastRenderError = nil
        local scriptChanged = script ~= state.lastRenderedScript
        local inputChanged = renderInput ~= state.lastRenderedInput
        local forcePublish = ((state.renderTick or 0) - (state.lastRenderPublishTick or 0)) >= SCREEN_REPUBLISH_TICKS
        if scriptChanged or inputChanged or forcePublish then
            state.lastRenderedScript = script
            state.lastRenderedInput = renderInput
            state.lastRenderPublishTick = state.renderTick or 0
            local skipped = 0
            for _, screen in ipairs(state.linkedScreens) do
                if hasMethod(screen, "setRenderScript") then
                    if hasMethod(screen, "clearScriptOutput") then
                        screen.clearScriptOutput()
                    end
                    if scriptChanged or forcePublish then
                        screen.setRenderScript(script)
                    end
                    if hasMethod(screen, "setScriptInput") then
                        screen.setScriptInput(renderInput)
                    end
                else
                    skipped = skipped + 1
                end
            end
            if skipped > 0 then
                dp("Skipped " .. tostring(skipped) .. " linked screen(s) without setRenderScript")
            end
        end
        unit.setTimer("render", 0.1)  -- ~10fps render updates
    end
end

function HudEditorBoard.buildRenderScript(document)
    if not HudEditorBoard.buildRenderInput(document) then
        return nil, "no_document"
    end
    local script = [=[
local D=nil
local DI=nil
local DE=""
local DW=0
local F={}
local function G(s)
    s=math.max(1,math.floor(tonumber(s) or 16))
    local f=F[s]
    if not f then
        f=loadFont("Play",s)
        F[s]=f
    end
    return f
end
local function FC(l,c,d)
    c=c or d
    setNextFillColor(l,tonumber(c[1]) or d[1],tonumber(c[2]) or d[2],tonumber(c[3]) or d[3],tonumber(c[4]) or d[4])
end
local function SC(l,c,d)
    c=c or d
    setNextStrokeColor(l,tonumber(c[1]) or d[1],tonumber(c[2]) or d[2],tonumber(c[3]) or d[3],tonumber(c[4]) or d[4])
end
local function P(raw)
    if type(raw)~="string" or raw=="" then
        return nil,"no_input"
    end
    local loader,err=load("return "..raw,"@HudEditorScreenInput","t",{})
    if not loader then
        return nil,err
    end
    local ok,val=pcall(loader)
    if not ok then
        return nil,val
    end
    if type(val)~="table" then
        return nil,"bad_input_type"
    end
    return val,nil
end
local function RD()
    local raw=""
    if type(getInput)=="function" then
        local ok,val=pcall(getInput)
        if ok and type(val)=="string" then
            raw=val
        end
    end
    if raw~=DI then
        DI=raw
        local doc,err=P(raw)
        D=doc
        DE=doc and "" or tostring(err or "input_error")
    end
    return D,DE,raw
end
local function SX(v,s)
    return (tonumber(v) or 0)*s
end
local function TX(l,e,sc,sx,sy)
    local lines=e.l
    if not lines or #lines==0 then return end
    local s=math.max(1,math.floor((tonumber(e.ts) or 16)*sc+0.5))
    local f=G(s)
    if not f then return end
    local a=e.ta or "left"
    local x=SX(e.x,sx)+12*sc
    local h=AlignH_Left
    local w=SX(e.w,sx)
    if a=="center" then
        x=SX(e.x,sx)+w*0.5
        h=AlignH_Center
    elseif a=="right" then
        x=SX(e.x,sx)+w-12*sc
        h=AlignH_Right
    end
    setNextTextAlign(l,h,AlignV_Middle)
    local g=math.max(2,math.floor(s*0.2))
    local y=SX(e.y,sy)+SX(e.h,sy)*0.5-((#lines-1)*(s+g))*0.5
    local c=e.tc or {1,1,1,1}
    for i=1,#lines do
        FC(l,c,{1,1,1,1})
        addText(l,f,tostring(lines[i] or ""),x,y+(i-1)*(s+g))
    end
end
local function ER(rx,ry,msg)
    local l=createLayer()
    FC(l,{0.1,0.1,0.12,1},{0.1,0.1,0.12,1})
    addBoxRounded(l,24,24,math.max(80,rx-48),math.max(80,ry-48),20)
    SC(l,{0.92,0.28,0.28,1},{0.92,0.28,0.28,1})
    setNextStrokeWidth(l,2)
    addBoxRounded(l,24,24,math.max(80,rx-48),math.max(80,ry-48),20)
    FC(l,{1,0.85,0.85,1},{1,0.85,0.85,1})
    setNextTextAlign(l,AlignH_Center,AlignV_Middle)
    addText(l,G(math.max(14,math.floor(math.min(rx,ry)*0.05))),tostring(msg or "SCREEN INPUT ERROR"),rx*0.5,ry*0.5)
end
local rx,ry=getResolution()
setBackgroundColor(0,0,0)
local doc,err,raw=RD()
if not doc then
    ER(rx,ry,raw=="" and "HUD EDITOR: NO INPUT" or "HUD EDITOR: INPUT ERROR")
    if raw=="" and type(requestAnimationFrame)=="function" then
        DW=(DW or 0)+1
        if DW<=10 then
            requestAnimationFrame(1)
        end
    else
        DW=0
    end
    return
end
DW=0
local dw=math.max(1,tonumber(doc.w) or rx)
local dh=math.max(1,tonumber(doc.h) or ry)
local sx=rx/dw
local sy=ry/dh
local sc=math.min(sx,sy)
for i=1,#(doc.e or {}) do
    local e=doc.e[i]
    if e and e.v~=false then
        local l=createLayer()
        local t=e.t or "box"
        if t=="text" then
            TX(l,e,sc,sx,sy)
        elseif t=="line" then
            SC(l,e.s,{1,1,1,1})
            setNextStrokeWidth(l,math.max(1,(tonumber(e.sw) or 2)*sc))
            local x=SX(e.x,sx)
            local y=SX(e.y,sy)
            addLine(l,x,y,x+SX(e.w,sx),y+SX(e.h,sy))
            TX(l,e,sc,sx,sy)
        else
            FC(l,e.f,{0.2,0.2,0.2,1})
            SC(l,e.s,{1,1,1,1})
            setNextStrokeWidth(l,math.max(0,(tonumber(e.sw) or 0)*sc))
            local x=SX(e.x,sx)
            local y=SX(e.y,sy)
            local w=SX(e.w,sx)
            local h=SX(e.h,sy)
            if t=="circle" then
                addCircle(l,x+w*0.5,y+h*0.5,math.min(w,h)*0.5)
            elseif t=="boxRounded" then
                addBoxRounded(l,x,y,w,h,math.max(0,(tonumber(e.r) or 0)*sc))
            else
                addBox(l,x,y,w,h)
            end
            TX(l,e,sc,sx,sy)
        end
    end
end
]=]
    if #script > SCREEN_SCRIPT_LIMIT then
        return nil, "screen_script_too_long:" .. tostring(#script)
    end
    return script, nil
end

--  Module export

if _ENV then
    _ENV.HudEditorBoard = HudEditorBoard
end
if package and package.loaded then
    package.loaded["HudEditorBoard"] = HudEditorBoard
end

return HudEditorBoard
