-- SimpleSignS-svg.lua
-- RenderScript consumer that reads SVG content and parses it with SvgParser.
-- Renders using the shared SilverZero helper library.

local SZ = require("lib.SilverZeroRsLib")
local SvgParser = require("lib.SvgParser")
local SimpleSignS_svgContent = require("examples.SilverZero.SimpleSignS_html")

local FirstCSS_snippet = [[
<style>
:root {
  --primary-color: #f00;
  --highlight-color: #fff;
  --text-color: #FFF;

  --circuit-color-A: #5008;
  --circuit-color-B: #4008;
  --circuit-color-C: #f008;
}
</style>]]

local resolutionX, resolutionY = getResolution()

local theme = {
    background = { 0.31, 0.00, 0.03, 1.0 },
    circuitB = { 0.25, 0.00, 0.03, 1.0 },
    circuitC = { 0.94, 0.00, 0.03, 1.0 },
    primary = { 1.00, 0.00, 0.00, 1.0 },
    highlight = { 1.00, 1.00, 1.00, 1.0 },
    textColor = { 1.00, 1.00, 1.00, 1.0 },
}

local messageText = "SilverZero's Lab"

_G.__simpleSignS_svgDoc = _G.__simpleSignS_svgDoc or SvgParser.parse(FirstCSS_snippet .. SimpleSignS_svgContent)
local doc = _G.__simpleSignS_svgDoc

local layers = SZ.createLayers("master", "board", "logo", "text")

local function firstSubpathOnly(pathData)
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

local masterLayer = layers.master
local masterW = resolutionX
local masterH = resolutionY
local contentCenterY = resolutionY * 0.5
local logoSourceW = 248.17
local logoSourceH = 286.55
local logoHexRingCenterX = 15186.2
local logoHexRingCenterY = 10315.975
local logoHexRingOuterRadius = 1285.415
local logoHexRingInnerRadius = 917.845
local logoSegmentQuads = {
    {
        color = "highlight",
        points = {
            { x = 96.2, y = 16.1 },
            { x = 96.2, y = 29.0 },
            { x = 39.1, y = 62.0 },
            { x = 27.9, y = 55.5 },
        },
    },
    {
        color = "primary",
        points = {
            { x = 152.0, y = 16.1 },
            { x = 220.3, y = 55.6 },
            { x = 209.1, y = 62.0 },
            { x = 152.0, y = 29.0 },
        },
    },
    {
        color = "primary",
        points = {
            { x = 0.0, y = 103.9 },
            { x = 11.1, y = 110.2 },
            { x = 11.1, y = 176.3 },
            { x = 0.3, y = 182.5 },
        },
    },
    {
        color = "highlight",
        points = {
            { x = 237.0, y = 110.2 },
            { x = 248.2, y = 103.9 },
            { x = 248.2, y = 182.6 },
            { x = 237.1, y = 176.2 },
        },
    },
    {
        color = "highlight",
        points = {
            { x = 27.9, y = 231.0 },
            { x = 39.1, y = 224.6 },
            { x = 96.2, y = 257.6 },
            { x = 96.2, y = 270.4 },
        },
    },
    {
        color = "primary",
        points = {
            { x = 152.0, y = 257.6 },
            { x = 209.1, y = 224.6 },
            { x = 219.9, y = 230.9 },
            { x = 152.0, y = 270.5 },
        },
    },
}
local boardRightDecalQuads = {
    {
        points = {
            { x = 226.095, y = 16.646 },
            { x = 228.937, y = 13.314 },
            { x = 228.937, y = 17.038 },
            { x = 226.095, y = 20.370 },
        },
    },
    {
        points = {
            { x = 226.095, y = 9.198 },
            { x = 228.937, y = 5.866 },
            { x = 228.937, y = 9.590 },
            { x = 226.095, y = 12.922 },
        },
    },
    {
        points = {
            { x = 226.095, y = 27.818 },
            { x = 226.095, y = 24.094 },
            { x = 228.937, y = 20.762 },
            { x = 228.937, y = 24.486 },
        },
    },
    {
        points = {
            { x = 229.035, y = 137.676 },
            { x = 226.193, y = 134.344 },
            { x = 226.193, y = 138.068 },
            { x = 229.035, y = 141.400 },
        },
    },
    {
        points = {
            { x = 229.035, y = 130.228 },
            { x = 226.193, y = 126.896 },
            { x = 226.193, y = 130.620 },
            { x = 229.035, y = 133.952 },
        },
    },
    {
        points = {
            { x = 226.095, y = 145.516 },
            { x = 226.095, y = 141.792 },
            { x = 228.937, y = 145.124 },
            { x = 228.937, y = 148.848 },
        },
    },
}
local boardLeftDecalQuads = {
    {
        points = {
            { x = 1.871, y = 150.122 },
            { x = 1.871, y = 146.398 },
            { x = 4.713, y = 143.066 },
            { x = 4.713, y = 146.790 },
        },
    },
    {
        points = {
            { x = 1.871, y = 8.904 },
            { x = 1.871, y = 5.180 },
            { x = 4.713, y = 8.512 },
            { x = 4.713, y = 12.236 },
        },
    },
}
local boardCenterHighlightQuads = {
    {
        points = {
            { x = 79.6826, y = 152.768 },
            { x = 135.1506, y = 152.768 },
            { x = 138.7766, y = 149.338 },
            { x = 76.2526, y = 149.338 },
        },
    },
}

