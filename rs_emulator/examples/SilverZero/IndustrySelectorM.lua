-- RenderScript conversion of SilverZero IndustrySelectorM.json (static)

local SZ = require("lib.SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.05)
local now = SZ.time()

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3])

SZ.animLoop(1)

local titleFont = SZ.font("Arial", SZ.scaleFontSize(18, layout))
local headingFont = SZ.font("Arial", SZ.scaleFontSize(10, layout))
local valueFont = SZ.font("Arial", SZ.scaleFontSize(8, layout))
local tinyFont = SZ.font("Arial", SZ.scaleFontSize(6, layout))

local layers = SZ.createLayers("base", "status", "cards", "controls", "fx")

local running = true
local statusMsg = "Production Ready"
local produceCount = 12
local selectedItem = 1

local schemes = {
  "Aeration Matrix",
  "Refined Alloy",
  "Plasma Rail",
  "Quantum Drive",
  "Nano Coating",
  "Cryo Core",
  "Microthruster",
  "Hydrogen Cell",
  "Graphene Loop",
  "Pulse Lens",
  "Stator Stack",
  "Magnetic Rail",
  "Warp Buffer",
}

local accents = {
  { 0.92, 0.54, 0.20, 0.75 },
  { 0.33, 0.84, 0.97, 0.65 },
  { 0.55, 0.24, 0.95, 0.68 },
  { 0.98, 0.33, 0.40, 0.62 },
  { 0.26, 0.72, 0.34, 0.62 },
  { 0.95, 0.65, 0.12, 0.66 },
  { 0.40, 0.76, 0.98, 0.58 },
  { 0.85, 0.26, 0.82, 0.60 },
  { 0.92, 0.62, 0.15, 0.66 },
  { 0.27, 0.58, 0.94, 0.65 },
  { 0.44, 0.84, 0.84, 0.62 },
  { 0.95, 0.42, 0.58, 0.64 },
}

local function drawFrame(layer)
  SZ.panel(layer, layout, {
    x = 3,
    y = 3,
    w = 225,
    h = 150,
  }, theme, {
    radius = 8,
    strokeWidth = 2,
    fillColor = theme.panelFill,
    strokeColor = theme.panelStroke,
    innerInset = 3,
    innerColor = theme.panelInset,
  })

  SZ.frame(layer, layout, {
    x = 9,
    y = 9,
    w = 213,
    h = 140,
  }, theme, {
    color = theme.accent,
    strokeWidth = 1,
    cross = 2,
  })

  SZ.text(layer, layout, titleFont, "INDUSTRY", 116, 12, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })

  SZ.text(layer, layout, headingFont, "SELECTOR CONSOLE", 116, 23, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textDim,
  })

  for y = 30, 44, 4 do
    SZ.divider(layer, layout, 11, y, 220, y, theme, {
      color = { theme.textDim[1], theme.textDim[2], theme.textDim[3], 0.10 + SZ.pulse(0.04, 0.12, 1.1, y * 0.1) },
      width = 0.35,
    })
  end
end

local function drawStatusBar(layer)
  setNextFillColor(layer, 0.10, 0.04, 0.06, 0.85)
  setNextStrokeColor(layer, theme.panelStroke[1], theme.panelStroke[2], theme.panelStroke[3], 0.65)
  setNextStrokeWidth(layer, 1)
  addBoxRounded(layer, SZ.toScreenX(layout, 11), SZ.toScreenY(layout, 29), SZ.toScreenW(layout, 126), SZ.toScreenH(layout, 14), SZ.toScreenW(layout, 2))

  SZ.text(layer, layout, headingFont, "STATUS", 14, 36, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.textDim,
  })

  SZ.text(layer, layout, valueFont, statusMsg, 55, 35, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = running and { 0.95, 0.42, 0.36, 0.95 } or theme.textPrimary,
  })

  local spinnerX = SZ.toScreenX(layout, 122)
  local spinnerY = SZ.toScreenY(layout, 35)
  local radius = SZ.toScreenW(layout, 4)

  setNextFillColor(layer, 0, 0, 0, 0)
  setNextStrokeColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.32)
  setNextStrokeWidth(layer, 1)
  addCircle(layer, spinnerX, spinnerY, radius)

  local angle = now * 2.4
  setNextStrokeColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.9)
  setNextStrokeWidth(layer, 0.8)
  addLine(layer, spinnerX, spinnerY, spinnerX + math.cos(angle) * radius * 0.7, spinnerY + math.sin(angle) * radius * 0.7)

  for i = 0, 7 do
    local y = 46 + i * 3
    setNextStrokeColor(layer, theme.textDim[1], theme.textDim[2], theme.textDim[3], 0.08 + i * 0.02 + SZ.pulse(0.01, 0.04, 1.8, i * 0.35))
    setNextStrokeWidth(layer, 0.6)
    addLine(layer, SZ.toScreenX(layout, 125), SZ.toScreenY(layout, y), SZ.toScreenX(layout, 129), SZ.toScreenY(layout, y))
  end
