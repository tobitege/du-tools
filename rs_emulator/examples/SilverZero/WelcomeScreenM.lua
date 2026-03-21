local SZ = require("SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.055)
local now = SZ.time()

SZ.animLoop(1)
setBackgroundColor(0.42, 0.30, 0.30)

local titleFont = SZ.font("Georgia", SZ.scaleFontSize(26, layout))
local subtitleFont = SZ.font("Georgia", SZ.scaleFontSize(24, layout))
local metaFont = SZ.font("Arial", SZ.scaleFontSize(8, layout))

local layers = SZ.createLayers("bg", "panel", "logo", "helix", "text", "fx")

local function circuitNode(layer, x, y, r, color, alpha)
  setNextFillColor(layer, color[1], color[2], color[3], alpha)
  setNextStrokeColor(layer, color[1], color[2], color[3], alpha)
  setNextStrokeWidth(layer, 0.6)
  addCircle(layer, SZ.toScreenX(layout, x), SZ.toScreenY(layout, y), SZ.toScreenW(layout, r))
end

local function drawBackground(layer)
  setNextFillColor(layer, 0.67, 0.53, 0.53, 1)
  addBox(layer, 0, 0, layout.screenW, layout.screenH)

  setNextFillColor(layer, 0.28, 0.16, 0.16, 0.32)
  addQuad(layer,
    SZ.toScreenX(layout, 0), SZ.toScreenY(layout, 82),
    SZ.toScreenX(layout, 36), SZ.toScreenY(layout, 58),
    SZ.toScreenX(layout, 88), SZ.toScreenY(layout, 108),
    SZ.toScreenX(layout, 0), SZ.toScreenY(layout, 134)
  )
  setNextFillColor(layer, 0.34, 0.20, 0.20, 0.18)
  addQuad(layer,
    SZ.toScreenX(layout, 146), SZ.toScreenY(layout, 24),
    SZ.toScreenX(layout, 231), SZ.toScreenY(layout, 0),
    SZ.toScreenX(layout, 231), SZ.toScreenY(layout, 74),
    SZ.toScreenX(layout, 178), SZ.toScreenY(layout, 108)
  )

  local function trace(x1, y1, x2, y2, x3, y3, nodeX, nodeY)
    setNextStrokeColor(layer, 0.93, 0.24, 0.22, 0.9)
    setNextStrokeWidth(layer, 1)
    addLine(layer, SZ.toScreenX(layout, x1), SZ.toScreenY(layout, y1), SZ.toScreenX(layout, x2), SZ.toScreenY(layout, y2))
    addLine(layer, SZ.toScreenX(layout, x2), SZ.toScreenY(layout, y2), SZ.toScreenX(layout, x3), SZ.toScreenY(layout, y3))
    circuitNode(layer, nodeX, nodeY, 1.3, { 0.93, 0.24, 0.22 }, 0.95)
  end

  for i = 0, 8 do
    local startX = -6 + i * 19
    local startY = 12 + (i % 3) * 10
    local elbowX = startX + 18
    local elbowY = startY + 16
    local endX = elbowX + 30
    trace(startX, startY, elbowX, elbowY, endX, elbowY, endX, elbowY)
  end

  for i = 0, 8 do
    local startX = 118 + i * 14
    local startY = 0
    local elbowX = startX
    local elbowY = 20 + (i % 4) * 10
    local endX = elbowX - 18
    trace(startX, startY, elbowX, elbowY, endX, elbowY, endX, elbowY)
  end

  for i = 0, 9 do
    local startX = 231 - i * 12
    local startY = 104 + (i % 3) * 8
    local elbowX = startX - 20
    local elbowY = startY
    local endX = elbowX - 12
    local endY = elbowY + 12
    setNextStrokeColor(layer, 0.93, 0.24, 0.22, 0.88)
    setNextStrokeWidth(layer, 1)
    addLine(layer, SZ.toScreenX(layout, startX), SZ.toScreenY(layout, startY), SZ.toScreenX(layout, elbowX), SZ.toScreenY(layout, elbowY))
    addLine(layer, SZ.toScreenX(layout, elbowX), SZ.toScreenY(layout, elbowY), SZ.toScreenX(layout, endX), SZ.toScreenY(layout, endY))
    circuitNode(layer, startX, startY, 1.25, { 0.93, 0.24, 0.22 }, 0.95)
  end

  for i = 0, 7 do
    local startX = 0
    local startY = 128 - i * 14
    local elbowX = 16 + (i % 2) * 8
    local elbowY = startY
    local endX = elbowX + 18
    local endY = elbowY - 12
    setNextStrokeColor(layer, 0.93, 0.24, 0.22, 0.88)
    setNextStrokeWidth(layer, 1)
    addLine(layer, SZ.toScreenX(layout, startX), SZ.toScreenY(layout, startY), SZ.toScreenX(layout, elbowX), SZ.toScreenY(layout, elbowY))
    addLine(layer, SZ.toScreenX(layout, elbowX), SZ.toScreenY(layout, elbowY), SZ.toScreenX(layout, endX), SZ.toScreenY(layout, endY))
    circuitNode(layer, startX + 1, startY, 1.25, { 0.93, 0.24, 0.22 }, 0.95)
  end

  for i = 0, 13 do
    circuitNode(layer, 14 + i * 16, 18 + (i % 5) * 18, 1.2, { 0.55, 0.04, 0.04 }, 0.95)
    circuitNode(layer, 8 + i * 17, 144 - (i % 4) * 17, 1.1, { 0.55, 0.04, 0.04 }, 0.95)
  end

  for i = 0, 7 do
    local x = 10 + i * 28
    setNextStrokeColor(layer, 0.93, 0.24, 0.22, 0.72)
    setNextStrokeWidth(layer, 1)
    addLine(layer, SZ.toScreenX(layout, x), SZ.toScreenY(layout, 24), SZ.toScreenX(layout, x + 12), SZ.toScreenY(layout, 24))
    addLine(layer, SZ.toScreenX(layout, x + 12), SZ.toScreenY(layout, 24), SZ.toScreenX(layout, x + 20), SZ.toScreenY(layout, 36))
    addLine(layer, SZ.toScreenX(layout, x + 20), SZ.toScreenY(layout, 36), SZ.toScreenX(layout, x + 40), SZ.toScreenY(layout, 36))
    circuitNode(layer, x + 40, 36, 1.15, { 0.93, 0.24, 0.22 }, 0.9)
  end

  for i = 0, 6 do
    local x = 126 + i * 14
    setNextStrokeColor(layer, 0.93, 0.24, 0.22, 0.74)
    setNextStrokeWidth(layer, 1)
    addLine(layer, SZ.toScreenX(layout, x), SZ.toScreenY(layout, 0), SZ.toScreenX(layout, x), SZ.toScreenY(layout, 18))
    addLine(layer, SZ.toScreenX(layout, x), SZ.toScreenY(layout, 18), SZ.toScreenX(layout, x + 14), SZ.toScreenY(layout, 18))
    circuitNode(layer, x + 14, 18, 1.15, { 0.93, 0.24, 0.22 }, 0.9)
  end

  for i = 0, 6 do
    local y = 120 + i * 12
    setNextStrokeColor(layer, 0.93, 0.24, 0.22, 0.74)
    setNextStrokeWidth(layer, 1)
    addLine(layer, SZ.toScreenX(layout, 0), SZ.toScreenY(layout, y), SZ.toScreenX(layout, 16), SZ.toScreenY(layout, y))
    addLine(layer, SZ.toScreenX(layout, 16), SZ.toScreenY(layout, y), SZ.toScreenX(layout, 28), SZ.toScreenY(layout, y - 10))
    circuitNode(layer, 0.8, y, 1.15, { 0.93, 0.24, 0.22 }, 0.9)
  end

  for i = 0, 5 do
    local y = 112 + i * 14
    setNextStrokeColor(layer, 0.93, 0.24, 0.22, 0.74)
    setNextStrokeWidth(layer, 1)
    addLine(layer, SZ.toScreenX(layout, 211), SZ.toScreenY(layout, y), SZ.toScreenX(layout, 231), SZ.toScreenY(layout, y))
    addLine(layer, SZ.toScreenX(layout, 211), SZ.toScreenY(layout, y), SZ.toScreenX(layout, 199), SZ.toScreenY(layout, y - 10))
    circuitNode(layer, 231, y, 1.15, { 0.93, 0.24, 0.22 }, 0.9)
  end
end

local function drawPanel(layer)
  setNextFillColor(layer, 0.12, 0.06, 0.06, 0.95)
  setNextStrokeColor(layer, 1, 0.05, 0.05, 0.96)
  setNextStrokeWidth(layer, 1.4)
  addBoxRounded(layer, SZ.toScreenX(layout, 20), SZ.toScreenY(layout, 18), SZ.toScreenW(layout, 191), SZ.toScreenH(layout, 118), SZ.toScreenW(layout, 2))

  setNextFillColor(layer, 0.15, 0.10, 0.10, 0.82)
  setNextStrokeColor(layer, 0.16, 0.04, 0.04, 0.8)
  setNextStrokeWidth(layer, 0.7)
  addBox(layer, SZ.toScreenX(layout, 22), SZ.toScreenY(layout, 20), SZ.toScreenW(layout, 187), SZ.toScreenH(layout, 114))

  setNextFillColor(layer, 0.05, 0.02, 0.02, 0.42)
  addQuad(layer,
    SZ.toScreenX(layout, 20), SZ.toScreenY(layout, 18),
    SZ.toScreenX(layout, 82), SZ.toScreenY(layout, 18),
    SZ.toScreenX(layout, 98), SZ.toScreenY(layout, 48),
    SZ.toScreenX(layout, 36), SZ.toScreenY(layout, 48)
  )
  addQuad(layer,
    SZ.toScreenX(layout, 146), SZ.toScreenY(layout, 134),
    SZ.toScreenX(layout, 208), SZ.toScreenY(layout, 134),
    SZ.toScreenX(layout, 192), SZ.toScreenY(layout, 104),
    SZ.toScreenX(layout, 130), SZ.toScreenY(layout, 104)
  )

  setNextStrokeColor(layer, 1, 1, 1, 0.95)
  setNextStrokeWidth(layer, 1.2)
  addLine(layer, SZ.toScreenX(layout, 24), SZ.toScreenY(layout, 20), SZ.toScreenX(layout, 52), SZ.toScreenY(layout, 20))
  addLine(layer, SZ.toScreenX(layout, 20), SZ.toScreenY(layout, 24), SZ.toScreenX(layout, 20), SZ.toScreenY(layout, 32))
  addLine(layer, SZ.toScreenX(layout, 179), SZ.toScreenY(layout, 20), SZ.toScreenX(layout, 207), SZ.toScreenY(layout, 20))
  addLine(layer, SZ.toScreenX(layout, 211), SZ.toScreenY(layout, 24), SZ.toScreenX(layout, 211), SZ.toScreenY(layout, 32))
  addLine(layer, SZ.toScreenX(layout, 24), SZ.toScreenY(layout, 136), SZ.toScreenX(layout, 52), SZ.toScreenY(layout, 136))
  addLine(layer, SZ.toScreenX(layout, 20), SZ.toScreenY(layout, 122), SZ.toScreenX(layout, 20), SZ.toScreenY(layout, 130))
  addLine(layer, SZ.toScreenX(layout, 179), SZ.toScreenY(layout, 136), SZ.toScreenX(layout, 207), SZ.toScreenY(layout, 136))
  addLine(layer, SZ.toScreenX(layout, 211), SZ.toScreenY(layout, 122), SZ.toScreenX(layout, 211), SZ.toScreenY(layout, 130))

  for i = 0, 7 do
    local x = 54 + i * 20
    setNextStrokeColor(layer, 0.30, 0.03, 0.03, 0.55)
    setNextStrokeWidth(layer, 0.9)
    addLine(layer, SZ.toScreenX(layout, x), SZ.toScreenY(layout, 20), SZ.toScreenX(layout, x + 18), SZ.toScreenY(layout, 46))
    addLine(layer, SZ.toScreenX(layout, x - 6), SZ.toScreenY(layout, 136), SZ.toScreenX(layout, x + 12), SZ.toScreenY(layout, 110))
  end
end

local function drawLogo(layer)
  local cx = SZ.toScreenX(layout, 56)
  local cy = SZ.toScreenY(layout, 78)
  local outer = SZ.toScreenW(layout, 18)
  local mid = SZ.toScreenW(layout, 13)
  local inner = SZ.toScreenW(layout, 5.5)

  setNextFillColor(layer, 0, 0, 0, 0)
  setNextStrokeColor(layer, 1, 1, 1, 0.98)
  setNextStrokeWidth(layer, 1.5)
  addCircle(layer, cx, cy, outer)

  setNextStrokeColor(layer, 1, 0.08, 0.08, 0.98)
  setNextStrokeWidth(layer, 1.4)
  addCircle(layer, cx, cy, mid)

  setNextStrokeColor(layer, 1, 1, 1, 0.98)
  setNextStrokeWidth(layer, 1.1)
  addLine(layer, cx - outer * 0.9, cy - outer * 0.35, cx - outer * 0.45, cy - outer * 0.7)
  addLine(layer, cx + outer * 0.9, cy + outer * 0.35, cx + outer * 0.45, cy + outer * 0.7)
  addLine(layer, cx - outer * 0.9, cy + outer * 0.35, cx - outer * 0.45, cy + outer * 0.7)
  addLine(layer, cx + outer * 0.9, cy - outer * 0.35, cx + outer * 0.45, cy - outer * 0.7)

  setNextStrokeColor(layer, 1, 0.08, 0.08, 0.98)
  setNextStrokeWidth(layer, 1.3)
  addCircle(layer, cx, cy, inner)
end

local function drawHelix(layer)
  local centerX = 180
  local centerY = 78
  local rows = 14
  local spacing = 8.2
  local amp = 6.4

  SZ.withClip(layer, layout, { x = 153, y = 30, w = 44, h = 96 }, function()
    for i = 0, rows - 1 do
      local phase = now * 3.1 + i * 0.42
      local swing = math.sin(phase)
      local depth = (math.cos(phase) + 1) * 0.5
      local y = centerY - (rows - 1) * spacing * 0.5 + i * spacing
      local leftX = centerX - swing * amp
      local rightX = centerX + swing * amp
      local leftFront = math.cos(phase) >= 0
      local frontAlpha = 0.92
      local backAlpha = 0.38
      local frontRadius = 2.35 + depth * 0.4
      local backRadius = 1.95 - depth * 0.2

      setNextStrokeColor(layer, 0.82, 0.82, 0.82, 0.14 + depth * 0.14)
      setNextStrokeWidth(layer, 0.7)
      addLine(layer, SZ.toScreenX(layout, leftX), SZ.toScreenY(layout, y), SZ.toScreenX(layout, rightX), SZ.toScreenY(layout, y))

      if leftFront then
        circuitNode(layer, rightX, y, backRadius, { 0.40, 0.40, 0.40 }, backAlpha)
        circuitNode(layer, leftX, y, frontRadius, { 0.82, 0.82, 0.82 }, frontAlpha)
      else
        circuitNode(layer, leftX, y, backRadius, { 0.40, 0.40, 0.40 }, backAlpha)
        circuitNode(layer, rightX, y, frontRadius, { 0.82, 0.82, 0.82 }, frontAlpha)
      end
    end
  end)
end

local function drawText(layer)
  local x = 118
  local y1 = 101
  local y2 = 118
  local shadowDx = -0.05
  local shadowDy = 0.16

  setNextTextAlign(layer, AlignH_Center, AlignV_Middle)
  setNextFillColor(layer, 0, 0, 0, 0.18)
  addText(layer, titleFont, "Welcome", SZ.toScreenX(layout, x + shadowDx), SZ.toScreenY(layout, y1 + shadowDy))
  addText(layer, subtitleFont, "SilverZero!", SZ.toScreenX(layout, x + shadowDx), SZ.toScreenY(layout, y2 + shadowDy))

  setNextFillColor(layer, 1, 1, 1, 0.98)
  addText(layer, titleFont, "Welcome", SZ.toScreenX(layout, x), SZ.toScreenY(layout, y1))
  addText(layer, subtitleFont, "SilverZero!", SZ.toScreenX(layout, x), SZ.toScreenY(layout, y2))

  setNextFillColor(layer, 1, 1, 1, 0.3)
  addText(layer, metaFont, "BOOT SEQUENCE ACTIVE", SZ.toScreenX(layout, 116), SZ.toScreenY(layout, 88))
end

drawBackground(layers.bg)
drawPanel(layers.panel)
drawLogo(layers.logo)
drawHelix(layers.helix)
drawText(layers.text)
