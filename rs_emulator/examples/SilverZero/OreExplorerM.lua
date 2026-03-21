-- RenderScript conversion of SilverZero OreExplorerM.json (static)

local SZ = require("SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.04)
local now = SZ.time()

SZ.animLoop(1)

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3])

local titleFont = SZ.font("Arial", SZ.scaleFontSize(20, layout))
local headingFont = SZ.font("Arial", SZ.scaleFontSize(10, layout))
local valueFont = SZ.font("Arial", SZ.scaleFontSize(8, layout))
local tinyFont = SZ.font("Arial", SZ.scaleFontSize(6, layout))

local layers = SZ.createLayers("space", "frame", "horizon", "catalog", "fx", "meta")

local selectedPlanet = 2
local planets = {
  {
    name = "Madis",
    tier = "1",
    color = { 0.95, 0.72, 0.35, 0.85 },
    size = 2.6,
    selected = false,
  },
  {
    name = "Alioth",
    tier = "4",
    color = { 0.46, 0.72, 1.00, 0.90 },
    size = 5.2,
    selected = true,
  },
  {
    name = "Thades",
    tier = "5",
    color = { 0.78, 0.31, 0.95, 0.88 },
    size = 6.4,
    selected = false,
  },
  {
    name = "Talemai",
    tier = "3",
    color = { 0.54, 0.74, 0.95, 0.82 },
    size = 3.8,
    selected = false,
  },
  {
    name = "Feli",
    tier = "2",
    color = { 0.66, 0.24, 0.82, 0.80 },
    size = 3.9,
    selected = false,
  },
  {
    name = "Sicari",
    tier = "2",
    color = { 0.95, 0.62, 0.30, 0.84 },
    size = 3.2,
    selected = false,
  },
  {
    name = "Sinnen",
    tier = "2",
    color = { 0.40, 0.68, 0.34, 0.80 },
    size = 3.5,
    selected = false,
  },
  {
    name = "Teoma",
    tier = "6",
    color = { 0.90, 0.34, 0.28, 0.82 },
    size = 4.0,
    selected = false,
  },
  {
    name = "Jago",
    tier = "1",
    color = { 0.74, 0.28, 0.42, 0.82 },
    size = 3.9,
    selected = false,
  },
  {
    name = "Lacobus",
    tier = "4",
    color = { 0.60, 0.85, 0.95, 0.80 },
    size = 3.5,
    selected = false,
  },
  {
    name = "Symeon",
    tier = "3",
    color = { 0.48, 0.88, 0.42, 0.84 },
    size = 3.0,
    selected = false,
  },
  {
    name = "Ion",
    tier = "7",
    color = { 0.96, 0.42, 0.18, 0.80 },
    size = 2.8,
    selected = false,
  },
}

local resourceRows = {
  {
    title = "Pures",
    ore = "Bauxite",
    purity = "(Aluminium)",
    tier = "1",
    amount = "2.4k",
  },
  {
    title = "Pures",
    ore = "Pyrite",
    purity = "(Sulfur)",
    tier = "2",
    amount = "1.1k",
  },
  {
    title = "Pures",
    ore = "Hematite",
    purity = "(Iron)",
    tier = "1",
    amount = "2.9k",
  },
  {
    title = "Pures",
    ore = "Quartz",
    purity = "(Silicon)",
    tier = "3",
    amount = "950",
  },
  {
    title = "Precious",
    ore = "Coal",
    purity = "(Carbon)",
    tier = "2",
    amount = "1.2k",
  },
  {
    title = "Precious",
    ore = "Malachite",
    purity = "(Copper)",
    tier = "3",
    amount = "640",
  },
  {
    title = "Precious",
    ore = "Petalite",
    purity = "(Lithium)",
    tier = "4",
    amount = "440",
  },
  {
    title = "Heavy",
    ore = "Gold Nuggets",
    purity = "(Gold)",
    tier = "7",
    amount = "120",
  },
  {
    title = "Heavy",
    ore = "Columbite",
    purity = "(Niobium)",
    tier = "5",
    amount = "220",
  },
  {
    title = "Rare",
    ore = "Rhodonite",
    purity = "(Manganese)",
    tier = "4",
    amount = "340",
  },
  {
    title = "Rare",
    ore = "Illmenite",
    purity = "(Titanium)",
    tier = "6",
    amount = "190",
  },
  {
    title = "Rare",
    ore = "Acanthite",
    purity = "(Silver)",
    tier = "6",
    amount = "280",
  },
}