end

local function drawControlPad(layer)
  setNextFillColor(layer, 0.14, 0.06, 0.09, 0.9)
  setNextStrokeColor(layer, 0.95, 0.35, 0.15, 0.75)
  setNextStrokeWidth(layer, 1)
  addBoxRounded(layer, SZ.toScreenX(layout, 145), SZ.toScreenY(layout, 29), SZ.toScreenW(layout, 76), SZ.toScreenH(layout, 14), SZ.toScreenW(layout, 2))

  setNextFillColor(layer, 0.24, 0.07, 0.10, 0.75)
  setNextStrokeColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.7)
  setNextStrokeWidth(layer, 0.8)
  addBoxRounded(layer, SZ.toScreenX(layout, 152), SZ.toScreenY(layout, 30), SZ.toScreenW(layout, 10), SZ.toScreenH(layout, 12), SZ.toScreenW(layout, 1))

  setNextFillColor(layer, 0.92, 0.28, 0.28, 0.55 + SZ.pulse(0.08, 0.20, 2.0, 0.4))
  setNextStrokeColor(layer, 0.98, 0.82, 0.48, 0.7)
  setNextStrokeWidth(layer, 1)
  addCircle(layer, SZ.toScreenX(layout, 157), SZ.toScreenY(layout, 36), SZ.toScreenW(layout, 2.5))

  setNextStrokeColor(layer, 0.95, 0.95, 1, 0.85)
  setNextStrokeWidth(layer, 1)
  addLine(
    layer,
    SZ.toScreenX(layout, 157) - SZ.toScreenW(layout, 1.1),
    SZ.toScreenY(layout, 35.8),
    SZ.toScreenX(layout, 157) + SZ.toScreenW(layout, 1.1),
    SZ.toScreenY(layout, 35.8)
  )

  SZ.text(layer, layout, valueFont, "RUN", 161, 31, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })

  SZ.badge(layer, layout, {
    x = 168,
    y = 31,
    w = 18,
    h = 9,
  }, tinyFont, "x", theme, {
    fill = { 0.45, 0.11, 0.14, 0.7 },
    stroke = { 0.95, 0.24, 0.33, 0.7 },
    textColor = theme.textPrimary,
    align = {
      x = "Center",
      y = "Middle",
    },
  })

  SZ.text(layer, layout, tinyFont, "COUNT", 168, 41, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.textMuted,
  })

  SZ.panel(layer, layout, {
    x = 176,
    y = 31,
    w = 20,
    h = 9,
  }, theme, {
    fillColor = { 0.2, 0.04, 0.06, 0.9 },
    strokeColor = theme.accent,
    strokeWidth = 0.8,
    radius = 1,
    innerInset = 1,
    innerColor = { 0.08, 0.02, 0.03, 0.5 },
  })

  SZ.text(layer, layout, valueFont, tostring(produceCount), 186, 35, theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })
end

