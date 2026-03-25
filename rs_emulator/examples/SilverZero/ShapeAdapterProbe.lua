local SZ = require("lib.SilverZeroRsLib")
local Classifier = require("lib.SvgShapeClassifier")

local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 240, 238, 0.04)

local colors = {
    background = { 0.08, 0.03, 0.04, 1.0 },
    card = { 0.16, 0.05, 0.06, 1.0 },
    accent = { 1.0, 0.08, 0.08, 1.0 },
    accentSoft = { 1.0, 0.35, 0.35, 1.0 },
    highlight = { 1.0, 1.0, 1.0, 1.0 },
    muted = { 0.88, 0.82, 0.82, 1.0 },
}

local layers = SZ.createLayers("bg", "shapes", "text")
local bgLayer = layers.bg
local shapeLayer = layers.shapes
local textLayer = layers.text

local titleFont = SZ.font("Arial", SZ.scaleFontSize(10, layout))
local bodyFont = SZ.font("Arial", SZ.scaleFontSize(4, layout))

local boardProbe = SZ.simpleSignBoardProbeItems()

local function drawCard(x, y, w, h)
    setNextFillColor(bgLayer, colors.card[1], colors.card[2], colors.card[3], colors.card[4])
    addBox(
        bgLayer,
        SZ.toScreenX(layout, x),
        SZ.toScreenY(layout, y),
        SZ.toScreenW(layout, w),
        SZ.toScreenH(layout, h)
    )
end

local function drawText(font, text, x, y, color)
    setNextTextAlign(textLayer, AlignH_Center, AlignV_Middle)
    setNextFillColor(textLayer, color[1], color[2], color[3], color[4] or 1)
    addText(textLayer, font, text, SZ.toScreenX(layout, x), SZ.toScreenY(layout, y))
end

local function cardProbeLayout(cardX, cardY, cardW, cardH, shape, sourceW, sourceH)
    local insetX = 2
    local insetTop = 8
    local insetBottom = 13
    local availableW = math.max(1, cardW - insetX * 2)
    local availableH = math.max(1, cardH - insetTop - insetBottom)
    local availableScreenW = SZ.toScreenW(layout, availableW)
    local availableScreenH = SZ.toScreenH(layout, availableH)
    local bounds = shape and shape.geometry and shape.geometry.bounds or {
        x = 0,
        y = 0,
        w = sourceW,
        h = sourceH,
    }
    local maxDim = math.max(bounds.w or 0, bounds.h or 0, 1)
    local minExtent = maxDim * 0.42
    local pad = maxDim * 0.20
    local boxW = math.max(bounds.w or 0, minExtent, 1) + pad * 2
    local boxH = math.max(bounds.h or 0, minExtent, 1) + pad * 2
    local scale = math.min(availableScreenW / boxW, availableScreenH / boxH)
    local scaledW = boxW * scale
    local scaledH = boxH * scale
    local sourceX = (bounds.x or 0) - pad - (boxW - math.max(bounds.w or 0, minExtent, 1)) * 0.5
    local sourceY = (bounds.y or 0) - pad - (boxH - math.max(bounds.h or 0, minExtent, 1)) * 0.5
    local screenX = SZ.toScreenX(layout, cardX + insetX)
    local screenY = SZ.toScreenY(layout, cardY + insetTop)

    return {
        screenW = layout.screenW,
        screenH = layout.screenH,
        sourceW = boxW,
        sourceH = boxH,
        scale = scale,
        x = screenX + (availableScreenW - scaledW) * 0.5 - sourceX * scale,
        y = screenY + (availableScreenH - scaledH) * 0.5 - sourceY * scale,
    }
end

local function drawFallback(probeLayout, probe)
    local pathData = probe.item.d
    if probe.fallbackFirstSubpathOnly then
        pathData = SZ.firstSubpathPathData(pathData)
    end

    SZ.drawPath(shapeLayer, probeLayout, pathData, probe.color, probe.strokeWidth, probe.item.transform)
    return true
end

local function drawProbeCase(probeLayout, probe, shape)
    local beforeCost = getRenderCost()
    local adapterHit = false

    if probe.mode == "fill" then
        adapterHit = SZ.drawClassifiedFillShape(shapeLayer, probeLayout, shape, {
            color = probe.color,
            strokeWidth = probe.strokeWidth,
        })
    elseif probe.mode == "stroke" then
        adapterHit = SZ.drawClassifiedStrokeShape(shapeLayer, probeLayout, shape, {
            color = probe.color,
            strokeWidth = probe.strokeWidth,
        })
    else
        adapterHit = SZ.drawClassifiedShape(shapeLayer, probeLayout, shape, {
            color = probe.color,
            strokeWidth = probe.strokeWidth,
        })
    end

    local status = "adapter"
    if not adapterHit then
        drawFallback(probeLayout, probe)
        status = "fallback"
    end

    return status, getRenderCost() - beforeCost
