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

function Library.fontSizeVw(layout, value)
    return math.max(1, math.floor(layout.screenW * (value / 100) + 0.5))
end

function Library.fontSizeVh(layout, value)
    return math.max(1, math.floor(layout.screenH * (value / 100) + 0.5))
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
    local compatFonts = {
        Arial = "Montserrat",
        Georgia = "Play",
        ["Courier New"] = "FiraMono",
        Verdana = "RobotoCondensed",
        ["Times New Roman"] = "Montserrat-Light",
    }
    return loadFont(compatFonts[fontName] or fontName, size)
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

function Library.relativeLayout(layout, bounds, sourceW, sourceH, options)
    options = options or {}

    local screenX = Library.toScreenX(layout, bounds.x or 0)
    local screenY = Library.toScreenY(layout, bounds.y or 0)
    local screenW = Library.toScreenW(layout, bounds.w or sourceW)
    local screenH = Library.toScreenH(layout, bounds.h or sourceH)
    local scaleX = screenW / math.max(sourceW, 0.0001)
    local scaleY = screenH / math.max(sourceH, 0.0001)

    if options.preserveAspect then
        local scale = math.min(scaleX, scaleY)
        local drawW = sourceW * scale
        local drawH = sourceH * scale
        local alignX = options.alignX or "center"
        local alignY = options.alignY or "center"

        if alignX == "center" then
            screenX = screenX + (screenW - drawW) * 0.5
        elseif alignX == "right" then
            screenX = screenX + (screenW - drawW)
        end

        if alignY == "center" then
            screenY = screenY + (screenH - drawH) * 0.5
        elseif alignY == "bottom" then
            screenY = screenY + (screenH - drawH)
        end

        return {
            screenW = layout.screenW,
            screenH = layout.screenH,
            sourceW = sourceW,
            sourceH = sourceH,
            scale = scale,
            scaleX = scale,
            scaleY = scale,
            x = screenX,
            y = screenY,
        }
    end

    return {
        screenW = layout.screenW,
        screenH = layout.screenH,
        sourceW = sourceW,
        sourceH = sourceH,
        scale = math.min(scaleX, scaleY),
        scaleX = scaleX,
        scaleY = scaleY,
        x = screenX,
        y = screenY,
    }
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

function Library.firstSubpathPathData(pathData)
    if not pathData or pathData == "" then
        return pathData
    end

    local moveCount = 0
    for i = 1, #pathData do
        local c = pathData:sub(i, i)
        if c == "M" or c == "m" then
            moveCount = moveCount + 1
            if moveCount == 2 then
                return pathData:sub(1, i - 1)
            end
        end
    end

    return pathData
end

function Library.drawDot(layer, layout, cx, cy, radius, color)
    local scx = Library.toScreenX(layout, cx)
    local scy = Library.toScreenY(layout, cy)
    local sr = Library.toScreenW(layout, radius)
    setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
    addCircle(layer, scx, scy, sr)
end

local SIMPLE_SIGN_BOARD_OUTLINE_PATH =
    "m840 59h560l64 61 1.7 0.7h491l1.6-0.61 47-41h327l40 33v260l-42 36-0.86 1.9v905l0.59 1.6 43 50v237l-40 33h-327l-47-41-1.6-0.62h-1504l-1.6 0.6-48 41h-335l-39-33v-82l33-40 0.57-1.6v-268l-0.88-1.9-33-28v-635l35-29 0.91-1.9v-322l-0.68-1.7-35-37v-44l36-32h326l47 41 1.6 0.62h334l1.7-0.7 64-61m561-5h-562l-1.7 0.69-64 61h-332l-47-41-1.6-0.62h-328l-1.7 0.65-37 34-0.82 1.9v46l0.68 1.7 35 37v320l-35 29-0.91 1.9v638l0.88 1.9 33 28v266l-33 40-0.57 1.6v84l0.87 1.9 40 35 1.6 0.61h336l1.6-0.61 48-41h1502l47 41 1.6 0.62h329l1.6-0.58 41-34 0.91-1.9v-239l-0.6-1.6-43-50v-903l42-36 0.87-1.9v-263l-0.91-1.9-41-34-1.6-0.57h-329l-1.6 0.62-47 41h-489l-64-61-1.7-0.69"

