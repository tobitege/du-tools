system.print("------------------------------------")
system.print("SLE Form Editor v2")
system.print("Customized by tobitege 2026-03-29")
system.print("------------------------------------")
-------------------------------------------------------------------------------------

SLE_DIAG = true --export Set to true to log SLE diagnostics to Lua chat
SLE_LOG_LEVEL = "info" --export SLE chat level: debug, info, error
SLE_BUILD = "0329l" --export Short live build marker for SLE diagnostics

-------------------------------------------------------------------------------------

SLE_DIAG = SLE_DIAG ~= false
SLE_DIAG_LAST = type(SLE_DIAG_LAST) == "table" and SLE_DIAG_LAST or {}
SLE_LOG_LEVEL = string.lower(tostring(SLE_LOG_LEVEL or "error"))
SLE_BUILD = tostring(SLE_BUILD or "0328l")

local SLE_LEVEL_RANK = {
    debug = 1,
    info = 2,
    error = 3
}

local function SLEShouldPrint(level)
    local wanted = SLE_LEVEL_RANK[SLE_LOG_LEVEL] or SLE_LEVEL_RANK.info
    local current = SLE_LEVEL_RANK[string.lower(tostring(level or "debug"))] or SLE_LEVEL_RANK.debug
    return current >= wanted
end

local function SLEP(key, text, levelOrForce, force)
    if not SLE_DIAG then
        return
    end
    if type(system) ~= "table" or type(system.print) ~= "function" then
        return
    end
    local level = "debug"
    local sticky = force == true
    if type(levelOrForce) == "boolean" then
        sticky = levelOrForce
    elseif type(levelOrForce) == "string" and levelOrForce ~= "" then
        level = string.lower(levelOrForce)
    end
    if not SLEShouldPrint(level) then
        return
    end
    local normalizedKey = tostring(key or text or "")
    local normalizedText = tostring(text or "")
    if not sticky and SLE_DIAG_LAST[normalizedKey] == normalizedText then
        return
    end
    SLE_DIAG_LAST[normalizedKey] = normalizedText
    system.print("[SLE] " .. normalizedText)
end

local function SLETrimDebugText(value, maxLength)
    local text = tostring(value or "")
    local limit = math.max(16, math.floor(tonumber(maxLength) or 160))
    if #text <= limit then
        return text
    end
    return text:sub(1, limit) .. "..."
end

