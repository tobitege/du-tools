-- RenderScript conversion of SilverZero HubPanelS.html (static)

local SZ = require("lib.SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.06)
local now = SZ.time()

SZ.animLoop(1)

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3])

local titleFont = SZ.font("Arial", SZ.scaleFontSize(13, layout))
local labelFont = SZ.font("Arial", SZ.scaleFontSize(8, layout))
local detailFont = SZ.font("Arial", SZ.scaleFontSize(7, layout))

local layers = SZ.createLayers("base", "stripes", "hubs", "text", "fx")

local hubs = {
  {
    name = "Atmospheric Engines",
    accent = { 0.89, 0.30, 0.35, 0.65 },
  },
  {
    name = "Fuel Tanks",
    accent = { 0.39, 0.82, 0.98, 0.58 },
  },
  {
    name = "Atmospheric Brakes",
    accent = { 0.76, 0.28, 0.95, 0.56 },
  },
  {
    name = "Adjustors",
    accent = { 0.95, 0.57, 0.22, 0.63 },
  },
}

local function drawGrid(layer)
  for i = 0, 13 do
    local y = 22 + i * 9.5
    local tone = i * 0.014 + 0.06
    SZ.divider(layer, layout, 10, y, 221, y, theme, {
      color = {
        theme.panelStroke[1],
        theme.panelStroke[2],
        theme.panelStroke[3],
        0.03 + tone * 0.5 + SZ.pulse(0.01, 0.08, 1.2, i * 0.25),
      },
      width = 0.52,
    })
  end
end

local function drawHubIcon(layer, x, y, size, color)
  local cx = SZ.toScreenX(layout, x + size * 0.5)
  local cy = SZ.toScreenY(layout, y + size * 0.5)
  local r = SZ.toScreenW(layout, size * 0.45)

  setNextFillColor(layer, color[1], color[2], color[3], 0.15)
  setNextStrokeColor(layer, color[1], color[2], color[3], 0.75)
  setNextStrokeWidth(layer, 1)
  addCircle(layer, cx, cy, r)

  local half = r * 0.6
  setNextStrokeColor(layer, 1, 1, 1, 0.4)
  setNextStrokeWidth(layer, 1)
  addLine(layer, cx - half, cy, cx + half, cy)
  addLine(layer, cx, cy - half, cx, cy + half)
  addLine(layer, cx - half, cy - half, cx + half, cy + half)
end

local function drawHubCards(layer)
  for i, hub in ipairs(hubs) do
    local x = 8 + (i - 1) * 52
    local y = 14
    local w = 45
    local h = 28

    SZ.panel(layer, layout, {
      x = x,
      y = y,
      w = w,
      h = h,
    }, theme, {
      fillColor = { 0.17, 0.08, 0.12, 0.24 },
      strokeColor = theme.panelStroke,
      strokeWidth = 1,
      radius = 2,
      innerInset = 2,
      innerColor = { 0.08, 0.03, 0.03, 0.34 },
    })

    drawHubIcon(layer, x + 4, y + 4, 16, hub.accent)

    SZ.text(layer, layout, detailFont, hub.name, x + 1, y + 19, theme, {
      alignX = AlignH_Left,
      alignY = AlignV_Top,
      color = { 0.86, 0.89, 0.98, 0.95 },
    })
  end
end

local function drawDividerRows(layer)
  for i = 0, 3 do
    local y = 47 + i * 34
    local x = 8 + (i % 2) * 116

    setNextFillColor(layer, 0.05, 0.07, 0.10, 0.70)
    setNextStrokeColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.72)
    setNextStrokeWidth(layer, 1)
    addBoxRounded(layer, SZ.toScreenX(layout, x), SZ.toScreenY(layout, y), SZ.toScreenW(layout, 106), SZ.toScreenH(layout, 22), SZ.toScreenW(layout, 2))

    SZ.text(layer, layout, labelFont, "HUB " .. (i + 1), x + 4, y + 3, theme, {
      alignX = AlignH_Left,
      alignY = AlignV_Top,
      color = theme.textMuted,
    })

    setNextStrokeColor(layer, theme.textDim[1], theme.textDim[2], theme.textDim[3], 0.45)
    setNextStrokeWidth(layer, 1)
    addLine(layer, SZ.toScreenX(layout, x + 2), SZ.toScreenY(layout, y + 11), SZ.toScreenX(layout, x + 104), SZ.toScreenY(layout, y + 11))

    SZ.text(layer, layout, detailFont, "status: active", x + 5, y + 13, theme, {
      alignX = AlignH_Left,
      alignY = AlignV_Top,
      color = theme.textPrimary,
    })
  end
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

SZ.text(layers.text, layout, titleFont, "HUB PANELS", 116, 9, theme, {
  alignX = AlignH_Center,
  alignY = AlignV_Middle,
  color = theme.textPrimary,
})

SZ.text(layers.text, layout, labelFont, "SYSTEM OVERVIEW", 116, 21, theme, {
  alignX = AlignH_Center,
  alignY = AlignV_Middle,
  color = theme.textDim,
})

drawGrid(layers.stripes)
drawHubCards(layers.hubs)
drawDividerRows(layers.hubs)

SZ.withClip(layers.fx, layout, {
  x = 10,
  y = 145,
  w = 211,
  h = 8,
}, function()
  for i = 0, 26 do
    local px = 12 + i * 8
    local sway = SZ.wave(1.8, i * 0.3) * 1.2
    SZ.divider(layers.fx, layout, px, 147 - sway, px + 2, 143 + sway, theme, {
      color = {
        theme.textDim[1],
        theme.textDim[2],
        theme.textDim[3],
        0.08 + (i % 3) * 0.03 + SZ.pulse(0.02, 0.10, 1.8, i * 0.2),
      },
      width = 0.9,
    })
  end
end)

setNextFillColor(layers.text, 0.08, 0.10, 0.14, 0.82)
setNextStrokeColor(layers.text, 0.95, 0.35, 0.15, 0.45)
setNextStrokeWidth(layers.text, 1)
addBoxRounded(
  layers.text,
  SZ.toScreenX(layout, 72),
  SZ.toScreenY(layout, 130),
  SZ.toScreenW(layout, 86),
  SZ.toScreenH(layout, 11),
  SZ.toScreenW(layout, 3)
)

SZ.text(layers.text, layout, detailFont, "ROUTE STABLE | POWER: OK | LINK: GOOD", 116, 136, theme, {
  alignX = AlignH_Center,
  alignY = AlignV_Middle,
  color = theme.textPrimary,
})
