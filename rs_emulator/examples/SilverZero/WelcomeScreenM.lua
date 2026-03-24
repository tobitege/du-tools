local SZ = require("lib.SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.055)
local now = SZ.time()

SZ.animLoop(1)
setBackgroundColor(0.31, 0.03, 0.03) -- #5008 (approximate)

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
  -- Background base color (circuit-color-A)
  setNextFillColor(layer, 0.31, 0.03, 0.03, 0.53) -- #5008 (approximate)
  addBox(layer, 0, 0, layout.screenW, layout.screenH)

  -- Circuit lines (circuit-color-C: #f008)
  local function circuitLine(x1, y1, x2, y2, hasNode, nodeAtStart)
    SZ.line(layer, layout, x1, y1, x2, y2, { 1, 0, 0, 0.55 }, 0.8)

    if hasNode then
      local nx, ny = x2, y2
      if nodeAtStart then nx, ny = x1, y1 end

      -- Draw "solder point" (Lötstelle)
      -- Outer glow
      setNextFillColor(layer, 1, 0, 0, 0.3)
      addCircle(layer, SZ.toScreenX(layout, nx), SZ.toScreenY(layout, ny), SZ.toScreenW(layout, 1.6))
      -- Inner point
      setNextFillColor(layer, 1, 0.5, 0.5, 0.95)
      addCircle(layer, SZ.toScreenX(layout, nx), SZ.toScreenY(layout, ny), SZ.toScreenW(layout, 0.7))
    end
  end

  -- Authentic PCB-style layout (High density)

  -- Left Bus Cluster
  for i = 0, 12 do
    local x = 10 + i * 4
    local yStart = 5 + (i % 3) * 10
    circuitLine(x, yStart, x, yStart + 140, false)
    if i % 4 == 0 then
      circuitLine(x, yStart + 20, x + 15, yStart + 35, true)
    end
  end

  -- Right Bus Cluster
  for i = 0, 12 do
    local x = 220 - i * 4
    local yStart = 10 + (i % 4) * 8
    circuitLine(x, yStart, x, yStart + 130, false)
    if i % 5 == 1 then
      circuitLine(x, yStart + 80, x - 20, yStart + 100, true)
    end
  end

  -- Horizontal Interconnects
  for i = 0, 8 do
    local y = 20 + i * 15
    circuitLine(40, y, 190, y, false)
    if i % 2 == 0 then
      circuitLine(60, y, 60, y + 10, true)
      circuitLine(170, y, 170, y - 10, true)
    end
  end

  -- Diagonal PCB Traces
  for i = 0, 6 do
    local x = 50 + i * 20
    circuitLine(x, 10, x + 30, 40, true, true)
    circuitLine(x + 30, 40, x + 30, 60, true)

    circuitLine(230 - x, 140, 200 - x, 110, true, true)
    circuitLine(200 - x, 110, 200 - x, 90, true)
  end

  -- Scattered solder points for density
  for i = 0, 40 do
    local rx = 2 + (i * 53) % 227
    local ry = 2 + (i * 37) % 152
    setNextFillColor(layer, 1, 0.2, 0.2, 0.4)
    addCircle(layer, SZ.toScreenX(layout, rx), SZ.toScreenY(layout, ry), SZ.toScreenW(layout, 0.5))
  end
end

local function drawPanel(layer)
  SZ.box(layer, layout, {
    x = 20,
    y = 18,
    w = 191,
    h = 118,
  }, {
    radius = 2,
    fillColor = { 0.12, 0.06, 0.06, 0.95 },
    strokeColor = { 1, 0.05, 0.05, 0.96 },
    strokeWidth = 1.4,
  })

  SZ.box(layer, layout, {
    x = 22,
    y = 20,
    w = 187,
    h = 114,
  }, {
    fillColor = { 0.15, 0.10, 0.10, 0.82 },
    strokeColor = { 0.16, 0.04, 0.04, 0.8 },
    strokeWidth = 0.7,
  })

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

  SZ.line(layer, layout, 24, 20, 52, 20, { 1, 1, 1, 0.95 }, 1.2)
  SZ.line(layer, layout, 20, 24, 20, 32, { 1, 1, 1, 0.95 }, 1.2)
  SZ.line(layer, layout, 179, 20, 207, 20, { 1, 1, 1, 0.95 }, 1.2)
  SZ.line(layer, layout, 211, 24, 211, 32, { 1, 1, 1, 0.95 }, 1.2)
  SZ.line(layer, layout, 24, 136, 52, 136, { 1, 1, 1, 0.95 }, 1.2)
  SZ.line(layer, layout, 20, 122, 20, 130, { 1, 1, 1, 0.95 }, 1.2)
  SZ.line(layer, layout, 179, 136, 207, 136, { 1, 1, 1, 0.95 }, 1.2)
  SZ.line(layer, layout, 211, 122, 211, 130, { 1, 1, 1, 0.95 }, 1.2)

  for i = 0, 7 do
    local x = 54 + i * 20
    SZ.line(layer, layout, x, 20, x + 18, 46, { 0.30, 0.03, 0.03, 0.55 }, 0.9)
    SZ.line(layer, layout, x - 6, 136, x + 12, 110, { 0.30, 0.03, 0.03, 0.55 }, 0.9)
  end
end

local function drawLogo(layer)
  local cx, cy = 56, 78
  local bs = 6
  local sw = 0.6 -- dünne Outline-Strichstärke

  local r_out = bs * 4.4     -- Außenradius der Brackets
  local r_in  = bs * 3.4     -- Innenradius der Brackets
  local bHalf = 18           -- Halbe Winkelbreite eines Brackets

  -- Hilfsfunktion: Punkt auf Kreis
  local function pt(angle, radius)
    local rad = math.rad(angle)
    return cx + math.cos(rad) * radius, cy + math.sin(rad) * radius
  end

  -- Hilfsfunktion: Quad zeichnen mit Outline
  local function outlinedQuad(x1,y1, x2,y2, x3,y3, x4,y4, fill)
    setNextFillColor(layer, fill[1], fill[2], fill[3], fill[4] or 1)
    addQuad(
      layer,
      SZ.toScreenX(layout, x1), SZ.toScreenY(layout, y1),
      SZ.toScreenX(layout, x2), SZ.toScreenY(layout, y2),
      SZ.toScreenX(layout, x3), SZ.toScreenY(layout, y3),
      SZ.toScreenX(layout, x4), SZ.toScreenY(layout, y4)
    )
    SZ.line(layer, layout, x1, y1, x2, y2, { 1, 1, 1, 0.9 }, sw)
    SZ.line(layer, layout, x2, y2, x3, y3, { 1, 1, 1, 0.9 }, sw)
    SZ.line(layer, layout, x3, y3, x4, y4, { 1, 1, 1, 0.9 }, sw)
    SZ.line(layer, layout, x4, y4, x1, y1, { 1, 1, 1, 0.9 }, sw)
  end

  -- 1. Die 6 Brackets an den Ecken (alternierend Weiß/Rot)
  for i = 0, 5 do
    local angle = i * 60
    local fill = (i % 2 == 0) and {1, 1, 1} or {1, 0.08, 0.08}
    local x1,y1 = pt(angle - bHalf, r_in)
    local x2,y2 = pt(angle - bHalf, r_out)
    local x3,y3 = pt(angle + bHalf, r_out)
    local x4,y4 = pt(angle + bHalf, r_in)
    outlinedQuad(x1,y1, x2,y2, x3,y3, x4,y4, fill)
  end


  -- 3. Roter Ring
  SZ.hexRing(layer, layout, cx, cy, bs * 3.0, bs * 0.4, {1, 0.08, 0.08})

  -- 4. Innerer weißer Ring
  SZ.hexRing(layer, layout, cx, cy, bs * 2.4, bs * 0.6, {1, 1, 1})

  -- 5. Roter Kern (nur Umriss)
  SZ.hexagonOutline(layer, layout, cx, cy, bs * 1.2, {1, 0.08, 0.08}, 1.2)
end

local function drawHelix(layer)
  local centerX = 180
  local centerY = 78
  local rows = 15 -- Matching HTML child count
  local spacing = 5.2 -- Tighter spacing for helix look
  local amp = 10 -- 10vw width in HTML
  local speed = 3.14 -- Speed of rotation

  SZ.withClip(layer, layout, { x = 153, y = 20, w = 54, h = 116 }, function()
    for i = 0, rows - 1 do
      local delay = -i * 0.15 -- Matching animation-delay: -0.15s
      local phase = (now + delay) * speed

      local xOffset = math.sin(phase) * amp
      local depth = math.cos(phase) -- For z-order and size

      local y = centerY - (rows - 1) * spacing * 0.5 + i * spacing

      local colorA = { 0.33, 0.33, 0.33 } -- #555
      local colorB = { 0.66, 0.66, 0.66 } -- #aaa

      -- Draw "beads" of the helix
      local function drawBead(x, y, color, isFront)
        local r = 2.0 * (isFront and 1.2 or 0.8)
        local alpha = isFront and 0.9 or 0.4
        circuitNode(layer, x, y, r, color, alpha)
      end

      if depth > 0 then
        -- colorB is behind colorA
        drawBead(centerX + xOffset, y, colorB, false)
        drawBead(centerX - xOffset, y, colorA, true)
      else
        -- colorA is behind colorB
        drawBead(centerX - xOffset, y, colorA, false)
        drawBead(centerX + xOffset, y, colorB, true)
      end
    end
  end)
end

local function drawText(layer)
  local x = 115 -- Adjusted to be more central
  local y = 110 -- Adjusted for flex-end alignment intent

  setNextTextAlign(layer, AlignH_Center, AlignV_Middle)

  -- Combined text block to match <div class="message">Welcome <br> SilverZero!</div>
  setNextFillColor(layer, 1, 1, 1, 0.98)

  -- Draw "Welcome" and "SilverZero!" closer together
  local lineSpacing = 15
  addText(layer, titleFont, "Welcome", SZ.toScreenX(layout, x), SZ.toScreenY(layout, y - lineSpacing))
  addText(layer, subtitleFont, "SilverZero!", SZ.toScreenX(layout, x), SZ.toScreenY(layout, y))

  setNextFillColor(layer, 1, 1, 1, 0.3)
  addText(layer, metaFont, "BOOT SEQUENCE ACTIVE", SZ.toScreenX(layout, 116), SZ.toScreenY(layout, 88))
end

drawBackground(layers.bg)
drawPanel(layers.panel)
drawLogo(layers.logo)
drawHelix(layers.helix)
drawText(layers.text)