Screens = {}
databank = nil
for slot, element in pairs(unit) do
    if type(element) == "table"
        and type(element.export) == "table"
        and type(element.getClass) == "function" then
        local className = element.getClass()
        if className == "ScreenUnit" then
            if not Screen then
                Screen = element
            end
            Screens[#Screens + 1] = element
            element.activate()
        elseif string.lower(tostring(className)) == "databankunit" then
            databank = element
        end
    end
end


local function BuildScreenLayoutEditorRenderSource()
    local source = SCREEN_LAYOUT_EDITOR_SOURCE
    local function cutBetween(text, startMarker, endMarker)
        local startIndex = string.find(text, startMarker, 1, true)
        if not startIndex then
            return text
        end
        local endIndex = string.find(text, endMarker, startIndex + #startMarker, true)
        if not endIndex then
            return text
        end
        return text:sub(1, startIndex - 1) .. text:sub(endIndex)
    end
    source = cutBetween(
        source,
        "function ScreenLayoutEditor.serializeDocument(",
        "function ScreenLayoutEditor.hashText("
    )
    source = cutBetween(
        source,
        "function ScreenLayoutEditor.serializeOutputEnvelope(",
        "function ScreenLayoutEditor.findElement("
    )
    return source
end

function BuildEditableRenderScript(instanceTag)
    local tag = tostring(instanceTag or "")
    if tag ~= "" then
        return string.format("-- sle-instance:%s\n", tag) .. BuildScreenLayoutEditorRenderSource()
    end
    return BuildScreenLayoutEditorRenderSource()
end

if not Screen then
    system.print("ERROR: No Screen linked!")
    unit.exit()
    return
end

SCREEN_LAYOUT_EDITOR_SOURCE = [====[
local ScreenLayoutEditor = {}
local SLE = ScreenLayoutEditor
SCREEN_LAYOUT_EDITOR_MODULE = ScreenLayoutEditor

SLE.SCHEMA_VERSION = 1
SLE.OUTPUT_KIND = "sled"
SLE.LEGACY_OUTPUT_KIND = "screen_layout_editor_doc"
SLE.INPUT_KIND = "slei"
SLE.TRANSPORT_KIND = "sd"
SLE.PERSISTENCE_DB_KEY = "screen_layout_editor:document"
SLE.DEFAULT_MARGIN = 8

local UINT32_MOD = 4294967296

local function clamp(value, minimum, maximum)
    if value < minimum then
        return minimum
    end
    if value > maximum then
        return maximum
    end
    return value
end

local function append(parts, value)
    parts[#parts + 1] = value
end

local function isNumber(value)
    return type(value) == "number" and value == value and value ~= math.huge and value ~= -math.huge
end

local function numberOrNil(value)
    local numeric = tonumber(value)
    if isNumber(numeric) then
        return numeric
    end
    return nil
end

local function roundInt(value)
    local numeric = numberOrNil(value) or 0
    if numeric >= 0 then
        return math.floor(numeric + 0.5)
    end
    return math.ceil(numeric - 0.5)
end

local function encodeBase36(value)
    local numeric = math.max(0, roundInt(value))
    if numeric == 0 then
        return "0"
    end
    local chars = {}
    while numeric > 0 do
        local digit = numeric % 36
        chars[#chars + 1] = string.char(digit < 10 and (48 + digit) or (87 + digit))
        numeric = math.floor(numeric / 36)
    end
    local parts = {}
    for index = #chars, 1, -1 do
        parts[#parts + 1] = chars[index]
    end
    return table.concat(parts)
end

local function serializeNumber(value)
    local numeric = numberOrNil(value) or 0
    if math.floor(numeric) == numeric then
        return tostring(numeric)
    end
    local text = string.format("%.6f", numeric)
    text = text:gsub("0+$", ""):gsub("%.$", "")
    if text == "-0" then
        return "0"
    end
    return text
end

local function serializeString(value)
    return string.format("%q", tostring(value or ""))
end

local function splitTextLines(text)
    if type(text) ~= "string" or text == "" then
        return nil
    end
    local normalized = text:gsub("\r\n", "\n")
    local lines = {}
    local startIndex = 1
    while true do
        local newlineIndex = normalized:find("\n", startIndex, true)
        if not newlineIndex then
            lines[#lines + 1] = normalized:sub(startIndex)
            break
        end
        lines[#lines + 1] = normalized:sub(startIndex, newlineIndex - 1)
        startIndex = newlineIndex + 1
    end
    return lines
end

local function cloneStringArray(lines)
    if type(lines) ~= "table" then
        return nil
    end
    local copy = {}
    for index = 1, #lines do
        copy[#copy + 1] = tostring(lines[index] or "")
    end
    if #copy <= 0 then
        return nil
    end
    return copy
end

local function cloneColor(value, fallback)
    local source = type(value) == "table" and value or fallback
    if type(source) ~= "table" then
        return nil
    end
    return {
        numberOrNil(source[1]) or 0,
        numberOrNil(source[2]) or 0,
        numberOrNil(source[3]) or 0,
        numberOrNil(source[4]) or 1
    }
end

local function getArkTimeSeconds()
    if type(system) ~= "table" or type(system.getArkTime) ~= "function" then
        return nil
    end
    local ok, arkTime = pcall(system.getArkTime)
    if ok and type(arkTime) == "number" then
        return arkTime
    end
    return nil
end

local function serializeColor(color)
    if type(color) ~= "table" then
        return nil
    end
    return string.format(
        "{%s,%s,%s,%s}",
        serializeNumber(color[1]),
        serializeNumber(color[2]),
        serializeNumber(color[3]),
        serializeNumber(color[4])
    )
end

local function serializeStringArray(lines)
    if type(lines) ~= "table" or #lines <= 0 then
        return nil
    end
    local parts = { "{" }
    for index = 1, #lines do
        if index > 1 then
            append(parts, ",")
        end
        append(parts, serializeString(lines[index]))
    end
    append(parts, "}")
    return table.concat(parts)
end

function ScreenLayoutEditor.computeMetrics(screenWidth, screenHeight)
    return {
        screenWidth = screenWidth,
        screenHeight = screenHeight,
        margin = ScreenLayoutEditor.DEFAULT_MARGIN,
        handleSize = math.max(12, math.floor(screenHeight / 48)),
        minWidth = math.max(42, math.floor(screenWidth / 36)),
        minHeight = math.max(28, math.floor(screenHeight / 42)),
        selectionPadding = math.max(8, math.floor(screenWidth / 200))
    }
end

function ScreenLayoutEditor.createDefaultDocument(screenWidth, screenHeight)
    local sx = screenWidth / 1920
    local sy = screenHeight / 1080
    local function px(value)
        return math.floor(value * sx + 0.5)
    end
    local function py(value)
        return math.floor(value * sy + 0.5)
    end

    return {
        version = ScreenLayoutEditor.SCHEMA_VERSION,
        revision = 0,
        selectedId = "main_canvas",
        screenWidth = screenWidth,
        screenHeight = screenHeight,
        elements = {
            {
                id = "main_canvas",
                type = "boxRounded",
                x = px(80), y = py(80), w = px(1760), h = py(920), radius = px(20),
                fill = { 0.10, 0.11, 0.12, 0.98 },
                stroke = { 0.70, 0.72, 0.76, 1.00 },
                strokeWidth = px(3),
                textLines = { "SLE" },
                textColor = { 0.86, 0.88, 0.92, 1.00 },
                textSize = px(26),
                textAlign = "center",
            }
        }
    }
end

local function normalizeElement(rawElement, index)
    if type(rawElement) ~= "table" then
        return nil
    end

    local x = numberOrNil(rawElement.x)
    local y = numberOrNil(rawElement.y)
    local w = numberOrNil(rawElement.w)
    local h = numberOrNil(rawElement.h)
    if not x or not y or not w or not h then
        return nil
    end

    local textLines = cloneStringArray(rawElement.textLines or rawElement.l)
    if not textLines and type(rawElement.text) == "string" then
        textLines = splitTextLines(rawElement.text)
    end

    local elementType = tostring(rawElement.type or rawElement.t or rawElement.kind or "boxRounded")
    if elementType == "rect" then
        elementType = "boxRounded"
    end

    local element = {
        id = tostring(rawElement.id or rawElement.i or ("element_" .. tostring(index))),
        type = elementType,
        x = x,
        y = y,
        w = w,
        h = h
    }

    local radius = numberOrNil(rawElement.radius or rawElement.r)
    if radius then
        element.radius = radius
    end

    local strokeWidth = numberOrNil(rawElement.strokeWidth or rawElement.sw)
    if strokeWidth then
        element.strokeWidth = strokeWidth
    end

    local textSize = numberOrNil(rawElement.textSize or rawElement.ts)
    if textSize then
        element.textSize = textSize
    end

    local lineGap = numberOrNil(rawElement.lineGap or rawElement.lg)
    if lineGap then
        element.lineGap = lineGap
    end

    element.fill = cloneColor(rawElement.fill or rawElement.f, { 0.2, 0.2, 0.2, 1.0 })
    element.stroke = cloneColor(rawElement.stroke or rawElement.s, { 1.0, 1.0, 1.0, 1.0 })
    element.textColor = cloneColor(rawElement.textColor or rawElement.tc or rawElement.c, { 1.0, 1.0, 1.0, 1.0 })

    if textLines then
        element.textLines = textLines
    end

    local textAlign = rawElement.textAlign or rawElement.ta
    if type(textAlign) == "string" and textAlign ~= "" then
        element.textAlign = textAlign
    elseif textLines then
        element.textAlign = "center"
    end

    local movable = rawElement.movable
    if movable == nil then
        movable = rawElement.m
    end
    if movable ~= nil then
        element.movable = not not movable
    end

    local resizable = rawElement.resizable
    if resizable == nil then
        resizable = rawElement.z
    end
    if resizable ~= nil then
        element.resizable = not not resizable
    end

    return element
end

function ScreenLayoutEditor.normalizeDocument(rawDocument, screenWidth, screenHeight)
    local fallback = ScreenLayoutEditor.createDefaultDocument(screenWidth or 1920, screenHeight or 1080)
    if type(rawDocument) ~= "table" then
        return fallback
    end

    local rawElements = rawDocument.elements or rawDocument.e
    local elements = {}
    if type(rawElements) == "table" then
        for index = 1, #rawElements do
            local normalized = normalizeElement(rawElements[index], index)
            if normalized then
                elements[#elements + 1] = normalized
            end
        end
    end

    if #elements <= 0 then
        return fallback
    end

    local rawSelectedId = rawDocument.selectedId or rawDocument.s
    local selectedId = nil
    if type(rawSelectedId) == "string" and rawSelectedId ~= "" then
        for index = 1, #elements do
            if elements[index].id == rawSelectedId then
                selectedId = rawSelectedId
                break
            end
        end
    end

    return {
        version = ScreenLayoutEditor.SCHEMA_VERSION,
        revision = math.max(0, math.floor(numberOrNil(rawDocument.revision or rawDocument.r) or 0)),
        selectedId = selectedId,
        screenWidth = math.max(1, math.floor(numberOrNil(rawDocument.screenWidth or rawDocument.sw) or screenWidth or fallback.screenWidth or 1920)),
        screenHeight = math.max(1, math.floor(numberOrNil(rawDocument.screenHeight or rawDocument.sh) or screenHeight or fallback.screenHeight or 1080)),
        elements = elements
    }
end

local function isEditableElement(element)
    return type(element) == "table" and (element.movable ~= false or element.resizable ~= false)
end

local function serializeElement(element)
    local parts = { "{" }
    append(parts, "i=")
    append(parts, serializeString(element.id))
    append(parts, ",t=")
    append(parts, serializeString(element.type))
    append(parts, ",x=")
    append(parts, serializeNumber(element.x))
    append(parts, ",y=")
    append(parts, serializeNumber(element.y))
    append(parts, ",w=")
    append(parts, serializeNumber(element.w))
    append(parts, ",h=")
    append(parts, serializeNumber(element.h))

    if isNumber(element.radius) then
        append(parts, ",r=")
        append(parts, serializeNumber(element.radius))
    end

    local fill = serializeColor(element.fill)
    if fill then
        append(parts, ",f=")
        append(parts, fill)
    end

    local stroke = serializeColor(element.stroke)
    if stroke then
        append(parts, ",s=")
        append(parts, stroke)
    end

    if isNumber(element.strokeWidth) then
        append(parts, ",sw=")
        append(parts, serializeNumber(element.strokeWidth))
    end

    local textLines = serializeStringArray(element.textLines)
    if textLines then
        append(parts, ",l=")
        append(parts, textLines)
    end

    local textColor = serializeColor(element.textColor)
    if textColor then
        append(parts, ",c=")
        append(parts, textColor)
    end

    if isNumber(element.textSize) then
        append(parts, ",ts=")
        append(parts, serializeNumber(element.textSize))
    end

    if type(element.textAlign) == "string" and element.textAlign ~= "" then
        append(parts, ",ta=")
        append(parts, serializeString(element.textAlign))
    end

    if isNumber(element.lineGap) then
        append(parts, ",lg=")
        append(parts, serializeNumber(element.lineGap))
    end

    if element.movable ~= nil then
        append(parts, ",m=")
        append(parts, tostring(not not element.movable))
    end

    if element.resizable ~= nil then
        append(parts, ",z=")
        append(parts, tostring(not not element.resizable))
    end

    append(parts, "}")
    return table.concat(parts)
end

local function normalizeDocumentForOutput(document, screenWidth, screenHeight)
    local normalized = SLE.normalizeDocument(document, screenWidth, screenHeight)
    if type(normalized) ~= "table" then
        normalized = SLE.createDefaultDocument(screenWidth or 1920, screenHeight or 1080)
    end

    local safeElements = {}
    if type(normalized.elements) == "table" then
        for index = 1, #normalized.elements do
            local element = normalized.elements[index]
            if type(element) == "table" then
                if type(element.id) ~= "string" or element.id == "" then
                    element.id = string.format("element_%d", index)
                end
                if type(element.type) ~= "string" or element.type == "" then
                    element.type = "boxRounded"
                end
                element.x = numberOrNil(element.x) or 0
                element.y = numberOrNil(element.y) or 0
                element.w = math.max(1, numberOrNil(element.w) or 1)
                element.h = math.max(1, numberOrNil(element.h) or 1)
                safeElements[#safeElements + 1] = element
            end
        end
    end

    if #safeElements <= 0 then
        local fallback = SLE.createDefaultDocument(
            normalized.screenWidth or screenWidth or 1920,
            normalized.screenHeight or screenHeight or 1080
        )
        safeElements = fallback.elements
        if type(normalized.selectedId) ~= "string" or normalized.selectedId == "" then
            normalized.selectedId = fallback.selectedId
        end
    end

    normalized.elements = safeElements
    if type(normalized.selectedId) ~= "string" or normalized.selectedId == "" then
        normalized.selectedId = safeElements[1] and safeElements[1].id or nil
    end

    return normalized
end

function ScreenLayoutEditor.serializeDocument(document)
    local normalized = normalizeDocumentForOutput(document)
    local parts = {
        "{v=",
        tostring(normalized.version),
        ",r=",
        tostring(normalized.revision)
    }

    if normalized.selectedId then
        append(parts, ",s=")
        append(parts, serializeString(normalized.selectedId))
    end

    append(parts, ",e={")
    for index = 1, #normalized.elements do
        if index > 1 then
            append(parts, ",")
        end
        append(parts, serializeElement(normalized.elements[index]))
    end
    append(parts, "}}")
    return table.concat(parts)
end

function ScreenLayoutEditor.hashText(text)
    local value = tostring(text or "")
    local hash = 5381
    for index = 1, #value do
        hash = ((hash * 33) + string.byte(value, index)) % UINT32_MOD
    end
    return hash
end

ScreenLayoutEditor.serializeDocument = ScreenLayoutEditor.serializeDocument or function(document)
    local d = normalizeDocumentForOutput(document)
    local p = { "{v=", tostring(d.version), ",r=", tostring(d.revision) }
    if d.selectedId then
        p[#p + 1] = ",s=" .. serializeString(d.selectedId)
    end
    p[#p + 1] = ",e={"
    for i = 1, #d.elements do
        p[#p + 1] = (i > 1 and "," or "") .. serializeElement(d.elements[i])
    end
    p[#p + 1] = "}}"
    return table.concat(p)
end

local function parseLuaTable(text, chunkName)
    if type(text) ~= "string" or text == "" then
        return nil, "empty"
    end
    local loader, loadError = load("return " .. text, chunkName or "sle", "t", {})
    if not loader then
        return nil, loadError
    end
    local ok, value = pcall(loader)
    if not ok then
        return nil, value
    end
    if type(value) ~= "table" then
        return nil, "not_table"
    end
    return value, nil
end

function ScreenLayoutEditor.deserializeDocument(text, screenWidth, screenHeight)
    local rawDocument, parseError = parseLuaTable(text, "sle_document")
    if not rawDocument then
        return nil, parseError
    end
    return SLE.normalizeDocument(rawDocument, screenWidth, screenHeight), nil
end

function ScreenLayoutEditor.serializeLayoutPatch(document)
    local normalized = SLE.normalizeDocument(document)
    local parts = {}
    for index = 1, #normalized.elements do
        local element = normalized.elements[index]
        if isEditableElement(element) then
            parts[#parts + 1] = string.format(
                "%s.%s.%s.%s",
                encodeBase36(element.x),
                encodeBase36(element.y),
                encodeBase36(element.w),
                encodeBase36(element.h)
            )
        end
    end
    return table.concat(parts, ";")
end

function ScreenLayoutEditor.deserializeLayoutPatch(text, screenWidth, screenHeight)
    if type(text) ~= "string" or text == "" then
        return nil, "empty_patch"
    end
    local document = SLE.createDefaultDocument(screenWidth or 1920, screenHeight or 1080)
    local startIndex = 1
    local patchCount = 0
    for index = 1, #document.elements do
        local element = document.elements[index]
        if isEditableElement(element) then
            local nextIndex = text:find(";", startIndex, true)
            local chunk = nextIndex and text:sub(startIndex, nextIndex - 1) or text:sub(startIndex)
            if chunk == "" then
                return nil, "patch_short"
            end
            local x, y, w, h = chunk:match("^([^%.]+)%.([^%.]+)%.([^%.]+)%.([^%.]+)$")
            x = x and tonumber(x, 36) or nil
            y = y and tonumber(y, 36) or nil
            w = w and tonumber(w, 36) or nil
            h = h and tonumber(h, 36) or nil
            if not x or not y or not w or not h then
                return nil, "patch_rect"
            end
            element.x = x
            element.y = y
            element.w = w
            element.h = h
            patchCount = patchCount + 1
            if not nextIndex then
                startIndex = #text + 1
                break
            end
            startIndex = nextIndex + 1
        end
    end
    if patchCount <= 0 then
        return nil, "patch_empty"
    end
    if startIndex <= #text then
        return nil, "patch_long"
    end
    return document, nil
end

function ScreenLayoutEditor.serializeOutputEnvelope(document, serializedDocument, hash)
    local normalized = normalizeDocumentForOutput(document)
    local docText = serializedDocument or SLE.serializeDocument(normalized)
    return docText
end

function ScreenLayoutEditor.serializeTransportDelta(document, elementId, screenWidth, screenHeight)
    local normalized = SLE.normalizeDocument(document, screenWidth, screenHeight)
    local deltaId = tostring(elementId or normalized.selectedId or "")
    for index = 1, #normalized.elements do
        local element = normalized.elements[index]
        if isEditableElement(element) then
            if element.id == deltaId then
                return string.format(
                    "d|%s|%s|%s|%s|%s|%s|%s|%s",
                    encodeBase36(normalized.revision or 0),
                    tostring(element.id),
                    encodeBase36(element.x),
                    encodeBase36(element.y),
                    encodeBase36(element.w),
                    encodeBase36(element.h),
                    encodeBase36(screenWidth or 1920),
                    encodeBase36(screenHeight or 1080)
                )
            end
        end
    end
    return ""
end

function ScreenLayoutEditor.parseOutputEnvelope(text, screenWidth, screenHeight)
    local document, parseError = SLE.deserializeDocument(text, screenWidth, screenHeight)
    if not document then
        return nil, parseError
    end
    local serialized = SLE.serializeDocument(document)
    local computedHash = SLE.hashText(serialized)
    return {
        kind = ScreenLayoutEditor.OUTPUT_KIND,
        version = ScreenLayoutEditor.SCHEMA_VERSION,
        revision = document.revision,
        hash = computedHash,
        serializedDocument = serialized,
        document = document
    }, nil
end

function ScreenLayoutEditor.readPersistedEnvelope(text, screenWidth, screenHeight)
    local envelope, parseError = SLE.parseOutputEnvelope(text, screenWidth, screenHeight)
    if not envelope then
        return nil, parseError
    end
    return {
        kind = ScreenLayoutEditor.OUTPUT_KIND,
        version = ScreenLayoutEditor.SCHEMA_VERSION,
        revision = envelope.revision,
        hash = envelope.hash,
        serializedDocument = envelope.serializedDocument,
        document = envelope.document,
        text = SLE.serializeOutputEnvelope(envelope.document, envelope.serializedDocument, envelope.hash)
    }, nil
end

function ScreenLayoutEditor.resolveMaxScreenCodeChars(value)
    local numeric = math.floor(numberOrNil(value) or 50000)
    if numeric <= 0 then
        return 50000
    end
    return numeric
end

function ScreenLayoutEditor.buildPersistenceRecord(document, maxScreenCodeChars)
    local normalized = SLE.normalizeDocument(document)
    local serialized = SLE.serializeDocument(normalized)
    local hash = SLE.hashText(serialized)
    local text = serialized
    local maxLength = SLE.resolveMaxScreenCodeChars(maxScreenCodeChars)
    return {
        key = SLE.PERSISTENCE_DB_KEY,
        version = SLE.SCHEMA_VERSION,
        revision = normalized.revision or 0,
        hash = hash,
        serializedDocument = serialized,
        text = text,
        length = #text,
        maxLength = maxLength,
        fits = #text <= maxLength
    }
end

function ScreenLayoutEditor.buildPersistenceRecordFromOutput(text, maxScreenCodeChars, screenWidth, screenHeight)
    local document, parseError = SLE.deserializeDocument(text, screenWidth, screenHeight)
    if not document then
        return nil, parseError
    end
    return SLE.buildPersistenceRecord(document, maxScreenCodeChars), nil
end

function ScreenLayoutEditor.canPersistDocument(document, maxScreenCodeChars)
    local record = SLE.buildPersistenceRecord(document, maxScreenCodeChars)
    return record.fits, record
end

function ScreenLayoutEditor.restorePersistedDocument(text, screenWidth, screenHeight)
    local envelope, parseError = SLE.parseOutputEnvelope(text, screenWidth, screenHeight)
    if not envelope then
        return nil, parseError
    end
    return envelope.document, nil
end

function ScreenLayoutEditor.findElement(document, elementId)
    if type(document) ~= "table" or type(document.elements) ~= "table" or type(elementId) ~= "string" then
        return nil, nil
    end
    for index = 1, #document.elements do
        local element = document.elements[index]
        if element.id == elementId then
            return element, index
        end
    end
    return nil, nil
end

local function pointInRect(px, py, x, y, w, h)
    return px >= x and px <= (x + w) and py >= y and py <= (y + h)
end

function ScreenLayoutEditor.getHandleRects(metrics, element)
    local cached = element._handleRectsCache
    if cached
        and cached._x == element.x and cached._y == element.y
        and cached._w == element.w and cached._h == element.h
        and cached._hs == metrics.handleSize then
        return cached
    end

    local handleSize = metrics.handleSize
    local half = handleSize * 0.5
    local handles = {
        nw = { x = element.x - half, y = element.y - half, w = handleSize, h = handleSize },
        ne = { x = element.x + element.w - half, y = element.y - half, w = handleSize, h = handleSize },
        sw = { x = element.x - half, y = element.y + element.h - half, w = handleSize, h = handleSize },
        se = { x = element.x + element.w - half, y = element.y + element.h - half, w = handleSize, h = handleSize },
        _x = element.x, _y = element.y, _w = element.w, _h = element.h, _hs = handleSize
    }
    element._handleRectsCache = handles
    return handles
end

function ScreenLayoutEditor.hitResizeHandle(metrics, element, cursorX, cursorY)
    local handles = ScreenLayoutEditor.getHandleRects(metrics, element)
    for handleName, rect in pairs(handles) do
        if type(rect) == "table" and pointInRect(cursorX, cursorY, rect.x, rect.y, rect.w, rect.h) then
            return handleName
        end
    end
    return nil
end

function ScreenLayoutEditor.pickTopmostElement(document, cursorX, cursorY)
    if type(document) ~= "table" or type(document.elements) ~= "table" then
        return nil
    end
    for index = #document.elements, 1, -1 do
        local element = document.elements[index]
        if pointInRect(cursorX, cursorY, element.x, element.y, element.w, element.h) then
            return element
        end
    end
    return nil
end

local function setRectIfChanged(element, newX, newY, newW, newH)
    local changed = false
    if isNumber(newX) and element.x ~= newX then
        element.x = newX
        changed = true
    end
    if isNumber(newY) and element.y ~= newY then
        element.y = newY
        changed = true
    end
    if isNumber(newW) and element.w ~= newW then
        element.w = newW
        changed = true
    end
    if isNumber(newH) and element.h ~= newH then
        element.h = newH
        changed = true
    end
    if changed then
        element._handleRectsCache = nil
    end
    return changed
end

local function beginDrag(state, element, cursorX, cursorY)
    state.document.selectedId = element.id
    state.operation = {
        kind = "drag",
        elementId = element.id,
        offsetX = cursorX - element.x,
        offsetY = cursorY - element.y
    }
end

local function beginResize(state, element, handleName)
    state.document.selectedId = element.id
    state.operation = {
        kind = "resize",
        elementId = element.id,
        handle = handleName,
        startX = element.x,
        startY = element.y,
        startW = element.w,
        startH = element.h
    }
end

local function updateDrag(state, element, cursorX, cursorY)
    local op = state.operation
    local metrics = state.metrics
    local newX = clamp(cursorX - op.offsetX, metrics.margin, metrics.screenWidth - element.w - metrics.margin)
    local newY = clamp(cursorY - op.offsetY, metrics.margin, metrics.screenHeight - element.h - metrics.margin)
    return setRectIfChanged(element, newX, newY, nil, nil)
end

local function updateResize(state, element, cursorX, cursorY)
    local op = state.operation
    local metrics = state.metrics
    local minWidth = metrics.minWidth
    local minHeight = metrics.minHeight
    local maxRight = metrics.screenWidth - metrics.margin
    local maxBottom = metrics.screenHeight - metrics.margin

    if op.handle == "se" then
        local newW = clamp(cursorX - op.startX, minWidth, maxRight - op.startX)
        local newH = clamp(cursorY - op.startY, minHeight, maxBottom - op.startY)
        return setRectIfChanged(element, nil, nil, newW, newH)
    end

    if op.handle == "sw" then
        local newX = clamp(cursorX, metrics.margin, op.startX + op.startW - minWidth)
        local newW = clamp((op.startX + op.startW) - newX, minWidth, maxRight - newX)
        local newH = clamp(cursorY - op.startY, minHeight, maxBottom - op.startY)
        return setRectIfChanged(element, newX, nil, newW, newH)
    end

    if op.handle == "ne" then
        local newY = clamp(cursorY, metrics.margin, op.startY + op.startH - minHeight)
        local newH = clamp((op.startY + op.startH) - newY, minHeight, maxBottom - newY)
        local newW = clamp(cursorX - op.startX, minWidth, maxRight - op.startX)
        return setRectIfChanged(element, nil, newY, newW, newH)
    end

    if op.handle == "nw" then
        local newX = clamp(cursorX, metrics.margin, op.startX + op.startW - minWidth)
        local newY = clamp(cursorY, metrics.margin, op.startY + op.startH - minHeight)
        local newW = clamp((op.startX + op.startW) - newX, minWidth, maxRight - newX)
        local newH = clamp((op.startY + op.startH) - newY, minHeight, maxBottom - newY)
        return setRectIfChanged(element, newX, newY, newW, newH)
    end

    return false
end

function ScreenLayoutEditor.commitDocument(state)
    if type(state) ~= "table" or type(state.document) ~= "table" then
        if type(state) == "table" then
            state.lastOutputEnvelope = ""
            state.documentDirty = false
            state.os = "nd"
        end
        return false
    end
    state.document = normalizeDocumentForOutput(
        state.document,
        state.metrics and state.metrics.screenWidth or nil,
        state.metrics and state.metrics.screenHeight or nil
    )
    state.document.revision = math.max(0, math.floor(numberOrNil(state.document.revision) or 0)) + 1
    local ok, serialized = pcall(SLE.serializeDocument, state.document)
    if not ok or type(serialized) ~= "string" or serialized == "" then
        state.lastOutputEnvelope = ""
        state.documentDirty = false
        local errorText = tostring(serialized or "?"):gsub("[%c\r\n\t]", " "):gsub("%s+", " ")
        state.os = "ne:" .. errorText:sub(1, 18)
        return false
    end
    state.lastOutputEnvelope = serialized
    state.documentDirty = false
    return state.lastOutputEnvelope ~= ""
end

function ScreenLayoutEditor.createState(screenWidth, screenHeight, initialDocument)
    local document = nil
    if type(initialDocument) == "table" then
        document = SLE.normalizeDocument(initialDocument, screenWidth, screenHeight)
    end
    if not document then
        document = SLE.createDefaultDocument(screenWidth, screenHeight)
    end

    return {
        metrics = SLE.computeMetrics(screenWidth, screenHeight),
        document = document,
        operation = nil,
        documentDirty = false,
        lastOutputEnvelope = "",
        os = "-",
        appliedStartupToken = nil,
        startupReadyAt = nil,
        startupReadyFrame = nil,
        autoProbeSent = false,
        frameFontCache = {},
        frameCount = 0,
        pointerData = { cursorX = 0, cursorY = 0, pressed = false, down = false, released = false },
        pointerResult = { selectedChanged = false, documentChanged = false, committed = false }
    }
end

function ScreenLayoutEditor.applyPointerFrame(state, pointer)
    if type(state) ~= "table" or type(state.document) ~= "table" or type(state.metrics) ~= "table" then
        return { selectedChanged = false, documentChanged = false, committed = false }
    end
    state.document = normalizeDocumentForOutput(
        state.document,
        state.metrics.screenWidth,
        state.metrics.screenHeight
    )
    local cursorX = numberOrNil(pointer and pointer.cursorX) or -1
    local cursorY = numberOrNil(pointer and pointer.cursorY) or -1
    local hasCursor = cursorX >= 0 and cursorY >= 0
    local pressed = not not (pointer and pointer.pressed)
    local down = not not (pointer and pointer.down)
    local released = not not (pointer and pointer.released)
    local result = state.pointerResult
    if not result then
        result = { selectedChanged = false, documentChanged = false, committed = false }
        state.pointerResult = result
    end
    result.selectedChanged = false
    result.documentChanged = false
    result.committed = false

    local selected = nil
    if state.document.selectedId then
        selected = SLE.findElement(state.document, state.document.selectedId)
    end

    if pressed and hasCursor then
        if selected and selected.resizable ~= false then
            local handleName = SLE.hitResizeHandle(state.metrics, selected, cursorX, cursorY)
            if handleName then
                beginResize(state, selected, handleName)
                return result
            end
        end

        local hit = SLE.pickTopmostElement(state.document, cursorX, cursorY)
        if hit then
            if state.document.selectedId ~= hit.id then
                result.selectedChanged = true
            end
            if hit.movable ~= false then
                beginDrag(state, hit, cursorX, cursorY)
            else
                state.document.selectedId = hit.id
                state.operation = nil
            end
        else
            if state.document.selectedId ~= nil then
                result.selectedChanged = true
            end
            state.document.selectedId = nil
            state.operation = nil
        end
    end

    if down and hasCursor and state.operation then
        local element = SLE.findElement(state.document, state.operation.elementId)
        if element then
            local changed = false
            if state.operation.kind == "drag" then
                changed = updateDrag(state, element, cursorX, cursorY)
            elseif state.operation.kind == "resize" then
                changed = updateResize(state, element, cursorX, cursorY)
            end
            if changed then
                state.documentDirty = true
                result.documentChanged = true
            end
        end
    end

    if state.operation and not down then
        local committedElementId = state.operation.elementId or state.document.selectedId
        state.operation = nil
        if state.documentDirty then
            result.committed = SLE.commitDocument(state, committedElementId)
        end
        return result
    end

    if released then
        local committedElementId = state.operation and state.operation.elementId or state.document.selectedId
        state.operation = nil
        if state.documentDirty then
            result.committed = SLE.commitDocument(state, committedElementId)
        end
    end

    return result
end

function ScreenLayoutEditor.getOutputEnvelope(state)
    if type(state) ~= "table" then
        return ""
    end
    return state.lastOutputEnvelope or ""
end

local function runStartupAutoProbe(state)
    if type(state) ~= "table" or state.startupPending or state.autoProbeSent then
        return false
    end
    if type(state.document) ~= "table" or type(state.metrics) ~= "table" then
        state.autoProbeSent = true
        return false
    end
    state.document = normalizeDocumentForOutput(state.document, state.metrics.screenWidth, state.metrics.screenHeight)
    local readyByTime = false
    if type(state.startupReadyAt) == "number" then
        local now = getArkTimeSeconds()
        readyByTime = type(now) == "number" and (now - state.startupReadyAt) >= 2
    end
    local readyByFrames = type(state.startupReadyFrame) == "number"
        and type(state.frameCount) == "number"
        and (state.frameCount - state.startupReadyFrame) >= 20
    if not readyByTime and not readyByFrames then
        return false
    end
    local element = SLE.findElement(state.document, "main_canvas")
    if type(element) ~= "table" and type(state.document) == "table" and type(state.document.elements) == "table" then
        element = state.document.elements[1]
    end
    if type(element) ~= "table" then
        state.autoProbeSent = true
        return false
    end
    state.autoProbeSent = true
    state.lastOutputEnvelope = string.format(
        "p|%s|boot|%s",
        encodeBase36(state.document.revision or 0),
        encodeBase36(#tostring(element.id or ""))
    )
    state.os = "p"
    return true
end

SCREEN_LAYOUT_EDITOR_FONT_NAME_CACHE = type(SCREEN_LAYOUT_EDITOR_FONT_NAME_CACHE) == "table" and SCREEN_LAYOUT_EDITOR_FONT_NAME_CACHE or {}
SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE = type(SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE) == "table" and SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE or {}
SCREEN_LAYOUT_EDITOR_AVAILABLE_FONT_NAMES = type(SCREEN_LAYOUT_EDITOR_AVAILABLE_FONT_NAMES) == "table" and SCREEN_LAYOUT_EDITOR_AVAILABLE_FONT_NAMES or nil

local function getAvailableFontNames()
    if type(SCREEN_LAYOUT_EDITOR_AVAILABLE_FONT_NAMES) == "table" then
        return SCREEN_LAYOUT_EDITOR_AVAILABLE_FONT_NAMES
    end

    local discovered = {}
    local okCount, count = pcall(getAvailableFontCount)
    if okCount and type(count) == "number" and count > 0 then
        for fontIndex = 0, count - 1 do
            local okName, fontName = pcall(getAvailableFontName, fontIndex)
            if okName and type(fontName) == "string" and fontName ~= "" then
                discovered[#discovered + 1] = fontName
            end
        end
    end

    SCREEN_LAYOUT_EDITOR_AVAILABLE_FONT_NAMES = discovered
    return SCREEN_LAYOUT_EDITOR_AVAILABLE_FONT_NAMES
end

local function getFont(size, frameFontCache)
    local fontSize = math.max(1, math.floor(numberOrNil(size) or 24))
    if type(frameFontCache) == "table" then
        local frameCached = frameFontCache[fontSize]
        if frameCached ~= nil then
            return frameCached ~= false and frameCached or nil
        end
    end

    local cachedHandle = SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE[fontSize]
    if cachedHandle ~= nil then
        if type(frameFontCache) == "table" then
            frameFontCache[fontSize] = cachedHandle
        end
        return cachedHandle ~= false and cachedHandle or nil
    end

    local cachedName = SCREEN_LAYOUT_EDITOR_FONT_NAME_CACHE[fontSize]
    if type(cachedName) == "string" and cachedName ~= "" then
        local ok, loaded = pcall(loadFont, cachedName, fontSize)
        if ok and loaded then
            SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE[fontSize] = loaded
            if type(frameFontCache) == "table" then
                frameFontCache[fontSize] = loaded
            end
            return loaded
        end
        SCREEN_LAYOUT_EDITOR_FONT_NAME_CACHE[fontSize] = nil
        SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE[fontSize] = nil
    elseif cachedName == false then
        SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE[fontSize] = false
        if type(frameFontCache) == "table" then
            frameFontCache[fontSize] = false
        end
        return nil
    end

    local preferred = { "Play", "Rajdhani", "Orbitron", "Roboto" }
    for index = 1, #preferred do
        local ok, loaded = pcall(loadFont, preferred[index], fontSize)
        if ok and loaded then
            SCREEN_LAYOUT_EDITOR_FONT_NAME_CACHE[fontSize] = preferred[index]
            SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE[fontSize] = loaded
            if type(frameFontCache) == "table" then
                frameFontCache[fontSize] = loaded
            end
            return loaded
        end
    end

    local availableFontNames = getAvailableFontNames()
    for index = 1, #availableFontNames do
        local fontName = availableFontNames[index]
        if fontName ~= preferred[1]
            and fontName ~= preferred[2]
            and fontName ~= preferred[3]
            and fontName ~= preferred[4] then
            local okLoad, loaded = pcall(loadFont, fontName, fontSize)
            if okLoad and loaded then
                SCREEN_LAYOUT_EDITOR_FONT_NAME_CACHE[fontSize] = fontName
                SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE[fontSize] = loaded
                if type(frameFontCache) == "table" then
                    frameFontCache[fontSize] = loaded
                end
                return loaded
            end
        end
    end

    SCREEN_LAYOUT_EDITOR_FONT_NAME_CACHE[fontSize] = false
    SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE[fontSize] = false
    if type(frameFontCache) == "table" then
        frameFontCache[fontSize] = false
    end
    return nil
end

local function getLineWidth(font, text)
    local okBounds, width = pcall(getTextBounds, font, text)
    if okBounds and type(width) == "number" then
        return width
    end
    return 0
end

local function isTextLayoutCacheValid(cached, lines, fontSize, lineGap, fontName)
    if type(cached) ~= "table" then
        return false
    end
    if cached.fontSize ~= fontSize or cached.lineGap ~= lineGap or cached.fontName ~= fontName then
        return false
    end

    local cachedLines = cached.lines
    if type(cachedLines) ~= "table" or #cachedLines ~= #lines then
        return false
    end

    for index = 1, #lines do
        if cachedLines[index] ~= tostring(lines[index] or "") then
            return false
        end
    end

    return true
end

local function getElementTextLayout(element, font, fontSize, lineGap)
    local lines = element.textLines
    local fontName = SCREEN_LAYOUT_EDITOR_FONT_NAME_CACHE[fontSize]
    local cached = element._textLayoutCache
    if isTextLayoutCacheValid(cached, lines, fontSize, lineGap, fontName) then
        return cached
    end

    local cachedLines = {}
    local widths = {}
    for index = 1, #lines do
        local text = tostring(lines[index] or "")
        cachedLines[index] = text
        widths[index] = getLineWidth(font, text)
    end

    local layout = {
        lines = cachedLines,
        widths = widths,
        totalHeight = (#cachedLines * fontSize) + ((#cachedLines - 1) * lineGap),
        fontSize = fontSize,
        lineGap = lineGap,
        fontName = fontName
    }
    element._textLayoutCache = layout
    return layout
end

local function addTextWithFontRetry(layer, element, font, fontSize, lineGap, text, textX, baselineY, frameFontCache)
    local okAdd = pcall(addText, layer, font, text, textX, baselineY)
    if okAdd then
        return true
    end

    SCREEN_LAYOUT_EDITOR_FONT_HANDLE_CACHE[fontSize] = nil
    if type(frameFontCache) == "table" then
        frameFontCache[fontSize] = nil
    end
    if type(element) == "table" then
        element._textLayoutCache = nil
    end

    local retryFont = getFont(fontSize, frameFontCache)
    if not retryFont then
        return false
    end

    local retryTextX = textX
    if type(element) == "table" and element.textAlign == "center" then
        local retryWidth = getLineWidth(retryFont, text)
        retryTextX = element.x + (element.w - retryWidth) * 0.5
    end

    return pcall(addText, layer, retryFont, text, retryTextX, baselineY)
end

local DEFAULT_FILL_COLOR = { 0.2, 0.2, 0.2, 1.0 }
local DEFAULT_STROKE_COLOR = { 1.0, 1.0, 1.0, 1.0 }
local DEFAULT_TEXT_COLOR = { 1.0, 1.0, 1.0, 1.0 }

local function drawRoundedElement(layer, element)
    local fill = element.fill or DEFAULT_FILL_COLOR
    local stroke = element.stroke or DEFAULT_STROKE_COLOR
    setNextFillColor(layer, fill[1], fill[2], fill[3], fill[4])
    setNextStrokeColor(layer, stroke[1], stroke[2], stroke[3], stroke[4])
    setNextStrokeWidth(layer, element.strokeWidth or 2)
    if element.type == "box" then
        addBox(layer, element.x, element.y, element.w, element.h)
    else
        addBoxRounded(layer, element.x, element.y, element.w, element.h, element.radius or 12)
    end
end

local function drawElementText(layer, element, frameFontCache)
    local lines = element.textLines
    if not lines or #lines <= 0 then
        return
    end

    local fontSize = element.textSize or 24
    local font = getFont(fontSize, frameFontCache)
    if not font then
        return
    end

    local color = element.textColor or DEFAULT_TEXT_COLOR
    local lineGap = element.lineGap or math.max(4, math.floor(fontSize * 0.15))
    local layout = getElementTextLayout(element, font, fontSize, lineGap)
    local totalHeight = layout.totalHeight
    local startY = element.y + math.max(10, (element.h - totalHeight) * 0.5)

    for index = 1, #lines do
        local text = layout.lines[index] or tostring(lines[index] or "")
        local textWidth = layout.widths[index] or 0
        local textX = element.x + 14
        if element.textAlign == "center" then
            textX = element.x + (element.w - textWidth) * 0.5
        end
        local baselineY = startY + ((index - 1) * (fontSize + lineGap)) + (fontSize * 0.82)
        setNextFillColor(layer, color[1], color[2], color[3], color[4])
        addTextWithFontRetry(layer, element, font, fontSize, lineGap, text, textX, baselineY, frameFontCache)
    end
end

local SELECTION_BORDER_COLOR = { 0.14, 0.88, 0.98, 0.95 }

local function drawSelectionOverlay(state, layer, element)
    local pad = state.metrics.selectionPadding
    setNextFillColor(layer, 0.00, 0.00, 0.00, 0.00)
    setNextStrokeColor(layer, SELECTION_BORDER_COLOR[1], SELECTION_BORDER_COLOR[2], SELECTION_BORDER_COLOR[3], SELECTION_BORDER_COLOR[4])
    setNextStrokeWidth(layer, 3)
    addBoxRounded(
        layer,
        element.x - pad,
        element.y - pad,
        element.w + pad * 2,
        element.h + pad * 2,
        math.max(10, element.radius or 10)
    )

    if element.resizable == false then
        return
    end

    local handles = SLE.getHandleRects(state.metrics, element)
    for _, rect in pairs(handles) do
        if type(rect) == "table" then
            setNextFillColor(layer, SELECTION_BORDER_COLOR[1], SELECTION_BORDER_COLOR[2], SELECTION_BORDER_COLOR[3], 0.95)
            setNextStrokeColor(layer, 1.0, 1.0, 1.0, 0.95)
            setNextStrokeWidth(layer, 2)
            addBoxRounded(layer, rect.x, rect.y, rect.w, rect.h, 4)
        end
    end
end

local function drawHud(state, layer, screenHeight, frameFontCache)
    local font = getFont(math.max(18, math.floor(screenHeight / 42)), frameFontCache)
    if not font then
        return
    end

    local helpText = "Drag to move, handles resize"
    setNextFillColor(layer, 1.0, 0.68, 0.22, 1.0)
    addTextWithFontRetry(layer, nil, font, math.max(18, math.floor(screenHeight / 42)), 0, helpText, 44, screenHeight - 58, frameFontCache)
end

local function getInputText()
    if type(getInput) ~= "function" then
        return nil
    end
    local inputOk, inputText = pcall(getInput)
    if not inputOk or type(inputText) ~= "string" or inputText == "" then
        return nil
    end
    return inputText
end

local function getInitialDocumentSeed(inputText, screenWidth, screenHeight)
    if type(inputText) ~= "string" or inputText == "" then
        return nil
    end
    local revision36, selectedId, width36, height36, patchText = inputText:match("^d|([^|]*)|([^|]*)|([^|]*)|([^|]*)|(.*)$")
    if revision36 then
        local patchWidth = tonumber(width36, 36) or screenWidth
        local patchHeight = tonumber(height36, 36) or screenHeight
        local document, parseError = SLE.deserializeLayoutPatch(
            patchText,
            patchWidth,
            patchHeight
        )
        if type(document) == "table" then
            if type(selectedId) == "string" and selectedId ~= "" then
                document.selectedId = selectedId
            end
            document.revision = math.max(0, math.floor(tonumber(revision36, 36) or document.revision or 0))
            return {
                document = SLE.normalizeDocument(document, screenWidth, screenHeight),
                token = "d:" .. tostring(revision36 or "0") .. ":" .. tostring(selectedId or "")
            }
        end
        return nil
    end
    return nil
end

local function getState()
    local screenWidth, screenHeight = getResolution()
    local inputText = getInputText()
    local startup = getInitialDocumentSeed(inputText, screenWidth, screenHeight)
    if type(SCREEN_LAYOUT_EDITOR_STATE) ~= "table" or not SCREEN_LAYOUT_EDITOR_STATE.initialized then
        local state = SLE.createState(
            screenWidth,
            screenHeight,
            startup and startup.document or nil
        )
        state.initialized = true
        state.appliedStartupToken = startup and startup.token or nil
        SCREEN_LAYOUT_EDITOR_STATE = state
    end

    local state = SCREEN_LAYOUT_EDITOR_STATE
    if state.metrics.screenWidth ~= screenWidth or state.metrics.screenHeight ~= screenHeight then
        state.metrics = SLE.computeMetrics(screenWidth, screenHeight)
    end
    if startup and type(startup.document) == "table" and state.appliedStartupToken ~= startup.token then
        local restoredState = SLE.createState(screenWidth, screenHeight, startup.document)
        restoredState.initialized = true
        restoredState.appliedStartupToken = startup.token
        SCREEN_LAYOUT_EDITOR_STATE = restoredState
        state = restoredState
    end

    return state, screenHeight
end

local function runRenderScript()
    local state, screenHeight = getState()
    if type(state) ~= "table" then
        return
    end
    if type(state.metrics) ~= "table" then
        local width, height = getResolution()
        state.metrics = SLE.computeMetrics(width, height)
    end
    if type(state.document) ~= "table" then
        state.document = SLE.createDefaultDocument(state.metrics.screenWidth, state.metrics.screenHeight)
    end
    state.document = normalizeDocumentForOutput(state.document, state.metrics.screenWidth, state.metrics.screenHeight)
    state.frameCount = math.max(0, math.floor(numberOrNil(state.frameCount) or 0)) + 1

    local frameFontCache = state.frameFontCache
    local cursorX, cursorY = getCursor()
    local cursorPressed = getCursorPressed()
    local cursorDown = getCursorDown()
    local cursorReleased = getCursorReleased()
    local pointerData = state.pointerData
    pointerData.cursorX = cursorX
    pointerData.cursorY = cursorY
    pointerData.pressed = cursorPressed
    pointerData.down = cursorDown
    pointerData.released = cursorReleased
    if type(state.startupReadyFrame) ~= "number" then
        state.startupReadyFrame = state.frameCount
    end
    if type(state.startupReadyAt) ~= "number" then
        state.startupReadyAt = getArkTimeSeconds()
    end
    SLE.applyPointerFrame(state, pointerData)
    runStartupAutoProbe(state)

    setBackgroundColor(0.06, 0.06, 0.07)

    local layer = createLayer()

    for index = 1, #state.document.elements do
        local element = state.document.elements[index]
        drawRoundedElement(layer, element)
        drawElementText(layer, element, frameFontCache)
    end

    if state.document.selectedId then
        local selected = SLE.findElement(state.document, state.document.selectedId)
        if selected then
            drawSelectionOverlay(state, layer, selected)
        end
    end

    drawHud(state, layer, screenHeight, frameFontCache)

    local envelope = SLE.getOutputEnvelope(state)
    if type(envelope) == "string" and envelope ~= "" then
        local ok = pcall(setOutput, envelope)
        if ok then
            state.os = "o"
            state.lastOutputEnvelope = ""
        else
            state.os = "!"
            pcall(setOutput, string.format("p|%s|of|%s", encodeBase36(state.document.revision or 0), encodeBase36(#envelope)))
        end
    elseif envelope == nil then
        state.os = "on"
    end

    local nextFrameDelay = 6
    if state.operation or cursorPressed or cursorDown or cursorReleased then
        nextFrameDelay = 1
    end
    requestAnimationFrame(nextFrameDelay)
end

ScreenLayoutEditor._runRenderScript = runRenderScript

if type(getResolution) == "function"
    and type(createLayer) == "function"
    and type(getCursor) == "function"
    and type(requestAnimationFrame) == "function" then
    runRenderScript()
end
]====]

local function EnsureScreenLayoutEditorModule()
    local loader, loadError = load(SCREEN_LAYOUT_EDITOR_SOURCE, "@ScreenLayoutEditor.lua", "t", _ENV)
    if not loader then
        system.print("ERROR: Failed to load ScreenLayoutEditor source: " .. tostring(loadError))
        return nil
    end
    local ok, loadedModule = pcall(loader)
    if not ok then
        system.print("ERROR: Failed to initialize ScreenLayoutEditor: " .. tostring(loadedModule))
        return nil
    end
    if type(loadedModule) == "table" then
        SCREEN_LAYOUT_EDITOR_MODULE = loadedModule
    end
    if type(SCREEN_LAYOUT_EDITOR_MODULE) ~= "table"
        or type(SCREEN_LAYOUT_EDITOR_MODULE.readPersistedEnvelope) ~= "function" then
        system.print("ERROR: ScreenLayoutEditor did not initialize module helpers")
        return nil
    end
    return SCREEN_LAYOUT_EDITOR_MODULE
end

local function InstallScreenLayoutEditorJsonOutputSupport(editorModule)
    if type(editorModule) ~= "table" or editorModule._jsonOutputSupportInstalled then
        return editorModule
    end
    local legacyParseOutputEnvelope = editorModule.parseOutputEnvelope
    if type(legacyParseOutputEnvelope) ~= "function" then
        return editorModule
    end
    editorModule.parseOutputEnvelope = function(text, screenWidth, screenHeight)
        if type(json) == "table" and type(json.decode) == "function" and type(text) == "string" and text ~= "" then
            local decoded = json.decode(text)
            if type(decoded) == "table" then
                if decoded.p ~= nil and decoded.d == nil and decoded.document == nil and decoded.m == nil and decoded.minimal == nil then
                    return nil, "probe_output"
                end
                local outputKind = decoded.kind or decoded.k
                if outputKind == editorModule.OUTPUT_KIND or outputKind == editorModule.LEGACY_OUTPUT_KIND then
                    local documentValue = decoded.document or decoded.d
                    local patchValue = decoded.minimal or decoded.m
                    local document, documentError = nil, nil
                    if type(documentValue) == "string" and documentValue ~= "" then
                        document, documentError = editorModule.deserializeDocument(documentValue, screenWidth, screenHeight)
                    elseif type(patchValue) == "string" and patchValue ~= "" and type(editorModule.deserializeLayoutPatch) == "function" then
                        local patchWidth = (type(decoded.sx) == "string" and tonumber(decoded.sx, 36)) or screenWidth
                        local patchHeight = (type(decoded.sy) == "string" and tonumber(decoded.sy, 36)) or screenHeight
                        document, documentError = editorModule.deserializeLayoutPatch(patchValue, patchWidth, patchHeight)
                    else
                        document = editorModule.normalizeDocument(documentValue, screenWidth, screenHeight)
                    end
                    if not document then
                        return nil, documentError or "document_parse_error"
                    end
                    local selectedId = decoded.si or decoded.selectedId
                    if type(selectedId) == "string" and selectedId ~= "" then
                        document.selectedId = selectedId
                    end
                    document.revision = math.max(0, math.floor(tonumber(decoded.revision or decoded.r) or document.revision or 0))
                    local serialized = editorModule.serializeDocument(document)
                    local computedHash = editorModule.hashText(serialized)
                    local expectedHash = tonumber(decoded.hash or decoded.g)
                    if expectedHash and computedHash ~= expectedHash and (type(patchValue) ~= "string" or patchValue == "") then
                        return nil, "hash_mismatch"
                    end
                    return {
                        kind = editorModule.OUTPUT_KIND,
                        version = editorModule.SCHEMA_VERSION,
                        revision = document.revision,
                        hash = computedHash,
                        serializedDocument = serialized,
                        document = document
                    }, nil
                end
            end
        end
        return legacyParseOutputEnvelope(text, screenWidth, screenHeight)
    end
    editorModule._jsonOutputSupportInstalled = true
    return editorModule
end

local function SLEDebugDatabankValue(editorModule, persistedText)
    if type(SLEP) ~= "function" then
        return
    end
    local rawText = type(persistedText) == "string" and persistedText or ""
    SLEP(
        "sle-db-raw",
        string.format(
            "db raw b=%d %s",
            #rawText,
            SLETrimDebugText(rawText, 180)
        ),
        "info",
        true
    )
    if rawText == "" then
        return
    end

    local parsed = nil
    if type(json) == "table" and type(json.decode) == "function" then
        local jsonOk, jsonValue = pcall(json.decode, rawText)
        if jsonOk and type(jsonValue) == "table" then
            parsed = jsonValue
        end
    end
    if type(parsed) ~= "table" then
        local loader, loadError = load("return " .. rawText, "sle_db_debug", "t", {})
        if not loader then
            SLEP("sle-db-parse", "db parse " .. tostring(loadError or "?"), "error", true)
            return
        end

        local loadOk, loadValue = pcall(loader)
        if not loadOk or type(loadValue) ~= "table" then
            SLEP(
                "sle-db-parse",
                "db eval " .. tostring(loadOk and type(loadValue) or loadValue or "?"),
                "error",
                true
            )
            return
        end
        parsed = loadValue
    end

    local keys = {}
    local lastNumericIndex = 0
    local lastNumericValue = nil
    for key, value in pairs(parsed) do
        keys[#keys + 1] = tostring(key)
        if type(key) == "number" and key > lastNumericIndex then
            lastNumericIndex = key
            lastNumericValue = value
        end
    end
    table.sort(keys)

    local documentValue = parsed.d or parsed.document
    SLEP(
        "sle-db-keys",
        string.format(
            "db tbl keys=%s doc=%s docb=%d k=%s r=%s g=%s",
            table.concat(keys, ","),
            type(documentValue),
            type(documentValue) == "string" and #documentValue or -1,
            tostring(parsed.k or parsed.kind or "?"),
            tostring(parsed.r or parsed.revision or "?"),
            tostring(parsed.g or parsed.hash or "?")
        ),
        "info",
        true
    )

    if lastNumericIndex > 0 then
        local extra = ""
        if type(lastNumericValue) == "string" then
            extra = " " .. SLETrimDebugText(lastNumericValue, 120)
        elseif type(lastNumericValue) == "table" then
            extra = string.format(
                " r=%s h=%s d=%s",
                tostring(lastNumericValue.r or lastNumericValue.revision or "?"),
                tostring(lastNumericValue.g or lastNumericValue.hash or "?"),
                SLETrimDebugText(lastNumericValue.d or lastNumericValue.document or "?", 80)
            )
        end
        SLEP(
            "sle-db-last",
            string.format(
                "db tbl last=%d t=%s%s",
                lastNumericIndex,
                type(lastNumericValue),
                extra
            ),
            "info",
            true
        )
    end
end

local function RestoreScreenLayoutEditorEnvelope(editorModule)
    if not databank then
        SLEP("sle-r", "r skip: no db", "error")
        return nil
    end
    local key = editorModule.PERSISTENCE_DB_KEY
    local hasOk, hasKey = pcall(databank.hasKey, key)
    if hasOk and hasKey then
        local getOk, persistedText = pcall(databank.getStringValue, key)
        if not getOk then
            SLEP("sle-r", "r get", "error", true)
            return nil
        end
        SLEDebugDatabankValue(editorModule, persistedText)
        if type(persistedText) == "string" and persistedText ~= "" then
            local envelope, parseError = editorModule.readPersistedEnvelope(persistedText)
            if envelope then
                SCREEN_LAYOUT_EDITOR_LAST_DOCUMENT = envelope.document
                SLEP(
                    "sle-restore",
                    string.format(
                        "r ok r=%d h=%s b=%d",
                        envelope.revision or 0,
                        tostring(envelope.hash or "?"),
                        #persistedText
                    ),
                    "info"
                )
                if type(editorModule.findElement) == "function" then
                    local restoreCanvas = editorModule.findElement(envelope.document, "main_canvas")
                    if type(restoreCanvas) == "table" then
                        SLEP(
                            "sle-restore-canvas",
                            string.format(
                                "r mc=%d,%d %dx%d",
                                math.floor((restoreCanvas.x or 0) + 0.5),
                                math.floor((restoreCanvas.y or 0) + 0.5),
                                math.floor((restoreCanvas.w or 0) + 0.5),
                                math.floor((restoreCanvas.h or 0) + 0.5)
                            ),
                            "debug",
                            true
                        )
                    end
                end
                return envelope
            end
            SLEP(
                "sle-r",
                "r bad: " .. tostring(parseError),
                "error",
                true
            )
        end
        SLEP("sle-r", "r mt", "debug", true)
        return nil
    end
    SLEP("sle-r", hasOk and "r nk" or "r hk", hasOk and "debug" or "error")
    return nil
end

SCREEN_LAYOUT_EDITOR_ENABLED = true
if not SCREEN_LAYOUT_EDITOR_ENABLED then
    system.print("ERROR: SLE is disabled")
    unit.exit()
    return
end

local screenLayoutEditor = InstallScreenLayoutEditorJsonOutputSupport(EnsureScreenLayoutEditorModule())
if not screenLayoutEditor then
    unit.exit()
    return
end

local persistedEnvelope = RestoreScreenLayoutEditorEnvelope(screenLayoutEditor)
local initialDocumentState = nil
if persistedEnvelope and type(persistedEnvelope.document) == "table" then
    initialDocumentState = {
        patch = screenLayoutEditor.serializeLayoutPatch(persistedEnvelope.document),
        revision = persistedEnvelope.revision,
        selectedId = persistedEnvelope.document.selectedId,
        screenWidth = persistedEnvelope.document.screenWidth,
        screenHeight = persistedEnvelope.document.screenHeight
    }
end

SCREEN_LAYOUT_EDITOR_MAX_SCREEN_CODE_CHARS = screenLayoutEditor.resolveMaxScreenCodeChars(SCREEN_LAYOUT_EDITOR_MAX_SCREEN_CODE_CHARS)
SCREEN_LAYOUT_EDITOR_LAST_PERSISTED_REVISION = persistedEnvelope and persistedEnvelope.revision or -1
SCREEN_LAYOUT_EDITOR_LAST_PERSISTED_HASH = persistedEnvelope and persistedEnvelope.hash or -1
SCREEN_LAYOUT_EDITOR_LAST_DOCUMENT = persistedEnvelope and persistedEnvelope.document or nil

local renderInput = ""
if type(initialDocumentState) == "table" and type(initialDocumentState.patch) == "string" and initialDocumentState.patch ~= "" then
    renderInput = table.concat({
        "d|",
        encodeBase36(math.max(0, math.floor(tonumber(initialDocumentState.revision) or 0))),
        "|",
        tostring(initialDocumentState.selectedId or ""),
        "|",
        encodeBase36(math.max(1, math.floor(tonumber(initialDocumentState.screenWidth) or 1))),
        "|",
        encodeBase36(math.max(1, math.floor(tonumber(initialDocumentState.screenHeight) or 1))),
        "|",
        initialDocumentState.patch
    })
end

local renderInstanceTag = nil
if type(system) == "table" and type(system.getArkTime) == "function" then
    local arkTime = tonumber(system.getArkTime())
    if arkTime then
        renderInstanceTag = encodeBase36(math.max(0, math.floor((arkTime * 1000) + 0.5)))
    end
end

local renderScript = BuildEditableRenderScript(renderInstanceTag)
local linkedScreens = type(Screens) == "table" and #Screens > 0 and Screens or {Screen}
for index = 1, #linkedScreens do
    linkedScreens[index].clearScriptOutput()
    linkedScreens[index].setRenderScript(renderScript)
    linkedScreens[index].setScriptInput(renderInput)
end
SLEP("sle-sc", "sc " .. tostring(#linkedScreens), "debug", true)

unit.hideWidget();
SLEP("sle-v", "v " .. SLE_BUILD, "debug", true)
local _sok, _serr = pcall(unit.setTimer, "UPD", 0.1)
SLEP("sle-t", (_sok and "t " or "te ") .. SLE_BUILD .. (_sok and "" or (":" .. tostring(_serr))), _sok and "debug" or "error", true)
