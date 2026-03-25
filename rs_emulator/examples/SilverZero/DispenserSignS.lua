-- RenderScript conversion of SilverZero DispenserSignS.html

local SZ = require("lib.SilverZeroRsLib")
local SimpleSignSharedAssets = require("examples.SilverZero.SimpleSignSharedAssets")

local DESCRIPTION_LINES = {
  "Terran",
  "Battlecruiser",
  "\"Hyperion\"",
  "MK1",
}

local theme = {
  background = { 0.31, 0.00, 0.03, 1.0 },
  text = { 1.0, 1.0, 1.0, 1.0 },
  price = { 250 / 255, 212 / 255, 122 / 255, 1.0 },
  placeholderStroke = { 0.86, 0.86, 0.88, 0.48 },
  placeholderFill = { 0.10, 0.10, 0.10, 0.08 },
  placeholderShadow = { 0.18, 0.18, 0.18, 0.55 },
  brokenGreen = { 0.41, 0.78, 0.34, 0.95 },
}

local resolutionX, resolutionY = getResolution()
local SOURCE_W = 1400
local SOURCE_H = 980

local function vw(value)
  return resolutionX * value / 100
end

local function vh(value)
  return resolutionY * value / 100
end

local function cssVw(value)
  return SOURCE_W * value / 100
end

local function cssVh(value)
  return SOURCE_H * value / 100
end

local pixelLayout = {
  screenW = resolutionX,
  screenH = resolutionY,
  sourceW = resolutionX,
  sourceH = resolutionY,
  scale = 1,
  scaleX = 1,
  scaleY = 1,
  x = 0,
  y = 0,
}

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3], theme.background[4])

local backgroundLayout = SZ.relativeLayout(pixelLayout, {
  x = 0,
  y = 0,
  w = resolutionX,
  h = resolutionY,
}, SOURCE_W, SOURCE_H)

local boardLayout = SZ.relativeLayout(pixelLayout, {
  x = vw(10),
  y = vh(10),
  w = vw(80),
  h = vh(80),
}, 231, 156)

local logoLayout = SZ.relativeLayout(pixelLayout, {
  x = vw(14),
  y = vh(60),
  w = vw(13),
  h = vw(13),
}, 248.17, 286.55, {
  preserveAspect = true,
  alignX = "center",
  alignY = "center",
})

local titleBaseFontSize = math.max(1, math.floor(SZ.toScreenW(backgroundLayout, cssVw(6.0)) + 0.5))
local priceFont = loadFont("Montserrat-Light", math.max(1, math.floor(SZ.toScreenW(backgroundLayout, cssVw(7.4)) + 0.5)))
local currencyFont = loadFont("Montserrat-Light", math.max(1, math.floor(SZ.toScreenW(backgroundLayout, cssVw(5.8)) + 0.5)))

local layers = SZ.createLayers("background", "board", "image", "logo", "text")
local sharedAssets = SimpleSignSharedAssets.get()

