-- RenderScript conversion of SilverZero ContainerHubHubM.json (static)

local SZ = require("SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.05)
local now = SZ.time()

SZ.animLoop(1)

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3])

local titleFont = SZ.font("Arial", SZ.scaleFontSize(18, layout))
local headingFont = SZ.font("Arial", SZ.scaleFontSize(11, layout))
local valueFont = SZ.font("Arial", SZ.scaleFontSize(8, layout))
local tinyFont = SZ.font("Arial", SZ.scaleFontSize(6, layout))

local layers = SZ.createLayers("base", "bars", "browser", "meta", "fx")

local hubs = {
  {
    name = "A",
    color = { 0.92, 0.45, 0.17, 0.72 },
    loaded = 186,
    max = 300,
  },
  {
    name = "B",
    color = { 0.30, 0.84, 0.96, 0.70 },
    loaded = 98,
    max = 220,
  },
  {
    name = "C",
    color = { 0.58, 0.22, 0.95, 0.70 },
    loaded = 124,
    max = 220,
  },
  {
    name = "D",
    color = { 0.93, 0.41, 0.66, 0.70 },
    loaded = 70,
    max = 160,
  },
}

local items = {
  { name = "Titanium Alloy", amount = 1240, unit = "L", color = "#", hub = "A", selected = true },
  { name = "Carbon", amount = 540, unit = "kg", color = "#", hub = "B" },
  { name = "Copper", amount = 88, unit = "kL", color = "#", hub = "C" },
  { name = "Nitride", amount = 330, unit = "L", color = "#", hub = "D" },
  { name = "Hydrogen", amount = 620, unit = "L", color = "#", hub = "A" },
  { name = "Scrap", amount = 44, unit = "kg", color = "#", hub = "B" },
  { name = "Electrons", amount = 12, unit = "U", color = "#", hub = "C" },
  { name = "Warp Cell", amount = 19, unit = "kL", color = "#", hub = "D" },
  { name = "Titanium", amount = 90, unit = "kg", color = "#", hub = "A" },
  { name = "Silicon", amount = 160, unit = "L", color = "#", hub = "C" },
  { name = "Aluminum", amount = 700, unit = "L", color = "#", hub = "B" },
  { name = "Ore Dust", amount = 33, unit = "U", color = "#", hub = "A" },
}

local function drawTopFrame(layer)
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
    color = theme.accentStrong,
    strokeWidth = 1,
    cross = 2,
  })

  SZ.text(layer, layout, titleFont, "CONTAINER HUB HUB", 116, 15, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })

  SZ.text(layer, layout, valueFont, "MULTI HUB CONTAINER OVERVIEW", 116, 25, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textMuted,
  })

  for i = 1, 10 do
    local y = 33 + i * 7
    setNextStrokeColor(layer, theme.panelStroke[1], theme.panelStroke[2], theme.panelStroke[3], 0.06 + i * 0.012 + SZ.pulse(0.02, 0.09, 1.1, i * 0.15))
    setNextStrokeWidth(layer, 0.45)
    addLine(layer, SZ.toScreenX(layout, 10), SZ.toScreenY(layout, y), SZ.toScreenX(layout, 221), SZ.toScreenY(layout, y))
  end
end

