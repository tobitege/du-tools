-- RenderScript conversion of SilverZero ContainerHubHubM.json

local SZ = require("lib.SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()

local SOURCE_W = 231
local SOURCE_H = 156
local CARD_SOURCE_W = 504.98
local CARD_SOURCE_H = 268.68
local CARD_VW_W = 12.25 * 1.8795
local CARD_VW_H = 12.25

local function vw(value)
  return SOURCE_W * value / 100
end

local function vh(value)
  return SOURCE_H * value / 100
end

local function cardCssX(value)
  return CARD_SOURCE_W * value / CARD_VW_W
end

local function cardCssY(value)
  return CARD_SOURCE_H * value / CARD_VW_H
end

local layout = SZ.layoutForScreen(resolutionX, resolutionY, SOURCE_W, SOURCE_H, 0)
setBackgroundColor(theme.background[1], theme.background[2], theme.background[3])

local function topMetricFontSize(baseSize)
  return math.max(1, math.floor(baseSize * math.sqrt(layout.scale) + 0.5))
end

local layers = SZ.createLayers("frame", "bar", "separator", "cards", "text")

local hubPalette = {
  A = {
    hex = "#eb8934",
    color = { 0.92, 0.54, 0.20, 0.88 },
  },
  B = {
    hex = "#31bfeb",
    color = { 0.19, 0.75, 0.92, 0.88 },
  },
  C = {
    hex = "#37ed4c",
    color = { 0.22, 0.93, 0.30, 0.88 },
  },
  D = {
    hex = "#eb3498",
    color = { 0.92, 0.20, 0.60, 0.88 },
  },
}

local hubs = {
  { name = "A", loaded = 186, max = 300 },
  { name = "B", loaded = 98, max = 220 },
  { name = "C", loaded = 124, max = 220 },
  { name = "D", loaded = 70, max = 160 },
}

local items = {
  { name = "Titanium Alloy", amount = "1240 L", code = "TA", hub = "A", selected = true },
  { name = "Carbon", amount = "540 kg", code = "C", hub = "B" },
  { name = "Copper", amount = "88 kL", code = "Cu", hub = "C" },
  { name = "Nitride", amount = "330 L", code = "Ni", hub = "D" },
  { name = "Hydrogen", amount = "620 L", code = "H2", hub = "A" },
  { name = "Scrap", amount = "44 kg", code = "Sc", hub = "B" },
  { name = "Electrons", amount = "12 U", code = "El", hub = "C" },
  { name = "Warp Cell", amount = "19 kL", code = "WC", hub = "D" },
  { name = "Titanium", amount = "90 kg", code = "Ti", hub = "A" },
  { name = "Silicon", amount = "160 L", code = "Si", hub = "C" },
  { name = "Aluminum", amount = "700 L", code = "Al", hub = "B" },
  { name = "Ore Dust", amount = "33 U", code = "OD", hub = "A" },
}

local FRAME_SVG = [[
<svg width="100vw" height="100vh" version="1.1" viewBox="0 0 231 156" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
<g transform="translate(156,-71)">
<g transform="matrix(.98 0 0 -.98 -159 232)">
<g transform="scale(.1)">
<g transform="translate(7.7)" fill="#bbb">
<path d="m413 119-30-26h-300l25 26h305"/>
<path d="m85 94h297l28 24h-302l-23-24m297-2h-300l-0.91 0.61 0.2 1.1 25 26 0.72 0.3h305l0.93-0.66-0.29-1.1-30-26-0.64-0.24"/>
<path d="m2312 93h-300l-30 26h305l25-26"/>
<path d="m2e3 94h297l-23 24h-302l28-24m299-2h-300l-0.65 0.24-30 26-0.29 1.1 0.94 0.66h305l0.71-0.3 25-26 0.41-0.81-1-1"/>
<path d="m836 84h566l37 35h-638l35-35"/>
<path d="m2309 1620h-300l-25-21h350l-25 21"/>
<path d="m402 1620h-300l-25-21h350l-25 21"/>
<path d="m402 1620h-300l-25-21h350l-25 21"/>
<path d="m46 195-20-15v351l20-16v-320"/>
<path d="m46 1215-21-18v305l21-25v-262"/>
<path d="m2330 1473 29 34v-38l-29-34v38"/>
<path d="m2330 1549 29 34v-38l-29-34v38"/>
<path d="m2330 1359v38l29 34v-38"/>
<path d="m2360 238-29 34v-38l29-34v38"/>
<path d="m2360 314-29 34v-38l29-34v38"/>
<path d="m2330 158v38l29-34v-38"/>
<path d="m42 111v38l29 34v-38"/>
<path d="m42 1552v38l29-34v-38"/>
</g>
<g transform="translate(7.7)" fill="#b41010">
<path d="m840 59h560l64 61 1.7 0.7h491l1.6-0.61 47-41h327l40 33v260l-42 36-0.86 1.9v905l0.59 1.6 43 50v237l-40 33h-327l-47-41-1.6-0.62h-1504l-1.6 0.6-48 41h-335l-39-33v-82l33-40 0.57-1.6v-268l-0.88-1.9-33-28v-635l35-29 0.91-1.9v-322l-0.68-1.7-35-37v-44l36-32h326l47 41 1.6 0.62h334l1.7-0.7 64-61m561-5h-562l-1.7 0.69-64 61h-332l-47-41-1.6-0.62h-328l-1.7 0.65-37 34-0.82 1.9v46l0.68 1.7 35 37v320l-35 29-0.91 1.9v638l0.88 1.9 33 28v266l-33 40-0.57 1.6v84l0.87 1.9 40 35 1.6 0.61h336l1.6-0.61 48-41h1502l47 41 1.6 0.62h329l1.6-0.58 41-34 0.91-1.9v-239l-0.6-1.6-43-50v-903l42-36 0.87-1.9v-263l-0.91-1.9-41-34-1.6-0.57h-329l-1.6 0.62-47 41h-489l-64-61-1.7-0.69"/>
</g>
</g>
</g>
</g>
</svg>
]]

local SEPARATOR_SVG = [[
<svg id="master-artboard" width="1vw" height="23vh" enable-background="new 0 0 1400 980" version="1.1" viewBox="0 0 13 231">
    <g transform="translate(-1084 -709)" fill="#bbb">
        <g fill="#f00">
            <path d="m1097 748-9.6-8.7v-30h-3.1v231h3.1v-102l9.6-10z" fill="#bbb"/>
        </g>
    </g>
</svg>
]]

local ITEM_CARD_SVG = [[
<style>
:root {
  --card-color: #b41010;
}
</style>
<svg width="calc(12.25*1.8795vw)" height="12.25vw" enable-background="new" version="1.1" viewBox="0 0 504.98 268.68">
 <g transform="translate(147 2.1)" fill="var(--card-color)" stroke="var(--card-color)" stroke-width=".15">
  <path d="m63-2.1-12 13h-76l-12-13h-30l3.5 3.7h25l12 13h79l16-17zm-209 0.0036c1.2 1.2 2.3 2.5 3.5 3.7h78l-3.5-3.7c-26-9.7e-5 -52 1.4e-4 -78-2e-5zm212 3.7c263 0.6 205-0.31 263 0.15l26 24v132l-11 12v35c3.7 3.9 7.3 7.7 11 12v27l-6.9 7.3-127-9e-3 -3.7 3.7 132 9e-3 9-9.5v-30c-3.7-3.9-7.3-7.7-11-12v-32l11-12c-0.017-136 0.017 0 0-136l-27-25-263-0.15zm-212 2.9v175c2 2.1 4 4.2 5.9 6.3v75l3.5-3.6v-73c-2-2.1-4-4.2-5.9-6.3v-65c2-2.1 4-4.2 5.9-6.3v-92c-3.1-3.3-6.3-6.6-9.4-10zm288 245-0.013 0.014h-180c-3.1 3.3-6.2 6.6-9.3 9.8-1 1.1-2.1 2.2-3.1 3.3h-86l-3.5 3.7h90l3.1-3.3h26l3.1 3.3h148l16-17zm4.9-1e-5c-5.4-0.014-23 3-8.5 3.8 23-0.012 56-0.067 79-0.067l3.7-3.7c-21-2e-3 -53-9e-3 -74-0.014zm-184 3.8h175l-8.9 9.4h-145l-3.1-3.3h-24z"/>
  <path d="m339 217v23h-79l20-23h59"/>
  <path d="m89 25h-215v215h215v-215m-3 4v207h-209v-207h209"/>
 </g>
 <g transform="translate(147 2.1)" fill="#bbb">
  <path d="m-139 5.5 6.9 7.3h98l-6.9-7.3z"/>
  <path d="m275 217-20 23h-154v-23h175"/>
  <path d="m-147 183v8.4l3.5 3.7v-8.4l-3.5-3.7zm0 11v8.4l3.5 3.7v-8.4zm0 11v8.4l3.5 3.7v-8.4zm0 11v8.4l3.5 3.7v-8.4l-3.5-3.7zm0 11v38l3.5-3.6v-31z"/>
  <path d="m-17 257 3.3 3.3h47l-3.1-3.3zm50 0 3.3 3.3h47l-3-3.3zm50 0 3.3 3.3h41l3-3.2-0.07-0.074z"/>
 </g>
</svg>
]]

containerHubHubMCache = containerHubHubMCache or {}
local cache = containerHubHubMCache

local function prepareCacheStep()
  cache.stage = cache.stage or 0
  if cache.ready then
    return true
  end

  if cache.stage == 0 then
    local framePrepared = require("lib.ContainerHubHubMFramePrepared")
    cache.frameSvg = framePrepared.svg
    cache.frameDoc = { vars = framePrepared.vars }
    cache.frameShapes = framePrepared.shapes
    cache.stage = 1
    return false
  end
  if cache.stage == 1 then
    local separatorPrepared = require("lib.ContainerHubHubMSeparatorPrepared")
    cache.separatorSvg = separatorPrepared.svg
    cache.separatorDoc = { vars = separatorPrepared.vars }
    cache.separatorShapes = separatorPrepared.shapes
    cache.stage = 2
    return false
  end

  local itemCardPrepared = require("lib.ContainerHubHubMItemCardPrepared")
  cache.itemCardSvg = itemCardPrepared.svg
  cache.itemCardDoc = { vars = itemCardPrepared.vars }
  cache.itemCardShapes = itemCardPrepared.shapes
  cache.ready = true
  cache.stage = 3
  return true
end

local percentFontSize = topMetricFontSize(26)
local capacityFontSize = topMetricFontSize(26)
local weightFontSize = topMetricFontSize(26)
local cardNameFontSize = SZ.fontSizeVw(layout, 1.6)
local cardAmountFontSize = SZ.fontSizeVw(layout, 2.0)
local iconFontSize = SZ.fontSizeVw(layout, 1.0)
local percentFont = SZ.font("Arial", percentFontSize)
local capacityFont = SZ.font("Arial", capacityFontSize)
local weightFont = SZ.font("Arial", weightFontSize)
local cardNameFont = SZ.font("Arial", cardNameFontSize)
local cardAmountFont = SZ.font("Arial", cardAmountFontSize)
local iconFont = SZ.font("Arial", iconFontSize)

local function drawSkewedPanel(layer, bounds, skewDegrees, fillColor, strokeColor, strokeWidth)
  local x = SZ.toScreenX(layout, bounds.x)
  local y = SZ.toScreenY(layout, bounds.y)
  local w = SZ.toScreenW(layout, bounds.w)
  local h = SZ.toScreenH(layout, bounds.h)
  local skewOffset = bounds.h * math.tan(math.rad(math.abs(skewDegrees or 30)))
  local skewPx = SZ.toScreenW(layout, skewOffset)

  setNextFillColor(layer, fillColor[1], fillColor[2], fillColor[3], fillColor[4] or 1)
  addQuad(
    layer,
    x + skewPx, y,
    x + w, y,
    x + w - skewPx, y + h,
    x, y + h
  )

  if strokeColor then
    setNextStrokeColor(layer, strokeColor[1], strokeColor[2], strokeColor[3], strokeColor[4] or 1)
    setNextStrokeWidth(layer, math.max(0.5, (strokeWidth or 1) * layout.scale))
    addLine(layer, x + skewPx, y, x + w, y)
    addLine(layer, x + w, y, x + w - skewPx, y + h)
    addLine(layer, x + w - skewPx, y + h, x, y + h)
    addLine(layer, x, y + h, x + skewPx, y)
  end
end

local totalLoaded = 0
local totalMax = 0
for _, hub in ipairs(hubs) do
  totalLoaded = totalLoaded + hub.loaded
  totalMax = totalMax + hub.max
end

local capacityPercent = math.floor((totalLoaded / totalMax) * 1000 + 0.5) / 10
local loadedMass = 478
local maxWeight = 800

local selectedItem = items[1]
local selectedHubColor = hubPalette[selectedItem.hub]

local function drawFrame()
  local fillInsetX = vw(1.8)
  local fillInsetY = vh(1.8)

  setNextFillColor(layers.frame, 0.19, 0.05, 0.06, 0.92)
  addBox(
    layers.frame,
    SZ.toScreenX(layout, fillInsetX),
    SZ.toScreenY(layout, fillInsetY),
    SZ.toScreenW(layout, SOURCE_W - fillInsetX * 2),
    SZ.toScreenH(layout, SOURCE_H - fillInsetY * 2)
  )

  SZ.drawSvgEntry(layers.frame, layout, cache.frameSvg, {
    vars = cache.frameDoc.vars,
    classifiedShapes = cache.frameShapes,
    classifiedMode = "fill",
    strokeWidth = 1.4,
  })
end

local function drawTopBar()
  local frameBounds = {
    x = vw(5.0),
    y = vh(5.0),
    w = vw(53.4),
    h = vh(11.5),
  }
  local segmentX = vw(6.5)
  local segmentY = vh(5.25)
  local segmentH = vh(11.0)
  local segmentW = frameBounds.w * (totalLoaded / totalMax)

  drawSkewedPanel(
    layers.bar,
    frameBounds,
    30,
    { 0.16, 0.06, 0.08, 0.36 },
    { 0.71, 0.06, 0.06, 0.92 },
    0.28
  )

  local currentX = segmentX
  for _, hub in ipairs(hubs) do
    local hubWidth = segmentW * (hub.loaded / totalLoaded)
    local isSelectedHub = hub.name == selectedItem.hub
    local fillColor = isSelectedHub and selectedHubColor.color or { 0.34, 0.34, 0.38, 0.85 }
    local strokeColor = isSelectedHub and selectedHubColor.color or { 0.63, 0.63, 0.68, 0.32 }

    drawSkewedPanel(layers.bar, {
      x = currentX,
      y = segmentY,
      w = hubWidth,
      h = segmentH,
    }, 30, fillColor, strokeColor, 0.12)

    currentX = currentX + hubWidth + vw(0.098)
  end

  SZ.text(layers.text, layout, percentFont, string.format("%.1f%%", capacityPercent), vw(31.7), vh(8.5), theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })

  SZ.text(layers.text, layout, capacityFont, string.format("%d / %d KL", totalLoaded, totalMax), vw(61.5), vh(25.4), theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Bottom,
    color = theme.textPrimary,
  })

  SZ.text(layers.text, layout, weightFont, string.format("%dt", loadedMass), vw(95.0), vh(13.0), theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Bottom,
    color = theme.textPrimary,
  })

  SZ.text(layers.text, layout, weightFont, string.format("%dt", maxWeight), vw(95.0), vh(25.4), theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Bottom,
    color = theme.textPrimary,
  })

  setNextStrokeColor(layers.bar, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.82)
  setNextStrokeWidth(layers.bar, math.max(0.5, 0.18 * layout.scale))
  addLine(
    layers.bar,
    SZ.toScreenX(layout, vw(80)),
    SZ.toScreenY(layout, vh(16)),
    SZ.toScreenX(layout, vw(95)),
    SZ.toScreenY(layout, vh(16))
  )

  local separatorLayout = SZ.relativeLayout(layout, {
    x = vw(64),
    y = vh(5),
    w = vw(1),
    h = vh(23),
  }, 13, 231)

  SZ.drawSvgEntry(layers.separator, separatorLayout, cache.separatorSvg, {
    vars = cache.separatorDoc.vars,
    classifiedShapes = cache.separatorShapes,
    classifiedMode = "fill",
    strokeWidth = 0.8,
  })
