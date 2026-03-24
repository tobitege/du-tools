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

function Library.scaleColor(color, factor, alpha)
    factor = factor or 1
    return {
        color[1] * factor,
        color[2] * factor,
        color[3] * factor,
        alpha or color[4] or 1,
    }
end

function Library.toScreenX(layout, sourceX)
    return layout.x + sourceX * (layout.scaleX or layout.scale)
end

function Library.toScreenY(layout, sourceY)
    return layout.y + sourceY * (layout.scaleY or layout.scale)
end

function Library.toScreenW(layout, sourceW)
    return sourceW * (layout.scaleX or layout.scale)
end

function Library.toScreenH(layout, sourceH)
    return sourceH * (layout.scaleY or layout.scale)
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

function Library.line(layer, layout, x1, y1, x2, y2, color, width)
    color = color or { 1, 1, 1, 1 }
    setNextStrokeColor(layer, color[1], color[2], color[3], color[4] or 1)
    setNextStrokeWidth(layer, math.max(0.5, (width or 1) * layout.scale))
    addLine(
        layer,
        Library.toScreenX(layout, x1),
        Library.toScreenY(layout, y1),
        Library.toScreenX(layout, x2),
        Library.toScreenY(layout, y2)
    )
end

function Library.box(layer, layout, bounds, options)
    options = options or {}
    local x = Library.toScreenX(layout, bounds.x)
    local y = Library.toScreenY(layout, bounds.y)
    local w = Library.toScreenW(layout, bounds.w)
    local h = Library.toScreenH(layout, bounds.h)
    local fill = options.fillColor or { 0, 0, 0, 0 }
    local stroke = options.strokeColor or { 0, 0, 0, 0 }
    local strokeWidth = math.max(0.5, (options.strokeWidth or 1) * layout.scale)

    setNextFillColor(layer, fill[1], fill[2], fill[3], fill[4] or 1)
    setNextStrokeColor(layer, stroke[1], stroke[2], stroke[3], stroke[4] or 1)
    setNextStrokeWidth(layer, strokeWidth)

    if options.radius and options.radius > 0 then
        addBoxRounded(layer, x, y, w, h, math.max(1, Library.toScreenW(layout, options.radius)))
    else
        addBox(layer, x, y, w, h)
    end
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
        setNextStrokeColor(layer, lineColor[1], lineColor[2], lineColor[3], lineColor[4])
        setNextStrokeWidth(layer, s)
        addLine(layer, mX - gap, mY, mX + gap, mY)
        setNextStrokeColor(layer, lineColor[1], lineColor[2], lineColor[3], lineColor[4])
        setNextStrokeWidth(layer, s)
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

