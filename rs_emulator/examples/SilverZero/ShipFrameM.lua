-- RenderScript conversion of SilverZero ShipFrameM.html (static)

local SZ = require("SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.06)
local now = SZ.time()

SZ.animLoop(1)

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3])

local titleFont = SZ.font("Arial", SZ.scaleFontSize(28, layout))
local labelFont = SZ.font("Arial", SZ.scaleFontSize(10, layout))
local valueFont = SZ.font("Arial", SZ.scaleFontSize(7, layout))

local layers = SZ.createLayers("base", "frame", "labels", "fx")

local function drawScanlineLayer(layer)
  for i = 0, 11 do
    local y = 12 + i * 11
    local alpha = 0.10 + i * 0.01 + SZ.pulse(0.02, 0.10, 1.0, i * 0.2)
    if alpha > 0.42 then
      alpha = 0.42
    end
    SZ.divider(layer, layout, 12, y, 219, y, theme, {
      color = {
        theme.textDim[1],
        theme.textDim[2],
        theme.textDim[3],
        alpha,
      },
      width = 0.6,
    })
  end
end

local function drawCornerFlares(layer)
  local points = {
    { x = 15, y = 18, r = 3 },
    { x = 211, y = 18, r = 3 },
    { x = 15, y = 138, r = 2.5 },
    { x = 211, y = 138, r = 2.5 },
  }

  for _, point in ipairs(points) do
    local cx = SZ.toScreenX(layout, point.x)
    local cy = SZ.toScreenY(layout, point.y)
    local r = SZ.toScreenW(layout, point.r)
    setNextStrokeColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.75)
    setNextStrokeWidth(layer, 1)
    addCircle(layer, cx, cy, r)
    addLine(layer, cx - r, cy, cx + r, cy)
    addLine(layer, cx, cy - r, cx, cy + r)
  end
end

local function drawBottomBar(layer)
  local x = 10
  local y = 126
  local w = 210
  local h = 20
  SZ.panel(layer, layout, {
    x = x,
    y = y,
    w = w,
    h = h,
  }, theme, {
    radius = 4,
    strokeWidth = 1,
    fillColor = { 0.08, 0.04, 0.05, 0.82 },
    strokeColor = theme.accent,
    innerInset = 2,
    innerColor = { 0.18, 0.06, 0.08, 0.22 },
  })

  setNextFillColor(layer, theme.textMuted[1], theme.textMuted[2], theme.textMuted[3], 0.9)
  setNextStrokeColor(layer, theme.textMuted[1], theme.textMuted[2], theme.textMuted[3], 0.5)
  setNextStrokeWidth(layer, 1)
  local y2 = SZ.toScreenY(layout, y + 11)
  addLine(layer, SZ.toScreenX(layout, x + 12), y2, SZ.toScreenX(layout, x + 198), y2)

  SZ.text(layer, layout, valueFont, "SHIP FRAME DATA", 12, 128.5, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.textMuted,
  })
  SZ.text(layer, layout, valueFont, "TERA-CLASS HULL PLATING", 119, 128.5, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })
end

local function drawSidePanel(layer)
  setNextFillColor(layer, 0, 0, 0, 0)
  setNextStrokeColor(layer, theme.accentStrong[1], theme.accentStrong[2], theme.accentStrong[3], 0.55)
  setNextStrokeWidth(layer, 1)
  addLine(layer, SZ.toScreenX(layout, 40), SZ.toScreenY(layout, 23), SZ.toScreenX(layout, 70), SZ.toScreenY(layout, 40))
  addLine(layer, SZ.toScreenX(layout, 40), SZ.toScreenY(layout, 40), SZ.toScreenX(layout, 70), SZ.toScreenY(layout, 23))
  addLine(layer, SZ.toScreenX(layout, 55), SZ.toScreenY(layout, 23), SZ.toScreenX(layout, 55), SZ.toScreenY(layout, 40))

  SZ.text(layer, layout, labelFont, "TERAN", 12, 23, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Top,
    color = theme.textMuted,
  })
  SZ.text(layer, layout, labelFont, "BATTLECRUISER", 12, 31, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Top,
    color = theme.textMuted,
  })
end

SZ.panel(layers.base, layout, {
  x = 3,
  y = 3,
  w = 225,
  h = 150,
}, theme, {
  radius = 6,
  strokeWidth = 2,
  fillColor = theme.panelFill,
  strokeColor = theme.panelStroke,
  innerInset = 3,
  innerColor = { 0.18, 0.07, 0.08, 0.28 },
})

SZ.frame(layers.base, layout, {
  x = 9,
  y = 9,
  w = 213,
  h = 138,
}, theme, {
  color = theme.accentStrong,
  strokeWidth = 1,
  cross = 2,
})

drawScanlineLayer(layers.frame)
drawCornerFlares(layers.frame)
drawBottomBar(layers.fx)
drawSidePanel(layers.labels)

SZ.logoMark(layers.fx, layout, 49, 74, 30, theme, {
  thickness = 1,
})

SZ.text(layers.labels, layout, titleFont, "SHIP FRAME", 116, 18, theme, {
  alignX = AlignH_Center,
  alignY = AlignV_Top,
  color = theme.textPrimary,
})

SZ.badge(layers.labels, layout, {
  x = 153,
  y = 20,
  w = 60,
  h = 16,
}, titleFont, "HULL", theme, {
  stroke = theme.accent,
  fill = { 0.28, 0.06, 0.06, 0.7 },
  textColor = theme.textPrimary,
  radius = 2,
  align = {
    x = "Center",
    y = "Middle",
  },
})

SZ.text(layers.labels, layout, labelFont, '"Hyperion" MK1', 116, 44, theme, {
  alignX = AlignH_Center,
  alignY = AlignV_Middle,
  color = theme.textMuted,
})

SZ.text(layers.labels, layout, valueFont, "Mass", 22, 86, theme, {
  alignX = AlignH_Left,
  alignY = AlignV_Middle,
  color = theme.textPrimary,
})
SZ.text(layers.labels, layout, valueFont, "2.4 kt", 54, 86, theme, {
  alignX = AlignH_Left,
  alignY = AlignV_Middle,
  color = theme.textDim,
})

SZ.text(layers.labels, layout, valueFont, "Cargo", 22, 94, theme, {
  alignX = AlignH_Left,
  alignY = AlignV_Middle,
  color = theme.textPrimary,
})
SZ.text(layers.labels, layout, valueFont, "5.0 mL", 54, 94, theme, {
  alignX = AlignH_Left,
  alignY = AlignV_Middle,
  color = theme.textDim,
})

SZ.text(layers.labels, layout, valueFont, "Speed", 22, 102, theme, {
  alignX = AlignH_Left,
  alignY = AlignV_Middle,
  color = theme.textPrimary,
})
SZ.text(layers.labels, layout, valueFont, "1200 km/h", 54, 102, theme, {
  alignX = AlignH_Left,
  alignY = AlignV_Middle,
  color = theme.textDim,
})

SZ.withClip(layers.fx, layout, { x = 22, y = 108, w = 95, h = 24 }, function()
  for i = 0, 12 do
    local t = i / 12
    local x = 24 + t * 84
    local sway = SZ.wave(1.7, i * 0.32) * 1.6
    SZ.divider(layers.fx, layout, x, 110 + sway, x + 1.6, 130 - sway, theme, {
      color = {
        theme.textDim[1],
        theme.textDim[2],
        theme.textDim[3],
        0.12 + SZ.pulse(0.04, 0.18, 1.8, i * 0.32),
      },
      width = 0.7,
    })
  end
end)