local function drawSpace(layer)
  setNextFillColor(layer, 0.03, 0.04, 0.09, 0.95)
  addBox(layer, 0, 0, layout.screenW, SZ.toScreenY(layout, 58))

  for i = 0, 40 do
    local px = i * (layout.screenW / 40)
    local alpha = 0.03 + (i % 9) * 0.01 + SZ.pulse(0.01, 0.05, 0.9, i * 0.14)
    setNextStrokeColor(layer, 1, 1, 1, alpha)
    setNextStrokeWidth(layer, 0.35)
    addLine(layer, px, 0, px, SZ.toScreenY(layout, 60))
  end

  for i = 0, 24 do
    local y = i * (SZ.toScreenY(layout, 58) / 24)
    setNextStrokeColor(layer, 1, 1, 1, 0.045)
    setNextStrokeWidth(layer, 0.4)
    addLine(layer, 0, y, layout.screenW, y)
  end

  setNextFillColor(layer, 0.12, 0.15, 0.24, 0.45)
  setNextStrokeColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.35)
  setNextStrokeWidth(layer, 1)
  addBoxRounded(layer, SZ.toScreenX(layout, 4), SZ.toScreenY(layout, 42), SZ.toScreenW(layout, 223), SZ.toScreenH(layout, 20), SZ.toScreenW(layout, 1.5))
end

local function drawSolarMap(layer)
  local starX = SZ.toScreenX(layout, 116)
  local starY = SZ.toScreenY(layout, 34)
  local starR = SZ.toScreenW(layout, 8.5)

  setNextFillColor(layer, 0.18, 0.10, 0.14, 0.8)
  setNextStrokeColor(layer, theme.accentStrong[1], theme.accentStrong[2], theme.accentStrong[3], 0.45 + SZ.pulse(0.10, 0.28, 1.8, 0.2))
  setNextStrokeWidth(layer, 1.5)
  addCircle(layer, starX, starY, starR * (1.15 + SZ.pulse(0.02, 0.12, 1.8, 0.2)))

  setNextFillColor(layer, 1, 0.55, 0.15, 0.95)
  setNextStrokeColor(layer, 1, 0.78, 0.35, 0.9)
  setNextStrokeWidth(layer, 1)
  addCircle(layer, starX, starY, starR)

  setNextFillColor(layer, 0.98, 0.98, 1, 0.35)
  setNextStrokeColor(layer, 0.98, 0.76, 0.36, 0.45)
  setNextStrokeWidth(layer, 0.45)
  addCircle(layer, starX + 1.5, starY - 0.5, starR * 0.45)
  addCircle(layer, starX - 1.8, starY + 0.8, starR * 0.4)

  local orbitY = SZ.toScreenY(layout, 35.5)
  for i = 1, 5 do
    local rad = SZ.toScreenW(layout, 12 + i * 11)
    setNextStrokeColor(layer, 0.35, 0.44, 0.56, 0.1 + i * 0.08)
    setNextStrokeWidth(layer, 0.5)
    addCircle(layer, starX, orbitY, rad)
  end

  for index, planet in ipairs(planets) do
    local t = (index - 1) / #planets
    local px = SZ.toScreenX(layout, 16 + (index - 1) * 18)
    local py = SZ.toScreenY(layout, 18 + (index % 2) * 2 + SZ.wave(0.5, index * 0.5) * 0.9)
    local pR = SZ.toScreenW(layout, planet.size)
    local highlight = (index == selectedPlanet)

    if highlight then
      setNextStrokeColor(layer, planet.color[1], planet.color[2], planet.color[3], 0.92)
      setNextStrokeWidth(layer, 1.2)
      addCircle(layer, px, py, pR * (1.38 + SZ.pulse(0.04, 0.18, 1.9, index * 0.2)))
    end

    setNextFillColor(layer, 0.10, 0.10, 0.12, 0.65)
    setNextStrokeColor(layer, planet.color[1], planet.color[2], planet.color[3], 0.65)
    setNextStrokeWidth(layer, highlight and 1 or 0.7)
    addCircle(layer, px, py, pR)

    setNextFillColor(layer, 0.14, 0.14, 0.18, 0.92)
    setNextStrokeColor(layer, 1, 1, 1, 0.3)
    setNextStrokeWidth(layer, 0.4)
    addLine(layer, px - pR * 0.9, py, px + pR * 0.9, py)
    addLine(layer, px, py - pR * 0.9, px, py + pR * 0.9)

    setNextTextAlign(layer, AlignH_Center, AlignV_Middle)
    setNextFillColor(layer, highlight and theme.textPrimary[1] or theme.textDim[1], highlight and theme.textPrimary[2] or theme.textDim[2], highlight and theme.textPrimary[3] or theme.textDim[3], 0.95)
    addText(layer, valueFont, planet.name, px, py + pR + SZ.toScreenH(layout, 3))

    if highlight then
      local statusY = py + pR + SZ.toScreenH(layout, 8)
      setNextFillColor(layer, theme.accent[1], theme.accent[2], theme.accent[3], 0.82)
      addText(layer, tinyFont, "T" .. planet.tier, px, statusY)
    end
  end
