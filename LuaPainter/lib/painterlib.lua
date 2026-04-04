local P = {}

local FONT_CACHE = {}
local IMAGE_CACHE = {}

local function N(value, fallback)
    value = tonumber(value)
    if value == nil then
        return fallback
    end
    return value
end

local function GF(size)
    size = math.max(1, math.floor(N(size, 16)))
    local font = FONT_CACHE[size]
    if not font then
        font = loadFont("Play", size)
        FONT_CACHE[size] = font
    end
    return font
end

local function GI(path)
    if type(path) ~= "string" or path == "" then
        return nil
    end
    local image = IMAGE_CACHE[path]
    if not image then
        image = loadImage(path)
        IMAGE_CACHE[path] = image
    end
    return image
end

local function FC(layer, color, fallback)
    color = color or fallback
    setNextFillColor(layer, N(color[1], fallback[1]), N(color[2], fallback[2]), N(color[3], fallback[3]), N(color[4], fallback[4]))
end

local function SC(layer, color, fallback)
    color = color or fallback
    setNextStrokeColor(layer, N(color[1], fallback[1]), N(color[2], fallback[2]), N(color[3], fallback[3]), N(color[4], fallback[4]))
end

local function ST(layer, command)
    command = command or {}
    local rotation = N(command.rot, 0)
    if rotation ~= 0 then
        setNextRotation(layer, rotation)
    end
    local shadow = command.sh
    local shadowColor = shadow and shadow.c or nil
    local shadowBlur = shadow and N(shadow.b, 0) or 0
    if shadowColor and shadowBlur > 0 then
        setNextShadow(layer, shadowBlur, N(shadowColor[1], 0), N(shadowColor[2], 0), N(shadowColor[3], 0), N(shadowColor[4], 0))
    end
end

function P.bg(r, g, b)
    setBackgroundColor(N(r, 0), N(g, 0), N(b, 0))
end

function P.ly()
    return createLayer()
end

function P.bx(layer, command)
    ST(layer, command)
    FC(layer, command and command.f, {0.2, 0.2, 0.2, 1})
    SC(layer, command and command.s, {1, 1, 1, 1})
    setNextStrokeWidth(layer, N(command and command.sw, 0))
    addBox(layer, N(command and command.x, 0), N(command and command.y, 0), N(command and command.w, 0), N(command and command.h, 0))
end

function P.br(layer, command)
    ST(layer, command)
    FC(layer, command and command.f, {0.2, 0.2, 0.2, 1})
    SC(layer, command and command.s, {1, 1, 1, 1})
    setNextStrokeWidth(layer, N(command and command.sw, 0))
    addBoxRounded(layer, N(command and command.x, 0), N(command and command.y, 0), N(command and command.w, 0), N(command and command.h, 0), N(command and command.r, 0))
end

function P.ci(layer, command)
    ST(layer, command)
    FC(layer, command and command.f, {0.2, 0.2, 0.2, 1})
    SC(layer, command and command.s, {1, 1, 1, 1})
    setNextStrokeWidth(layer, N(command and command.sw, 0))
    local x = N(command and command.x, 0)
    local y = N(command and command.y, 0)
    local w = N(command and command.w, 0)
    local h = N(command and command.h, 0)
    addCircle(layer, x + w * 0.5, y + h * 0.5, math.min(w, h) * 0.5)
end

function P.tr(layer, command)
    ST(layer, command)
    FC(layer, command and command.f, {0.2, 0.2, 0.2, 1})
    SC(layer, command and command.s, {1, 1, 1, 1})
    setNextStrokeWidth(layer, N(command and command.sw, 0))
    local x = N(command and command.x, 0)
    local y = N(command and command.y, 0)
    local w = N(command and command.w, 0)
    local h = N(command and command.h, 0)
    addTriangle(layer, x, y, x + w, y, x, y + h)
end

function P.qd(layer, command)
    ST(layer, command)
    FC(layer, command and command.f, {0.2, 0.2, 0.2, 1})
    SC(layer, command and command.s, {1, 1, 1, 1})
    setNextStrokeWidth(layer, N(command and command.sw, 0))
    local x = N(command and command.x, 0)
    local y = N(command and command.y, 0)
    local w = N(command and command.w, 0)
    local h = N(command and command.h, 0)
    local inset = N(command and command.qi, 0.125)
    addQuad(layer, x, y, x + w * (1 - inset), y + h * inset, x + w, y + h, x + w * inset, y + h * (1 - inset))
end

function P.bz(layer, command)
    ST(layer, command)
    SC(layer, command and command.s, {1, 1, 1, 1})
    setNextStrokeWidth(layer, N(command and command.sw, 2))
    local x = N(command and command.x, 0)
    local y = N(command and command.y, 0)
    local w = N(command and command.w, 0)
    local h = N(command and command.h, 0)
    addBezier(layer, x, y + h, x + w * 0.5, y, x + w, y + h)
end

function P.ln(layer, command)
    ST(layer, command)
    SC(layer, command and command.s, {1, 1, 1, 1})
    setNextStrokeWidth(layer, N(command and command.sw, 2))
    local x = N(command and command.x, 0)
    local y = N(command and command.y, 0)
    addLine(layer, x, y, x + N(command and command.w, 0), y + N(command and command.h, 0))
end

function P.ig(layer, command)
    ST(layer, command)
    if command and command.f then
        FC(layer, command.f, {0.2, 0.2, 0.2, 1})
    end
    local image = GI(command and command.src or nil)
    if not image then
        return
    end
    addImage(layer, image, N(command and command.x, 0), N(command and command.y, 0), N(command and command.w, 0), N(command and command.h, 0))
end

function P.tx(layer, command)
    local lines = command and command.l or nil
    if type(lines) ~= "table" or #lines == 0 then
        return
    end
    ST(layer, command)
    SC(layer, command and command.s, {0, 0, 0, 0})
    setNextStrokeWidth(layer, N(command and command.sw, 0))
    local size = math.max(1, math.floor(N(command and command.ts, 16)))
    local font = GF(size)
    if not font then
        return
    end
    local align = command and command.ta or "left"
    local valign = command and command.tv or "center"
    local x = N(command and command.x, 0) + 12
    local y = N(command and command.y, 0)
    local w = N(command and command.w, 0)
    local h = N(command and command.h, 0)
    local alignH = AlignH_Left
    local alignV = AlignV_Middle
    if align == "center" then
        x = x + w * 0.5 - 12
        alignH = AlignH_Center
    elseif align == "right" then
        x = x + w - 24
        alignH = AlignH_Right
    end
    if valign == "top" then
        alignV = AlignV_Top
    elseif valign == "bottom" then
        alignV = AlignV_Bottom
    end
    local gap = math.max(2, math.floor(size * 0.2))
    local blockHeight = #lines * size + (#lines - 1) * gap
    local startY = y + h * 0.5 - (blockHeight - size) * 0.5
    if valign == "top" then
        startY = y + 12
    elseif valign == "bottom" then
        startY = y + h - 12 - (blockHeight - size)
    end
    local color = command and command.tc or {1, 1, 1, 1}
    for index = 1, #lines do
        setNextTextAlign(layer, alignH, alignV)
        FC(layer, color, {1, 1, 1, 1})
        addText(layer, font, tostring(lines[index] or ""), x, startY + (index - 1) * (size + gap))
    end
end

return P
