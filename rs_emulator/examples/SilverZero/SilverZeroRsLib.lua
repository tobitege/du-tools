-- SilverZero shared RenderScript helper library
-- Purpose-built helpers for screen conversions with reusable panel, frame, text, and badge helpers.

local Library = {}

local function clamp(value, low, high)
    if value < low then
        return low
    end
    if value > high then
        return high
    end
    return value
end

local function toScale(value, scale)
    return value * scale
end

local function setColor(fill, stroke)
    return function(layer, color)
        if fill then
            setNextFillColor(layer, color[1], color[2], color[3], color[4])
        end
        if stroke then
            setNextStrokeColor(layer, color[1], color[2], color[3], color[4])
        end
        if not fill and not stroke then
            setNextFillColor(layer, 1, 1, 1, 1)
        end
    end
end

Library.setColor = setColor

Library.Themes = {
    SilverZero = {
        background = { 0.01, 0.01, 0.03, 1 },
        panelFill = { 0.20, 0.05, 0.05, 0.92 },
        panelStroke = { 0.95, 0.12, 0.12, 0.95 },
        panelInset = { 0.30, 0.18, 0.16, 0.25 },
        accent = { 1.00, 0.45, 0.00, 0.90 },
        accentStrong = { 1.00, 0.62, 0.24, 0.95 },
        textPrimary = { 0.98, 0.98, 1.00, 1 },
        textMuted = { 0.70, 0.75, 0.88, 1 },
        textDim = { 0.65, 0.70, 0.78, 1 },
    },
}

Library.Align = {
    Left = AlignH_Left,
    Center = AlignH_Center,
    Right = AlignH_Right,
    Top = AlignV_Top,
    Middle = AlignV_Middle,
    Bottom = AlignV_Bottom,
    Baseline = AlignV_Baseline,
    Descender = AlignV_Descender,
}

local function normalizedAlign(value, mapping)
    if type(value) == "number" then
        return value
    end
    return mapping[value] or mapping.Left or mapping.Top
end

local function layoutToScale(screenW, screenH, sourceW, sourceH, inset)
    inset = inset or 0.06
    local contentPadX = screenW * inset
    local contentPadY = screenH * inset
    local contentW = math.max(1, screenW - 2 * contentPadX)
    local contentH = math.max(1, screenH - 2 * contentPadY)

    local sx = contentW / sourceW
    local sy = contentH / sourceH
    local scale = clamp(math.min(sx, sy), 0.05, 10)

    local scaledW = sourceW * scale
    local scaledH = sourceH * scale
    local x = (screenW - scaledW) * 0.5
    local y = (screenH - scaledH) * 0.5

    return {
        screenW = screenW,
        screenH = screenH,
        sourceW = sourceW,
        sourceH = sourceH,
        scale = scale,
        x = x,
        y = y,
    }
end

function Library.layoutForScreen(screenW, screenH, sourceW, sourceH, inset)
    return layoutToScale(screenW, screenH, sourceW, sourceH, inset)
end

function Library.orientation(screenW, screenH)
    if screenW >= screenH then
        return "landscape"
    end
    return "portrait"
end

function Library.scaleFontSize(fontBaseSize, layout)
    local scale = layout.scale
    local fontScale = scale
    if scale > 1 then
        fontScale = 1 + (scale - 1) * 0.35
    end
    return math.max(1, clamp(math.floor(fontBaseSize * fontScale + 0.5), 1, 500))
end

function Library.time()
    return getTime()
end

function Library.animLoop(frames)
    requestAnimationFrame(frames or 1)
end

function Library.fract(value)
    return value - math.floor(value)
end

function Library.pulse(minValue, maxValue, speed, offset)
    local now = getTime()
    local wave = (math.sin(now * (speed or 1) + (offset or 0)) + 1) * 0.5
    return minValue + (maxValue - minValue) * wave
end

function Library.wave(speed, offset)
    return math.sin(getTime() * (speed or 1) + (offset or 0))
end

function Library.saw(speed, offset)
    return Library.fract(getTime() * (speed or 1) + (offset or 0))
end

function Library.breatheColor(color, alphaMin, alphaMax, speed, offset)
    return {
        color[1],
        color[2],
        color[3],
        Library.pulse(alphaMin, alphaMax, speed, offset),
    }
end

function Library.toScreenX(layout, sourceX)
    return layout.x + sourceX * layout.scale
end

function Library.toScreenY(layout, sourceY)
    return layout.y + sourceY * layout.scale
end

function Library.toScreenW(layout, sourceW)
    return sourceW * layout.scale
end

