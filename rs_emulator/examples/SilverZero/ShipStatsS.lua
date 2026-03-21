local SZ = require("SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.06)
local now = SZ.time()

SZ.animLoop(1)

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3])

local panelFont = SZ.font("Arial", SZ.scaleFontSize(16, layout))
local titleFont = SZ.font("Arial", SZ.scaleFontSize(13, layout))
local valueFont = SZ.font("Arial", SZ.scaleFontSize(12, layout))
local metaFont = SZ.font("Arial", SZ.scaleFontSize(9, layout))

local layers = SZ.createLayers("base", "chrome", "rows", "values", "fx")

local function drawHeader(name, y)
  local sx = SZ.toScreenX(layout, 12)
  local sy = SZ.toScreenY(layout, y)
  local sw = SZ.toScreenW(layout, 207)
  local sh = SZ.toScreenH(layout, 10)

  setNextFillColor(layers.chrome, 0.75, 0.05, 0.05, 0.30)
  setNextStrokeColor(layers.chrome, theme.accent[1], theme.accent[2], theme.accent[3], 0.9)
  setNextStrokeWidth(layers.chrome, 1)
  addBoxRounded(layers.chrome, sx, sy, sw, sh, 2)

  setNextTextAlign(layers.chrome, AlignH_Left, AlignV_Middle)
  setNextFillColor(layers.chrome, 1, 1, 1, 0.95)
  addText(layers.chrome, titleFont, name, sx + 6, sy + sh * 0.52)
end

local function drawStat(x, y, metric, quantity, unit)
  local metricX = SZ.toScreenX(layout, x)
  local quantityX = SZ.toScreenX(layout, x + 134)
  local unitX = SZ.toScreenX(layout, x + 156)
  local sy = SZ.toScreenY(layout, y)
  local rowY = sy + SZ.toScreenH(layout, 6)

  setNextTextAlign(layers.rows, AlignH_Left, AlignV_Middle)
  setNextFillColor(layers.rows, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.95)
  addText(layers.rows, valueFont, metric, metricX, rowY)

  setNextTextAlign(layers.values, AlignH_Right, AlignV_Middle)
  setNextFillColor(layers.values, theme.textMuted[1], theme.textMuted[2], theme.textMuted[3], 0.95)
  addText(layers.values, valueFont, quantity, quantityX, rowY)

  setNextTextAlign(layers.values, AlignH_Left, AlignV_Middle)
  setNextFillColor(layers.values, theme.textMuted[1], theme.textMuted[2], theme.textMuted[3], 0.8)
  addText(layers.values, valueFont, unit, unitX, rowY)
end

SZ.panel(layers.base, layout, {
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

for i = 0, 11 do
  local y = 16 + i * 10
  local tone = 0.5 + i * 0.03
  SZ.divider(layers.base, layout, 12, y, 218, y, theme, {
    color = {
      tone * 0.02,
      theme.accent[2] * 0.55,
      tone * 0.05,
      0.06 + SZ.pulse(0.02, 0.14, 1.1, i * 0.18),
    },
    width = 0.35,
  })
end

SZ.text(layers.chrome, layout, panelFont, "SHIP STATS", 116, 18, theme, {
  alignX = AlignH_Center,
  alignY = AlignV_Middle,
  color = theme.textPrimary,
})

SZ.text(layers.rows, layout, titleFont, "Description", 17, 32, theme, {
  alignX = AlignH_Left,
  alignY = AlignV_Middle,
  color = theme.textPrimary,
})
setNextTextAlign(layers.rows, AlignH_Left, AlignV_Top)
setNextFillColor(layers.rows, theme.textDim[1], theme.textDim[2], theme.textDim[3], 0.95)
addText(layers.rows, metaFont, "Hyperion is a Behemoth-class", SZ.toScreenX(layout, 17), SZ.toScreenY(layout, 39))
addText(layers.rows, metaFont, "battlecruiser with burst lasers.", SZ.toScreenX(layout, 17), SZ.toScreenY(layout, 44))
addText(layers.rows, metaFont, "Operates in atmosphere and warp.", SZ.toScreenX(layout, 17), SZ.toScreenY(layout, 49))

drawHeader("Static Parameters", 54)
drawStat(12, 66, "Mass", "2.4", "kt")
drawStat(12, 76, "Atmospheric Fuel", "3.6", "kL")
drawStat(12, 86, "Space Fuel Capacity", "2.8", "kL")
drawStat(12, 96, "Cargo Capacity", "5", "mL")
drawStat(12, 106, "Max Cargo Weight", "8", "kt")

drawHeader("Atmospheric Flight", 115)
drawStat(12, 127, "Max Thrust", "8", "MN")
drawStat(12, 137, "Max Brake", "1.7", "MN")
drawStat(12, 147, "Max Speed", "1200", "km/h")

SZ.withClip(layers.fx, layout, {
  x = 8,
  y = 8,
  w = 215,
  h = 140,
}, function()
  for i = 0, 14 do
    local px = 15 + i * 14
    local t = i / 14
    local sway = SZ.wave(1.8, i * 0.3) * 1.4
    SZ.divider(layers.fx, layout, px, 123 + sway, px + 2, 147 - sway, theme, {
      color = {
        theme.textDim[1],
        theme.textDim[2],
        theme.textDim[3],
        0.12 + t * 0.08 + SZ.pulse(0.02, 0.12, 1.9, i * 0.3),
      },
      width = 0.9,
    })
  end

  for i = 0, 2 do
    local cx = 24 + i * 72
    for j = 0, 2 do
      local cy = 132 + j * 12
      local glow = SZ.pulse(0.16, 0.42, 2.2, i + j * 0.7)
      setNextFillColor(layers.fx, 0.96, 0.45, 0.08, glow)
      setNextStrokeColor(layers.fx, theme.accent[1], theme.accent[2], theme.accent[3], glow + 0.08)
      setNextStrokeWidth(layers.fx, 0.9)
      addCircle(layers.fx, SZ.toScreenX(layout, cx), SZ.toScreenY(layout, cy), SZ.toScreenW(layout, 0.9 + SZ.wave(2.2, i + j) * 0.15))
    end
  end
end)
