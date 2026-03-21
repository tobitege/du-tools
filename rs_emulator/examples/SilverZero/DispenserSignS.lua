-- RenderScript conversion of SilverZero DispenserSignS.html (static)

local SZ = require("SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.045)
local now = SZ.time()

SZ.animLoop(1)

setBackgroundColor(0.01, 0.01, 0.03, 1)

local titleFont = SZ.font("Arial", SZ.scaleFontSize(34, layout))
local priceFont = SZ.font("Arial", SZ.scaleFontSize(34, layout))
local bodyFont = SZ.font("Arial", SZ.scaleFontSize(9, layout))

local layers = SZ.createLayers("base", "bg", "items", "text", "fx")

local colorA = { 0.31, 0.03, 0.35, 0.30 }
local colorB = { 0.25, 0.02, 0.20, 0.28 }
local colorC = { 0.95, 0.55, 0.97, 0.26 }

local function wireTrack(layer)
  setNextStrokeColor(layer, colorA[1], colorA[2], colorA[3], colorA[4] + SZ.pulse(0.03, 0.12, 1.5, 0.2))
  setNextStrokeWidth(layer, 1)

  for i = 0, 15 do
    local x = i * 14
    local y = (i % 2) * 4
    local sx1 = SZ.toScreenX(layout, 9 + x)
    local sy1 = SZ.toScreenY(layout, 18 + y)
    local sx2 = SZ.toScreenX(layout, 9 + x + 6)
    local sy2 = SZ.toScreenY(layout, 146 - y)
    addLine(layer, sx1, sy1, sx2, sy2)
  end

  setNextStrokeColor(layer, colorB[1], colorB[2], colorB[3], colorB[4])
  for i = 0, 17 do
    local x = i * 12
    local sway = SZ.wave(1.1, i * 0.18) * 1.6
    addLine(
      layer,
      SZ.toScreenX(layout, 9 + x),
      SZ.toScreenY(layout, 140 - sway),
      SZ.toScreenX(layout, 8 + x),
      SZ.toScreenY(layout, 20 + sway)
    )
  end

  setNextStrokeColor(layer, colorC[1], colorC[2], colorC[3], colorC[4] + SZ.pulse(0.02, 0.10, 1.8, 0.5))
  for i = 0, 10 do
    local x = 16 + i * 12
    local y = 22 + i * 10 + SZ.wave(1.7, i * 0.4) * 1.2
    addLine(
      layer,
      SZ.toScreenX(layout, x),
      SZ.toScreenY(layout, y),
      SZ.toScreenX(layout, x + 8),
      SZ.toScreenY(layout, y + 6)
    )
  end
end

local function drawImagePlaceholder(layer)
  local x = SZ.toScreenX(layout, 159)
  local y = SZ.toScreenY(layout, 13)
  local w = SZ.toScreenW(layout, 20)
  local h = SZ.toScreenH(layout, 20)

  setNextFillColor(layer, 0.16, 0.16, 0.22, 0.42)
  setNextStrokeColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.6)
  setNextStrokeWidth(layer, 1)
  addBoxRounded(layer, x, y, w, h, 2)
  SZ.text(layer, layout, bodyFont, "ICON", 159, 23, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textMuted,
  })

  setNextStrokeColor(layer, theme.accentStrong[1], theme.accentStrong[2], theme.accentStrong[3], 0.65)
  setNextStrokeWidth(layer, 1)
  addLine(
    layer,
    SZ.toScreenX(layout, 160),
    SZ.toScreenY(layout, 14),
    SZ.toScreenX(layout, 175),
    SZ.toScreenY(layout, 29)
  )
  addLine(layer,
    SZ.toScreenX(layout, 175),
    SZ.toScreenY(layout, 14),
    SZ.toScreenX(layout, 160),
    SZ.toScreenY(layout, 29)
  )
end