end

local syntheticSourceW = 40
local syntheticSourceH = 40

local probes = {
    {
        id = "hex_fill",
        mode = "fill",
        color = colors.accent,
        strokeWidth = 1.6,
        sourceW = syntheticSourceW,
        sourceH = syntheticSourceH,
        item = {
            d = "M20 4 L33 12 L33 28 L20 36 L7 28 L7 12 z M20 10 L28 15 L28 25 L20 30 L12 25 L12 15 z",
            fill = "#f00",
        },
    },
    {
        id = "poly_fill",
        mode = "fill",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = syntheticSourceW,
        sourceH = syntheticSourceH,
        item = {
            d = "M6 6 L34 6 L34 34 L6 34 z M13 13 L27 13 L27 27 L13 27 z",
            fill = "#fff",
        },
    },
    {
        id = "trap_fill",
        mode = "fill",
        color = colors.accent,
        strokeWidth = 1.6,
        sourceW = syntheticSourceW,
        sourceH = syntheticSourceH,
        item = {
            d = "M5 9 L35 9 L29 31 L11 31 z",
            fill = "#f00",
        },
    },
    {
        id = "poly_closed",
        mode = "fill",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = syntheticSourceW,
        sourceH = syntheticSourceH,
        item = {
            d = "M20 4 L34 15 L29 34 L11 34 L6 15 z",
            fill = "#fff",
        },
    },
    {
        id = "compound_stk",
        mode = "stroke",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = syntheticSourceW,
        sourceH = syntheticSourceH,
        item = {
            d = "M5 8 L16 8 L16 32 L5 32 z M24 8 L35 8 L35 32 L24 32 z",
            fill = "#fff",
        },
    },
    {
        id = "outline_stk",
        mode = "stroke",
        color = colors.accent,
        strokeWidth = 1.6,
        sourceW = syntheticSourceW,
        sourceH = syntheticSourceH,
        item = {
            d = "M5 30 L13 8 L20 14 L28 4 L35 12",
            fill = "#f00",
        },
    },
    {
        id = "board_trap",
        mode = "fill",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = boardProbe.sourceW,
        sourceH = boardProbe.sourceH,
        item = boardProbe.items.topTrapezoid,
    },
    {
        id = "board_quad",
        mode = "fill",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = boardProbe.sourceW,
        sourceH = boardProbe.sourceH,
        item = boardProbe.items.rightMidQuad,
    },
    {
        id = "board_ofill",
        mode = "fill",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = boardProbe.sourceW,
        sourceH = boardProbe.sourceH,
        item = boardProbe.items.leftUpperOutline,
    },
    {
        id = "board_ostrk",
        mode = "stroke",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = boardProbe.sourceW,
        sourceH = boardProbe.sourceH,
        item = boardProbe.items.leftUpperOutline,
    },
    {
        id = "board_cshape",
        mode = "shape",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = boardProbe.sourceW,
        sourceH = boardProbe.sourceH,
        item = boardProbe.items.topEdgeCompound,
    },
    {
        id = "board_cfill",
        mode = "fill",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = boardProbe.sourceW,
        sourceH = boardProbe.sourceH,
        item = boardProbe.items.topEdgeCompound,
    },
}

local summaries = {}
local cardW = 68
local cardH = 50
local startX = 11
local startY = 27
local stepX = 75
local stepY = 52

setNextFillColor(bgLayer, colors.background[1], colors.background[2], colors.background[3], colors.background[4])
addBox(bgLayer, 0, 0, resolutionX, resolutionY)

drawText(titleFont, "Shape Adapter Probe", 120, 10, colors.highlight)
drawText(bodyFont, "synthetic + real board families", 120, 18, colors.muted)

for index, probe in ipairs(probes) do
    local col = (index - 1) % 3
    local row = math.floor((index - 1) / 3)
    local cardX = startX + col * stepX
    local cardY = startY + row * stepY
    local cardCenterX = cardX + cardW * 0.5
    local shape = Classifier.classifyItem(probe.item)
    local probeLayout = cardProbeLayout(cardX, cardY, cardW, cardH, shape, probe.sourceW, probe.sourceH)

    drawCard(cardX, cardY, cardW, cardH)
    local status, costDelta = drawProbeCase(probeLayout, probe, shape)

    drawText(bodyFont, probe.id, cardCenterX, cardY + 5, colors.muted)
    drawText(bodyFont, shape and shape.kind or "nil", cardCenterX, cardY + 40, colors.highlight)
    drawText(
        bodyFont,
        string.format("%s:%s c%d", status, probe.mode, costDelta),
        cardCenterX,
        cardY + 46,
        status == "adapter" and colors.accentSoft or colors.muted
    )

    summaries[#summaries + 1] = string.format(
        "%s=%s|%s|%s",
        probe.id,
        shape and shape.kind or "nil",
        probe.mode,
        status
    )
end

setOutput(table.concat(summaries, ";"))