end

local function drawItemCard(item, index)
  local browserX = vw(2)
  local browserY = vh(29)
  local margin = vw(0.5)
  local cardW = vw(CARD_VW_W)
  local cardH = vw(12.25)
  local stepX = cardW + margin * 2
  local stepY = cardH + margin * 2
  local slot = index - 1
  local row = math.floor(slot / 4)
  local col = slot % 4
  local cardBounds = {
    x = browserX + margin + col * stepX,
    y = browserY + margin + row * stepY,
    w = cardW,
    h = cardH,
  }
  local accentHex = item.selected and hubPalette[item.hub].hex or "#b41010"
  local cardLayout = SZ.relativeLayout(layout, cardBounds, CARD_SOURCE_W, CARD_SOURCE_H)
  local iconAccent = hubPalette[item.hub].color
  local iconBounds = {
    x = cardCssX(1.3),
    y = cardCssY(1.7),
    w = cardCssX(9.0),
    h = cardCssY(9.0),
  }
  local iconCenterX = iconBounds.x + iconBounds.w * 0.5
  local iconCenterY = iconBounds.y + iconBounds.h * 0.5

  SZ.drawSvgEntry(layers.cards, cardLayout, cache.itemCardSvg, {
    vars = {
      ["card-color"] = accentHex,
    },
    classifiedShapes = cache.itemCardShapes,
    classifiedMode = "fill",
    strokeWidth = 1.0,
  })

  SZ.box(layers.cards, cardLayout, iconBounds, {
    fillColor = { 0.10, 0.08, 0.11, 0.45 },
    strokeColor = { 0.90, 0.90, 0.94, item.selected and 0.58 or 0.28 },
    strokeWidth = item.selected and 1.4 or 0.9,
    radius = 10,
  })

  SZ.hexagon(layers.cards, cardLayout, iconCenterX, iconCenterY+10, iconBounds.w * 0.26, {
    iconAccent[1],
    iconAccent[2],
    iconAccent[3],
    item.selected and 0.84 or 0.48,
  })

  SZ.text(layers.text, cardLayout, iconFont, item.code, iconCenterX, iconCenterY, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })

  SZ.text(layers.text, cardLayout, cardNameFont, item.name, cardCssX(16.75), cardCssY(3.0), theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })

  SZ.text(layers.text, cardLayout, cardAmountFont, item.amount, cardCssX(16.75), cardCssY(7.0), theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })
end

local function drawBrowser()
  local browserBounds = {
    x = vw(2),
    y = vh(29),
    w = vw(96.2),
    h = vh(69),
  }

  SZ.withClip(layers.cards, layout, browserBounds, function()
    for index, item in ipairs(items) do
      drawItemCard(item, index)
    end
  end)
end

if not prepareCacheStep() then
  requestAnimationFrame(1)
else
  drawFrame()
  drawTopBar()
  drawBrowser()
end
