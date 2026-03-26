-- RenderScript conversion of SilverZero DispenserSignS.html

local SZ = require("lib.SilverZeroRsLib")
local SimpleSignSharedAssetsSelective = require("lib.SimpleSignSharedAssetsSelective")

local OPTIONS = {
  -- Grobe Mock-Kosten mit aktuellem Stand:
  -- CircuitCRange1 ~1154, Logo ~729, CircuitCRange2 ~675,
  -- BoardOutline ~31, BoardHighlights ~45, Dots ~23, Placeholder ~4, Text ~6.
  -- Fuer schnelles Ausschlussverfahren zuerst diese drei toggeln:
  -- drawCircuitCRange1, drawLogo, drawCircuitCRange2.
  drawCircuitB = true,
  drawCircuitCRange1 = true,
  drawCircuitCRange1Start = 8,
  drawCircuitCRange1End = 24,
  drawCircuitCRange2 = true,
  drawCircuitCRange2Start = 82,
  drawCircuitCRange2End = 99,
  drawCircuitDots = true,
  drawCircuitDotsStart = 102,
  drawCircuitDotsEnd = 124,
  drawBoardOutline = true,
  drawBoardHighlights = true,
  drawImagePlaceholder = true,
  drawLogo = true,
  drawDescription = true,
  drawPrice = true,
}

local DESCRIPTION_LINES = {
  "Terran",
  "Battlecruiser",
  "\"Hyperion\"",
  "MK1",
}

local theme = {
  background = { 0.31, 0.00, 0.03, 1.0 },
  circuitB = { 0.25, 0.00, 0.03, 1.0 },
  circuitC = { 0.94, 0.00, 0.03, 1.0 },
  primary = { 1.0, 0.0, 0.0, 1.0 },
  highlight = { 1.0, 1.0, 1.0, 1.0 },
  text = { 1.0, 1.0, 1.0, 1.0 },
  price = { 250 / 255, 212 / 255, 122 / 255, 1.0 },
  placeholderStroke = { 0.86, 0.86, 0.88, 0.48 },
  placeholderFill = { 0.10, 0.10, 0.10, 0.08 },
  placeholderShadow = { 0.18, 0.18, 0.18, 0.55 },
  brokenGreen = { 0.41, 0.78, 0.34, 0.95 },
}

local BOARD_OUTLINE_PATH =
  "m76.53 1636.6h335l49.6-41.6 1505.6 0.62 47 41h327l40-33v-237l-43.59-51.6 3.45-901.44 42-36-2.59-265.46-40.05-35.91-330.6 0.62041-47 41-490.65 2.2-64-61h-560l-65.65 62.09h-334l-48.6-41.62-328.7-4.36-33.3 36.36-4.52 45.54 35.68 38.7 3.61 322.36-35 29v635l33 28 0.31 271.5-33 40v82z"
local BOARD_OUTLINE_TRANSFORM = { 0.098, 0, 0, -0.098, -3, 161 }

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
local needMasterAssets = OPTIONS.drawCircuitB or OPTIONS.drawCircuitCRange1 or OPTIONS.drawCircuitCRange2 or OPTIONS.drawCircuitDots
local needSharedAssets = needMasterAssets or OPTIONS.drawBoardHighlights or OPTIONS.drawLogo
local sharedAssets = needSharedAssets and SimpleSignSharedAssetsSelective.get({
  master = needMasterAssets,
  board = OPTIONS.drawBoardHighlights,
  logo = OPTIONS.drawLogo,
}) or nil

local function resolveBoardColor(item, shape)
  if item.fill == "#000c" then
    return { 0.0, 0.0, 0.0, 0.8 }
  end

  if item.fill == "var(--highlight-color)" and (not shape or shape.role ~= "edge_decal") then
    return theme.highlight
  end

  return nil
end

local function drawBoardNativeQuad(points, color)
  return SZ.drawQuadPoints(layers.board, boardLayout, points, color)
end