function Library.namedSymbolRow(layer, layout, entries, theme, options)
    options = options or {}

    local minSize = nil
    local maxSize = nil
    for i = 1, #entries do
        local entrySize = tonumber(entries[i].size) or 0
        if entrySize > 0 then
            if not minSize or entrySize < minSize then
                minSize = entrySize
            end
            if not maxSize or entrySize > maxSize then
                maxSize = entrySize
            end
        end
    end

    minSize = minSize or 1
    maxSize = maxSize or minSize

    local minVisualSize = options.minVisualSize or minSize
    local scaleMode = options.scaleMode or "linear"
    if scaleMode == "auto" then
        local ratio = maxSize / math.max(minSize, 0.0001)
        if ratio >= (options.logThreshold or 3.5) then
            scaleMode = "log"
        else
            scaleMode = "linear"
        end
    end

    local function scaledSize(entrySize)
        local numericSize = tonumber(entrySize) or minSize
        if numericSize <= 0 then
            numericSize = minSize
        end

        if scaleMode == "log" and maxSize > minSize then
            local maxVisualSize = options.maxVisualSize or (minVisualSize * (options.logVisualFactor or 2.8))
            local numerator = math.log(numericSize / minSize)
            local denominator = math.log(maxSize / minSize)
            local normalized = 0
            if denominator ~= 0 then
                normalized = numerator / denominator
            end
            return minVisualSize + (maxVisualSize - minVisualSize) * normalized
        end

        return numericSize * (minVisualSize / minSize)
    end

    local function drawCircle(entry, centerX, centerY, diameter)
        local radius = diameter * 0.5
        local color = entry.color or theme.accentStrong
        local fillColor = entry.fillColor or (options.fillColor or { 0.10, 0.10, 0.14, 0.90 })
        local strokeAlpha = entry.strokeAlpha or (entry.selected and (options.selectedStrokeAlpha or 0.95) or (options.strokeAlpha or 0.56))
        local strokeWidth = entry.strokeWidth or (entry.selected and (options.selectedStrokeWidth or 0.85) or (options.strokeWidth or 0.55))

        if entry.selected then
            local outlineColor = entry.selectedOutlineColor or options.selectedOutlineColor or { 1, 1, 1, 0.92 }
            local outlineWidth = entry.selectedOutlineWidth or options.selectedOutlineWidth or 0.8
            local outlinePadding = entry.selectedOutlinePadding or options.selectedOutlinePadding or 1.2
            setNextFillColor(layer, 0, 0, 0, 0)
            setNextStrokeColor(layer, outlineColor[1], outlineColor[2], outlineColor[3], outlineColor[4] or 1)
            setNextStrokeWidth(layer, math.max(1, outlineWidth * layout.scale))
            addCircle(
                layer,
                Library.toScreenX(layout, centerX),
                Library.toScreenY(layout, centerY),
                Library.toScreenW(layout, radius + outlinePadding)
            )
        end

        setNextFillColor(layer, fillColor[1], fillColor[2], fillColor[3], fillColor[4] or 1)
        setNextStrokeColor(layer, color[1], color[2], color[3], strokeAlpha)
        setNextStrokeWidth(layer, math.max(0.7, strokeWidth * layout.scale))
        addCircle(
            layer,
            Library.toScreenX(layout, centerX),
            Library.toScreenY(layout, centerY),
            Library.toScreenW(layout, radius)
        )

        if options.innerHighlight ~= false and entry.innerHighlight ~= false then
            local innerAlpha = entry.innerAlpha or (entry.selected and (options.selectedInnerAlpha or 0.22) or (options.innerAlpha or 0.12))
            local innerStrokeAlpha = entry.innerStrokeAlpha or (entry.selected and (options.selectedInnerStrokeAlpha or 0.18) or (options.innerStrokeAlpha or 0.09))
            local innerScale = entry.innerScale or (options.innerScale or 0.72)
            local innerOffsetX = entry.innerOffsetX or (options.innerOffsetX or 0.5)
            local innerOffsetY = entry.innerOffsetY or (options.innerOffsetY or -0.3)
            setNextFillColor(layer, color[1], color[2], color[3], innerAlpha)
            setNextStrokeColor(layer, 1, 1, 1, innerStrokeAlpha)
            setNextStrokeWidth(layer, math.max(0.5, (options.innerStrokeWidth or 0.3) * layout.scale))
            addCircle(
                layer,
                Library.toScreenX(layout, centerX + innerOffsetX),
                Library.toScreenY(layout, centerY + innerOffsetY),
                Library.toScreenW(layout, radius * innerScale)
            )
        end
    end

    for i = 1, #entries do
        local entry = entries[i]
        local baseSize = scaledSize(entry.size)
        local symbolSize = baseSize
        if entry.selected then
            symbolSize = math.max(
                baseSize * (entry.selectedScale or options.selectedScale or 1),
                entry.selectedMinSize or options.selectedMinSize or baseSize
            )
        end

        local centerX = entry.x or ((options.left or 0) + (i - 1) * (options.step or 12))
        local baselineY = entry.baselineY or options.baselineY or 0
        local centerY = entry.y or (baselineY - symbolSize * 0.5 + (entry.offsetY or 0))
        local shape = entry.shape or "circle"

        if type(shape) == "function" then
            shape(layer, layout, centerX, centerY, symbolSize, entry, theme, options)
        elseif shape == "circle" then
            drawCircle(entry, centerX, centerY, symbolSize)
        else
            drawCircle(entry, centerX, centerY, symbolSize)
        end

        if entry.name then
            Library.text(layer, layout, options.labelFont, entry.name, centerX, centerY - symbolSize * 0.5 - (entry.labelGap or options.labelGap or 1.2), theme, {
                alignX = AlignH_Center,
                alignY = AlignV_Bottom,
                color = entry.labelColor or (entry.selected and (options.selectedLabelColor or theme.textPrimary) or (options.labelColor or theme.textDim)),
            })
        end

        local metaText = entry.metaText or entry.meta
        if metaText and metaText ~= "" and (entry.selected or options.showMetaForAll) then
            Library.text(layer, layout, options.metaFont or options.labelFont, metaText, centerX, baselineY + (entry.metaGap or options.metaGap or 2.4), theme, {
                alignX = AlignH_Center,
                alignY = AlignV_Top,
                color = entry.metaColor or options.metaColor or theme.accentStrong,
            })
        end
    end
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
    setNextStrokeColor(layer, 1, 1, 1, 0.9)
    setNextStrokeWidth(layer, thin * 0.75)
    addLine(layer, cx, cy - p, cx, cy + p)
    setNextStrokeColor(layer, 1, 1, 1, 0.9)
    setNextStrokeWidth(layer, thin * 0.75)
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