function Library.toScreenH(layout, sourceH)
    return sourceH * layout.scale
end

function Library.font(fontName, size)
    return loadFont(fontName, size)
end

function Library.withFontSize(font, size)
    setFontSize(font, size)
    return font
end

function Library.createLayers(...)
    local result = {}
    local names = { ... }
    for i = 1, #names do
        result[names[i]] = createLayer()
    end
    return result
end

function Library.panel(layer, layout, bounds, theme, options)
    options = options or {}
    local x = Library.toScreenX(layout, bounds.x)
    local y = Library.toScreenY(layout, bounds.y)
    local w = Library.toScreenW(layout, bounds.w)
    local h = Library.toScreenH(layout, bounds.h)
    local radius = Library.toScreenW(layout, options.radius or 6)

    if options.fillColor then
        local c = options.fillColor
        setNextFillColor(layer, c[1], c[2], c[3], c[4])
    else
        local c = theme.panelFill
        setNextFillColor(layer, c[1], c[2], c[3], c[4])
    end

    if options.strokeColor then
        local c = options.strokeColor
        setNextStrokeColor(layer, c[1], c[2], c[3], c[4])
    else
        local c = theme.panelStroke
        setNextStrokeColor(layer, c[1], c[2], c[3], c[4])
    end

    setNextStrokeWidth(layer, options.strokeWidth or (2 * layout.scale))
    addBoxRounded(layer, x, y, w, h, math.max(1, radius))

    if options.innerInset then
        local inset = Library.toScreenW(layout, options.innerInset)
        local iC = options.innerColor or theme.panelInset
        setNextFillColor(layer, 0, 0, 0, 0)
        setNextStrokeColor(layer, iC[1], iC[2], iC[3], iC[4])
        setNextStrokeWidth(layer, math.max(1, 1 * layout.scale))
        addBoxRounded(
            layer,
            x + inset,
            y + inset,
            math.max(1, w - inset * 2),
            math.max(1, h - inset * 2),
            math.max(1, radius - inset)
        )
    end

    return {
        x = x,
        y = y,
        w = w,
        h = h,
    }
end

function Library.frame(layer, layout, bounds, theme, options)
    options = options or {}
    local x = Library.toScreenX(layout, bounds.x)
    local y = Library.toScreenY(layout, bounds.y)
    local w = Library.toScreenW(layout, bounds.w)
    local h = Library.toScreenH(layout, bounds.h)

    local lineColor = options.color or theme.accent
    setNextFillColor(layer, 0, 0, 0, 0)
    setNextStrokeColor(layer, lineColor[1], lineColor[2], lineColor[3], lineColor[4])
    setNextStrokeWidth(layer, math.max(1, (options.strokeWidth or 1.4) * layout.scale))
    addBox(layer, x, y, w, h)

    if options.cross then
        local mX = x + w * 0.5
        local mY = y + h * 0.5
        local gap = Library.toScreenW(layout, options.cross)
        local s = 2 * layout.scale
        setNextStrokeWidth(layer, s)
        addLine(layer, mX - gap, mY, mX + gap, mY)
        addLine(layer, mX, mY - gap, mX, mY + gap)
    end
end

function Library.divider(layer, layout, x1, y1, x2, y2, theme, options)
    options = options or {}
    local color = options.color or theme.panelStroke
    local width = options.width or (1 * layout.scale)
    local sx1 = Library.toScreenX(layout, x1)
    local sy1 = Library.toScreenY(layout, y1)
    local sx2 = Library.toScreenX(layout, x2)
    local sy2 = Library.toScreenY(layout, y2)
    setNextStrokeColor(layer, color[1], color[2], color[3], color[4])
    setNextStrokeWidth(layer, width)
    addLine(layer, sx1, sy1, sx2, sy2)
end

