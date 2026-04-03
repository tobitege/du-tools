local inputPath = arg[1]
local outputPath = arg[2] or inputPath

if not inputPath or inputPath == "" then
    io.stderr:write("Usage: lua format-layout.lua <input.lua> [output.lua]\n")
    os.exit(1)
end

local function readFile(path)
    local handle = assert(io.open(path, "rb"))
    local data = handle:read("*a")
    handle:close()
    return data
end

local function writeFile(path, data)
    local handle = assert(io.open(path, "wb"))
    handle:write(data)
    handle:close()
end

local function startsWithBom(text)
    return text:sub(1, 3) == string.char(0xEF, 0xBB, 0xBF)
end

local function parseRootName(source)
    return source:match("^%s*local%s+([%a_][%w_]*)%s*=")
        or source:match("\n%s*local%s+([%a_][%w_]*)%s*=")
end

local function isArray(value)
    if type(value) ~= "table" then
        return false
    end
    local count = 0
    for key in pairs(value) do
        if type(key) ~= "number" or key < 1 or key % 1 ~= 0 then
            return false
        end
        count = count + 1
    end
    for index = 1, count do
        if value[index] == nil then
            return false
        end
    end
    return true
end

local function isPrimitive(value)
    local kind = type(value)
    return kind == "number" or kind == "string" or kind == "boolean"
end

local function quoteString(value)
    return string.format("%q", value)
end

local rootOrder = {
    "version",
    "revision",
    "id",
    "name",
    "selectedId",
    "screenWidth",
    "screenHeight",
    "elements",
}

local elementOrder = {
    "id",
    "type",
    "visible",
    "x",
    "y",
    "w",
    "h",
    "radius",
    "fill",
    "stroke",
    "strokeWidth",
    "textLines",
    "textColor",
    "textSize",
    "textAlign",
    "rotation",
    "shadowBlur",
    "shadowColor",
    "imageSrc",
    "imageFit",
    "quadInset",
}

local function appendOrderedKeys(target, source, preferred)
    local seen = {}
    for _, key in ipairs(preferred) do
        if source[key] ~= nil then
            target[#target + 1] = key
            seen[key] = true
        end
    end
    local extra = {}
    for key in pairs(source) do
        if not seen[key] then
            extra[#extra + 1] = key
        end
    end
    table.sort(extra, function(a, b)
        return tostring(a) < tostring(b)
    end)
    for _, key in ipairs(extra) do
        target[#target + 1] = key
    end
end

local function formatNumber(value)
    if value ~= value then
        error("NaN values are not supported")
    end
    if value == math.huge or value == -math.huge then
        error("Infinite values are not supported")
    end
    local text = string.format("%.4f", value)
    text = text:gsub("(%..-)0+$", "%1")
    text = text:gsub("%.$", "")
    if text == "-0" then
        text = "0"
    end
    return text
end

local function formatInlineArray(items)
    local parts = {}
    for index = 1, #items do
        local value = items[index]
        local kind = type(value)
        if kind == "number" then
            parts[#parts + 1] = formatNumber(value)
        elseif kind == "string" then
            parts[#parts + 1] = quoteString(value)
        elseif kind == "boolean" then
            parts[#parts + 1] = tostring(value)
        else
            return nil
        end
    end
    if #parts == 0 then
        return "{  }"
    end
    return "{ " .. table.concat(parts, ", ") .. " }"
end

local function formatValue(value, indentLevel, keyContext)
    local indent = string.rep("    ", indentLevel)
    local nextIndent = string.rep("    ", indentLevel + 1)
    local kind = type(value)

    if kind == "number" then
        return formatNumber(value)
    end
    if kind == "string" then
        return quoteString(value)
    end
    if kind == "boolean" then
        return tostring(value)
    end
    if kind ~= "table" then
        error("Unsupported value type: " .. kind)
    end

    if isArray(value) then
        local inline = formatInlineArray(value)
        if inline then
            return inline
        end
        local lines = { "{" }
        for index = 1, #value do
            lines[#lines + 1] = nextIndent .. formatValue(value[index], indentLevel + 1) .. ","
        end
        lines[#lines + 1] = indent .. "}"
        return table.concat(lines, "\n")
    end

    local preferred = nil
    if keyContext == "__root__" then
        preferred = rootOrder
    elseif keyContext == "elements" then
        preferred = elementOrder
    end

    local keys = {}
    appendOrderedKeys(keys, value, preferred or {})

    local lines = { "{" }
    for _, key in ipairs(keys) do
        local childContext = nil
        if key == "elements" then
            childContext = "elements"
        end
        lines[#lines + 1] = nextIndent .. key .. " = " .. formatValue(value[key], indentLevel + 1, childContext) .. ","
    end
    lines[#lines + 1] = indent .. "}"
    return table.concat(lines, "\n")
end

local original = readFile(inputPath)
local hasBom = startsWithBom(original)
local source = hasBom and original:sub(4) or original
local rootName = assert(parseRootName(source), "Could not detect root local variable name")

local function loadLayout(chunkText)
    local chunk, loadError = loadstring(chunkText, "@" .. inputPath)
    if not chunk then
        return nil, loadError
    end
    setfenv(chunk, {})
    local ok, result = pcall(chunk)
    if not ok then
        return nil, result
    end
    if type(result) == "table" then
        return result
    end
    return nil, "Chunk did not return a table"
end

local layout, firstError = loadLayout(source)
if not layout then
    layout, firstError = loadLayout(source .. "\nreturn " .. rootName)
end
if not layout then
    error(firstError)
end
assert(type(layout) == "table", "Root value must be a table")

local formatted = "local " .. rootName .. " = " .. formatValue(layout, 0, "__root__") .. "\n\nreturn " .. rootName .. "\n"
if hasBom then
    formatted = string.char(0xEF, 0xBB, 0xBF) .. formatted
end

writeFile(outputPath, formatted)