local function drawPriceLine(layer)
  SZ.badge(layer, layout, {
    x = 11,
    y = 111,
    w = 209,
    h = 17,
  }, priceFont, "10,000,000", theme, {
    fill = { 0.25, 0.17, 0.02, 0.7 },
    stroke = theme.accent,
    textColor = { 1, 0.9, 0.42, 0.96 },
    radius = 3,
    align = {
      x = "Right",
      y = "Middle",
    },
  })

  setNextTextAlign(layer, AlignH_Left, AlignV_Middle)
  setNextFillColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.2)
  addText(layer, titleFont, "ħ", SZ.toScreenX(layout, 205 - SZ.wave(2.0, 0.7) * 1.2), SZ.toScreenY(layout, 122))
  setNextFillColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.95)
  addText(layer, titleFont, "ħ", SZ.toScreenX(layout, 205), SZ.toScreenY(layout, 122))
  setNextFillColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.2)
  addText(layer, titleFont, "ħ", SZ.toScreenX(layout, 205 + SZ.wave(2.0, 0.7) * 1.2), SZ.toScreenY(layout, 122))
  SZ.text(layer, layout, bodyFont, "MARKET PRICE", 11, 102, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Bottom,
    color = theme.textMuted,
  })
  SZ.text(layer, layout, bodyFont, "Terran Battlecruiser", 11, 40, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Top,
    color = theme.textPrimary,
  })
  SZ.text(layer, layout, bodyFont, "MK1", 11, 46, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Top,
    color = theme.textMuted,
  })
end

local function drawPanelChrome(layer)
  SZ.panel(layer, layout, {
    x = 3,
    y = 3,
    w = 225,
    h = 150,
  }, theme, {
    radius = 6,
    strokeWidth = 1.8,
    fillColor = { 0.12, 0.03, 0.03, 0.92 },
    strokeColor = theme.accent,
    innerInset = 3,
    innerColor = { 0.18, 0.08, 0.10, 0.22 },
  })

  SZ.frame(layer, layout, {
    x = 9,
    y = 9,
    w = 213,
    h = 138,
  }, theme, {
    color = theme.accentStrong,
    strokeWidth = 1.1,
    cross = 1.5,
  })

  for i = 0, 8 do
    local y = 16 + i * 14
    SZ.divider(layer, layout, 14, y, 216, y, theme, {
      color = {
        theme.textDim[1],
        theme.textDim[2],
        theme.textDim[3],
        0.10 + i * 0.025,
      },
      width = 0.7,
    })
  end
end

local function drawOrbitLogo(layer)
  SZ.logoMark(layer, layout, 34, 72, 34, theme, {
    thickness = 1,
  })
  setNextFillColor(layer, 0.8, 0.8, 0.1, 0.2)
  setNextStrokeColor(layer, 1, 1, 1, 0.08)
  setNextStrokeWidth(layer, 1)
  addCircle(layer, SZ.toScreenX(layout, 34), SZ.toScreenY(layout, 72), SZ.toScreenW(layout, 2.5))
end

SZ.panel(layers.base, layout, {
  x = 3,
  y = 3,
  w = 225,
  h = 150,
}, theme, {
  radius = 6,
  strokeWidth = 1.6,
  fillColor = theme.panelFill,
  strokeColor = theme.panelStroke,
})

wireTrack(layers.bg)
drawPanelChrome(layers.base)
drawImagePlaceholder(layers.items)
drawOrbitLogo(layers.fx)
drawPriceLine(layers.text)

SZ.text(layers.text, layout, titleFont, "DISPENSER", 116, 70, theme, {
  alignX = AlignH_Center,
  alignY = AlignV_Middle,
  color = theme.textPrimary,
})

SZ.text(layers.text, layout, bodyFont, "Static promotional layout", 116, 84, theme, {
  alignX = AlignH_Center,
  alignY = AlignV_Middle,
  color = theme.textMuted,
})

SZ.withClip(layers.fx, layout, { x = 11, y = 130, w = 208, h = 16 }, function()
  for i = 0, 14 do
    local t = i / 14
    local px = 16 + t * 198
    setNextStrokeColor(layers.fx, theme.textDim[1], theme.textDim[2], theme.textDim[3], 0.10 + SZ.pulse(0.04, 0.14, 1.5, i * 0.24))
    setNextStrokeWidth(layers.fx, 0.7)
    addLine(
      layers.fx,
      SZ.toScreenX(layout, px),
      SZ.toScreenY(layout, 130),
      SZ.toScreenX(layout, px),
      SZ.toScreenY(layout, 146)
    )
  end
end)

SZ.badge(layers.text, layout, {
  x = 12,
  y = 55,
  w = 30,
  h = 8,
}, bodyFont, "SALE", theme, {
  stroke = theme.accentStrong,
  fill = { 0.35, 0.03, 0.03, 0.72 },
  textColor = theme.textPrimary,
  radius = 1,
  align = {
    x = "Center",
    y = "Middle",
  },
})