end

local function drawFrame(layer)
  SZ.panel(layer, layout, {
    x = 2,
    y = 2,
    w = 227,
    h = 152,
  }, theme, {
    radius = 8,
    strokeWidth = 2,
    fillColor = { 0.14, 0.02, 0.03, 0.20 },
    strokeColor = theme.panelStroke,
    innerInset = 2,
    innerColor = theme.panelInset,
  })

  SZ.frame(layer, layout, {
    x = 8,
    y = 58,
    w = 215,
    h = 92,
    }, theme, {
    color = theme.accent,
    strokeWidth = 1,
    cross = 2,
  })

  SZ.text(layer, layout, titleFont, "ORE EXPLORER", 116, 63, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })

  SZ.text(layer, layout, valueFont, "PLANETARY RESOURCE REPORT", 116, 72, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textMuted,
  })

  setNextFillColor(layer, 0.08, 0.05, 0.06, 0.78)
  setNextStrokeColor(layer, theme.textDim[1], theme.textDim[2], theme.textDim[3], 0.45)
  setNextStrokeWidth(layer, 0.8)
  addBoxRounded(layer, SZ.toScreenX(layout, 10), SZ.toScreenY(layout, 77), SZ.toScreenW(layout, 211), SZ.toScreenH(layout, 2), SZ.toScreenW(layout, 1))

  SZ.text(layer, layout, headingFont, "SECTOR: ALIOTH", 15, 82, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.accentStrong,
  })

  SZ.badge(layer, layout, {
    x = 196,
    y = 80,
    w = 28,
    h = 7,
  }, tinyFont, "TRACK", theme, {
    fill = { 0.3, 0.06, 0.09, 0.6 },
    stroke = theme.accent,
    textColor = theme.textPrimary,
    align = {
      x = "Center",
      y = "Middle",
    },
  })
end

local function drawCatalogHeader(layer)
  setNextFillColor(layer, 0.12, 0.06, 0.08, 0.74)
  setNextStrokeColor(layer, theme.textDim[1], theme.textDim[2], theme.textDim[3], 0.4)
  setNextStrokeWidth(layer, 0.9)
  addBoxRounded(layer, SZ.toScreenX(layout, 11), SZ.toScreenY(layout, 91), SZ.toScreenW(layout, 209), SZ.toScreenH(layout, 9), SZ.toScreenW(layout, 1.5))

  SZ.text(layer, layout, headingFont, "CLASS", 14, 96, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.textDim,
  })
  SZ.text(layer, layout, headingFont, "ORE", 62, 96, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.textDim,
  })
  SZ.text(layer, layout, headingFont, "TRACE", 142, 96, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.textDim,
  })
  SZ.text(layer, layout, headingFont, "QTY", 198, 96, theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Middle,
    color = theme.textDim,
  })
end

