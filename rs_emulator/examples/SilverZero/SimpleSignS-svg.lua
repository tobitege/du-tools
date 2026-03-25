-- SimpleSignS-svg.lua
-- RenderScript consumer that reads SVG content and parses it with SvgParser.
-- Renders using the shared SilverZero helper library.

local SZ = require("lib.SilverZeroRsLib")
local SvgParser = require("lib.SvgParser")
local SimpleSignSharedAssets = require("examples.SilverZero.SimpleSignSharedAssets")

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

local sharedAssets = SimpleSignSharedAssets.get()

local layers = SZ.createLayers("master", "board", "logo", "text")

local masterLayer = layers.master
local masterW = resolutionX
local masterH = resolutionY
local contentCenterY = resolutionY * 0.5
local logoSourceW = 248.17
local logoSourceH = 286.55

setNextFillColor(masterLayer, theme.background[1], theme.background[2], theme.background[3], theme.background[4])
addBox(masterLayer, 0, 0, masterW, masterH)

local masterSvg = sharedAssets.masterSvg
local masterLayout = SZ.layoutForScreen(resolutionX, resolutionY, 1400, 980, 0)
masterLayout.x = 0
masterLayout.y = 0
masterLayout.scale = math.max(resolutionX / 1400, resolutionY / 980)

for itemIndex, item in ipairs(masterSvg.items or {}) do
    local fill = theme.circuitC
    if item.fill then
        local resolved = SvgParser.parseColor(item.fill, sharedAssets.vars)
        if resolved then fill = resolved end
    end
    if item.d then
        local classifiedShape = sharedAssets.masterShapes[itemIndex]
        SZ.drawClassifiedPathItem(masterLayer, masterLayout, item, classifiedShape, {
            classifiedMode = "fill",
            classifiedKinds = { "polygon_ring", "quad", "trapezoid" },
            color = fill,
            strokeWidth = 1.8,
        })
    end
end

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

for itemIndex, item in ipairs(sharedAssets.boardSvg.items or {}) do
    local fill = theme.primary
    if item.fill then
        local resolved = SvgParser.parseColor(item.fill, sharedAssets.vars)
        if resolved then fill = resolved end
    end
    if item.d then
        local classifiedShape = sharedAssets.boardShapes[itemIndex]
        SZ.drawClassifiedPathItem(boardLayer, scaledLayout, item, classifiedShape, {
            classifiedMode = "shape",
            color = fill,
            strokeWidth = 2.5,
            fallbackFirstSubpathOnly = true,
        })
    end
end

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

for itemIndex, item in ipairs(sharedAssets.logoSvg.items or {}) do
    local fill = theme.primary
    if item.fill then
        local resolved = SvgParser.parseColor(item.fill, sharedAssets.vars)
        if resolved then fill = resolved end
    end
    if item.d then
        local classifiedShape = sharedAssets.logoShapes[itemIndex]
        SZ.drawClassifiedPathItem(logoLayer, logoLayout, item, classifiedShape, {
            classifiedMode = "fill",
            color = fill,
            strokeWidth = 2.0,
        })
    end
end

local textLayer = layers.text
local textFontSize = math.floor(resolutionX * 0.07)
local textFont = SZ.font("Georgia", textFontSize)
local textX = resolutionX * 0.36 + (resolutionX * 0.49) * 0.5
local textY = contentCenterY - 50

setNextTextAlign(textLayer, AlignH_Center, AlignV_Middle)
setNextFillColor(textLayer, theme.textColor[1], theme.textColor[2], theme.textColor[3], theme.textColor[4])
addText(textLayer, textFont, messageText, textX, textY)
