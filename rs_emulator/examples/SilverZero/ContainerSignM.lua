-- RenderScript conversion of SilverZero ContainerSignM.json (static)

local SZ = require("SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.06)
local now = SZ.time()

SZ.animLoop(1)

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3])

local headerFont = SZ.font("Arial", SZ.scaleFontSize(16, layout))
local labelFont = SZ.font("Arial", SZ.scaleFontSize(8, layout))
local valueFont = SZ.font("Arial", SZ.scaleFontSize(7, layout))

local layers = SZ.createLayers("base", "content", "rows", "gauge", "fx")

local usagePercent = 64

local items = {
  { name = "Carbon Aged", quantity = "1,250", unit = "L" },
  { name = "Scrap Alloy", quantity = "482", unit = "L" },
  { name = "Silicon", quantity = "3,120", unit = "L" },
  { name = "Titanium", quantity = "98", unit = "kL" },
  { name = "Warp Cells", quantity = "34", unit = "kg" },
}

local function drawHeader(layer)
  setNextFillColor(layer, 0, 0, 0, 0)
  setNextStrokeColor(layer, theme.accentStrong[1], theme.accentStrong[2], theme.accentStrong[3], 0.85)
  setNextStrokeWidth(layer, 1)
  addLine(layer, SZ.toScreenX(layout, 9), SZ.toScreenY(layout, 24), SZ.toScreenX(layout, 222), SZ.toScreenY(layout, 24))

  SZ.text(layer, layout, headerFont, "CONTAINER SIGN", 115, 11, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })

  SZ.text(layer, layout, valueFont, "HUB STORAGE OVERVIEW", 115, 20, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textMuted,
  })
end

local function drawGrid(layer)
  for i = 0, 11 do
    local y = 29 + i * 10
    SZ.divider(layer, layout, 10, y, 149, y, theme, {
      color = { theme.panelStroke[1], theme.panelStroke[2], theme.panelStroke[3], 0.10 + SZ.pulse(0.04, 0.18, 1.2, i * 0.2) },
      width = 0.45,
    })
  end
end

local function drawGauge(layer)
  SZ.panel(layer, layout, {
    x = 156,
    y = 32,
    w = 62,
    h = 52,
  }, theme, {
    fillColor = { 0.18, 0.05, 0.08, 0.62 },
    strokeColor = theme.accent,
    radius = 3,
    strokeWidth = 1,
    innerInset = 2,
    innerColor = { 0.08, 0.03, 0.05, 0.7 },
  })

  local cx = SZ.toScreenX(layout, 187)
  local cy = SZ.toScreenY(layout, 58)
  local outer = SZ.toScreenW(layout, 17)
  local inner = SZ.toScreenW(layout, 13)

  setNextFillColor(layer, 0.05, 0.05, 0.08, 0.95)
  setNextStrokeColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.9)
  setNextStrokeWidth(layer, 1)
  addCircle(layer, cx, cy, outer)

  setNextFillColor(layer, 0.2, 0.08, 0.10, 0.95)
  addCircle(layer, cx, cy, inner)

  SZ.text(layer, layout, labelFont, usagePercent .. "%", 187, 58, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })

  SZ.text(layer, layout, valueFont, "VOLUME", 187, 65, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textMuted,
  })

  setNextStrokeColor(layer, theme.panelStroke[1], theme.panelStroke[2], theme.panelStroke[3], 0.75)
  setNextStrokeWidth(layer, 0.8)
  local fillHeight = 0.42 * usagePercent + SZ.wave(1.4, 0.3) * 2.5
  for i = 0, 10 do
    local x = SZ.toScreenX(layout, 165 + i * 5)
    local h = SZ.toScreenH(layout, fillHeight - i * 0.75)
    local y = SZ.toScreenY(layout, 79)
    addLine(layer, x, y, x, y - h)
  end

  setNextStrokeColor(layer, theme.textDim[1], theme.textDim[2], theme.textDim[3], 0.45)
  setNextStrokeWidth(layer, 0.7)
  addLine(layer, SZ.toScreenX(layout, 160), SZ.toScreenY(layout, 86), SZ.toScreenX(layout, 212), SZ.toScreenY(layout, 86))

  SZ.text(layer, layout, valueFont, "64 / 100mL", 187, 90, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textDim,
  })
end

local function drawRows(layer)
  local rowHeight = 9
  local rowTop = 32
  local rowBottom = 72
  local scrollY = rowTop + rowBottom - 2

  SZ.withClip(layer, layout, {
    x = 10,
    y = 34,
    w = 142,
    h = 72,
  }, function()
    for index, item in ipairs(items) do
      local y = SZ.toScreenY(layout, 34 + (index - 1) * rowHeight)
      local rowGlow = 0.18 + SZ.pulse(0.03, 0.14, 1.6, index * 0.4)

      SZ.divider(layer, layout, 12, y + rowHeight * 0.95, 142, y + rowHeight * 0.95, theme, {
        color = {
          theme.textDim[1],
          theme.textDim[2],
          theme.textDim[3],
          rowGlow,
        },
        width = 0.35,
      })

      setNextTextAlign(layer, AlignH_Left, AlignV_Middle)
      setNextFillColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.95)
      addText(layer, valueFont, item.name, SZ.toScreenX(layout, 12), y + SZ.toScreenH(layout, 4.2))

      setNextTextAlign(layer, AlignH_Right, AlignV_Middle)
      setNextFillColor(layer, theme.textMuted[1], theme.textMuted[2], theme.textMuted[3], 0.92)
      addText(layer, valueFont, item.quantity, SZ.toScreenX(layout, 122), y + SZ.toScreenH(layout, 4.2))

      setNextTextAlign(layer, AlignH_Left, AlignV_Middle)
      setNextFillColor(layer, theme.textDim[1], theme.textDim[2], theme.textDim[3], 0.75)
      addText(layer, valueFont, item.unit, SZ.toScreenX(layout, 127), y + SZ.toScreenH(layout, 4.2))
    end
  end)

  SZ.text(layer, layout, valueFont, "SCROLL", 138, scrollY, theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Bottom,
    color = theme.textDim,
  })

  SZ.text(layer, layout, valueFont, ">", 143, scrollY, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Bottom,
    color = theme.accentStrong,
  })
end

local function drawFooter(layer)
  setNextFillColor(layer, 0.06, 0.07, 0.1, 0.82)
  setNextStrokeColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.55)
  setNextStrokeWidth(layer, 1)
  addBoxRounded(layer, SZ.toScreenX(layout, 9), SZ.toScreenY(layout, 111), SZ.toScreenW(layout, 209), SZ.toScreenH(layout, 40), SZ.toScreenW(layout, 2))

  SZ.text(layer, layout, valueFont, "STATE: LINKED", 20, 127, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.textMuted,
  })
  SZ.text(layer, layout, valueFont, "UPDATES: LIVE", 188, 127, theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })
  SZ.text(layer, layout, valueFont, "ROW INDEX: 0", 115, 134, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textDim,
  })
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

drawHeader(layers.content)
drawGrid(layers.content)
drawRows(layers.rows)
drawGauge(layers.gauge)
drawFooter(layers.fx)
