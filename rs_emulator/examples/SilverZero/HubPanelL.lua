-- RenderScript conversion of SilverZero HubPanelL.html (static)

local SZ = require("lib.SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.05)
local now = SZ.time()

SZ.animLoop(1)

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3])

local titleFont = SZ.font("Arial", SZ.scaleFontSize(20, layout))
local headingFont = SZ.font("Arial", SZ.scaleFontSize(11, layout))
local valueFont = SZ.font("Arial", SZ.scaleFontSize(8, layout))
local tinyFont = SZ.font("Arial", SZ.scaleFontSize(6, layout))

local layers = SZ.createLayers("base", "rows", "details", "badge", "fx")

local entries = {
  {
    title = "Atmospheric Engines",
    tag = "A-01",
    status = "READY",
    accent = { 0.93, 0.54, 0.15, 0.70 },
  },
  {
    title = "Atmospheric Fuel Tanks",
    tag = "B-14",
    status = "READY",
    accent = { 0.28, 0.85, 0.96, 0.62 },
  },
  {
    title = "Atmospheric Brakes",
    tag = "C-07",
    status = "READY",
    accent = { 0.95, 0.43, 0.70, 0.62 },
  },
  {
    title = "Adjustors",
    tag = "D-09",
    status = "READY",
    accent = { 0.95, 0.76, 0.24, 0.62 },
  },
}

local function drawScanlines(layer)
  for i = 0, 16 do
    local y = 17 + i * 8
    local alpha = 0.05 + i * 0.012 + SZ.pulse(0.01, 0.08, 1.0, i * 0.18)
    SZ.divider(layer, layout, 11, y, 220, y, theme, {
      color = {
        theme.textDim[1],
        theme.textDim[2],
        theme.textDim[3],
        alpha > 0.45 and 0.45 or alpha,
      },
      width = 0.6,
    })
  end
end

local function drawIconShell(layer, x, y, accent)
  local iconX = SZ.toScreenX(layout, x)
  local iconY = SZ.toScreenY(layout, y)
  local iconW = SZ.toScreenW(layout, 12)
  local iconH = SZ.toScreenH(layout, 14)

  setNextFillColor(layer, 0.14, 0.05, 0.06, 0.85)
  setNextStrokeColor(layer, accent[1], accent[2], accent[3], 0.6)
  setNextStrokeWidth(layer, 1)
  addBox(layer, iconX, iconY, iconW, iconH)

  local cx = iconX + iconW * 0.5
  local cy = iconY + iconH * 0.5
  setNextStrokeColor(layer, 1, 1, 1, 0.35)
  setNextStrokeWidth(layer, 0.8)
  addLine(layer, cx - iconW * 0.25, cy, cx + iconW * 0.25, cy)
  addLine(layer, cx, cy - iconH * 0.25, cx, cy + iconH * 0.25)
end

local function drawEntry(layer, rowIndex, entry)
  local y = 22 + (rowIndex - 1) * 28
  local panelY = y + 2
  local panelH = 20

  SZ.panel(layer, layout, {
    x = 9,
    y = panelY,
    w = 165,
    h = panelH,
  }, theme, {
    fillColor = { 0.14, 0.06, 0.08, 0.25 },
    strokeColor = theme.panelStroke,
    strokeWidth = 0.9,
    radius = 2,
    innerInset = 1,
    innerColor = { 0.08, 0.03, 0.04, 0.28 },
  })

  drawIconShell(layer, 14, y + 4.2, entry.accent)

  SZ.badge(layer, layout, {
    x = 28,
    y = panelY + 5.5,
    w = 22,
    h = 10,
  }, headingFont, entry.tag, theme, {
    fill = { 0.1, 0.12, 0.16, 0.74 },
    stroke = entry.accent,
    textColor = theme.textPrimary,
    radius = 1,
    align = {
      x = "Center",
      y = "Middle",
    },
  })

  SZ.text(layer, layout, headingFont, entry.title, 52, y + 2, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })

  SZ.text(layer, layout, tinyFont, "STATUS: " .. entry.status, 52, y + 10, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.textMuted,
  })

  local barY = SZ.toScreenY(layout, y + panelH + 1)
  setNextStrokeColor(layer, entry.accent[1], entry.accent[2], entry.accent[3], 0.75)
  setNextStrokeWidth(layer, 1)
  addLine(layer, SZ.toScreenX(layout, 33), barY, SZ.toScreenX(layout, 170), barY)