local function applyTransformPoint(transform, x, y)
    if not transform then
        return x, y
    end
    return
        transform[1] * x + transform[3] * y + transform[5],
        transform[2] * x + transform[4] * y + transform[6]
end

local function applyTransformDistance(transform, dx, dy)
    if not transform then
        return math.sqrt(dx * dx + dy * dy)
    end
    local tx = transform[1] * dx + transform[3] * dy
    local ty = transform[2] * dx + transform[4] * dy
    return math.sqrt(tx * tx + ty * ty)
end

local function drawLogoSegmentQuad(layer, layout, quad, color)
    setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
    addQuad(
        layer,
        SZ.toScreenX(layout, quad.points[1].x),
        SZ.toScreenY(layout, quad.points[1].y),
        SZ.toScreenX(layout, quad.points[2].x),
        SZ.toScreenY(layout, quad.points[2].y),
        SZ.toScreenX(layout, quad.points[3].x),
        SZ.toScreenY(layout, quad.points[3].y),
        SZ.toScreenX(layout, quad.points[4].x),
        SZ.toScreenY(layout, quad.points[4].y)
    )
end

local function drawBoardQuad(layer, layout, quad, color)
    setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
    addQuad(
        layer,
        SZ.toScreenX(layout, quad.points[1].x),
        SZ.toScreenY(layout, quad.points[1].y),
        SZ.toScreenX(layout, quad.points[2].x),
        SZ.toScreenY(layout, quad.points[2].y),
        SZ.toScreenX(layout, quad.points[3].x),
        SZ.toScreenY(layout, quad.points[3].y),
        SZ.toScreenX(layout, quad.points[4].x),
        SZ.toScreenY(layout, quad.points[4].y)
    )
end

setNextFillColor(masterLayer, theme.background[1], theme.background[2], theme.background[3], theme.background[4])
addBox(masterLayer, 0, 0, masterW, masterH)