function Library.drawPath(layer, layout, pathData, color, strokeWidth, transform)
    local scale = layout.scale
    local function applyTransform(x, y)
        if not transform then
            return x, y
        end
        return
            transform[1] * x + transform[3] * y + transform[5],
            transform[2] * x + transform[4] * y + transform[6]
    end
    local function toScreenX(x)
        return Library.toScreenX(layout, x)
    end
    local function toScreenY(y)
        return Library.toScreenY(layout, y)
    end

    local function emitLine(x1, y1, x2, y2)
        local tx1, ty1 = applyTransform(x1, y1)
        local tx2, ty2 = applyTransform(x2, y2)
        setNextStrokeColor(layer, color[1], color[2], color[3], color[4] or 1)
        setNextStrokeWidth(layer, math.max(0.5, strokeWidth * scale))
        addLine(layer, toScreenX(tx1), toScreenY(ty1), toScreenX(tx2), toScreenY(ty2))
    end

    local tokens = {}
    local pathStr = pathData or ""
    local i = 1
    while i <= #pathStr do
        local c = pathStr:sub(i, i)
        if c:match("[MmLlHhVvCcSsQqTtAaZz]") then
            table.insert(tokens, { type = "cmd", value = c })
            i = i + 1
        elseif c:match("[%+%-%d%.]") then
            local startIndex = i
            if c == "+" or c == "-" then
                i = i + 1
            end

            while i <= #pathStr and pathStr:sub(i, i):match("%d") do
                i = i + 1
            end

            if i <= #pathStr and pathStr:sub(i, i) == "." then
                i = i + 1
                while i <= #pathStr and pathStr:sub(i, i):match("%d") do
                    i = i + 1
                end
            end

            if i <= #pathStr and pathStr:sub(i, i):match("[eE]") then
                local expIndex = i
                i = i + 1
                if i <= #pathStr and pathStr:sub(i, i):match("[%+%-]") then
                    i = i + 1
                end
                local expDigitsStart = i
                while i <= #pathStr and pathStr:sub(i, i):match("%d") do
                    i = i + 1
                end
                if expDigitsStart == i then
                    i = expIndex
                end
            end

            local value = tonumber(pathStr:sub(startIndex, i - 1))
            if value ~= nil then
                table.insert(tokens, { type = "num", value = value })
            else
                i = startIndex + 1
            end
        else
            i = i + 1
        end
    end

    local cx, cy = 0, 0
    local startX, startY = 0, 0
    local tokenIndex = 1
    local currentCmd = nil
    local lastCubicCtrlX, lastCubicCtrlY = nil, nil
    local lastQuadCtrlX, lastQuadCtrlY = nil, nil

    local function hasNum(count)
        for offset = 0, count - 1 do
            local token = tokens[tokenIndex + offset]
            if not token or token.type ~= "num" then
                return false
            end
        end
        return true
    end

    local function getNum()
        if not hasNum(1) then
            return nil
        end
        local value = tokens[tokenIndex].value
        tokenIndex = tokenIndex + 1
        return value
    end

    local function cubicPoint(x0, y0, x1, y1, x2, y2, x3, y3, t)
        local inv = 1 - t
        local inv2 = inv * inv
        local inv3 = inv2 * inv
        local t2 = t * t
        local t3 = t2 * t
        return
            inv3 * x0 + 3 * inv2 * t * x1 + 3 * inv * t2 * x2 + t3 * x3,
            inv3 * y0 + 3 * inv2 * t * y1 + 3 * inv * t2 * y2 + t3 * y3
    end

    local function quadraticPoint(x0, y0, x1, y1, x2, y2, t)
        local inv = 1 - t
        local inv2 = inv * inv
        local t2 = t * t
        return
            inv2 * x0 + 2 * inv * t * x1 + t2 * x2,
            inv2 * y0 + 2 * inv * t * y1 + t2 * y2
    end

    local function arcPoints(x1, y1, rx, ry, rot, large, sweep, x2, y2)
        local points = {}
        if rx == 0 or ry == 0 then
            return points
        end
        rx = math.abs(rx)
        ry = math.abs(ry)
        local rotRad = math.rad(rot)
        local cosr = math.cos(rotRad)
        local sinr = math.sin(rotRad)
        local dx = (x1 - x2) / 2
        local dy = (y1 - y2) / 2
        local x1p = cosr * dx + sinr * dy
        local y1p = -sinr * dx + cosr * dy
        local x1pp = x1p * x1p
        local y1pp = y1p * y1p
        local lambda = x1pp / (rx * rx) + y1pp / (ry * ry)
        if lambda > 1 then
            local s = math.sqrt(lambda)
            rx = s * rx
            ry = s * ry
        end
        local den = (rx * rx * y1pp + ry * ry * x1pp)
        if den == 0 then
            return points
        end
        local a = (rx * ry * y1pp + ry * ry * x1p) / den
        local sq = math.sqrt(a * a + 1)
        local mdf = (large == sweep and -1 or 1) * math.max(0, sq - a)
        local cxp = mdf * rx * y1p / ry
        local cyp = -mdf * ry * x1p / rx
        local cx = cosr * cxp - sinr * cyp + (x1 + x2) / 2
        local cy = sinr * cxp + cosr * cyp + (y1 + y2) / 2
        local function vectorAngle(ux, uy, vx, vy)
            local dot = ux * vx + uy * vy
            local det = ux * vy - uy * vx
            return math.atan2(det, dot)
        end

        local theta = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
        local dtheta = vectorAngle(
            (x1p - cxp) / rx,
            (y1p - cyp) / ry,
            (-x1p - cxp) / rx,
            (-y1p - cyp) / ry
        )

        if sweep == 0 and dtheta > 0 then
            dtheta = dtheta - math.pi * 2
        elseif sweep ~= 0 and dtheta < 0 then
            dtheta = dtheta + math.pi * 2
        end

        local segments = math.max(1, math.ceil(math.abs(dtheta) / (math.pi / 16)))
        for j = 1, segments do
            local t = theta + j * dtheta / segments
            table.insert(points, {
                x = cx + rx * math.cos(t) * cosr - ry * math.sin(t) * sinr,
                y = cy + rx * math.cos(t) * sinr + ry * math.sin(t) * cosr
            })
        end
        return points
    end

    while tokenIndex <= #tokens do
        local token = tokens[tokenIndex]
        if token.type == "cmd" then
            currentCmd = token.value
            tokenIndex = tokenIndex + 1
        elseif currentCmd == nil then
            tokenIndex = tokenIndex + 1
        else
            local cmd = currentCmd
            local isRel = cmd == cmd:lower()
            local ucmd = cmd:upper()

            if ucmd == "M" then
                local firstMove = true
                while hasNum(2) do
                    local x = getNum()
                    local y = getNum()
                    local nx = isRel and (cx + x) or x
                    local ny = isRel and (cy + y) or y
                    if firstMove then
                        cx, cy = nx, ny
                        startX, startY = cx, cy
                        firstMove = false
                    else
                        emitLine(cx, cy, nx, ny)
                        cx, cy = nx, ny
                    end
                end
                currentCmd = isRel and "l" or "L"
                lastCubicCtrlX, lastCubicCtrlY = nil, nil
                lastQuadCtrlX, lastQuadCtrlY = nil, nil
            elseif ucmd == "L" then
                while hasNum(2) do
                    local x = getNum()
                    local y = getNum()
                    local nx = isRel and (cx + x) or x
                    local ny = isRel and (cy + y) or y
                    emitLine(cx, cy, nx, ny)
                    cx, cy = nx, ny
                end
                lastCubicCtrlX, lastCubicCtrlY = nil, nil
                lastQuadCtrlX, lastQuadCtrlY = nil, nil
            elseif ucmd == "H" then
                while hasNum(1) do
                    local x = getNum()
                    local nx = isRel and (cx + x) or x
                    emitLine(cx, cy, nx, cy)
                    cx = nx
                end
                lastCubicCtrlX, lastCubicCtrlY = nil, nil
                lastQuadCtrlX, lastQuadCtrlY = nil, nil
            elseif ucmd == "V" then
                while hasNum(1) do
                    local y = getNum()
                    local ny = isRel and (cy + y) or y
                    emitLine(cx, cy, cx, ny)
                    cy = ny
                end
                lastCubicCtrlX, lastCubicCtrlY = nil, nil
                lastQuadCtrlX, lastQuadCtrlY = nil, nil
            elseif ucmd == "C" then
                while hasNum(6) do
                    local x1 = getNum()
                    local y1 = getNum()
                    local x2 = getNum()
                    local y2 = getNum()
                    local x = getNum()
                    local y = getNum()
                    local c1x = isRel and (cx + x1) or x1
                    local c1y = isRel and (cy + y1) or y1
                    local c2x = isRel and (cx + x2) or x2
                    local c2y = isRel and (cy + y2) or y2
                    local nx = isRel and (cx + x) or x
                    local ny = isRel and (cy + y) or y
                    local segments = math.max(6, math.ceil((math.abs(nx - cx) + math.abs(ny - cy)) / 18))
                    local px, py = cx, cy
                    for step = 1, segments do
                        local qx, qy = cubicPoint(cx, cy, c1x, c1y, c2x, c2y, nx, ny, step / segments)
                        emitLine(px, py, qx, qy)
                        px, py = qx, qy
                    end
                    cx, cy = nx, ny
                    lastCubicCtrlX, lastCubicCtrlY = c2x, c2y
                    lastQuadCtrlX, lastQuadCtrlY = nil, nil
                end
            elseif ucmd == "S" then
                while hasNum(4) do
                    local x2 = getNum()
                    local y2 = getNum()
                    local x = getNum()
                    local y = getNum()
                    local c1x = cx
                    local c1y = cy
                    if currentCmd and lastCubicCtrlX and lastCubicCtrlY and (currentCmd:upper() == "C" or currentCmd:upper() == "S") then
                        c1x = cx * 2 - lastCubicCtrlX
                        c1y = cy * 2 - lastCubicCtrlY
                    end
                    local c2x = isRel and (cx + x2) or x2
                    local c2y = isRel and (cy + y2) or y2
                    local nx = isRel and (cx + x) or x
                    local ny = isRel and (cy + y) or y
                    local segments = math.max(6, math.ceil((math.abs(nx - cx) + math.abs(ny - cy)) / 18))
                    local px, py = cx, cy
                    for step = 1, segments do
                        local qx, qy = cubicPoint(cx, cy, c1x, c1y, c2x, c2y, nx, ny, step / segments)
                        emitLine(px, py, qx, qy)
                        px, py = qx, qy
                    end
                    cx, cy = nx, ny
                    lastCubicCtrlX, lastCubicCtrlY = c2x, c2y
                    lastQuadCtrlX, lastQuadCtrlY = nil, nil
                end
            elseif ucmd == "Q" then
                while hasNum(4) do
                    local x1 = getNum()
                    local y1 = getNum()
                    local x = getNum()
                    local y = getNum()
                    local c1x = isRel and (cx + x1) or x1
                    local c1y = isRel and (cy + y1) or y1
                    local nx = isRel and (cx + x) or x
                    local ny = isRel and (cy + y) or y
                    local segments = math.max(5, math.ceil((math.abs(nx - cx) + math.abs(ny - cy)) / 20))
                    local px, py = cx, cy
                    for step = 1, segments do
                        local qx, qy = quadraticPoint(cx, cy, c1x, c1y, nx, ny, step / segments)
                        emitLine(px, py, qx, qy)
                        px, py = qx, qy
                    end
                    cx, cy = nx, ny
                    lastQuadCtrlX, lastQuadCtrlY = c1x, c1y
                    lastCubicCtrlX, lastCubicCtrlY = nil, nil
                end
            elseif ucmd == "T" then
                while hasNum(2) do
                    local x = getNum()
                    local y = getNum()
                    local c1x = cx
                    local c1y = cy
                    if currentCmd and lastQuadCtrlX and lastQuadCtrlY and (currentCmd:upper() == "Q" or currentCmd:upper() == "T") then
                        c1x = cx * 2 - lastQuadCtrlX
                        c1y = cy * 2 - lastQuadCtrlY
                    end
                    local nx = isRel and (cx + x) or x
                    local ny = isRel and (cy + y) or y
                    local segments = math.max(5, math.ceil((math.abs(nx - cx) + math.abs(ny - cy)) / 20))
                    local px, py = cx, cy
                    for step = 1, segments do
                        local qx, qy = quadraticPoint(cx, cy, c1x, c1y, nx, ny, step / segments)
                        emitLine(px, py, qx, qy)
                        px, py = qx, qy
                    end
                    cx, cy = nx, ny
                    lastQuadCtrlX, lastQuadCtrlY = c1x, c1y
                    lastCubicCtrlX, lastCubicCtrlY = nil, nil
                end
            elseif ucmd == "A" then
                while hasNum(7) do
                    local rx = getNum()
                    local ry = getNum()
                    local rot = getNum()
                    local large = getNum()
                    local sweep = getNum()
                    local nx = getNum()
                    local ny = getNum()
                    local nnx = isRel and (cx + nx) or nx
                    local nny = isRel and (cy + ny) or ny
                    local pts = arcPoints(cx, cy, rx, ry, rot, large, sweep, nnx, nny)
                    for _, pt in ipairs(pts) do
                        emitLine(cx, cy, pt.x, pt.y)
                        cx, cy = pt.x, pt.y
                    end
                    if cx ~= nnx or cy ~= nny then
                        emitLine(cx, cy, nnx, nny)
                    end
                    cx, cy = nnx, nny
                end
                lastCubicCtrlX, lastCubicCtrlY = nil, nil
                lastQuadCtrlX, lastQuadCtrlY = nil, nil
            elseif ucmd == "Z" then
                if cx ~= startX or cy ~= startY then
                    emitLine(cx, cy, startX, startY)
                    cx, cy = startX, startY
                end
                lastCubicCtrlX, lastCubicCtrlY = nil, nil
                lastQuadCtrlX, lastQuadCtrlY = nil, nil
                currentCmd = nil
            else
                tokenIndex = tokenIndex + 1
            end
        end
    end
