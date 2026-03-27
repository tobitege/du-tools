local ScreenLayoutEditor = {}
SCREEN_LAYOUT_EDITOR_MODULE = ScreenLayoutEditor

ScreenLayoutEditor.SCHEMA_VERSION = 1
ScreenLayoutEditor.OUTPUT_KIND = "screen_layout_editor_doc"
ScreenLayoutEditor.PERSISTENCE_DB_KEY = "screen_layout_editor:document"
ScreenLayoutEditor.DEFAULT_MARGIN = 8

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
        elements = {
            {
                id = "frame",
                type = "boxRounded",
                x = px(32), y = py(36), w = px(1848), h = py(1006), radius = px(22),
                fill = { 0.10, 0.11, 0.12, 0.98 },
                stroke = { 0.97, 0.97, 0.98, 1.00 },
                strokeWidth = px(4),
                movable = false,
                resizable = false
            },
            {
                id = "title_badge",
                type = "boxRounded",
                x = px(64), y = py(48), w = px(280), h = py(98), radius = px(18),
                fill = { 0.16, 0.16, 0.16, 0.96 },
                stroke = { 0.98, 0.98, 0.99, 1.00 },
                strokeWidth = px(4),
                textLines = { "Honeycomb Control" },
                textColor = { 1.00, 0.73, 0.24, 1.00 },
                textSize = px(32),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "purity_panel",
                type = "boxRounded",
                x = px(78), y = py(168), w = px(160), h = py(162), radius = px(18),
                fill = { 0.23, 0.16, 0.05, 0.96 },
                stroke = { 0.98, 0.86, 0.45, 1.00 },
                strokeWidth = px(3),
                textLines = { "Pure", "Product", "74t/s" },
                textColor = { 1.00, 0.91, 0.56, 1.00 },
                textSize = px(26),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "materials_strip",
                type = "boxRounded",
                x = px(390), y = py(48), w = px(1410), h = py(136), radius = px(18),
                fill = { 0.19, 0.20, 0.22, 0.96 },
                stroke = { 0.96, 0.96, 0.98, 1.00 },
                strokeWidth = px(4),
                movable = true,
                resizable = true
            },
            {
                id = "tier_all",
                type = "boxRounded",
                x = px(440), y = py(58), w = px(86), h = py(40), radius = px(18),
                fill = { 0.98, 0.78, 0.13, 0.98 },
                stroke = { 0.90, 0.63, 0.05, 1.00 },
                strokeWidth = px(2),
                textLines = { "All" },
                textColor = { 0.22, 0.15, 0.02, 1.00 },
                textSize = px(22),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "tier_l1",
                type = "boxRounded",
                x = px(544), y = py(58), w = px(106), h = py(40), radius = px(18),
                fill = { 0.95, 0.66, 0.16, 0.98 },
                stroke = { 0.90, 0.54, 0.04, 1.00 },
                strokeWidth = px(2),
                textLines = { "L1 T1" },
                textColor = { 0.24, 0.12, 0.02, 1.00 },
                textSize = px(20),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "tier_l2",
                type = "boxRounded",
                x = px(668), y = py(58), w = px(106), h = py(40), radius = px(18),
                fill = { 0.95, 0.66, 0.16, 0.98 },
                stroke = { 0.90, 0.54, 0.04, 1.00 },
                strokeWidth = px(2),
                textLines = { "L2 T2" },
                textColor = { 0.24, 0.12, 0.02, 1.00 },
                textSize = px(20),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "tier_l3",
                type = "boxRounded",
                x = px(792), y = py(58), w = px(106), h = py(40), radius = px(18),
                fill = { 0.95, 0.66, 0.16, 0.98 },
                stroke = { 0.90, 0.54, 0.04, 1.00 },
                strokeWidth = px(2),
                textLines = { "L3 T3" },
                textColor = { 0.24, 0.12, 0.02, 1.00 },
                textSize = px(20),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "tier_l4",
                type = "boxRounded",
                x = px(916), y = py(58), w = px(106), h = py(40), radius = px(18),
                fill = { 0.95, 0.66, 0.16, 0.98 },
                stroke = { 0.90, 0.54, 0.04, 1.00 },
                strokeWidth = px(2),
                textLines = { "L4 T4" },
                textColor = { 0.24, 0.12, 0.02, 1.00 },
                textSize = px(20),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "materials_band",
                type = "boxRounded",
                x = px(440), y = py(108), w = px(1320), h = py(70), radius = px(14),
                fill = { 0.15, 0.21, 0.31, 0.96 },
                stroke = { 0.70, 0.91, 1.00, 1.00 },
                strokeWidth = px(2),
                textLines = { "Aluminum   Carbon   Iron   Silicon   Calcium   Chromium   Copper   Sodium" },
                textColor = { 0.78, 0.95, 1.00, 1.00 },
                textSize = px(20),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "preview_panel",
                type = "boxRounded",
                x = px(78), y = py(214), w = px(228), h = py(266), radius = px(18),
                fill = { 0.14, 0.14, 0.15, 0.98 },
                stroke = { 0.97, 0.97, 0.98, 1.00 },
                strokeWidth = px(4),
                movable = true,
                resizable = true
            },
            {
                id = "status_badge",
                type = "boxRounded",
                x = px(92), y = py(526), w = px(168), h = py(62), radius = px(28),
                fill = { 0.78, 0.06, 0.10, 0.96 },
                stroke = { 0.99, 0.99, 0.99, 1.00 },
                strokeWidth = px(2),
                textLines = { "Stopped" },
                textColor = { 1.00, 0.68, 0.26, 1.00 },
                textSize = px(28),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "actions_panel",
                type = "boxRounded",
                x = px(64), y = py(608), w = px(268), h = py(344), radius = px(18),
                fill = { 0.18, 0.18, 0.18, 0.98 },
                stroke = { 0.97, 0.97, 0.98, 1.00 },
                strokeWidth = px(4),
                textLines = { "M0", "Maintain x100" },
                textColor = { 1.00, 0.72, 0.24, 1.00 },
                textSize = px(28),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "button_maintain",
                type = "boxRounded",
                x = px(96), y = py(734), w = px(204), h = py(58), radius = px(22),
                fill = { 0.18, 0.74, 0.96, 0.98 },
                stroke = { 0.86, 0.97, 1.00, 1.00 },
                strokeWidth = px(2),
                textLines = { "Maintain 1" },
                textColor = { 0.07, 0.22, 0.31, 1.00 },
                textSize = px(22),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "button_craft",
                type = "boxRounded",
                x = px(96), y = py(806), w = px(204), h = py(58), radius = px(22),
                fill = { 0.18, 0.74, 0.96, 0.98 },
                stroke = { 0.86, 0.97, 1.00, 1.00 },
                strokeWidth = px(2),
                textLines = { "Craft 1" },
                textColor = { 0.07, 0.22, 0.31, 1.00 },
                textSize = px(22),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "button_stop",
                type = "boxRounded",
                x = px(96), y = py(878), w = px(204), h = py(58), radius = px(22),
                fill = { 0.95, 0.48, 0.18, 0.98 },
                stroke = { 1.00, 0.87, 0.63, 1.00 },
                strokeWidth = px(2),
                textLines = { "Stop" },
                textColor = { 0.33, 0.12, 0.02, 1.00 },
                textSize = px(24),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "main_canvas",
                type = "boxRounded",
                x = px(370), y = py(198), w = px(1410), h = py(768), radius = px(20),
                fill = { 0.15, 0.15, 0.15, 0.98 },
                stroke = { 0.97, 0.97, 0.98, 1.00 },
                strokeWidth = px(4),
                textLines = { "No schematic required", "Nothing selected" },
                textColor = { 0.98, 0.66, 0.19, 1.00 },
                textSize = px(24),
                textAlign = "center",
                movable = true,
                resizable = true
            },
            {
                id = "footer_status",
                type = "boxRounded",
                x = px(1060), y = py(988), w = px(86), h = py(34), radius = px(14),
                fill = { 0.12, 0.80, 0.96, 0.98 },
                stroke = { 0.88, 0.98, 1.00, 1.00 },
                strokeWidth = px(2),
                movable = true,
                resizable = true
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

    local textLines = cloneStringArray(rawElement.textLines)
    if not textLines and type(rawElement.text) == "string" then
        textLines = splitTextLines(rawElement.text)
    end

    local elementType = tostring(rawElement.type or rawElement.kind or "boxRounded")
    if elementType == "rect" then
        elementType = "boxRounded"
    end

    local element = {
        id = tostring(rawElement.id or ("element_" .. tostring(index))),
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

    local lineGap = numberOrNil(rawElement.lineGap)
    if lineGap then
        element.lineGap = lineGap
    end

    element.fill = cloneColor(rawElement.fill, { 0.2, 0.2, 0.2, 1.0 })
    element.stroke = cloneColor(rawElement.stroke, { 1.0, 1.0, 1.0, 1.0 })
    element.textColor = cloneColor(rawElement.textColor or rawElement.tc, { 1.0, 1.0, 1.0, 1.0 })

    if textLines then
        element.textLines = textLines
    end

    if type(rawElement.textAlign) == "string" and rawElement.textAlign ~= "" then
        element.textAlign = rawElement.textAlign
    elseif textLines then
        element.textAlign = "center"
    end

    if rawElement.movable ~= nil then
        element.movable = not not rawElement.movable
    end

    if rawElement.resizable ~= nil then
        element.resizable = not not rawElement.resizable
    end

    return element
end

function ScreenLayoutEditor.normalizeDocument(rawDocument, screenWidth, screenHeight)
    local fallback = ScreenLayoutEditor.createDefaultDocument(screenWidth or 1920, screenHeight or 1080)
    if type(rawDocument) ~= "table" then
        return fallback
    end

    local elements = {}
    if type(rawDocument.elements) == "table" then
        for index = 1, #rawDocument.elements do
            local normalized = normalizeElement(rawDocument.elements[index], index)
            if normalized then
                elements[#elements + 1] = normalized
            end
        end
    end

    if #elements <= 0 then
        return fallback
    end

    local selectedId = nil
    if type(rawDocument.selectedId) == "string" and rawDocument.selectedId ~= "" then
        for index = 1, #elements do
            if elements[index].id == rawDocument.selectedId then
                selectedId = rawDocument.selectedId
                break
            end
        end
    end

    return {
        version = ScreenLayoutEditor.SCHEMA_VERSION,
        revision = math.max(0, math.floor(numberOrNil(rawDocument.revision) or 0)),
        selectedId = selectedId,
        elements = elements
    }
end

local function serializeElement(element)
    local parts = { "{" }
    append(parts, "id=")
    append(parts, serializeString(element.id))
    append(parts, ",type=")
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
        append(parts, ",radius=")
        append(parts, serializeNumber(element.radius))
    end

    local fill = serializeColor(element.fill)
    if fill then
        append(parts, ",fill=")
        append(parts, fill)
    end

    local stroke = serializeColor(element.stroke)
    if stroke then
        append(parts, ",stroke=")
        append(parts, stroke)
    end

    if isNumber(element.strokeWidth) then
        append(parts, ",strokeWidth=")
        append(parts, serializeNumber(element.strokeWidth))
    end

    local textLines = serializeStringArray(element.textLines)
    if textLines then
        append(parts, ",textLines=")
        append(parts, textLines)
    end

    local textColor = serializeColor(element.textColor)
    if textColor then
        append(parts, ",textColor=")
        append(parts, textColor)
    end

    if isNumber(element.textSize) then
        append(parts, ",textSize=")
        append(parts, serializeNumber(element.textSize))
    end

    if type(element.textAlign) == "string" and element.textAlign ~= "" then
        append(parts, ",textAlign=")
        append(parts, serializeString(element.textAlign))
    end

    if isNumber(element.lineGap) then
        append(parts, ",lineGap=")
        append(parts, serializeNumber(element.lineGap))
    end

    if element.movable ~= nil then
        append(parts, ",movable=")
        append(parts, tostring(not not element.movable))
    end

    if element.resizable ~= nil then
        append(parts, ",resizable=")
        append(parts, tostring(not not element.resizable))
    end

    append(parts, "}")
    return table.concat(parts)
end

function ScreenLayoutEditor.serializeDocument(document)
    local normalized = ScreenLayoutEditor.normalizeDocument(document)
    local parts = {
        "{version=",
        tostring(normalized.version),
        ",revision=",
        tostring(normalized.revision)
    }

    if normalized.selectedId then
        append(parts, ",selectedId=")
        append(parts, serializeString(normalized.selectedId))
    end

    append(parts, ",elements={")
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

local function parseLuaTable(text, chunkName)
    if type(text) ~= "string" or text == "" then
        return nil, "empty"
    end
    local loader, loadError = load("return " .. text, chunkName or "screen_layout_editor", "t", {})
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
    local rawDocument, parseError = parseLuaTable(text, "screen_layout_editor_document")
    if not rawDocument then
        return nil, parseError
    end
    return ScreenLayoutEditor.normalizeDocument(rawDocument, screenWidth, screenHeight), nil
end

function ScreenLayoutEditor.serializeOutputEnvelope(document, serializedDocument, hash)
    local normalized = ScreenLayoutEditor.normalizeDocument(document)
    local docText = serializedDocument or ScreenLayoutEditor.serializeDocument(normalized)
    local docHash = hash or ScreenLayoutEditor.hashText(docText)
    return string.format(
        "{kind=%s,version=%d,revision=%d,hash=%s,document=%s}",
        serializeString(ScreenLayoutEditor.OUTPUT_KIND),
        ScreenLayoutEditor.SCHEMA_VERSION,
        normalized.revision or 0,
        serializeNumber(docHash),
        docText
    )
end

function ScreenLayoutEditor.parseOutputEnvelope(text, screenWidth, screenHeight)
    local envelope, parseError = parseLuaTable(text, "screen_layout_editor_output")
    if not envelope then
        return nil, parseError
    end
    if envelope.kind ~= ScreenLayoutEditor.OUTPUT_KIND then
        return nil, "wrong_kind"
    end
    local document = ScreenLayoutEditor.normalizeDocument(envelope.document, screenWidth, screenHeight)
    document.revision = math.max(0, math.floor(numberOrNil(envelope.revision) or document.revision or 0))
    local serialized = ScreenLayoutEditor.serializeDocument(document)
    local computedHash = ScreenLayoutEditor.hashText(serialized)
    local expectedHash = numberOrNil(envelope.hash)
    if expectedHash and computedHash ~= expectedHash then
        return nil, "hash_mismatch"
    end
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
    local envelope, parseError = ScreenLayoutEditor.parseOutputEnvelope(text, screenWidth, screenHeight)
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
        text = ScreenLayoutEditor.serializeOutputEnvelope(envelope.document, envelope.serializedDocument, envelope.hash)
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
    local normalized = ScreenLayoutEditor.normalizeDocument(document)
    local serialized = ScreenLayoutEditor.serializeDocument(normalized)
    local hash = ScreenLayoutEditor.hashText(serialized)
    local text = ScreenLayoutEditor.serializeOutputEnvelope(normalized, serialized, hash)
    local maxLength = ScreenLayoutEditor.resolveMaxScreenCodeChars(maxScreenCodeChars)
    return {
        key = ScreenLayoutEditor.PERSISTENCE_DB_KEY,
        version = ScreenLayoutEditor.SCHEMA_VERSION,
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
    local envelope, parseError = ScreenLayoutEditor.readPersistedEnvelope(text, screenWidth, screenHeight)
    if not envelope then
        return nil, parseError
    end
    local record = ScreenLayoutEditor.buildPersistenceRecord(envelope.document, maxScreenCodeChars)
    if record.revision ~= envelope.revision or record.hash ~= envelope.hash then
        return nil, "output_mismatch"
    end
    return record, nil
end

function ScreenLayoutEditor.canPersistDocument(document, maxScreenCodeChars)
    local record = ScreenLayoutEditor.buildPersistenceRecord(document, maxScreenCodeChars)
    return record.fits, record
end

function ScreenLayoutEditor.restorePersistedDocument(text, screenWidth, screenHeight)
    local envelope, parseError = ScreenLayoutEditor.parseOutputEnvelope(text, screenWidth, screenHeight)
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
        return false
    end
    state.document.revision = math.max(0, math.floor(numberOrNil(state.document.revision) or 0)) + 1
    local serialized = ScreenLayoutEditor.serializeDocument(state.document)
    local hash = ScreenLayoutEditor.hashText(serialized)
    state.lastCommittedSerialized = serialized
    state.lastCommittedHash = hash
    state.lastOutputEnvelope = ScreenLayoutEditor.serializeOutputEnvelope(state.document, serialized, hash)
    state.documentDirty = false
    return true
end

function ScreenLayoutEditor.createState(screenWidth, screenHeight, initialDocument)
    local document = nil
    if type(initialDocument) == "string" and initialDocument ~= "" then
        document = ScreenLayoutEditor.deserializeDocument(initialDocument, screenWidth, screenHeight)
    elseif type(initialDocument) == "table" then
        document = ScreenLayoutEditor.normalizeDocument(initialDocument, screenWidth, screenHeight)
    end
    if not document then
        document = ScreenLayoutEditor.createDefaultDocument(screenWidth, screenHeight)
    end

    local serialized = ScreenLayoutEditor.serializeDocument(document)
    return {
        metrics = ScreenLayoutEditor.computeMetrics(screenWidth, screenHeight),
        document = document,
        operation = nil,
        documentDirty = false,
        lastCommittedSerialized = serialized,
        lastCommittedHash = ScreenLayoutEditor.hashText(serialized),
        lastOutputEnvelope = "",
        frameFontCache = {},
        pointerData = { cursorX = 0, cursorY = 0, pressed = false, down = false, released = false },
        pointerResult = { selectedChanged = false, documentChanged = false, committed = false }
    }
end

function ScreenLayoutEditor.applyPointerFrame(state, pointer)
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
        selected = ScreenLayoutEditor.findElement(state.document, state.document.selectedId)
    end

    if pressed and hasCursor then
        if selected and selected.resizable ~= false then
            local handleName = ScreenLayoutEditor.hitResizeHandle(state.metrics, selected, cursorX, cursorY)
            if handleName then
                beginResize(state, selected, handleName)
                return result
            end
        end

        local hit = ScreenLayoutEditor.pickTopmostElement(state.document, cursorX, cursorY)
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
        local element = ScreenLayoutEditor.findElement(state.document, state.operation.elementId)
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

    if released then
        state.operation = nil
        if state.documentDirty then
            result.committed = ScreenLayoutEditor.commitDocument(state)
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

    local handles = ScreenLayoutEditor.getHandleRects(state.metrics, element)
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

    local selectedText = string.format("Selected: none  rev=%d", state.document.revision or 0)
    if state.document.selectedId then
        local selected = ScreenLayoutEditor.findElement(state.document, state.document.selectedId)
        if selected then
            selectedText = string.format(
                "Selected: %s  x=%d y=%d w=%d h=%d  rev=%d",
                selected.id,
                math.floor(selected.x + 0.5),
                math.floor(selected.y + 0.5),
                math.floor(selected.w + 0.5),
                math.floor(selected.h + 0.5),
                state.document.revision or 0
            )
        end
    end

    local modeText = "Click to select, drag inside to move, drag corner handles to resize"
    setNextFillColor(layer, 1.0, 0.68, 0.22, 1.0)
    addTextWithFontRetry(layer, nil, font, math.max(18, math.floor(screenHeight / 42)), 0, modeText, 44, screenHeight - 42, frameFontCache)
    setNextFillColor(layer, 0.72, 0.96, 1.0, 1.0)
    addTextWithFontRetry(layer, nil, font, math.max(18, math.floor(screenHeight / 42)), 0, selectedText, 44, screenHeight - 16, frameFontCache)
end

local function getInitialDocumentText()
    if type(SCREEN_LAYOUT_EDITOR_INITIAL_DOCUMENT) == "string" and SCREEN_LAYOUT_EDITOR_INITIAL_DOCUMENT ~= "" then
        return SCREEN_LAYOUT_EDITOR_INITIAL_DOCUMENT
    end
    return nil
end

local function getState()
    local screenWidth, screenHeight = getResolution()
    if type(SCREEN_LAYOUT_EDITOR_STATE) ~= "table" or not SCREEN_LAYOUT_EDITOR_STATE.initialized then
        local state = ScreenLayoutEditor.createState(screenWidth, screenHeight, getInitialDocumentText())
        state.initialized = true
        SCREEN_LAYOUT_EDITOR_STATE = state
    end

    local state = SCREEN_LAYOUT_EDITOR_STATE
    if state.metrics.screenWidth ~= screenWidth or state.metrics.screenHeight ~= screenHeight then
        state.metrics = ScreenLayoutEditor.computeMetrics(screenWidth, screenHeight)
    end

    return state, screenHeight
end

local function runRenderScript()
    local state, screenHeight = getState()
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
    ScreenLayoutEditor.applyPointerFrame(state, pointerData)

    setBackgroundColor(0.06, 0.06, 0.07)

    local layer = createLayer()

    for index = 1, #state.document.elements do
        local element = state.document.elements[index]
        drawRoundedElement(layer, element)
        drawElementText(layer, element, frameFontCache)
    end

    if state.document.selectedId then
        local selected = ScreenLayoutEditor.findElement(state.document, state.document.selectedId)
        if selected then
            drawSelectionOverlay(state, layer, selected)
        end
    end

    drawHud(state, layer, screenHeight, frameFontCache)

    local envelope = ScreenLayoutEditor.getOutputEnvelope(state)
    if envelope ~= "" then
        pcall(setOutput, envelope)
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