local function drawCatalogRows(layer)
  SZ.withClip(layer, layout, {
    x = 10,
    y = 101,
    w = 211,
    h = 45,
  }, function()
    for index, row in ipairs(resourceRows) do
      if index > 5 then
        break
      end

      local rowY = 102 + (index - 1) * 9
      local isSelected = index == 2
      local rowYTop = SZ.toScreenY(layout, rowY)

      local glow = isSelected and (0.36 + SZ.pulse(0.06, 0.18, 1.8, index * 0.5)) or (0.18 + SZ.pulse(0.01, 0.05, 1.2, index * 0.2))
      setNextFillColor(layer, isSelected and 0.22 or 0.11, isSelected and 0.08 or 0.06, isSelected and 0.09 or 0.05, glow)
      setNextStrokeColor(layer, isSelected and theme.accentStrong[1] or theme.textDim[1], isSelected and theme.accentStrong[2] or theme.textDim[2], isSelected and theme.accentStrong[3] or theme.textDim[3], isSelected and 0.78 or 0.35)
      setNextStrokeWidth(layer, isSelected and 1 or 0.7)
      addBoxRounded(layer, SZ.toScreenX(layout, 11), rowYTop, SZ.toScreenW(layout, 209), SZ.toScreenH(layout, 8), SZ.toScreenW(layout, 1))

      setNextFillColor(layer, 0.2, 0.2, 0.2, 0.4)
      addBoxRounded(layer, SZ.toScreenX(layout, 12), rowYTop + SZ.toScreenH(layout, 1), SZ.toScreenW(layout, 18), SZ.toScreenH(layout, 6), SZ.toScreenW(layout, 0.7))

      local iconX = SZ.toScreenX(layout, 16)
      local iconY = rowYTop + SZ.toScreenH(layout, 2)
      local iconW = SZ.toScreenW(layout, 4)
      local iconH = SZ.toScreenH(layout, 4)
      setNextFillColor(layer, 0.9, 0.85, 0.4, 0.8)
      setNextStrokeColor(layer, 1, 1, 1, 0.4)
      setNextStrokeWidth(layer, 0.6)
      addBox(layer, iconX, iconY, iconW, iconH)

      SZ.text(layer, layout, valueFont, row.title, 54, rowY + 3.8, theme, {
        alignX = AlignH_Left,
        alignY = AlignV_Middle,
        color = isSelected and theme.accentStrong or theme.textPrimary,
      })

      SZ.text(layer, layout, valueFont, row.ore, 62, rowY + 3.8, theme, {
        alignX = AlignH_Left,
        alignY = AlignV_Middle,
        color = theme.textPrimary,
      })

      SZ.text(layer, layout, tinyFont, row.purity, 128, rowY + 3.4, theme, {
        alignX = AlignH_Left,
        alignY = AlignV_Middle,
        color = theme.textMuted,
      })

      SZ.badge(layer, layout, {
        x = 142,
        y = rowY + 1,
        w = 8,
        h = 5,
      }, tinyFont, "T" .. row.tier, theme, {
        fill = { 0.2, 0.16, 0.22, 0.75 },
        stroke = { 0.9, 0.75, 0.2, 0.5 },
        textColor = theme.textPrimary,
        align = {
          x = "Center",
          y = "Middle",
        },
      })

      SZ.text(layer, layout, valueFont, row.amount, 204, rowY + 3.8, theme, {
        alignX = AlignH_Right,
        alignY = AlignV_Middle,
        color = theme.textPrimary,
      })

      if isSelected then
        setNextFillColor(layer, theme.accentStrong[1], theme.accentStrong[2], theme.accentStrong[3], 0.85)
        setNextStrokeColor(layer, theme.accentStrong[1], theme.accentStrong[2], theme.accentStrong[3], 0.85)
        setNextStrokeWidth(layer, 0.9)
        addLine(layer, SZ.toScreenX(layout, 12), SZ.toScreenY(layout, rowY + 7.5), SZ.toScreenX(layout, 220), SZ.toScreenY(layout, rowY + 7.5))
      end
    end
  end)

  SZ.text(layer, layout, valueFont, "SCROLL", 220, 149, theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Bottom,
    color = theme.textDim,
  })
  SZ.text(layer, layout, valueFont, ">", 220, 152, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Bottom,
    color = theme.accentStrong,
  })

  SZ.text(layer, layout, tinyFont, "FILTERS: TIERS 1-8", 14, 152, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Bottom,
    color = theme.textDim,
  })
  SZ.text(layer, layout, tinyFont, "SORT: PURE DESC", 120, 152, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Bottom,
    color = theme.textDim,
  })
end

local function drawFX(layer)
  SZ.withClip(layer, layout, {
    x = 9,
    y = 90,
    w = 213,
    h = 65,
  }, function()
    for i = 0, 80 do
      local y = 90 + (i % 12) * 3.6 + SZ.wave(1.5, i * 0.15) * 0.8
      setNextStrokeColor(layer, 1, 1, 1, 0.02 + (i % 7) * 0.01 + SZ.pulse(0.01, 0.04, 1.7, i * 0.15))
      setNextStrokeWidth(layer, 0.45)
      addLine(
        layer,
        SZ.toScreenX(layout, 10 + i * 1.2),
        SZ.toScreenY(layout, 150),
        SZ.toScreenX(layout, 10 + i * 1.2 + 2),
        SZ.toScreenY(layout, y)
      )
    end
  end)

  for i = 0, 16 do
    local x = SZ.toScreenX(layout, 11 + i * 12.2)
    setNextStrokeColor(layer, theme.textPrimary[1], theme.textPrimary[2], theme.textPrimary[3], 0.10 + SZ.pulse(0.04, 0.12, 1.4, i * 0.2))
    setNextStrokeWidth(layer, 0.35)
    addLine(layer, x, SZ.toScreenY(layout, 92), x, SZ.toScreenY(layout, 147))
  end
end

drawFrame(layers.frame)
drawSpace(layers.space)
drawSolarMap(layers.horizon)
drawCatalogHeader(layers.meta)
drawCatalogRows(layers.catalog)
drawFX(layers.fx)