local function drawMasterPathRange(firstIndex, lastIndex, color, strokeWidth)
  for itemIndex = firstIndex, lastIndex do
    local item = sharedAssets and sharedAssets.masterSvg and sharedAssets.masterSvg.items and sharedAssets.masterSvg.items[itemIndex] or nil
    if item and item.d then
      SZ.drawPath(layers.background, backgroundLayout, item.d, color, strokeWidth, item.transform)
    end
  end
end

local function drawMasterDotRange(firstIndex, lastIndex, color)
  for itemIndex = firstIndex, lastIndex do
    local shape = sharedAssets and sharedAssets.masterShapes and sharedAssets.masterShapes[itemIndex] or nil
    local geometry = shape and shape.geometry or nil
    local center = geometry and geometry.center or nil
    local bounds = geometry and geometry.bounds or nil
    if center and bounds and bounds.w then
      SZ.drawDot(layers.background, backgroundLayout, center.x, center.y, bounds.w * 0.5, color)
    end
  end
end

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
  local baselineY = SZ.toScreenY(backgroundLayout, cssVw(50.0))
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

  setNextFillColor(layers.image, 0.0, 0.0, 0.0, 0.0)
  setNextStrokeColor(
    layers.image,
    theme.placeholderStroke[1],
    theme.placeholderStroke[2],
    theme.placeholderStroke[3],
    theme.placeholderStroke[4]
  )
  setNextStrokeWidth(layers.image, 2)
  addBox(layers.image, x, y, size, size)
end

if OPTIONS.drawCircuitB then
  drawMasterPathRange(2, 7, theme.circuitB, 2.0)
end

if OPTIONS.drawCircuitCRange1 then
  drawMasterPathRange(OPTIONS.drawCircuitCRange1Start, OPTIONS.drawCircuitCRange1End, theme.circuitC, 1.8)
end

if OPTIONS.drawCircuitCRange2 then
  drawMasterPathRange(OPTIONS.drawCircuitCRange2Start, OPTIONS.drawCircuitCRange2End, theme.circuitC, 1.8)
end

if OPTIONS.drawCircuitDots then
  drawMasterDotRange(OPTIONS.drawCircuitDotsStart, OPTIONS.drawCircuitDotsEnd, theme.circuitC)
end

if OPTIONS.drawBoardOutline then
  SZ.drawPath(layers.board, boardLayout, BOARD_OUTLINE_PATH, theme.primary, 3.0, BOARD_OUTLINE_TRANSFORM)
end

if OPTIONS.drawBoardHighlights and sharedAssets and sharedAssets.boardSvg then
  SZ.drawSvgEntry(layers.board, boardLayout, sharedAssets.boardSvg, {
    vars = sharedAssets.vars,
    classifiedShapes = sharedAssets.boardShapes,
    classifiedMode = "shape",
    strokeWidth = 2.5,
    fallbackFirstSubpathOnly = true,
    useSvgFill = false,
    colorResolver = resolveBoardColor,
  })

  for itemIndex, item in ipairs(sharedAssets.boardSvg.items or {}) do
    local shape = sharedAssets.boardShapes and sharedAssets.boardShapes[itemIndex] or nil
    local points = shape and shape.geometry and shape.geometry.points or nil

    if item.fill == "var(--highlight-color)" and shape and shape.role == "edge_decal" and points and #points == 4 then
      drawBoardNativeQuad(points, theme.highlight)
    end
  end
end

if OPTIONS.drawImagePlaceholder then
  drawImagePlaceholder()
end

if OPTIONS.drawLogo and sharedAssets and sharedAssets.logoSvg then
  SZ.drawSvgEntry(layers.logo, logoLayout, sharedAssets.logoSvg, {
    vars = sharedAssets.vars,
    classifiedShapes = sharedAssets.logoShapes,
    classifiedMode = "fill",
    strokeWidth = 2.0,
  })
end

if OPTIONS.drawDescription then
  drawDescription()
end

if OPTIONS.drawPrice then
  drawPrice()
end