local function drawSummaryBars(layer)
  local totalLoaded = 0
  local totalMax = 0
  for _, hub in ipairs(hubs) do
    totalLoaded = totalLoaded + hub.loaded
    totalMax = totalMax + hub.max
  end

  setNextFillColor(layer, 0.16, 0.06, 0.08, 0.6)
  setNextStrokeColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.55)
  setNextStrokeWidth(layer, 1)
  addBoxRounded(layer, SZ.toScreenX(layout, 5), SZ.toScreenY(layout, 37), SZ.toScreenW(layout, 127), SZ.toScreenH(layout, 12), SZ.toScreenW(layout, 2))

  local barWidth = 120
  local barHeight = 9
  local barStartX = 8
  local barStartY = 40
  local fillTotal = math.floor(totalLoaded / totalMax * barWidth + 0.5)
  local capacityPercent = math.floor(totalLoaded / totalMax * 100 + 0.5)

  setNextFillColor(layer, 0.9, 0.9, 1, 0.85)
  addLine(layer, SZ.toScreenX(layout, barStartX), SZ.toScreenY(layout, barStartY + 4.5), SZ.toScreenX(layout, barStartX + barWidth), SZ.toScreenY(layout, barStartY + 4.5))

  local x = barStartX
  local remaining = fillTotal

  for _, hub in ipairs(hubs) do
    local portion = math.floor((hub.loaded / totalMax) * barWidth)
    local seg = math.min(portion, remaining)
    if seg > 0 then
      local c = hub.color
      setNextFillColor(layer, c[1], c[2], c[3], 0.52 + SZ.pulse(0.04, 0.18, 1.2, _))
      setNextStrokeColor(layer, c[1], c[2], c[3], 0.95)
      setNextStrokeWidth(layer, 0.7)
      addBox(layer, SZ.toScreenX(layout, x), SZ.toScreenY(layout, barStartY), SZ.toScreenW(layout, seg), SZ.toScreenH(layout, barHeight))
      x = x + seg
      remaining = remaining - seg
    end
  end

  if remaining < barWidth - fillTotal then
    addLine(layer, SZ.toScreenX(layout, barStartX + fillTotal), SZ.toScreenY(layout, barStartY), SZ.toScreenX(layout, barStartX + fillTotal), SZ.toScreenY(layout, barStartY + barHeight))
  end

  SZ.text(layer, layout, valueFont, "CAPACITY", 136, 36, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.textDim,
  })
  SZ.text(layer, layout, headingFont, tostring(capacityPercent) .. "%", 136, 46, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.accentStrong,
  })

  SZ.text(layer, layout, tinyFont, tostring(totalLoaded) .. " / " .. tostring(totalMax) .. " kl", 130, 38, theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Middle,
    color = theme.textDim,
  })
  SZ.text(layer, layout, tinyFont, "MAX MASS: 800t", 130, 46, theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Middle,
    color = theme.textDim,
  })

  setNextStrokeColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.8)
  setNextStrokeWidth(layer, 0.8)
  addLine(layer, SZ.toScreenX(layout, 12), SZ.toScreenY(layout, 52), SZ.toScreenX(layout, 120), SZ.toScreenY(layout, 52))

  for idx, hub in ipairs(hubs) do
    local offsetY = 30 + idx * 6
    local swatchY = 62 + idx * 6
    setNextFillColor(layer, hub.color[1], hub.color[2], hub.color[3], 0.6)
    setNextStrokeColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.6)
    setNextStrokeWidth(layer, 0.6)
    addBoxRounded(layer, SZ.toScreenX(layout, 124), SZ.toScreenY(layout, swatchY), SZ.toScreenW(layout, 10), SZ.toScreenH(layout, 3), SZ.toScreenW(layout, 0.6))

    SZ.text(layer, layout, tinyFont, "HUB " .. hub.name .. " " .. hub.loaded .. "/" .. hub.max, 136, offsetY, theme, {
      alignX = AlignH_Left,
      alignY = AlignV_Middle,
      color = theme.textPrimary,
    })
  end
end

local function drawItemBadge(layer, x, y, w, h, isSelected)
  setNextFillColor(layer, 0.12, 0.05, 0.08, isSelected and 0.72 or 0.18)
  setNextStrokeColor(layer, isSelected and theme.accentStrong[1] or theme.textDim[1], isSelected and theme.accentStrong[2] or theme.textDim[2], isSelected and theme.accentStrong[3] or theme.textDim[3], isSelected and 0.9 or 0.5)
  setNextStrokeWidth(layer, isSelected and 1 or 0.8)
  addBoxRounded(layer, x, y, w, h, SZ.toScreenW(layout, 1.8))

  setNextFillColor(layer, 0.2, 0.2, 0.2, 0.35)
  setNextStrokeColor(layer, 1, 1, 1, 0.35)
  setNextStrokeWidth(layer, 0.6)
  addBoxRounded(layer, x + SZ.toScreenW(layout, 1), y + SZ.toScreenH(layout, 1.2), SZ.toScreenW(layout, 8.8), SZ.toScreenH(layout, 8.8), SZ.toScreenW(layout, 0.4))

  local cx = x + SZ.toScreenW(layout, 1.8)
  local cy = y + SZ.toScreenH(layout, 5.6)
  local px = SZ.toScreenW(layout, 2)
  setNextStrokeColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.45)
  setNextStrokeWidth(layer, 0.7)
  addLine(layer, cx - px, cy, cx + px, cy)
  addLine(layer, cx, cy - px, cx + px * 0.15, cy - px)
  addLine(layer, cx, cy + px, cx + px * 0.15, cy + px)
end