function Library.badge(layer, layout, bounds, font, text, theme, options)
    options = options or {}
    local color = options.color or theme.accent
    local fill = options.fill or { 0.15, 0.15, 0.18, 0.62 }
    local stroke = options.stroke or color
    local radius = options.radius or 3
    local x = Library.toScreenX(layout, bounds.x)
    local y = Library.toScreenY(layout, bounds.y)
    local w = Library.toScreenW(layout, bounds.w)
    local h = Library.toScreenH(layout, bounds.h)

    setNextFillColor(layer, fill[1], fill[2], fill[3], fill[4])
    setNextStrokeColor(layer, stroke[1], stroke[2], stroke[3], stroke[4])
    setNextStrokeWidth(layer, options.strokeWidth or (1 * layout.scale))
    addBoxRounded(layer, x, y, w, h, math.max(1, Library.toScreenW(layout, radius)))

    local tPad = h * 0.24
    local alignX = options.alignX or AlignH_Center
    local alignY = options.alignY or AlignV_Middle
    if options.align then
        alignX = normalizedAlign(options.align.x, {
            Left = AlignH_Left,
            Center = AlignH_Center,
            Right = AlignH_Right,
        })
        alignY = normalizedAlign(options.align.y, {
            Top = AlignV_Top,
            Middle = AlignV_Middle,
            Bottom = AlignV_Bottom,
            Baseline = AlignV_Baseline,
            Descender = AlignV_Descender,
        })
    end

    setNextTextAlign(layer, alignX, alignY)
    local c = options.textColor or theme.textPrimary
    setNextFillColor(layer, c[1], c[2], c[3], c[4])
    addText(layer, font, text, x + w * 0.5, y + h * 0.5 + tPad)
end

function Library.text(layer, layout, font, text, x, y, theme, options)
    options = options or {}
    local x2 = Library.toScreenX(layout, x)
    local y2 = Library.toScreenY(layout, y)
    local color = options.color or theme.textPrimary
    local alignX = normalizedAlign(options.alignX, {
        Left = AlignH_Left,
        Center = AlignH_Center,
        Right = AlignH_Right,
    })
    local alignY = normalizedAlign(options.alignY, {
        Top = AlignV_Top,
        Middle = AlignV_Middle,
        Bottom = AlignV_Bottom,
        Baseline = AlignV_Baseline,
        Descender = AlignV_Descender,
    })

    setNextTextAlign(layer, alignX, alignY)
    setNextFillColor(layer, color[1], color[2], color[3], color[4])
    addText(layer, font, text, x2, y2)
end

function Library.row(layer, layout, font, theme, config, leftLabel, rightLabel, options)
    options = options or {}
    local x = Library.toScreenX(layout, config.x)
    local y = Library.toScreenY(layout, config.y)
    local width = Library.toScreenW(layout, config.w)

    local labelColor = options.labelColor or theme.textPrimary
    local valueColor = options.valueColor or theme.textMuted

    local leftWidth = width * 0.58
    setNextTextAlign(layer, AlignH_Left, AlignV_Middle)
    setNextFillColor(layer, labelColor[1], labelColor[2], labelColor[3], labelColor[4])
    addText(layer, font, leftLabel, x, y)

    setNextTextAlign(layer, AlignH_Right, AlignV_Middle)
    setNextFillColor(layer, valueColor[1], valueColor[2], valueColor[3], valueColor[4])
    addText(layer, font, rightLabel, x + width, y)

    if options.showRule then
        local yRule = config.y + (options.ruleOffset or 9)
        Library.divider(layer, layout, config.x, yRule, config.x + config.w, yRule, theme, {
            color = theme.textDim,
            width = 0.8 * layout.scale,
        })
    end
end

function Library.logoMark(layer, layout, x, y, size, theme, options)
    options = options or {}
    local cx = Library.toScreenX(layout, x)
    local cy = Library.toScreenY(layout, y)
    local r = Library.toScreenW(layout, size * 0.45)
    local ring = theme.accentStrong
    local glow = theme.accent
    local thin = options.thickness or (1.2 * layout.scale)

    setNextFillColor(layer, 0, 0, 0, 0)
    setNextStrokeColor(layer, glow[1], glow[2], glow[3], glow[4])
    setNextStrokeWidth(layer, thin * 1.2)
    addCircle(layer, cx, cy, r * 1.15)

    setNextStrokeColor(layer, ring[1], ring[2], ring[3], ring[4])
    setNextStrokeWidth(layer, thin)
    addCircle(layer, cx, cy, r)

    local p = r * 0.55
    setNextStrokeColor(layer, 1, 1, 1, 0.9)
    setNextStrokeWidth(layer, thin * 0.75)
    addLine(layer, cx - p, cy, cx + p, cy)
    addLine(layer, cx, cy - p, cx, cy + p)
    addLine(layer, cx - p * 0.4, cy - p * 0.6, cx + p * 0.5, cy + p * 0.7)
end

function Library.withClip(layer, layout, bounds, callback)
    local x = Library.toScreenX(layout, bounds.x)
    local y = Library.toScreenY(layout, bounds.y)
    local w = Library.toScreenW(layout, bounds.w)
    local h = Library.toScreenH(layout, bounds.h)

    setLayerClipRect(layer, x, y, w, h)
    if callback then
        callback()
    end
    setLayerClipRect(layer, 0, 0, layout.screenW, layout.screenH)
end

return Library