local SIMPLE_SIGN_BOARD_HIGHLIGHT_PATHS = {
    "m413 119-30-26h-300l25 26h305",
    "m85 94h297l28 24h-302l-23-24m297-2h-300l-0.91 0.61 0.2 1.1 25 26 0.72 0.3h305l0.93-0.66-0.29-1.1-30-26-0.64-0.24",
    "m2312 93h-300l-30 26h305l25-26",
    "m2e3 94h297l-23 24h-302l28-24m299-2h-300l-0.65 0.24-30 26-0.29 1.1 0.94 0.66h305l0.71-0.3 25-26 0.41-0.81-1-1",
    "m836 84h566l37 35h-638l35-35",
    "m2309 1620h-300l-25-21h350l-25 21",
    "m402 1620h-300l-25-21h350l-25 21",
    "m402 1620h-300l-25-21h350l-25 21",
    "m46 195-20-15v351l20-16v-320",
    "m46 1215-21-18v305l21-25v-262",
    "m2330 1473 29 34v-38l-29-34v38",
    "m2330 1549 29 34v-38l-29-34v38",
    "m2330 1359v38l29 34v-38",
    "m2360 238-29 34v-38l29-34v38",
    "m2360 314-29 34v-38l29-34v38",
    "m2330 158v38l29-34v-38",
    "m42 111v38l29 34v-38",
    "m42 1552v38l29-34v-38",
}

local SIMPLE_SIGN_BOARD_TRANSFORM = {
    0.098,
    0,
    0,
    -0.098,
    -2.2454,
    161,
}

local SIMPLE_SIGN_BOARD_ITEMS = {
    {
        d = SIMPLE_SIGN_BOARD_OUTLINE_PATH,
        fill = "#f00",
        transform = SIMPLE_SIGN_BOARD_TRANSFORM,
    },
}

for _, pathData in ipairs(SIMPLE_SIGN_BOARD_HIGHLIGHT_PATHS) do
    SIMPLE_SIGN_BOARD_ITEMS[#SIMPLE_SIGN_BOARD_ITEMS + 1] = {
        d = pathData,
        fill = "#bbb",
        transform = SIMPLE_SIGN_BOARD_TRANSFORM,
    }
end

local SIMPLE_SIGN_BOARD_CLASSIFIED_SHAPES = nil

local function simpleSignBoardClassifiedShapes()
    if not SIMPLE_SIGN_BOARD_CLASSIFIED_SHAPES then
        local SvgShapeClassifier = require("lib.SvgShapeClassifier")
        SIMPLE_SIGN_BOARD_CLASSIFIED_SHAPES = SvgShapeClassifier.classifyItems(SIMPLE_SIGN_BOARD_ITEMS)
    end

    return SIMPLE_SIGN_BOARD_CLASSIFIED_SHAPES
end

local function cloneSimpleSignBoardItem(item)
    local cloned = {
        d = item.d,
        fill = item.fill,
    }

    if item.transform then
        cloned.transform = {
            item.transform[1],
            item.transform[2],
            item.transform[3],
            item.transform[4],
            item.transform[5],
            item.transform[6],
        }
    end

    return cloned
end

function Library.simpleSignBoardProbeItems()
    return {
        sourceW = 231,
        sourceH = 156,
        items = {
            outline = cloneSimpleSignBoardItem(SIMPLE_SIGN_BOARD_ITEMS[1]),
            topTrapezoid = cloneSimpleSignBoardItem(SIMPLE_SIGN_BOARD_ITEMS[2]),
            topEdgeCompound = cloneSimpleSignBoardItem(SIMPLE_SIGN_BOARD_ITEMS[3]),
            rightMidQuad = cloneSimpleSignBoardItem(SIMPLE_SIGN_BOARD_ITEMS[13]),
            leftUpperOutline = cloneSimpleSignBoardItem(SIMPLE_SIGN_BOARD_ITEMS[17]),
        },
    }
end

