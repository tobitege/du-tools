local SZ = require("lib.SilverZeroRsLib")
local Classifier = require("lib.SvgShapeClassifier")

local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 240, 160, 0.04)

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

local titleFont = SZ.font("Arial", SZ.scaleFontSize(11, layout))
local bodyFont = SZ.font("Arial", SZ.scaleFontSize(5, layout))

local function translatedScale(scale, tx, ty)
    return { scale, 0, 0, scale, tx, ty }
end

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

local function drawFallbackStrokePreview(shape, color, strokeWidth)
    local subpaths = shape and shape.geometry and shape.geometry.subpaths or nil
    if not subpaths then
        return false
    end

    local drew = false
    for _, subpath in ipairs(subpaths) do
        local points = subpath.points or {}
        if #points >= 2 then
            setNextStrokeColor(shapeLayer, color[1], color[2], color[3], color[4] or 1)
            setNextStrokeWidth(shapeLayer, strokeWidth * layout.scale)
            for i = 1, #points - 1 do
                addLine(
                    shapeLayer,
                    SZ.toScreenX(layout, points[i].x),
                    SZ.toScreenY(layout, points[i].y),
                    SZ.toScreenX(layout, points[i + 1].x),
                    SZ.toScreenY(layout, points[i + 1].y)
                )
                drew = true
            end
        end
    end

    return drew
end

local probes = {
    {
        id = "hex_fill",
        label = "hex_ring",
        adapter = "fill",
        fill = colors.accent,
        item = {
            d = "M0 -10 L8.66 -5 L8.66 5 L0 10 L-8.66 5 L-8.66 -5 z M0 -6 L5.2 -3 L5.2 3 L0 6 L-5.2 3 L-5.2 -3 z",
            fill = "#f00",
            transform = translatedScale(1.45, 45, 54),
        },
    },
    {
        id = "poly_fill",
        label = "polygon_ring",
        adapter = "fill",
        fill = colors.highlight,
        item = {
            d = "M-10 -10 L10 -10 L10 10 L-10 10 z M-5 -5 L5 -5 L5 5 L-5 5 z",
            fill = "#fff",
            transform = translatedScale(1.05, 120, 54),
        },
    },
    {
        id = "trap_fill",
        label = "trapezoid",
        adapter = "fill",
        fill = colors.accent,
        item = {
            d = "M-12 -7 L12 -7 L8 7 L-8 7 z",
            fill = "#f00",
            transform = translatedScale(1.0, 195, 54),
        },
    },
    {
        id = "poly_closed",
        label = "closed_polygon",
        adapter = "fill",
        fill = colors.highlight,
        item = {
            d = "M0 -14 L12 -4 L8 10 L-8 10 L-12 -4 z",
            fill = "#fff",
            transform = translatedScale(1.0, 45, 118),
        },
    },
    {
        id = "compound_stroke",
        label = "compound_path",
        adapter = "stroke",
        fill = colors.highlight,
        item = {
            d = "M-14 -8 L-4 -8 L-4 8 L-14 8 z M4 -8 L14 -8 L14 8 L4 8 z",
            fill = "#fff",
            transform = translatedScale(1.0, 120, 118),
        },
    },
    {
        id = "outline_stroke",
        label = "outline_path",
        adapter = "stroke",
        fill = colors.accent,
        item = {
            d = "M-14 10 L-8 -8 L0 -2 L8 -12 L14 -4",
            fill = "#f00",
            transform = translatedScale(1.0, 195, 118),
        },
    },
}

local summaries = {}
local cardW = 68
local cardH = 54
local startX = 11
local startY = 27
local stepX = 75
local stepY = 64

setNextFillColor(bgLayer, colors.background[1], colors.background[2], colors.background[3], colors.background[4])
addBox(bgLayer, 0, 0, resolutionX, resolutionY)

drawText(titleFont, "Shape Adapter Probe", 120, 12, colors.highlight)
drawText(bodyFont, "free-form classified geometry", 120, 20, colors.muted)

for index, probe in ipairs(probes) do
    local col = (index - 1) % 3
    local row = math.floor((index - 1) / 3)
    local cardX = startX + col * stepX
    local cardY = startY + row * stepY
    local cardCenterX = cardX + cardW * 0.5

    drawCard(cardX, cardY, cardW, cardH)

    local shape = Classifier.classifyItem(probe.item)
    local drew = false
    local fallbackPreview = false
    if probe.adapter == "fill" then
        drew = SZ.drawClassifiedFillShape(shapeLayer, layout, shape, {
            color = probe.fill,
            strokeWidth = 1.6,
        })
    elseif probe.adapter == "stroke" then
        drew = SZ.drawClassifiedStrokeShape(shapeLayer, layout, shape, {
            color = probe.fill,
            strokeWidth = 1.6,
        })
    else
        drew = SZ.drawClassifiedShape(shapeLayer, layout, shape, {
            color = probe.fill,
            strokeWidth = 1.6,
        })
    end

    if not drew and probe.adapter == "stroke" then
        fallbackPreview = drawFallbackStrokePreview(shape, colors.accentSoft, 2.2)
    end

    drawText(bodyFont, probe.id, cardCenterX, cardY + 6, colors.muted)
    drawText(bodyFont, shape and shape.kind or "nil", cardCenterX, cardY + 44, colors.highlight)
    local statusText = (drew and "adapter" or "fallback") .. ":" .. probe.adapter
    if fallbackPreview then
        statusText = "preview:fallback"
    end
    drawText(bodyFont, statusText, cardCenterX, cardY + 50, drew and colors.accentSoft or colors.muted)

    summaries[#summaries + 1] = string.format(
        "%s=%s|%s|%s",
        probe.id,
        shape and shape.kind or "nil",
        probe.adapter,
        tostring(drew)
    )
end

setOutput(table.concat(summaries, ";"))