end

function Library.drawDot(layer, layout, cx, cy, radius, color)
    local scx = Library.toScreenX(layout, cx)
    local scy = Library.toScreenY(layout, cy)
    local sr = Library.toScreenW(layout, radius)
    setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
    addCircle(layer, scx, scy, sr)
end

-- --- Geometrie-Routinen für SilverZero UI-Elemente ---

--- Zeichnet ein gefülltes Hexagon.
-- @param cx, cy Zentrum in Layout-Koordinaten
-- @param size Radius (Ecke zu Zentrum)
-- @param color {r, g, b, a}
function Library.hexagon(layer, layout, cx, cy, size, color)
    local s = layout.scale
    local h = size * 0.866 -- math.sqrt(3)/2
    local w = size * 0.5
    local sx, sy = Library.toScreenX(layout, cx), Library.toScreenY(layout, cy)

    setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
    addQuad(layer,
      sx - w * s, sy - h * s,
      sx + w * s, sy - h * s,
      sx + size * s, sy,
      sx - size * s, sy
    )
    setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
    addQuad(layer,
      sx - size * s, sy,
      sx + size * s, sy,
      sx + w * s, sy + h * s,
      sx - w * s, sy + h * s
    )
end

--- Zeichnet ein ungefülltes Hexagon (nur Umriss).
-- @param cx, cy Zentrum in Layout-Koordinaten
-- @param size Radius (Ecke zu Zentrum)
-- @param color {r, g, b, a}
-- @param strokeWidth Linienbreite (Standard: 1)
function Library.hexagonOutline(layer, layout, cx, cy, size, color, strokeWidth)
    local s = layout.scale
    local sx, sy = Library.toScreenX(layout, cx), Library.toScreenY(layout, cy)
    local w = (strokeWidth or 1) * s

    for i = 0, 5 do
      local a1 = math.rad(i * 60 - 30)
      local a2 = math.rad((i + 1) * 60 - 30)
      setNextStrokeColor(layer, color[1], color[2], color[3], color[4] or 1)
      setNextStrokeWidth(layer, w)
      addLine(layer,
        sx + math.cos(a1) * size * s, sy + math.sin(a1) * size * s,
        sx + math.cos(a2) * size * s, sy + math.sin(a2) * size * s
      )
    end
