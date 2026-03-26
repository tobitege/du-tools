-- Focused visual probe for the current "primitive first" routing rule.
-- If a filled target shape is really just a triangle, trapezoid, or skewed quad,
-- draw it with native RenderScript primitives instead of forcing a path route.

local SZ = require("lib.SilverZeroRsLib")
local Classifier = require("lib.SvgShapeClassifier")

local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 240, 186, 0.05)

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

local function drawTrianglePoints(layer, probeLayout, points, color)
    if not points or #points ~= 3 or not color then
        return false
    end

    setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
    addTriangle(
        layer,
        SZ.toScreenX(probeLayout, points[1].x),
        SZ.toScreenY(probeLayout, points[1].y),
        SZ.toScreenX(probeLayout, points[2].x),
        SZ.toScreenY(probeLayout, points[2].y),
        SZ.toScreenX(probeLayout, points[3].x),
        SZ.toScreenY(probeLayout, points[3].y)
    )
    return true
end

local function samePoint(a, b)
    return a and b and a.x == b.x and a.y == b.y
end

local function extractImplicitQuadPoints(points)
    if not points then
        return nil
    end

    if #points == 4 then
        return points
    end

    if #points == 5 and samePoint(points[1], points[5]) then
        return { points[1], points[2], points[3], points[4] }
    end

    return nil
end

local function drawPathFallback(probeLayout, probe)
    local pathData = probe.item.d
    if probe.fallbackFirstSubpathOnly then
        pathData = SZ.firstSubpathPathData(pathData)
    end

    SZ.drawPath(shapeLayer, probeLayout, pathData, probe.color, probe.strokeWidth, probe.item.transform)
    return "path_route"
end

local function drawJoinedStrokeCase(probeLayout, shape, probe)
    if shape.kind == "outline_path" then
        if SZ.drawClassifiedOutlinePath(shapeLayer, probeLayout, shape, {
            color = probe.color,
            strokeWidth = probe.strokeWidth,
        }) then
            return "joined_stroke"
        end
    end

    if shape.kind == "compound_path" then
        if SZ.drawClassifiedCompoundPath(shapeLayer, probeLayout, shape, {
            color = probe.color,
            strokeWidth = probe.strokeWidth,
        }) then
            return "joined_stroke"
        end
    end

    return nil
end

local function drawPrimitiveFirstCase(probeLayout, probe, shape)
    local points = shape and shape.geometry and shape.geometry.points or nil
    local quadPoints = extractImplicitQuadPoints(points)

    if quadPoints then
        local isSimpleQuad = shape.kind == "quad" or shape.kind == "trapezoid" or shape.role == "edge_decal"
        if probe.allowImplicitQuad and shape.kind == "outline_path" then
            isSimpleQuad = true
        end

        if isSimpleQuad and SZ.drawQuadPoints(shapeLayer, probeLayout, quadPoints, probe.color) then
            return "quad_primitive"
        end
    end

    if points and #points == 3 and (shape.kind == "closed_polygon" or shape.kind == "triangle") then
        if drawTrianglePoints(shapeLayer, probeLayout, points, probe.color) then
            return "triangle_primitive"
        end
    end

    if shape.kind == "closed_polygon" then
        if SZ.drawClassifiedClosedPolygon(shapeLayer, probeLayout, shape, {
            color = probe.color,
        }) then
            return "polygon_primitive"
        end
    end

    local strokeRoute = drawJoinedStrokeCase(probeLayout, shape, probe)
    if strokeRoute then
        return strokeRoute
    end

    return drawPathFallback(probeLayout, probe)
end

local syntheticSourceW = 40
local syntheticSourceH = 40

local probes = {
    {
        id = "trap_fill",
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
        id = "tri_fill",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = syntheticSourceW,
        sourceH = syntheticSourceH,
        item = {
            d = "M20 5 L35 33 L5 33 z",
            fill = "#fff",
        },
    },
    {
        id = "pent_fill",
        color = colors.accentSoft,
        strokeWidth = 1.6,
        sourceW = syntheticSourceW,
        sourceH = syntheticSourceH,
        item = {
            d = "M20 4 L34 14 L29 34 L11 34 L6 14 z",
            fill = "#fff",
        },
    },
    {
        id = "board_trap",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = boardProbe.sourceW,
        sourceH = boardProbe.sourceH,
        item = boardProbe.items.topTrapezoid,
    },
    {
        id = "board_edge",
        descriptor = "edge_decal",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = boardProbe.sourceW,
        sourceH = boardProbe.sourceH,
        item = boardProbe.items.rightMidQuad,
    },
    {
        id = "corner_join",
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = syntheticSourceW,
        sourceH = syntheticSourceH,
        item = {
            d = "M8 34 L8 12 L32 12",
            fill = "#fff",
        },
    },
    {
        id = "outline_quad",
        allowImplicitQuad = true,
        color = colors.highlight,
        strokeWidth = 1.6,
        sourceW = boardProbe.sourceW,
        sourceH = boardProbe.sourceH,
        item = boardProbe.items.leftUpperOutline,
    },
    {
        id = "board_comp",
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

drawText(titleFont, "Shape Primitive Routing Probe", 120, 10, colors.highlight)
drawText(bodyFont, "simple fills use primitives, joined corners use stroke geometry", 120, 18, colors.muted)

for index, probe in ipairs(probes) do
    local col = (index - 1) % 3
    local row = math.floor((index - 1) / 3)
    local cardX = startX + col * stepX
    local cardY = startY + row * stepY
    local cardCenterX = cardX + cardW * 0.5
    local shape = Classifier.classifyItem(probe.item)
    local probeLayout = cardProbeLayout(cardX, cardY, cardW, cardH, shape, probe.sourceW, probe.sourceH)

    drawCard(cardX, cardY, cardW, cardH)
    local route = drawPrimitiveFirstCase(probeLayout, probe, shape)
    local descriptor = probe.descriptor or (shape and (shape.role or shape.kind)) or "nil"

    drawText(bodyFont, probe.id, cardCenterX, cardY + 5, colors.muted)
    drawText(bodyFont, descriptor, cardCenterX, cardY + 40, colors.highlight)
    drawText(
        bodyFont,
        route,
        cardCenterX,
        cardY + 46,
        route == "path_route" and colors.muted or colors.accentSoft
    )

    summaries[#summaries + 1] = string.format("%s=%s|%s", probe.id, descriptor, route)
end

setOutput(table.concat(summaries, ";"))
