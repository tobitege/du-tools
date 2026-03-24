-- SimpleSignS-svg.lua
-- RenderScript consumer that reads SVG content and parses it with SvgParser.
-- Renders using the shared SilverZero helper library.

local SZ = require("lib.SilverZeroRsLib")
local SvgParser = require("lib.SvgParser")
local SvgShapeClassifier = require("lib.SvgShapeClassifier")
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

local masterLayer = layers.master
local masterW = resolutionX
local masterH = resolutionY
local contentCenterY = resolutionY * 0.5
local logoSourceW = 248.17
local logoSourceH = 286.55

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
        local classifiedBoardShapes = SvgShapeClassifier.classifySvg(svgEntry, {
            vars = doc.vars,
        })

        for itemIndex, item in ipairs(svgEntry.items or {}) do
            local fill = theme.primary
            if item.fill then
                local resolved = SvgParser.parseColor(item.fill, doc.vars)
                if resolved then fill = resolved end
            end
            if item.d then
                local classifiedShape = classifiedBoardShapes[itemIndex]
                SZ.drawClassifiedPathItem(boardLayer, scaledLayout, item, classifiedShape, {
                    classifiedMode = "shape",
                    color = fill,
                    strokeWidth = 2.5,
                    fallbackFirstSubpathOnly = true,
                })
            end
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
        local classifiedLogoShapes = SvgShapeClassifier.classifySvg(svgEntry, {
            vars = doc.vars,
        })

        for itemIndex, item in ipairs(svgEntry.items or {}) do
            local fill = theme.primary
            if item.fill then
                local resolved = SvgParser.parseColor(item.fill, doc.vars)
                if resolved then fill = resolved end
            end
            if item.d then
                local classifiedShape = classifiedLogoShapes[itemIndex]
                SZ.drawClassifiedPathItem(logoLayer, logoLayout, item, classifiedShape, {
                    classifiedMode = "fill",
                    color = fill,
                    strokeWidth = 2.0,
                })
            end
        end
    end
end

local textLayer = layers.text
local textFontSize = math.floor(resolutionX * 0.07)
local textFont = SZ.font("Georgia", textFontSize)
local textX = resolutionX * 0.36 + (resolutionX * 0.49) * 0.5
local textY = contentCenterY

setNextTextAlign(textLayer, AlignH_Center, AlignV_Middle)
setNextFillColor(textLayer, theme.textColor[1], theme.textColor[2], theme.textColor[3], theme.textColor[4])
addText(textLayer, textFont, messageText, textX, textY)
