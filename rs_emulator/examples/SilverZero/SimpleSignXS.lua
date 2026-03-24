local SZ = require("lib.SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.05)
local now = SZ.time()

SZ.animLoop(1)

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3], theme.background[4])

local titleFont = SZ.font("Arial", SZ.scaleFontSize(64, layout))
local bodyFont = SZ.font("Arial", SZ.scaleFontSize(12, layout))

local layers = SZ.createLayers("base", "chrome", "text", "fx")

SZ.panel(layers.base, layout, {
  x = 2,
  y = 2,
  w = 227,
  h = 152,
}, theme, {
  fillColor = theme.panelFill,
  strokeColor = theme.panelStroke,
  strokeWidth = 2,
  radius = 2,
  innerInset = 4,
  innerColor = theme.panelInset,
})

SZ.frame(layers.base, layout, {
  x = 9,
  y = 9,
  w = 213,
  h = 138,
}, theme, {
  color = theme.accentStrong,
  strokeWidth = 1.5,
  cross = 2,
})

for i = 0, 16 do
  local y = 14 + i * 7
  local alpha = 0.06 + (16 - i) * 0.003 + SZ.pulse(0.01, 0.05, 1.5, i * 0.22)
  SZ.divider(layers.chrome, layout, 11, y, 220, y, theme, {
    color = {
      0.55,
      0.20,
      0.20,
      alpha,
    },
    width = 0.6,
  })
end

for i = 0, 4 do
  local x = 20 + i * 50
  local sway = SZ.wave(1.3, i * 0.7) * 1.2
  SZ.divider(layers.chrome, layout, x, 16 + i + sway, x + 22, 16 + i + 18 + sway, theme, {
    color = theme.accent,
    width = 1.2,
  })
  SZ.divider(layers.chrome, layout, x + 34, 138 - i - sway, x + 56, 138 - i - 18 - sway, theme, {
    color = theme.accent,
    width = 1.2,
  })
end

SZ.badge(layers.text, layout, {
  x = 162,
  y = 14,
  w = 48,
  h = 16,
}, titleFont, "SIGN", theme, {
  stroke = theme.accent,
  fill = theme.panelInset,
  textColor = theme.textPrimary,
  radius = 2,
  align = {
    x = "Center",
    y = "Middle",
  },
})

SZ.logoMark(layers.fx, layout, 45, 77, 44, theme, {
  thickness = 1.3,
})

SZ.text(layers.text, layout, titleFont, "SilverZero's Lab", 116, 70, theme, {
  alignX = "Center",
  alignY = "Middle",
  color = theme.textPrimary,
})

SZ.text(layers.text, layout, bodyFont, "SYSTEM SIGNAL", 116, 100, theme, {
  alignX = AlignH_Center,
  alignY = AlignV_Middle,
  color = theme.textMuted,
})

SZ.withClip(layers.fx, layout, { x = 14, y = 120, w = 203, h = 24 }, function()
  for i = 0, 12 do
    local t = i / 12
    local x = 20 + t * 190
    local barTop = 124 + SZ.wave(2.0, i * 0.4) * 1.8
    local barBottom = 142 - SZ.wave(2.0, i * 0.4) * 1.8
    SZ.divider(layers.fx, layout, x, barTop, x + 1.6, barBottom, theme, {
      color = { theme.textDim[1], theme.textDim[2], theme.textDim[3], 0.18 + SZ.pulse(0.08, 0.22, 2.0, i * 0.4) },
      width = 0.8,
    })
  end
end)