function Library.simpleSignBoard(layer, layout, bounds, options)
    options = options or {}

    local screenX = Library.toScreenX(layout, bounds.x)
    local screenY = Library.toScreenY(layout, bounds.y)
    local screenW = Library.toScreenW(layout, bounds.w)
    local screenH = Library.toScreenH(layout, bounds.h)

    local boardLayout = {
        screenW = layout.screenW,
        screenH = layout.screenH,
        sourceW = 231,
        sourceH = 156,
        scale = math.min(screenW / 231, screenH / 156),
        scaleX = screenW / 231,
        scaleY = screenH / 156,
        x = screenX,
        y = screenY,
    }

    local outlineColor = options.outlineColor or { 1, 0, 0, 1 }
    local highlightColor = options.highlightColor or { 1, 1, 1, 1 }
    local outlineWidth = options.outlineWidth or 2.5
    local highlightWidth = options.highlightWidth or 2.0

    local classifiedShapes = simpleSignBoardClassifiedShapes()
    for itemIndex, item in ipairs(SIMPLE_SIGN_BOARD_ITEMS) do
        local color = highlightColor
        local strokeWidth = highlightWidth

        if itemIndex == 1 then
            color = outlineColor
            strokeWidth = outlineWidth
        end

        Library.drawClassifiedPathItem(layer, boardLayout, item, classifiedShapes[itemIndex], {
            classifiedMode = "fill",
            color = color,
            strokeWidth = strokeWidth,
        })
    end
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

local function shapeBoundsCenter(bounds)
    if not bounds then
        return nil, nil
    end
    return bounds.x + bounds.w * 0.5, bounds.y + bounds.h * 0.5
end

local function averagePointDistance(points, cx, cy)
    if not points or #points == 0 or cx == nil or cy == nil then
        return nil
    end

    local total = 0
    for i = 1, #points do
        local dx = points[i].x - cx
        local dy = points[i].y - cy
        total = total + math.sqrt(dx * dx + dy * dy)
    end

    return total / #points
end

local function ringSubpathArea(subpath)
    if subpath and subpath.area then
        return math.abs(subpath.area)
    end

    local bounds = subpath and subpath.bounds or nil
    if bounds then
        return math.abs(bounds.w * bounds.h)
    end

    return 0
end

local function resolveShapeColor(shape, options)
    if options and type(options.color) == "table" then
        return options.color
    end

    local style = shape and shape.style or nil
    if style and type(style.resolvedFill) == "table" then
        return style.resolvedFill
    end

    if style and type(style.fill) == "table" then
        return style.fill
    end

    return nil
end

local function isClassifiedKindAllowed(shape, options)
    if not shape or not shape.kind then
        return false
    end

    local classifiedKinds = options and options.classifiedKinds or nil
    if not classifiedKinds then
        return true
    end

    if classifiedKinds[shape.kind] ~= nil then
        return classifiedKinds[shape.kind] == true
    end

    for i = 1, #classifiedKinds do
        if classifiedKinds[i] == shape.kind then
            return true
        end
    end

    return false
end

local function drawPointQuad(layer, layout, points, color)
    setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
    addQuad(
        layer,
        Library.toScreenX(layout, points[1].x),
        Library.toScreenY(layout, points[1].y),
        Library.toScreenX(layout, points[2].x),
        Library.toScreenY(layout, points[2].y),
        Library.toScreenX(layout, points[3].x),
        Library.toScreenY(layout, points[3].y),
        Library.toScreenX(layout, points[4].x),
        Library.toScreenY(layout, points[4].y)
    )
end

local function drawPointTriangle(layer, layout, a, b, c, color)
    setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
    addTriangle(
        layer,
        Library.toScreenX(layout, a.x),
        Library.toScreenY(layout, a.y),
        Library.toScreenX(layout, b.x),
        Library.toScreenY(layout, b.y),
        Library.toScreenX(layout, c.x),
        Library.toScreenY(layout, c.y)
    )
end

local function extractFourPointShapePoints(shape)
    if not shape or not shape.geometry then
        return nil
    end

    local points = shape.geometry.points or nil
    if not points or #points ~= 4 then
        return nil
    end

    local analysis = shape.analysis or nil
    if analysis and analysis.subpathCount and analysis.subpathCount ~= 1 then
        return nil
    end

    return points
end