end

local function drawPanelChrome(layer)
  setNextFillColor(layer, 0.12, 0.05, 0.06, 0.7)
  setNextStrokeColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.52)
  setNextStrokeWidth(layer, 1)
  addBoxRounded(layer, SZ.toScreenX(layout, 178), SZ.toScreenY(layout, 9), SZ.toScreenW(layout, 40), SZ.toScreenH(layout, 47), SZ.toScreenW(layout, 4))

  drawIconShell(layer, 181.5, 12.5, theme.accentStrong)
  drawIconShell(layer, 181.5, 31.5, theme.accent)

  setNextFillColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.9)
  setNextStrokeColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.75)
  setNextStrokeWidth(layer, 1)
  addCircle(layer, SZ.toScreenX(layout, 197.5), SZ.toScreenY(layout, 48), SZ.toScreenW(layout, 7))
end

SZ.panel(layers.base, layout, {
  x = 2,
  y = 2,
  w = 227,
  h = 152,
}, theme, {
  radius = 7,
  strokeWidth = 2,
  fillColor = theme.panelFill,
  strokeColor = theme.panelStroke,
  innerInset = 3,
  innerColor = theme.panelInset,
})

SZ.frame(layers.base, layout, {
  x = 8,
  y = 8,
  w = 215,
  h = 140,
}, theme, {
  color = theme.accentStrong,
  strokeWidth = 1,
  cross = 2,
})

SZ.text(layers.details, layout, titleFont, "Atmospheric", 116, 20, theme, {
  alignX = AlignH_Center,
  alignY = AlignV_Middle,
  color = theme.textPrimary,
})

SZ.text(layers.details, layout, headingFont, "ENGINE ARRAY", 116, 34, theme, {
  alignX = AlignH_Center,
  alignY = AlignV_Middle,
  color = theme.textMuted,
})

drawScanlines(layers.rows)
drawPanelChrome(layers.rows)

for i, entry in ipairs(entries) do
  drawEntry(layers.rows, i, entry)
end

SZ.text(layers.badge, layout, valueFont, "HUB", 177, 60, theme, {
  alignX = AlignH_Center,
  alignY = AlignV_Middle,
  color = theme.textPrimary,
})

SZ.badge(layers.badge, layout, {
  x = 185,
  y = 64,
  w = 35,
  h = 13,
}, headingFont, "L", theme, {
  fill = { 0.1, 0.04, 0.08, 0.8 },
  stroke = theme.accent,
  textColor = theme.textPrimary,
  radius = 2,
  align = {
    x = "Center",
    y = "Middle",
  },
})

SZ.withClip(layers.fx, layout, {
  x = 13,
  y = 130,
  w = 205,
  h = 20,
}, function()
  for i = 0, 18 do
    local x = 13 + i * 11
    local y1 = i * 0.4 + SZ.wave(1.6, i * 0.25) * 1.2
    setNextStrokeColor(layers.fx, 1, 1, 1, 0.10 + SZ.pulse(0.05, 0.16, 1.8, i * 0.25))
    setNextStrokeWidth(layers.fx, 0.7)
    addLine(
      layers.fx,
      SZ.toScreenX(layout, x),
      SZ.toScreenY(layout, 132 + y1),
      SZ.toScreenX(layout, x + 1),
      SZ.toScreenY(layout, 147 - y1)
    )
  end
end)

SZ.divider(layers.fx, layout, 13, 132, 218, 132, theme, {
  color = theme.accentStrong,
  width = 1,
})
SZ.divider(layers.fx, layout, 13, 148, 218, 148, theme, {
  color = theme.accentStrong,
  width = 1,
})