for _, svgEntry in ipairs(doc.svgs or {}) do
    local id = svgEntry.id or ""
    local cls = svgEntry.class or ""

    if id == "master-artboard" then
        local vb = svgEntry.viewBox
        local srcW, srcH = 1400, 980
        if vb then
            local parts = {}
            for num in vb:gmatch("[%d%.e%+%-]+") do
                table.insert(parts, tonumber(num) or 0)
            end
            if #parts >= 4 then
                srcW, srcH = parts[3], parts[4]
            end
        end
        local layout = SZ.layoutForScreen(resolutionX, resolutionY, srcW, srcH, 0)
        layout.x = 0
        layout.y = 0
        layout.scale = math.max(resolutionX / srcW, resolutionY / srcH)

        for _, item in ipairs(svgEntry.items or {}) do
            local fill = theme.circuitC
            if item.fill then
                local resolved = SvgParser.parseColor(item.fill, doc.vars)
                if resolved then fill = resolved end
            end
            if item.d then
                SZ.drawPath(masterLayer, layout, item.d, fill, 1.8, item.transform)
            end
        end

    elseif id == "" and cls == "" and svgEntry.width and svgEntry.width:find("80vw") then
        local boardLayer = layers.board
        local boardScaleX = (resolutionX * 0.8) / 231
        local boardScaleY = (resolutionY * 0.8) / 156
        local boardX = resolutionX * 0.1
        local boardY = resolutionY * 0.1

        local scaledLayout = {
            screenW = resolutionX,
            screenH = resolutionY,
            sourceW = 231,
            sourceH = 156,
            scale = math.min(boardScaleX, boardScaleY),
            scaleX = boardScaleX,
            scaleY = boardScaleY,
            x = boardX,
            y = boardY,
        }

        for _, item in ipairs(svgEntry.items or {}) do
            local fill = theme.primary
            if item.fill then
                local resolved = SvgParser.parseColor(item.fill, doc.vars)
                if resolved then fill = resolved end
            end
            if item.d then
                local skipBoardPath = item.fill == "var(--highlight-color)" and (
                    item.d == "m2330 1473 29 34v-38l-29-34v38"
                    or item.d == "m2330 1549 29 34v-38l-29-34v38"
                    or item.d == "m2330 1359v38l29 34v-38"
                    or item.d == "m2360 238-29 34v-38l29-34v38"
                    or item.d == "m2360 314-29 34v-38l29-34v38"
                    or item.d == "m2330 158v38l29-34v-38"
                    or item.d == "m42 111v38l29 34v-38"
                    or item.d == "m42 1552v38l29-34v-38"
                    or item.d == "m836 84h566l37 35h-638l35-35"
                )
                if not skipBoardPath then
                    local boardPath = item.d
                    if item.fill and item.fill ~= "" and item.fill ~= "none" then
                        boardPath = firstSubpathOnly(boardPath)
                    end
                    SZ.drawPath(boardLayer, scaledLayout, boardPath, fill, 2.5, item.transform)
                end
            end
        end

        for _, quad in ipairs(boardRightDecalQuads) do
            drawBoardQuad(boardLayer, scaledLayout, quad, theme.highlight)
        end
        for _, quad in ipairs(boardLeftDecalQuads) do
            drawBoardQuad(boardLayer, scaledLayout, quad, theme.highlight)
        end
        for _, quad in ipairs(boardCenterHighlightQuads) do
            drawBoardQuad(boardLayer, scaledLayout, quad, theme.highlight)
        end

    elseif svgEntry.width and svgEntry.width:find("20vw") then
        local logoLayer = layers.logo
        local logoX = resolutionX * 0.14
        local logoY = contentCenterY
        local logoSize = resolutionX * 0.20
        local logoScale = logoSize / logoSourceW
        local logoRenderH = logoSourceH * logoScale

        local logoLayout = {
            screenW = resolutionX,
            screenH = resolutionY,
            sourceW = logoSourceW,
            sourceH = logoSourceH,
            scale = logoScale,
            x = logoX,
            y = logoY - logoRenderH * 0.5,
        }

        local deferredLogoFillItems = {}

        for itemIndex, item in ipairs(svgEntry.items or {}) do
            local fill = theme.primary
            if item.fill then
                local resolved = SvgParser.parseColor(item.fill, doc.vars)
                if resolved then fill = resolved end
            end
            if item.d then
                local itemTransform = item.transform
                if item.fill == "var(--highlight-color)" and #item.d == 172 and itemTransform then
                    table.insert(deferredLogoFillItems, {
                        kind = "ring",
                        fill = fill,
                        transform = itemTransform,
                        drawOrder = 1,
                    })
                elseif itemIndex >= 1 and itemIndex <= 7 and itemIndex ~= 3 then
                else
                    SZ.drawPath(logoLayer, logoLayout, item.d, fill, 2.0, itemTransform)
                end
            end
        end

        table.sort(deferredLogoFillItems, function(a, b)
            return a.drawOrder < b.drawOrder
        end)

        for _, deferredItem in ipairs(deferredLogoFillItems) do
            if deferredItem.kind == "ring" then
                local cx, cy = applyTransformPoint(deferredItem.transform, logoHexRingCenterX, logoHexRingCenterY)
                local outerRadius = applyTransformDistance(deferredItem.transform, 0, -logoHexRingOuterRadius)
                local innerRadius = applyTransformDistance(deferredItem.transform, 0, -logoHexRingInnerRadius)
                SZ.hexRing(logoLayer, logoLayout, cx, cy, outerRadius, outerRadius - innerRadius, deferredItem.fill)
            end
        end

        for _, quad in ipairs(logoSegmentQuads) do
            local color = quad.color == "primary" and theme.primary or theme.highlight
            drawLogoSegmentQuad(logoLayer, logoLayout, quad, color)
        end
    end
end

local textLayer = layers.text
local textFontSize = math.floor(resolutionX * 0.07)
local textFont = SZ.font("Arial", textFontSize)
local textX = resolutionX * 0.36 + (resolutionX * 0.49) * 0.5
local textY = contentCenterY

setNextTextAlign(textLayer, AlignH_Center, AlignV_Middle)
setNextFillColor(textLayer, theme.textColor[1], theme.textColor[2], theme.textColor[3], theme.textColor[4])
addText(textLayer, textFont, messageText, textX, textY)