local function extractClosedPolygonPoints(shape)
    if not shape or not shape.geometry then
        return nil
    end

    local points = shape.geometry.points or nil
    if not points or #points < 3 then
        return nil
    end

    local analysis = shape.analysis or nil
    if analysis and analysis.subpathCount and analysis.subpathCount ~= 1 then
        return nil
    end

    if analysis and analysis.closed == false then
        return nil
    end

    return points
end

local function extractImplicitFillPolygonPoints(shape)
    if not shape or not shape.geometry then
        return nil
    end

    local points = shape.geometry.points or nil
    if not points or #points < 3 then
        return nil
    end

    local analysis = shape.analysis or nil
    if analysis and analysis.subpathCount and analysis.subpathCount ~= 1 then
        return nil
    end

    return points
end

local function polygonSignedArea(points)
    local area = 0
    for i = 1, #points do
        local current = points[i]
        local nextPoint = points[i % #points + 1]
        area = area + (current.x * nextPoint.y - nextPoint.x * current.y)
    end
    return area * 0.5
end

local function triangleCross(a, b, c)
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
end

local function pointInTriangle(point, a, b, c, epsilon)
    epsilon = epsilon or 1e-6
    local c1 = triangleCross(a, b, point)
    local c2 = triangleCross(b, c, point)
    local c3 = triangleCross(c, a, point)
    local hasNegative = c1 < -epsilon or c2 < -epsilon or c3 < -epsilon
    local hasPositive = c1 > epsilon or c2 > epsilon or c3 > epsilon
    return not (hasNegative and hasPositive)
end

local function triangulatePolygon(points)
    if not points or #points < 3 then
        return nil
    end

    if #points == 3 then
        return {
            { points[1], points[2], points[3] },
        }
    end

    local epsilon = 1e-6
    local indices = {}
    for i = 1, #points do
        indices[i] = i
    end

    local isClockwise = polygonSignedArea(points) < 0
    local triangles = {}
    local safety = #points * #points

    while #indices > 3 and safety > 0 do
        local earFound = false

        for i = 1, #indices do
            local prevIndex = indices[(i - 2 + #indices) % #indices + 1]
            local currentIndex = indices[i]
            local nextIndex = indices[i % #indices + 1]
            local a = points[prevIndex]
            local b = points[currentIndex]
            local c = points[nextIndex]
            local cross = triangleCross(a, b, c)

            if (not isClockwise and cross > epsilon) or (isClockwise and cross < -epsilon) then
                local containsOtherPoint = false
                for j = 1, #indices do
                    local candidateIndex = indices[j]
                    if candidateIndex ~= prevIndex and candidateIndex ~= currentIndex and candidateIndex ~= nextIndex then
                        if pointInTriangle(points[candidateIndex], a, b, c, epsilon) then
                            containsOtherPoint = true
                            break
                        end
                    end
                end

                if not containsOtherPoint then
                    triangles[#triangles + 1] = { a, b, c }
                    table.remove(indices, i)
                    earFound = true
                    break
                end
            end
        end

        if not earFound then
            return nil
        end

        safety = safety - 1
    end

    if #indices == 3 then
        triangles[#triangles + 1] = {
            points[indices[1]],
            points[indices[2]],
            points[indices[3]],
        }
    end

    return triangles
end

local function reversePoints(points)
    local reversed = {}
    for i = #points, 1, -1 do
        reversed[#reversed + 1] = points[i]
    end
    return reversed
end

local function averageAlignedRingDistance(outerPoints, innerPoints, offset)
    local total = 0
    local count = #outerPoints
    for i = 1, count do
        local outerPoint = outerPoints[i]
        local innerPoint = innerPoints[((i + offset - 2) % count) + 1]
        local dx = outerPoint.x - innerPoint.x
        local dy = outerPoint.y - innerPoint.y
        total = total + math.sqrt(dx * dx + dy * dy)
    end
    return total / count
end

local function alignRingPoints(outerPoints, innerPoints)
    if not outerPoints or not innerPoints or #outerPoints ~= #innerPoints or #outerPoints < 3 then
        return nil
    end

    local bestInnerPoints = innerPoints
    local bestOffset = 0
    local bestDistance = averageAlignedRingDistance(outerPoints, innerPoints, 0)

    local reversedInnerPoints = reversePoints(innerPoints)
    local reversedDistance = averageAlignedRingDistance(outerPoints, reversedInnerPoints, 0)
    if reversedDistance < bestDistance then
        bestInnerPoints = reversedInnerPoints
        bestDistance = reversedDistance
    end

    for offset = 1, #outerPoints - 1 do
        local distance = averageAlignedRingDistance(outerPoints, bestInnerPoints, offset)
        if distance < bestDistance then
            bestDistance = distance
            bestOffset = offset
        end
    end

    local alignedInnerPoints = {}
    for i = 1, #outerPoints do
        alignedInnerPoints[i] = bestInnerPoints[((i + bestOffset - 2) % #bestInnerPoints) + 1]
    end

    return alignedInnerPoints
end

local function drawSubpathSegments(layer, layout, subpath, color, strokeWidth)
    local points = subpath and subpath.points or nil
    if not points or #points < 2 then
        return false
    end

    setNextStrokeColor(layer, color[1], color[2], color[3], color[4] or 1)
    setNextStrokeWidth(layer, (strokeWidth or 1) * layout.scale)

    for i = 1, #points - 1 do
        addLine(
            layer,
            Library.toScreenX(layout, points[i].x),
            Library.toScreenY(layout, points[i].y),
            Library.toScreenX(layout, points[i + 1].x),
            Library.toScreenY(layout, points[i + 1].y)
        )
    end

    if subpath.closed then
        addLine(
            layer,
            Library.toScreenX(layout, points[#points].x),
            Library.toScreenY(layout, points[#points].y),
            Library.toScreenX(layout, points[1].x),
            Library.toScreenY(layout, points[1].y)
        )
    end

    return true
end

--- Zeichnet einen klassifizierten hex_ring ueber die bestehende hexRing-Hilfsfunktion.
function Library.drawClassifiedHexRing(layer, layout, shape, options)
    if not shape or shape.kind ~= "hex_ring" then
        return false
    end

    local subpaths = shape.geometry and shape.geometry.subpaths or nil
    if not subpaths or #subpaths ~= 2 then
        return false
    end

    local first = subpaths[1]
    local second = subpaths[2]
    local outer = ringSubpathArea(first) >= ringSubpathArea(second) and first or second
    local inner = outer == first and second or first

    local center = shape.geometry and shape.geometry.center or nil
    local centerX = center and center.x or nil
    local centerY = center and center.y or nil
    if centerX == nil or centerY == nil then
        centerX, centerY = shapeBoundsCenter(outer and outer.bounds or nil)
    end

    local outerRadius = averagePointDistance(outer and outer.points or nil, centerX, centerY)
    local innerRadius = averagePointDistance(inner and inner.points or nil, centerX, centerY)
    if not outerRadius or not innerRadius or innerRadius <= 0 or outerRadius <= innerRadius then
        return false
    end

    local color = resolveShapeColor(shape, options)
    if not color then
        return false
    end

    Library.hexRing(layer, layout, centerX, centerY, outerRadius, outerRadius - innerRadius, color)
    return true
end

--- Zeichnet ein klassifiziertes 4-Punkt-Shape als gefuelltes Quad.
function Library.drawClassifiedFourPointShape(layer, layout, shape, options)
    local points = extractFourPointShapePoints(shape)
    if not points then
        return false
    end

    local color = resolveShapeColor(shape, options)
    if not color then
        return false
    end

    drawPointQuad(layer, layout, points, color)
    return true
end

--- Zeichnet ein klassifiziertes geschlossenes Polygon ueber Dreiecks-Triangulation.
function Library.drawClassifiedClosedPolygon(layer, layout, shape, options)
    local points = extractClosedPolygonPoints(shape)
    if not points then
        return false
    end

    local color = resolveShapeColor(shape, options)
    if not color then
        return false
    end

    if #points == 3 then
        drawPointTriangle(layer, layout, points[1], points[2], points[3], color)
        return true
    end

    local triangles = triangulatePolygon(points)
    if not triangles or #triangles == 0 then
        return false
    end

    for i = 1, #triangles do
        local triangle = triangles[i]
        drawPointTriangle(layer, layout, triangle[1], triangle[2], triangle[3], color)
    end

    return true
end

function Library.drawClassifiedImplicitFillPolygon(layer, layout, shape, options)
    local points = extractImplicitFillPolygonPoints(shape)
    if not points then
        return false
    end

    local color = resolveShapeColor(shape, options)
    if not color then
        return false
    end

    if #points == 3 then
        drawPointTriangle(layer, layout, points[1], points[2], points[3], color)
        return true
    end

    local triangles = triangulatePolygon(points)
    if not triangles or #triangles == 0 then
        return false
    end

    for i = 1, #triangles do
        local triangle = triangles[i]
        drawPointTriangle(layer, layout, triangle[1], triangle[2], triangle[3], color)
    end

    return true
end

--- Zeichnet einen klassifizierten polygon_ring ueber korrespondierende Ringsegmente.
function Library.drawClassifiedPolygonRing(layer, layout, shape, options)
    if not shape or shape.kind ~= "polygon_ring" then
        return false
    end

    local subpaths = shape.geometry and shape.geometry.subpaths or nil
    if not subpaths or #subpaths ~= 2 then
        return false
    end

    local first = subpaths[1]
    local second = subpaths[2]
    local outer = ringSubpathArea(first) >= ringSubpathArea(second) and first or second
    local inner = outer == first and second or first
    local outerPoints = outer and outer.points or nil
    local innerPoints = inner and inner.points or nil
    if not outerPoints or not innerPoints or #outerPoints ~= #innerPoints or #outerPoints < 3 then
        return false
    end

    local color = resolveShapeColor(shape, options)
    if not color then
        return false
    end

    local alignedInnerPoints = alignRingPoints(outerPoints, innerPoints)
    if not alignedInnerPoints then
        return false
    end

    for i = 1, #outerPoints do
        local nextIndex = i % #outerPoints + 1
        drawPointQuad(
            layer,
            layout,
            {
                alignedInnerPoints[i],
                outerPoints[i],
                outerPoints[nextIndex],
                alignedInnerPoints[nextIndex],
            },
            color
        )
    end

    return true
end

--- Zeichnet einen klassifizierten compound_path ueber seine bereits extrahierten Teilpfade.
function Library.drawClassifiedCompoundPath(layer, layout, shape, options)
    if not shape or shape.kind ~= "compound_path" then
        return false
    end

    local subpaths = shape.geometry and shape.geometry.subpaths or nil
    if not subpaths or #subpaths < 2 then
        return false
    end

    local color = resolveShapeColor(shape, options)
    if not color then
        return false
    end

    local strokeWidth = options and options.strokeWidth or 1

    for i = 1, #subpaths do
        local subpath = subpaths[i]
        if not subpath.points or #subpath.points < 2 then
            return false
        end
        if not drawSubpathSegments(layer, layout, subpath, color, strokeWidth) then
            return false
        end
    end

    return true
end

--- Zeichnet einen klassifizierten outline_path ueber seine extrahierten Linienpunkte.
function Library.drawClassifiedOutlinePath(layer, layout, shape, options)
    if not shape or shape.kind ~= "outline_path" then
        return false
    end

    local subpaths = shape.geometry and shape.geometry.subpaths or nil
    if not subpaths or #subpaths ~= 1 then
        return false
    end

    local color = resolveShapeColor(shape, options)
    if not color then
        return false
    end

    local strokeWidth = options and options.strokeWidth or 1
    return drawSubpathSegments(layer, layout, subpaths[1], color, strokeWidth)
end

--- Zeichnet nur klassifizierte Stroke-Shapes und laesst Fill-Faelle aus.
function Library.drawClassifiedStrokeShape(layer, layout, shape, options)
    if not shape or not shape.kind then
        return false
    end

    if shape.kind == "outline_path" then
        return Library.drawClassifiedOutlinePath(layer, layout, shape, options)
    end

    if shape.kind == "compound_path" then
        return Library.drawClassifiedCompoundPath(layer, layout, shape, options)
    end

    return false
end

--- Zeichnet die erste produktiv angebundene Teilmenge klassifizierter SVG-Shapes.
function Library.drawClassifiedShape(layer, layout, shape, options)
    if not shape or not shape.kind then
        return false
    end

    if shape.kind == "hex_ring" then
        return Library.drawClassifiedHexRing(layer, layout, shape, options)
    end

    if shape.kind == "polygon_ring" then
        return Library.drawClassifiedPolygonRing(layer, layout, shape, options)
    end

    if shape.kind == "compound_path" then
        return Library.drawClassifiedStrokeShape(layer, layout, shape, options)
    end

    if shape.kind == "quad" or shape.kind == "trapezoid" or shape.kind == "outline_path" then
        return Library.drawClassifiedFourPointShape(layer, layout, shape, options)
    end

    if shape.kind == "triangle" or shape.kind == "closed_polygon" then
        return Library.drawClassifiedClosedPolygon(layer, layout, shape, options)
    end

    return false
end

--- Zeichnet nur klassifizierte Fill-Shapes und laesst reine Linien-/Outline-Faelle aus.
function Library.drawClassifiedFillShape(layer, layout, shape, options)
    if not shape or not shape.kind then
        return false
    end

    if shape.kind == "hex_ring" then
        return Library.drawClassifiedHexRing(layer, layout, shape, options)
    end

    if shape.kind == "polygon_ring" then
        return Library.drawClassifiedPolygonRing(layer, layout, shape, options)
    end

    if shape.kind == "quad" or shape.kind == "trapezoid" then
        return Library.drawClassifiedFourPointShape(layer, layout, shape, options)
    end

    if shape.kind == "outline_path" then
        if Library.drawClassifiedFourPointShape(layer, layout, shape, options) then
            return true
        end

        if Library.drawClassifiedClosedPolygon(layer, layout, shape, options) then
            return true
        end

        return Library.drawClassifiedImplicitFillPolygon(layer, layout, shape, options)
    end

    if shape.kind == "triangle" or shape.kind == "closed_polygon" then
        return Library.drawClassifiedClosedPolygon(layer, layout, shape, options)
    end

    return false
end

function Library.drawClassifiedPathItem(layer, layout, item, shape, options)
    if not item or not item.d then
        return false
    end

    options = options or {}
    local hasFill = item.fill and item.fill ~= "" and item.fill ~= "none"
    local drewClassified = false

    if hasFill and shape and isClassifiedKindAllowed(shape, options) then
        if options.classifiedMode == "fill" then
            drewClassified = Library.drawClassifiedFillShape(layer, layout, shape, options)
        else
            drewClassified = Library.drawClassifiedShape(layer, layout, shape, options)
        end
    end

    if drewClassified then
        return true
    end

    local pathData = item.d
    if hasFill and options.fallbackFirstSubpathOnly then
        pathData = Library.firstSubpathPathData(pathData)
    end

    local color = options.color or resolveShapeColor(shape, options)
    if not color then
        return false
    end

    Library.drawPath(layer, layout, pathData, color, options.strokeWidth, item.transform)
    return true
end

function Library.drawSvgEntry(layer, layout, svgEntry, options)
    if not svgEntry then
        return false
    end

    options = options or {}

    local SvgParser = require("lib.SvgParser")
    local SvgShapeClassifier = require("lib.SvgShapeClassifier")
    local classifiedShapes = options.classifiedShapes

    if classifiedShapes == nil and options.classify ~= false then
        classifiedShapes = SvgShapeClassifier.classifySvg(svgEntry, {
            vars = options.vars,
        })
    end

    local drewAny = false
    for itemIndex, item in ipairs(svgEntry.items or {}) do
        local shape = classifiedShapes and classifiedShapes[itemIndex] or nil
        local color = nil

        if options.colorResolver then
            color = options.colorResolver(item, shape, itemIndex)
        end

        if not color and options.useSvgFill ~= false then
            color = SvgParser.parseColor(item.fill, options.vars)
        end

        if not color then
            color = options.color or options.defaultColor
        end

        if color then
            if Library.drawClassifiedPathItem(layer, layout, item, shape, {
                classifiedMode = options.classifiedMode or "fill",
                classifiedKinds = options.classifiedKinds,
                color = color,
                strokeWidth = options.strokeWidth or 1,
                fallbackFirstSubpathOnly = options.fallbackFirstSubpathOnly,
            }) then
                drewAny = true
            end
        end
    end

    return drewAny
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