end

--- Zeichnet einen hexagonalen Ring.
-- @param thickness Dicke des Rings nach innen
function Library.hexRing(layer, layout, cx, cy, size, thickness, color)
    local s = layout.scale
    local r_out = size
    local r_in = size - thickness
    local sx, sy = Library.toScreenX(layout, cx), Library.toScreenY(layout, cy)

    for i = 0, 5 do
      local a1 = math.rad(i * 60 - 30)
      local a2 = math.rad((i + 1) * 60 - 30)
      setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
      addQuad(layer,
        sx + math.cos(a1) * r_in * s, sy + math.sin(a1) * r_in * s,
        sx + math.cos(a1) * r_out * s, sy + math.sin(a1) * r_out * s,
        sx + math.cos(a2) * r_out * s, sy + math.sin(a2) * r_out * s,
        sx + math.cos(a2) * r_in * s, sy + math.sin(a2) * r_in * s
      )
    end
end

--- Zeichnet einen hexagonalen Rahmen mit "Zähnen" (Einkerbungen) an den Ecken.
-- @param toothWidth Winkelbreite der Zähne in Grad (Standard: 30)
function Library.notchedHex(layer, layout, cx, cy, size, color, options)
    options = options or {}
    local s = layout.scale
    local toothHalfWidth = (options.toothWidth or 30) / 2
    local r_out = size
    local r_in = size * (options.innerRatio or 0.8)
    local sx, sy = Library.toScreenX(layout, cx), Library.toScreenY(layout, cy)

    for i = 0, 5 do
      local angle = i * 60
      local rad1 = math.rad(angle - toothHalfWidth)
      local rad2 = math.rad(angle + toothHalfWidth)

      setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
      addQuad(layer,
        sx + math.cos(rad1) * r_in * s, sy + math.sin(rad1) * r_in * s,
        sx + math.cos(rad1) * r_out * s, sy + math.sin(rad1) * r_out * s,
        sx + math.cos(rad2) * r_out * s, sy + math.sin(rad2) * r_out * s,
        sx + math.cos(rad2) * r_in * s, sy + math.sin(rad2) * r_in * s
      )

      local rad3 = math.rad(angle + toothHalfWidth)
      local rad4 = math.rad(angle + 60 - toothHalfWidth)
      local connThickness = options.connThickness or 0.03
      local r_mid = (r_in + r_out) * 0.5
      local r_mid_out = r_mid + size * connThickness
      local r_mid_in = r_mid - size * connThickness

      setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
      addQuad(layer,
        sx + math.cos(rad3) * r_mid_in * s, sy + math.sin(rad3) * r_mid_in * s,
        sx + math.cos(rad3) * r_mid_out * s, sy + math.sin(rad3) * r_mid_out * s,
        sx + math.cos(rad4) * r_mid_out * s, sy + math.sin(rad4) * r_mid_out * s,
        sx + math.cos(rad4) * r_mid_in * s, sy + math.sin(rad4) * r_mid_in * s
      )
    end
