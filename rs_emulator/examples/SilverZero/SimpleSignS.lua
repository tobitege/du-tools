-- RenderScript conversion of SilverZero SimpleSignS.html

local SZ = require("SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.06)
local now = SZ.time()

SZ.animLoop(1)

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3], theme.background[4])

local panelFont = SZ.font("Arial", SZ.scaleFontSize(30, layout))
local detailFont = SZ.font("Arial", SZ.scaleFontSize(13, layout))

local layers = SZ.createLayers("canvas", "ornament", "text")

local panel = SZ.panel(layers.canvas, layout, {
  x = 3,
  y = 3,
  w = 225,
  h = 150,
}, theme, {
  radius = 8,
  strokeWidth = 2.4,
  fillColor = theme.panelFill,
  strokeColor = theme.panelStroke,
  innerInset = 3,
  innerColor = theme.panelInset,
})

SZ.frame(layers.canvas, layout, {
  x = 9,
  y = 9,
  w = 213,
  h = 138,
}, theme, {
  color = theme.accentStrong,
  strokeWidth = 1.2,
})

for i = 0, 11 do
  local y = 15 + i * 9
  local alpha = 0.16 - i * 0.007 + SZ.pulse(0.02, 0.08, 1.2, i * 0.35)
  if alpha < 0.06 then
    alpha = 0.06
  end
  SZ.divider(layers.ornament, layout,
    11, y,
    220, y,
    {
      panelStroke = theme.panelStroke,
      panelFill = theme.panelFill,
      panelInset = theme.panelInset,
      accent = theme.accent,
      accentStrong = theme.accentStrong,
      textPrimary = theme.textPrimary,
      textMuted = theme.textMuted,
      textDim = theme.textDim,
    },
    {
      color = {
        0.95,
        0.20,
        0.20,
        alpha,
      },
      width = 0.9,
    }
  )
end

SZ.divider(layers.ornament, layout,
  11,
  82,
  220,
  82,
  theme,
  {
    color = theme.accent,
    width = 1.4,
  }
)

SZ.withClip(layers.ornament, layout, { x = 10, y = 10, w = 211, h = 136 }, function()
  for i = 0, 3 do
    local x1 = 11 + i * 56
    local x2 = 11 + i * 56 + 22
    local tilt = SZ.wave(1.4, i * 0.6) * 1.8
    SZ.divider(layers.ornament, layout, x1, 18 + tilt, x2, 18 + i * 6 + tilt, theme, {
      color = {
        1,
        0.45 + i * 0.12,
        0.15,
        0.24 + SZ.pulse(0.10, 0.26, 1.6, i),
      },
      width = 1.0,
    })

    SZ.divider(layers.ornament, layout, x2, 138 - tilt, x1 + 22, 138 - i * 4 - tilt, theme, {
      color = {
        1,
        0.22 + i * 0.11,
        0.15,
        0.16 + SZ.pulse(0.08, 0.18, 1.1, i * 0.8),
      },
      width = 1.0,
    })
  end
end)

SZ.logoMark(layers.ornament, layout, 42, 78, 36, theme, {
  thickness = 1,
})

SZ.badge(layers.text, layout, {
  x = 156,
  y = 11,
  w = 53,
  h = 18,
}, panelFont, "SIGN", theme, {
  radius = 3,
  textColor = theme.textPrimary,
  stroke = theme.accentStrong,
  fill = {
    0.11,
    0.02,
    0.02,
    0.7,
  },
  align = {
    x = "Center",
    y = "Middle",
  },
})

SZ.text(layers.text, layout, panelFont, "SilverZero's Lab", 116, 68, theme, {
  color = theme.textPrimary,
  alignX = AlignH_Center,
  alignY = AlignV_Middle,
})

SZ.text(layers.text, layout, detailFont, "SYSTEM SIGNAL", 116, 84, theme, {
  color = theme.textMuted,
  alignX = AlignH_Center,
  alignY = AlignV_Top,
})

SZ.row(layers.text, layout, detailFont, theme, {
  x = 16,
  y = 132,
  w = 199,
}, "MODE", "STATIC", {
  showRule = true,
  ruleOffset = 14,
  labelColor = theme.textDim,
  valueColor = theme.textPrimary,
})