local function drawItem(layer, idx, name, accent, selected, x, y)
  local w = SZ.toScreenW(layout, 32.5)
  local h = SZ.toScreenH(layout, 24)

  setNextFillColor(layer, 0.09, 0.04, 0.08, selected and 0.42 or 0.18)
  setNextStrokeColor(layer, selected and accent[1] or theme.panelStroke[1], selected and accent[2] or theme.panelStroke[2], selected and accent[3] or theme.panelStroke[3], selected and 0.92 or 0.45)
  setNextStrokeWidth(layer, selected and 1 or 0.8)
  addBoxRounded(layer, x, y, w, h, SZ.toScreenW(layout, 1.5))

  local iconX = x + SZ.toScreenW(layout, 2)
  local iconY = y + SZ.toScreenH(layout, 2)
  local iconW = SZ.toScreenW(layout, 6)
  local iconH = SZ.toScreenH(layout, 6)

  setNextFillColor(layer, 0.15, 0.07, 0.10, 0.85)
  setNextStrokeColor(layer, accent[1], accent[2], accent[3], 0.6 + SZ.pulse(0.08, 0.22, 1.7, idx * 0.4))
  setNextStrokeWidth(layer, 0.8)
  addBoxRounded(layer, iconX, iconY, iconW, iconH, SZ.toScreenW(layout, 0.8))

  setNextStrokeColor(layer, 1, 1, 1, 0.32)
  setNextStrokeWidth(layer, 0.7)
  addLine(layer, iconX + iconW * 0.2, iconY + iconH * 0.5, iconX + iconW * 0.8, iconY + iconH * 0.5)
  addLine(layer, iconX + iconW * 0.5, iconY + iconH * 0.2, iconX + iconW * 0.5, iconY + iconH * 0.8)

  setNextTextAlign(layer, AlignH_Left, AlignV_Middle)
  setNextFillColor(layer, accent[1], accent[2], accent[3], accent[4])
  addText(layer, tinyFont, "#" .. idx, x + SZ.toScreenW(layout, 10.8), y + SZ.toScreenH(layout, 3))

  setNextTextAlign(layer, AlignH_Left, AlignV_Middle)
  setNextFillColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], theme.textPrimary[4])
  addText(layer, valueFont, name, x + SZ.toScreenW(layout, 2), y + SZ.toScreenH(layout, 12))

  if selected then
    setNextStrokeColor(layer, accent[1], accent[2], accent[3], 0.9)
    setNextStrokeWidth(layer, 1)
    addLine(layer, x + SZ.toScreenW(layout, 2), y + SZ.toScreenH(layout, 20.8), x + w - SZ.toScreenW(layout, 2), y + SZ.toScreenH(layout, 20.8))
  end

  setNextTextAlign(layer, AlignH_Left, AlignV_Middle)
  setNextFillColor(layer, theme.textDim[1], theme.textDim[2], theme.textDim[3], 0.85)
  addText(layer, tinyFont, "READY", x + SZ.toScreenW(layout, 2), y + SZ.toScreenH(layout, 17), "")
end

local function drawItems(layer)
  SZ.withClip(layer, layout, {
    x = 5,
    y = 44,
    w = 221,
    h = 85,
  }, function()
    for i, name in ipairs(schemes) do
      local localIndex = i - 1
      local row = math.floor(localIndex / 6)
      local col = localIndex % 6

      if row >= 2 then
        break
      end

      local sx = 9 + col * 35
      local sy = 45 + row * 26
      local x = SZ.toScreenX(layout, sx)
      local y = SZ.toScreenY(layout, sy)

      drawItem(layer, i, name, accents[i], i == selectedItem, x, y)
    end
  end)

  SZ.text(layer, layout, valueFont, "SCROLL", 222, 132, theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Bottom,
    color = theme.textDim,
  })
  SZ.text(layer, layout, valueFont, ">", 222, 138, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Bottom,
    color = theme.accentStrong,
  })

  setNextStrokeColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.5)
  setNextStrokeWidth(layer, 0.9)
  addLine(layer, SZ.toScreenX(layout, 6), SZ.toScreenY(layout, 140), SZ.toScreenX(layout, 225), SZ.toScreenY(layout, 140))
end

SZ.withClip(layers.fx, layout, {
  x = 4,
  y = 44,
  w = 223,
  h = 88,
}, function()
  for i = 0, 40 do
    local px = 8 + i * 3.3
    local py = 45 + (i % 11) * 0.8
      setNextStrokeColor(layers.fx, 1, 1, 1, 0.03 + (i % 5) * 0.012 + SZ.pulse(0.01, 0.05, 1.8, i * 0.2))
    setNextStrokeWidth(layers.fx, 0.5)
    addLine(
      layers.fx,
      SZ.toScreenX(layout, px),
      SZ.toScreenY(layout, 140),
      SZ.toScreenX(layout, px + 2),
      SZ.toScreenY(layout, py)
    )
  end
end)

drawFrame(layers.base)
drawStatusBar(layers.status)
drawControlPad(layers.controls)
drawItems(layers.cards)