end

--- Zeichnet kreisförmig angeordnete Segmente (Trapeze).
-- @param count Anzahl der Segmente
-- @param segmentAngle Breite eines Segments in Grad
function Library.circularSegments(layer, layout, cx, cy, radius, count, segmentAngle, color)
    local s = layout.scale
    local halfAngle = segmentAngle / 2
    local r_out = radius * 1.1
    local r_in = radius * 0.9
    local sx, sy = Library.toScreenX(layout, cx), Library.toScreenY(layout, cy)

    local step = 360 / count
    for i = 0, count - 1 do
      local angle = i * step
      local rad1 = math.rad(angle - halfAngle)
      local rad2 = math.rad(angle + halfAngle)

      setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
      addQuad(layer,
        sx + math.cos(rad1) * r_in * s, sy + math.sin(rad1) * r_in * s,
        sx + math.cos(rad1) * r_out * s, sy + math.sin(rad1) * r_out * s,
        sx + math.cos(rad2) * r_out * s, sy + math.sin(rad2) * r_out * s,
        sx + math.cos(rad2) * r_in * s, sy + math.sin(rad2) * r_in * s
      )
    end
end

--- Zeichnet einen hexagonalen Umriss (Ring mit sehr geringer Dicke).
function Library.hexOutline(layer, layout, cx, cy, size, thickness, color)
    Library.hexRing(layer, layout, cx, cy, size, thickness, color)
end

return Library