local function drawDescription()
  local boxX = SZ.toScreenX(backgroundLayout, cssVw(15))
  local boxY = SZ.toScreenY(backgroundLayout, cssVw(12))
  local boxW = SZ.toScreenW(backgroundLayout, cssVw(41))
  local boxH = SZ.toScreenH(backgroundLayout, cssVw(22))
  -- Visual observation: leftFrameEdge at 10.5vw was too far left.
  -- The white frame corner starts further in. Let's adjust to ~16.5vw for the visual edge.
  -- Right dummy square starts at cssVw(61.25)
  local leftFrameEdge = SZ.toScreenX(backgroundLayout, cssVw(16.5))
  local rightSquareEdge = SZ.toScreenX(backgroundLayout, cssVw(61.25))
  local horizontalCenter = (leftFrameEdge + rightSquareEdge) * 0.5

  local baseFont = loadFont("Montserrat-Bold", titleBaseFontSize)
  local maxLineWidth = 0
  local maxLineHeight = 0
  for _, line in ipairs(DESCRIPTION_LINES) do
    local width, height = getTextBounds(baseFont, line)
    maxLineWidth = math.max(maxLineWidth, width)
    maxLineHeight = math.max(maxLineHeight, height)
  end

  local baseCenterStep = maxLineHeight * 1.18
  local baseTotalHeight = maxLineHeight + baseCenterStep * (#DESCRIPTION_LINES - 1)
  local fitScale = math.min(1, (boxW * 0.95) / math.max(1, maxLineWidth), (boxH * 0.92) / math.max(1, baseTotalHeight))
  local finalFontSize = math.max(1, math.floor(titleBaseFontSize * fitScale + 0.5))
  local titleFont = finalFontSize == titleBaseFontSize and baseFont or loadFont("Montserrat-Bold", finalFontSize)
  maxLineHeight = 0
  for _, line in ipairs(DESCRIPTION_LINES) do
    local _, height = getTextBounds(titleFont, line)
    maxLineHeight = math.max(maxLineHeight, height)
  end

  local centerStep = maxLineHeight * 1.18
  local totalHeight = maxLineHeight + centerStep * (#DESCRIPTION_LINES - 1)
  local firstCenterY = boxY + (boxH - totalHeight) * 0.5 + maxLineHeight * 0.5

  for index, line in ipairs(DESCRIPTION_LINES) do
    setNextTextAlign(layers.text, AlignH_Center, AlignV_Middle)
    setNextFillColor(layers.text, theme.text[1], theme.text[2], theme.text[3], theme.text[4])
    addText(layers.text, titleFont, line, horizontalCenter, firstCenterY + (index - 1) * centerStep)
  end
end

local function drawPrice()
  local priceText = "10,000,000"
  local currencyText = "ħ"
  local priceWidth = getTextBounds(priceFont, priceText)
  local groupLeft = SZ.toScreenX(backgroundLayout, cssVw(28.5))
  local baselineY = SZ.toScreenY(backgroundLayout, cssVw(47.5))
  local currencyGap = SZ.toScreenW(backgroundLayout, cssVw(1.2))
  local priceX = groupLeft
  local currencyX = priceX + priceWidth + currencyGap

  setNextTextAlign(layers.text, AlignH_Left, AlignV_Bottom)
  setNextFillColor(layers.text, theme.price[1], theme.price[2], theme.price[3], theme.price[4])
  addText(layers.text, priceFont, priceText, priceX, baselineY)

  setNextTextAlign(layers.text, AlignH_Left, AlignV_Bottom)
  setNextFillColor(layers.text, theme.price[1], theme.price[2], theme.price[3], theme.price[4])
  addText(layers.text, currencyFont, currencyText, currencyX, baselineY)
end

local function drawImagePlaceholder()
  local x = SZ.toScreenX(backgroundLayout, cssVw(61.25))
  local y = SZ.toScreenY(backgroundLayout, cssVw(13))
  local size = SZ.toScreenW(backgroundLayout, cssVw(20))
  local iconX = x + SZ.toScreenW(backgroundLayout, cssVw(0.25))
  local iconY = y + SZ.toScreenY(backgroundLayout, cssVw(0.25))
  local iconW = SZ.toScreenW(backgroundLayout, cssVw(1.55))
  local iconH = SZ.toScreenH(backgroundLayout, cssVw(1.45))

  setNextFillColor(
    layers.image,
    theme.placeholderFill[1],
    theme.placeholderFill[2],
    theme.placeholderFill[3],
    theme.placeholderFill[4]
  )
  setNextStrokeColor(
    layers.image,
    theme.placeholderStroke[1],
    theme.placeholderStroke[2],
    theme.placeholderStroke[3],
    theme.placeholderStroke[4]
  )
  setNextStrokeWidth(layers.image, 1)
  addBox(layers.image, x, y, size, size)

  setNextFillColor(layers.image, theme.placeholderShadow[1], theme.placeholderShadow[2], theme.placeholderShadow[3], 0.72)
  setNextStrokeColor(layers.image, theme.placeholderStroke[1], theme.placeholderStroke[2], theme.placeholderStroke[3], 0.82)
  setNextStrokeWidth(layers.image, 1)
  addBox(layers.image, iconX, iconY, iconW, iconH)

  setNextFillColor(layers.image, theme.brokenGreen[1], theme.brokenGreen[2], theme.brokenGreen[3], theme.brokenGreen[4])
  addTriangle(
    layers.image,
    iconX + iconW * 0.10, iconY + iconH * 0.92,
    iconX + iconW * 0.48, iconY + iconH * 0.50,
    iconX + iconW * 0.92, iconY + iconH * 0.92
  )

  setNextStrokeColor(layers.image, theme.placeholderShadow[1], theme.placeholderShadow[2], theme.placeholderShadow[3], 0.9)
  setNextStrokeWidth(layers.image, 1)
  addLine(
    layers.image,
    iconX + iconW * 0.18, iconY + iconH * 0.78,
    iconX + iconW * 0.88, iconY + iconH * 0.20
  )
end

SZ.drawSvgEntry(layers.background, backgroundLayout, sharedAssets.masterSvg, {
  vars = sharedAssets.vars,
  classifiedShapes = sharedAssets.masterShapes,
  classifiedMode = "fill",
  strokeWidth = 1.8,
})

SZ.drawSvgEntry(layers.board, boardLayout, sharedAssets.boardSvg, {
  vars = sharedAssets.vars,
  classifiedShapes = sharedAssets.boardShapes,
  classifiedMode = "shape",
  strokeWidth = 2.5,
  fallbackFirstSubpathOnly = true,
})

drawImagePlaceholder()

SZ.drawSvgEntry(layers.logo, logoLayout, sharedAssets.logoSvg, {
  vars = sharedAssets.vars,
  classifiedShapes = sharedAssets.logoShapes,
  classifiedMode = "fill",
  strokeWidth = 2.0,
})

drawDescription()
drawPrice()