local function drawItems(layer)
  local rowHeight = 20
  local colWidth = 53
  local x0 = 8
  local y0 = 31

  SZ.withClip(layer, layout, {
    x = 3,
    y = 58,
    w = 223,
    h = 84,
  }, function()
    for index, item in ipairs(items) do
      local localIndex = index - 1
      local row = math.floor(localIndex / 4)
      local col = localIndex % 4

      if row >= 3 then
        break
      end

      local x = SZ.toScreenX(layout, x0 + col * (colWidth + 2))
      local y = SZ.toScreenY(layout, y0 + row * (rowHeight + 1.6))
      local w = SZ.toScreenW(layout, colWidth)
      local h = SZ.toScreenH(layout, rowHeight)

      drawItemBadge(layer, x, y, w, h, item.selected)

      SZ.text(layer, layout, valueFont, item.name,  x0 + col * (colWidth + 2) + 16, y0 + row * (rowHeight + 1.6) + 3.5, theme, {
        alignX = AlignH_Left,
        alignY = AlignV_Middle,
        color = theme.textPrimary,
      })

      SZ.text(layer, layout, headingFont, item.hub .. " HUB",  x0 + col * (colWidth + 2) + 16, y0 + row * (rowHeight + 1.6) + 9.2, theme, {
        alignX = AlignH_Left,
        alignY = AlignV_Middle,
        color = theme.textMuted,
      })

      SZ.text(layer, layout, tinyFont, tostring(item.amount) .. " " .. item.unit, x0 + col * (colWidth + 2) + 16, y0 + row * (rowHeight + 1.6) + 14.4, theme, {
        alignX = AlignH_Left,
        alignY = AlignV_Middle,
        color = theme.textDim,
      })

      if item.selected then
        setNextStrokeColor(layer, theme.accentStrong[1], theme.accentStrong[2], theme.accentStrong[3], 0.55 + SZ.pulse(0.08, 0.25, 2.0, index * 0.3))
        setNextStrokeWidth(layer, 1)
        addLine(layer, SZ.toScreenX(layout, x0 + col * (colWidth + 2) + 13), SZ.toScreenY(layout, y0 + row * (rowHeight + 1.6) + 18), SZ.toScreenX(layout, x0 + col * (colWidth + 2) + colWidth + 11), SZ.toScreenY(layout, y0 + row * (rowHeight + 1.6) + 18))
      end
    end
  end)

  SZ.text(layer, layout, valueFont, "SCROLL", 218, 140, theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Bottom,
    color = theme.textDim,
  })
  SZ.text(layer, layout, valueFont, ">", 222, 140, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Bottom,
    color = theme.accentStrong,
  })

  setNextStrokeColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.6)
  setNextStrokeWidth(layer, 1)
  addLine(layer, SZ.toScreenX(layout, 6), SZ.toScreenY(layout, 141.5), SZ.toScreenX(layout, 223), SZ.toScreenY(layout, 141.5))
end

local function drawSideDecor(layer)
  setNextFillColor(layer, 0.08, 0.05, 0.08, 0.7)
  addBoxRounded(layer, SZ.toScreenX(layout, 4), SZ.toScreenY(layout, 56), SZ.toScreenW(layout, 2), SZ.toScreenH(layout, 84), SZ.toScreenW(layout, 0.5))

  setNextFillColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.82)
  SZ.badge(layer, layout, {
    x = 5,
    y = 61,
    w = 1.5,
    h = 2,
  }, tinyFont, ">", theme, {
    fill = { 0.15, 0.07, 0.10, 0.5 },
    stroke = theme.accent,
    textColor = theme.textPrimary,
    align = {
      x = "Center",
      y = "Middle",
    },
  })

  for i = 0, 10 do
    local y = 58 + i * 7.2
    setNextStrokeColor(layer, 0.6, 0.16, 0.20, 0.14 + i * 0.03 + SZ.pulse(0.02, 0.10, 1.6, i * 0.25))
    setNextStrokeWidth(layer, 0.7)
    addLine(layer, SZ.toScreenX(layout, 5), SZ.toScreenY(layout, y), SZ.toScreenX(layout, 6), SZ.toScreenY(layout, y))
  end
end

SZ.withClip(layers.fx, layout, {
  x = 3,
  y = 57,
  w = 225,
  h = 86,
}, function()
  for i = 0, 180 do
    local px = 8 + i * 1.2
    setNextStrokeColor(layers.fx, 1, 1, 1, 0.05 + (i % 3) * 0.03 + SZ.pulse(0.01, 0.05, 1.7, i * 0.08))
    setNextStrokeWidth(layers.fx, 0.6)
    addLine(
      layers.fx,
      SZ.toScreenX(layout, px),
      SZ.toScreenY(layout, 141),
      SZ.toScreenX(layout, 8 + px * 0.03),
      SZ.toScreenY(layout, 57 + (i % 11) * 1.2)
    )
  end
end)

drawTopFrame(layers.base)
drawSummaryBars(layers.bars)
drawSideDecor(layers.meta)
drawItems(layers.browser)
