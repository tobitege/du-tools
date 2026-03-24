-- SvgParser.lua
-- Pure-Lua SVG/HTML parser for the SimpleSignS subset.
-- No external dependencies (no glue, lpeg, expat, Cairo, etc.).
--
-- Supported:
--   - CSS :root { --var: #color; } declarations
--   - var(--name) references in fill/style attributes
--   - Hex colors: #rgb, #rgba, #rrggbb, #rrggbbaa
--   - HTML elements: <style>, <div>, <svg>, <g>, <path>
--   - Attributes: id, class, viewBox, width, height, fill, transform, style, enable-background
--   - SVG transforms: translate(tx,ty), scale(sx,sy), matrix(a,b,c,d,e,f)
--   - SVG path d: M m L l H h V v C c S s Q q T t A a Z z
--   - Nested group transform flattening
--
-- Unsupported / not implemented:
--   - Full CSS parsing (only :root vars extracted)
--   - Gradients, patterns, masks, clipPaths
--   - Text, image, use elements
--   - rx/ry on rect, circle, ellipse
--   - preserveAspectRatio, align
--   - opacity, fill-rule, stroke attributes
--   - CSS selectors other than :root
--   - vw/vh units

local M = {}

-- ============================================================
-- Color parsing
-- ============================================================

local function hexToRgb(s)
    if not s or s:sub(1, 1) ~= "#" then return nil end
    s = s:sub(2)
    local r, g, b, a
    if #s == 3 then
        r = tonumber(s:sub(1, 1):rep(2), 16)
        g = tonumber(s:sub(2, 2):rep(2), 16)
        b = tonumber(s:sub(3, 3):rep(2), 16)
        a = 1.0
    elseif #s == 4 then
        r = tonumber(s:sub(1, 1):rep(2), 16)
        g = tonumber(s:sub(2, 2):rep(2), 16)
        b = tonumber(s:sub(3, 3):rep(2), 16)
        a = tonumber(s:sub(4, 4):rep(2), 16) / 255
    elseif #s == 6 then
        r = tonumber(s:sub(1, 2), 16)
        g = tonumber(s:sub(3, 4), 16)
        b = tonumber(s:sub(5, 6), 16)
        a = 1.0
    elseif #s == 8 then
        r = tonumber(s:sub(1, 2), 16)
        g = tonumber(s:sub(3, 4), 16)
        b = tonumber(s:sub(5, 6), 16)
        a = tonumber(s:sub(7, 8), 16) / 255
    end
    if r and g and b and a then
        return { r / 255, g / 255, b / 255, a }
    end
    return nil
end

function M.parseColor(s, vars)
    if not s or s == "none" or s == "" then
        return nil
    end
    local varMatch = s:match("^var%(%s*%-%-%S+%s*%)%s*$")
    if varMatch then
        local varName = s:match("^var%(%s*%-%-(%S+)%s*%)%s*$")
        if varName and vars and vars[varName] then
            return M.parseColor(vars[varName], vars)
        end
        return nil
    end
    return hexToRgb(s)
end

-- ============================================================
-- Transform parsing
-- ============================================================

local function parseTransform(s)
    if not s or s == "" then return nil end
    local result = { 1, 0, 0, 1, 0, 0 } -- identity matrix [a b c d e f]

    local function parseNumbers(argString)
        local values = {}
        local pos = 1
        while pos <= #argString do
            while pos <= #argString and not argString:sub(pos, pos):match("[%+%-%d%.]") do
                pos = pos + 1
            end
            if pos > #argString then
                break
            end

            local start = pos
            local c = argString:sub(pos, pos)
            if c == "+" or c == "-" then
                pos = pos + 1
            end

            while pos <= #argString and argString:sub(pos, pos):match("%d") do
                pos = pos + 1
            end

            if pos <= #argString and argString:sub(pos, pos) == "." then
                pos = pos + 1
                while pos <= #argString and argString:sub(pos, pos):match("%d") do
                    pos = pos + 1
                end
            end

            if pos <= #argString and argString:sub(pos, pos):match("[eE]") then
                local expPos = pos
                pos = pos + 1
                if pos <= #argString and argString:sub(pos, pos):match("[%+%-]") then
                    pos = pos + 1
                end
                local expDigitsStart = pos
                while pos <= #argString and argString:sub(pos, pos):match("%d") do
                    pos = pos + 1
                end
                if expDigitsStart == pos then
                    pos = expPos
                end
            end

            local value = tonumber(argString:sub(start, pos - 1))
            if value ~= nil then
                table.insert(values, value)
            elseif pos == start then
                pos = pos + 1
            end
        end
        return values
    end

    local function composeInPlace(a, b, c, d, e, f)
        local na = result[1] * a + result[3] * b
        local nb = result[2] * a + result[4] * b
        local nc = result[1] * c + result[3] * d
        local nd = result[2] * c + result[4] * d
        local ne = result[1] * e + result[3] * f + result[5]
        local nf = result[2] * e + result[4] * f + result[6]
        result[1], result[2], result[3], result[4], result[5], result[6] = na, nb, nc, nd, ne, nf
    end

    for name, args in s:gmatch("([%a]+)%s*%(([^)]*)%)") do
        local values = parseNumbers(args)
        local lower = name:lower()
        if lower == "translate" then
            composeInPlace(1, 0, 0, 1, values[1] or 0, values[2] or 0)
        elseif lower == "scale" then
            local sx = values[1] or 1
            local sy = values[2]
            if sy == nil then
                sy = sx
            end
            composeInPlace(sx, 0, 0, sy, 0, 0)
        elseif lower == "matrix" then
            composeInPlace(
                values[1] or 1,
                values[2] or 0,
                values[3] or 0,
                values[4] or 1,
                values[5] or 0,
                values[6] or 0
            )
        end
    end
    return result
end

M.parseTransform = parseTransform

function M.composeTransforms(t1, t2)
    if not t1 then return t2 end
    if not t2 then return t1 end
    local a1, b1, c1, d1, e1, f1 = t1[1], t1[2], t1[3], t1[4], t1[5], t1[6]
    local a2, b2, c2, d2, e2, f2 = t2[1], t2[2], t2[3], t2[4], t2[5], t2[6]
    return {
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    }
end

-- ============================================================
-- Path data parsing (for the d attribute)
-- ============================================================

local pathCmdMap = {
    m = "m", M = "M",
    l = "l", L = "L",
    h = "h", H = "H",
    v = "v", V = "V",
    c = "c", C = "C",
    s = "s", S = "S",
    q = "q", Q = "Q",
    t = "t", T = "T",
    a = "a", A = "A",
    z = "z", Z = "Z",
}

local function parsePath(s)
    if not s or s == "" then return nil end
    local tokens = {}
    local i = 1
    local function skipSpaces()
        while i <= #s and s:sub(i, i):match("%s") do i = i + 1 end
    end
    local function peek()
        return s:sub(i, i)
    end
    local function consume(c)
        if i <= #s and s:sub(i, i) == c then
            i = i + 1
            return true
        end
        return false
    end
    local function readNumber()
        skipSpaces()
        if i > #s then return nil end
        local start = i
        if s:sub(i, i) == "+" or s:sub(i, i) == "-" then i = i + 1 end
        local dotSeen = false
        while i <= #s do
            local c = s:sub(i, i)
            if c:match("%d") then
                i = i + 1
            elseif c == "." and not dotSeen then
                dotSeen = true
                i = i + 1
            else
                break
            end
        end
        if i > #s and start == i then return nil end
        if i > #s and s:sub(i, i) == "." then
        end
        if i <= #s and (s:sub(i, i) == "e" or s:sub(i, i) == "E") then
            i = i + 1
            if i <= #s and (s:sub(i, i) == "+" or s:sub(i, i) == "-") then i = i + 1 end
            while i <= #s and s:sub(i, i):match("%d") do i = i + 1 end
        end
        if start == i then return nil end
        return tonumber(s:sub(start, i - 1)) or 0
    end

    while i <= #s do
        skipSpaces()
        if i > #s then break end
        local c = s:sub(i, i)
        if pathCmdMap[c] then
            table.insert(tokens, { type = "cmd", value = c })
            i = i + 1
        elseif c == "," then
            i = i + 1
        elseif c:match("[%+%-%d%.]") then
            local num = readNumber()
            if num ~= nil then
                table.insert(tokens, { type = "num", value = num })
            else
                i = i + 1
            end
        else
            i = i + 1
        end
    end
    return tokens
end

M.parsePath = parsePath

-- ============================================================
-- Simple HTML tokenizer / extractor
-- ============================================================

local function extractRootVars(cssText)
    local vars = {}
    local rootStart = cssText:lower():find(":root%s*%{")
    if not rootStart then return vars end
    local braceCount = 0
    local blockEnd = nil
    for i = rootStart, #cssText do
        local c = cssText:sub(i, i)
        if c == "{" then
            braceCount = braceCount + 1
        elseif c == "}" then
            braceCount = braceCount - 1
            if braceCount == 0 then
                blockEnd = i
                break
            end
        end
    end
    if not blockEnd then return vars end
    local block = cssText:sub(rootStart, blockEnd)
    for name, val in block:gmatch("%-%-([%w%-]+)%s*:%s*([^;]+)") do
        local cleanVal = val:gsub("%s+", ""):gsub("}", "")
        if cleanVal ~= "" then
            vars[name] = cleanVal
        end
    end
    return vars
end

local function findDivText(html, className)
    local pattern = "<div%s+[^>]*class%s*=%s*[\"']?[^\"'>]*" .. className .. "[^>]*>"
    local startPos = html:find(pattern)
    if not startPos then return nil end
    local contentStart = html:find(">", startPos)
    if not contentStart then return nil end
    local contentEnd = html:find("</div>", contentStart)
    if not contentEnd then return nil end
    local text = html:sub(contentStart + 1, contentEnd - 1)
    text = text:gsub("%s+", " ")
    text = text:gsub("^%s+", "")
    text = text:gsub("%s+$", "")
    return text
end

local function parseTagAttrs(tagStr)
    local attrs = {}
    local pos = 1
    local function skipSpaces()
        while pos <= #tagStr and tagStr:sub(pos, pos):match("%s") do pos = pos + 1 end
    end
    while pos <= #tagStr do
        skipSpaces()
        if pos > #tagStr then break end
        local c = tagStr:sub(pos, pos)
        if c == ">" or c == "/" then break end
        local nameStart = pos
        while pos <= #tagStr and not tagStr:sub(pos, pos):match("[%s=/>]") do pos = pos + 1 end
        if pos <= #tagStr and tagStr:sub(pos, pos) == "=" then
            local name = tagStr:sub(nameStart, pos - 1)
            pos = pos + 1
            skipSpaces()
            local value
            if pos <= #tagStr and (tagStr:sub(pos, pos) == "\"" or tagStr:sub(pos, pos) == "'") then
                local quote = tagStr:sub(pos, pos)
                pos = pos + 1
                local valueStart = pos
                while pos <= #tagStr and tagStr:sub(pos, pos) ~= quote do pos = pos + 1 end
                value = tagStr:sub(valueStart, pos - 1)
                pos = pos + 1
            else
                local valueStart = pos
                while pos <= #tagStr and not tagStr:sub(pos, pos):match("[%s/>]") do pos = pos + 1 end
                value = tagStr:sub(valueStart, pos - 1)
            end
            attrs[name] = value
        else
            if pos > nameStart then
                attrs[tagStr:sub(nameStart, pos - 1)] = "true"
            end
        end
    end
    return attrs
end

local function extractSvgElements(html)
    local roots = {}
    local stack = {}
    local pos = 1
    while pos <= #html do
        local tagStart = html:find("<", pos, true)
        if not tagStart then break end
        local tagEnd = html:find(">", tagStart)
        if not tagEnd then break end
        local tagContent = html:sub(tagStart + 1, tagEnd - 1)
        pos = tagEnd + 1

        if not tagContent:match("^%s*!") and not tagContent:match("^%s*%?") then
            local closeName = tagContent:match("^%s*/%s*([a-zA-Z]+)")
            if closeName then
                closeName = closeName:lower()
                while #stack > 0 do
                    local node = stack[#stack]
                    table.remove(stack)
                    if node.tag == closeName then
                        break
                    end
                end
            else
                local tagName = tagContent:match("^%s*([a-zA-Z]+)")
                if tagName then
                    tagName = tagName:lower()
                    if tagName == "svg" or tagName == "g" or tagName == "path" then
                        local node = {
                            tag = tagName,
                            attrs = parseTagAttrs(tagContent),
                            children = {},
                        }

                        local parent = stack[#stack]
                        if parent then
                            table.insert(parent.children, node)
                        end

                        if tagName == "svg" and not parent then
                            table.insert(roots, node)
                        end

                        local isSelfClosing = tagContent:sub(-1) == "/" or tagName == "path"
                        if not isSelfClosing then
                            table.insert(stack, node)
                        end
                    end
                end
            end
        end
    end
    return roots
end

local function extractStyleBlocks(html)
    local blocks = {}
    for block in html:gmatch("<style[^>]*>(.-)</style>") do
        table.insert(blocks, block)
    end
    return blocks
end

-- ============================================================
-- Flatten SVG groups into a flat list of paths with resolved attrs
-- ============================================================

local function flattenSvgElement(elem, parentTransform, inheritedFill, svgs, index)
    local transform = parentTransform
    if elem.attrs and elem.attrs.transform then
        local t = M.parseTransform(elem.attrs.transform)
        if t then
            transform = M.composeTransforms(parentTransform, t)
        end
    end
    local fill = inheritedFill
    if elem.attrs and elem.attrs.fill then
        fill = elem.attrs.fill
    end
    if elem.tag == "path" then
        local pathElem = {
            d = elem.attrs and elem.attrs.d or nil,
            fill = fill,
            transform = transform,
            index = index,
        }
        table.insert(svgs, pathElem)
    elseif elem.tag == "g" then
        for _, child in ipairs(elem.children or {}) do
            flattenSvgElement(child, transform, fill, svgs, index)
        end
    end
end

local function parseSvgElement(elem, vars, svgIndex)
    local viewBox = nil
    local width = nil
    local height = nil
    local style = nil
    local fill = nil
    local transform = nil
    if elem.attrs then
        viewBox = elem.attrs.viewBox
        width = elem.attrs.width
        height = elem.attrs.height
        style = elem.attrs.style
        fill = elem.attrs.fill
        if elem.attrs.transform then
            transform = M.parseTransform(elem.attrs.transform)
        end
    end
    local resolvedFill = M.parseColor(fill, vars)
    local items = {}
    for _, child in ipairs(elem.children or {}) do
        flattenSvgElement(child, transform, fill, items, svgIndex)
    end
    return {
        viewBox = viewBox,
        width = width,
        height = height,
        style = style,
        fill = fill,
        resolvedFill = resolvedFill,
        transform = transform,
        items = items,
    }
end

-- ============================================================
-- Main parse function
-- ============================================================

function M.parse(html)
    local vars = {}
    local styleBlocks = extractStyleBlocks(html)
    for _, block in ipairs(styleBlocks) do
        local blockVars = extractRootVars(block)
        for k, v in pairs(blockVars) do
            vars[k] = v
        end
    end
    local messageText = findDivText(html, "message")
    local svgElements = extractSvgElements(html)
    local svgEntries = {}
    for i, elem in ipairs(svgElements) do
        if elem.tag == "svg" then
            local entry = parseSvgElement(elem, vars, i)
            entry.id = elem.attrs and elem.attrs.id
            entry.class = elem.attrs and elem.attrs.class
            table.insert(svgEntries, entry)
        end
    end
    return {
        vars = vars,
        message = messageText,
        svgs = svgEntries,
    }
end

return M
