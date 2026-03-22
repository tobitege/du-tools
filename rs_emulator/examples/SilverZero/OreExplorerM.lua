-- RenderScript conversion of SilverZero OreExplorerM.json

local SZ = require("SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()
local layout = SZ.layoutForScreen(resolutionX, resolutionY, 231, 156, 0.04)

SZ.animLoop(1)

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3])

local headingFont = SZ.font("Arial", SZ.scaleFontSize(10, layout))
local valueFont = SZ.font("Arial", SZ.scaleFontSize(8, layout))
local tinyFont = SZ.font("Arial", SZ.scaleFontSize(6, layout))
local microFont = SZ.font("Arial", SZ.scaleFontSize(5, layout))

local layers = SZ.createLayers("space", "sun", "frame", "map", "catalog", "meta")

local orbitBaseline = 25.2
local planets = {
  { name = "Madis", shape = "circle", size = 3.51, color = { 0.95, 0.72, 0.35, 0.85 }, metaText = "T1" },
  { name = "Alioth", shape = "circle", size = 6.00, color = { 0.46, 0.72, 1.00, 0.90 }, metaText = "T4", selected = true, selectedScale = 1.66, selectedMinSize = 10.0 },
  { name = "Thades", shape = "circle", size = 8.00, color = { 0.78, 0.31, 0.95, 0.88 }, metaText = "T5" },
  { name = "Talemai", shape = "circle", size = 4.56, color = { 0.54, 0.74, 0.95, 0.82 }, metaText = "T3" },
  { name = "Feli", shape = "circle", size = 4.76, color = { 0.66, 0.24, 0.82, 0.80 }, metaText = "T2" },
  { name = "Sicari", shape = "circle", size = 4.05, color = { 0.95, 0.62, 0.30, 0.84 }, metaText = "T2" },
  { name = "Sinnen", shape = "circle", size = 4.36, color = { 0.40, 0.68, 0.34, 0.80 }, metaText = "T2" },
  { name = "Teoma", shape = "circle", size = 4.92, color = { 0.90, 0.34, 0.28, 0.82 }, metaText = "T6" },
  { name = "Jago", shape = "circle", size = 4.89, color = { 0.74, 0.28, 0.42, 0.82 }, metaText = "T1" },
  { name = "Lacobus", shape = "circle", size = 4.41, color = { 0.60, 0.85, 0.95, 0.80 }, metaText = "T4" },
  { name = "Symeon", shape = "circle", size = 3.89, color = { 0.48, 0.88, 0.42, 0.84 }, metaText = "T3" },
  { name = "Ion", shape = "circle", size = 3.57, color = { 0.96, 0.42, 0.18, 0.80 }, metaText = "T7" },
}

local oreOrder = {
  "Bauxite",
  "Coal",
  "Quartz",
  "Hematite",
  "Natron",
  "Chromite",
  "Limestone",
  "Malachite",
  "Acanthite",
  "Petalite",
  "Pyrite",
  "Gold Nuggets",
  "Columbite",
  "Rhodonite",
}

local tierColors = {
  ["1"] = { 0.83, 0.79, 0.48, 0.95 },
  ["2"] = { 0.88, 0.58, 0.29, 0.95 },
  ["3"] = { 0.71, 0.53, 0.93, 0.95 },
  ["4"] = { 0.48, 0.76, 0.95, 0.95 },
  ["5"] = { 0.98, 0.44, 0.30, 0.95 },
}

local oreCatalog = {
  ["Bauxite"] = { short = "Bauxite", purity = "(Aluminium)", tier = "1" },
  ["Coal"] = { short = "Coal", purity = "(Carbon)", tier = "1" },
  ["Quartz"] = { short = "Quartz", purity = "(Silicon)", tier = "1" },
  ["Hematite"] = { short = "Hematite", purity = "(Iron)", tier = "1" },
  ["Natron"] = { short = "Natron", purity = "(Sodium)", tier = "2" },
  ["Chromite"] = { short = "Chromite", purity = "(Chromium)", tier = "2" },
  ["Limestone"] = { short = "Limestone", purity = "(Calcium)", tier = "2" },
  ["Malachite"] = { short = "Malachite", purity = "(Copper)", tier = "2" },
  ["Acanthite"] = { short = "Acanthite", purity = "(Silver)", tier = "3" },
  ["Petalite"] = { short = "Petalite", purity = "(Lithium)", tier = "3" },
  ["Pyrite"] = { short = "Pyrite", purity = "(Sulfur)", tier = "3" },
  ["Gold Nuggets"] = { short = "Gold", purity = "(Gold)", tier = "4" },
  ["Columbite"] = { short = "Columbite", purity = "(Niobium)", tier = "5" },
  ["Rhodonite"] = { short = "Rhodonite", purity = "(Manganese)", tier = "5" },
}

local planetRows = {
  {
    name = "Alioth",
    values = {
      ["Bauxite"] = "0-330",
      ["Coal"] = "0-293",
      ["Quartz"] = "0-289",
      ["Hematite"] = "0-245",
      ["Limestone"] = "598-663",
      ["Malachite"] = "430-566",
      ["Acanthite"] = "866-926",
    },
  },
  {
    name = "Alioth M1",
    values = {
      ["Bauxite"] = "0-126",
      ["Coal"] = "0-129",
      ["Quartz"] = "0-122",
      ["Hematite"] = "0-106",
      ["Columbite"] = "840-850",
    },
  },
  {
    name = "Alioth M2",
    values = {
      ["Bauxite"] = "0-?",
      ["Coal"] = "0-?",
      ["Quartz"] = "0-?",
      ["Hematite"] = "0-?",
      ["Natron"] = "500-800",
      ["Chromite"] = "500-800",
      ["Limestone"] = "500-800",
      ["Malachite"] = "500-800",
    },
  },
  {
    name = "Alioth M4",
    values = {
      ["Bauxite"] = "0-129",
      ["Coal"] = "0-130",
      ["Quartz"] = "0-131",
      ["Hematite"] = "0-119",
      ["Rhodonite"] = "836-836",
    },
  },
}

local function drawSpace(layer)
  setNextFillColor(layer, 0.03, 0.04, 0.09, 0.98)
  addBox(layer, 0, 0, layout.screenW, layout.screenH)

  setNextFillColor(layer, 0.05, 0.07, 0.14, 0.78)
  addBox(layer, 0, 0, layout.screenW, SZ.toScreenY(layout, 44))

  setNextFillColor(layer, 0.05, 0.01, 0.03, 0.86)
  addBox(layer, 0, SZ.toScreenY(layout, 44), layout.screenW, layout.screenH - SZ.toScreenY(layout, 44))

  for i = 0, 28 do
    local x = 2 + i * 8.2
    SZ.line(layer, layout, x, 0, x, 44, { 0.30, 0.36, 0.50, 0.13 }, 0.22)
  end

  for i = 0, 10 do
    local y = 3 + i * 3.7
    SZ.line(layer, layout, 0, y, 231, y, { 0.28, 0.34, 0.48, 0.09 }, 0.22)
  end

  for i = 0, 12 do
    local x = 10 + i * 17.2
    SZ.line(layer, layout, x, 52, x, 148, { 1.00, 0.46, 0.00, 0.07 }, 0.26)
  end

  SZ.line(layer, layout, 0, 44, 231, 44, { 1.00, 0.46, 0.00, 0.18 }, 0.7)
end

local function drawSun(layer)
  local cx = SZ.toScreenX(layout, 8)
  local cy = SZ.toScreenY(layout, 22)
  local outerR = SZ.toScreenW(layout, 34)

  setNextFillColor(layer, 0.96, 0.87, 0.68, 0.08)
  setNextStrokeColor(layer, 1.00, 0.78, 0.32, 0.14)
  setNextStrokeWidth(layer, math.max(1, 1.2 * layout.scale))
  addCircle(layer, cx, cy, outerR)
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
    fillColor = { 0.14, 0.02, 0.03, 0.18 },
    strokeColor = { 0.70, 0.07, 0.07, 0.80 },
    innerInset = 2,
    innerColor = { 0.30, 0.18, 0.16, 0.22 },
  })

  SZ.box(layer, layout, {
    x = 8,
    y = 44,
    w = 215,
    h = 104,
  }, {
    radius = 6,
    fillColor = { 0.10, 0.04, 0.05, 0.48 },
    strokeColor = { 1.00, 0.42, 0.00, 0.80 },
    strokeWidth = 0.9,
  })
  SZ.box(layer, layout, {
    x = 10,
    y = 47,
    w = 211,
    h = 98,
  }, {
    radius = 3,
    fillColor = { 0.06, 0.02, 0.03, 0.24 },
    strokeColor = { 0.74, 0.12, 0.07, 0.38 },
    strokeWidth = 0.5,
  })

  SZ.line(layer, layout, 12, 74, 220, 74, { 0.98, 0.48, 0.12, 0.60 }, 0.55)
end

local function drawPlanetRow(layer)
  local rowLeft = 18
  local rowStep = 16.5

  SZ.box(layer, layout, {
    x = 6,
    y = 10,
    w = 219,
    h = 29,
  }, {
    radius = 2.2,
    fillColor = { 0.07, 0.09, 0.15, 0.14 },
    strokeColor = { 0.42, 0.48, 0.62, 0.16 },
    strokeWidth = 0.45,
  })

  SZ.namedSymbolRow(layer, layout, planets, theme, {
    left = rowLeft,
    step = rowStep,
    baselineY = orbitBaseline,
    minVisualSize = 3.51,
    maxVisualSize = 8.0,
    scaleMode = "auto",
    logThreshold = 3.5,
    labelFont = tinyFont,
    metaFont = tinyFont,
    labelGap = 1.2,
    metaGap = 2.4,
    labelColor = SZ.scaleColor(theme.textDim, 1, 0.86),
    selectedLabelColor = theme.textPrimary,
    metaColor = theme.accentStrong,
    fillColor = { 0.10, 0.10, 0.14, 0.90 },
    strokeAlpha = 0.56,
    selectedStrokeAlpha = 0.95,
    strokeWidth = 0.55,
    selectedStrokeWidth = 0.85,
    selectedOutlineColor = { 1, 1, 1, 0.92 },
    selectedOutlineWidth = 0.8,
    selectedOutlinePadding = 1.2,
    innerAlpha = 0.12,
    selectedInnerAlpha = 0.22,
    innerStrokeAlpha = 0.09,
    selectedInnerStrokeAlpha = 0.18,
    innerScale = 0.72,
    innerOffsetX = 0.5,
    innerOffsetY = -0.3,
  })
end

local function drawOreCard(layer, cardX, cardY, oreName, range)
  local ore = oreCatalog[oreName]
  local tierColor = tierColors[ore.tier] or theme.accentStrong

  SZ.box(layer, layout, {
    x = cardX,
    y = cardY,
    w = 20.5,
    h = 13.2,
  }, {
    radius = 1.0,
    fillColor = { 0.11, 0.05, 0.07, 0.86 },
    strokeColor = { tierColor[1], tierColor[2], tierColor[3], 0.76 },
    strokeWidth = 0.45,
  })

  setNextFillColor(layer, tierColor[1], tierColor[2], tierColor[3], 0.28)
  addBox(layer, SZ.toScreenX(layout, cardX), SZ.toScreenY(layout, cardY), SZ.toScreenW(layout, 20.5), SZ.toScreenH(layout, 1.4))

  SZ.text(layer, layout, microFont, ore.short, cardX + 10.25, cardY + 3.5, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })

  SZ.text(layer, layout, microFont, ore.purity, cardX + 10.25, cardY + 7.0, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textMuted,
  })

  SZ.text(layer, layout, microFont, range, cardX + 10.25, cardY + 11.3, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Bottom,
    color = tierColor,
  })
end

local function drawCatalog(layer)
  SZ.withClip(layer, layout, {
    x = 10,
    y = 76,
    w = 211,
    h = 68,
  }, function()
    for rowIndex, row in ipairs(planetRows) do
      local rowY = 77 + (rowIndex - 1) * 15

      SZ.box(layer, layout, {
        x = 12,
        y = rowY,
        w = 207,
        h = 15,
      }, {
        radius = 1.3,
        fillColor = { 0.08, 0.03, 0.04, 0.46 },
        strokeColor = { 0.46, 0.11, 0.08, 0.24 },
        strokeWidth = 0.35,
      })
      SZ.box(layer, layout, {
        x = 14,
        y = rowY + 1,
        w = 22,
        h = 13,
      }, {
        radius = 1.0,
        fillColor = { 0.16, 0.05, 0.07, 0.82 },
        strokeColor = { 1.00, 0.45, 0.00, 0.50 },
        strokeWidth = 0.45,
      })

      SZ.text(layer, layout, tinyFont, row.name, 25, rowY + 7.6, theme, {
        alignX = AlignH_Center,
        alignY = AlignV_Middle,
        color = theme.textPrimary,
      })

      local column = 0
      for _, oreName in ipairs(oreOrder) do
        local range = row.values[oreName]
        if range and range ~= "" then
          local cardX = 39 + column * 22.4
          drawOreCard(layer, cardX, rowY + 0.9, oreName, range)
          column = column + 1
        end
      end
    end
  end)
end

local function drawMeta(layer)
  SZ.text(layer, layout, headingFont, "ALIOTH", 15, 66, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Bottom,
    color = theme.accentStrong,
  })

  SZ.text(layer, layout, tinyFont, "KNOWN ORE OCCURRENCES", 15, 70.2, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.textDim,
  })

  SZ.text(layer, layout, tinyFont, "PLANETS / MOONS", 14, 41.5, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Bottom,
    color = theme.textDim,
  })
end

drawSpace(layers.space)
drawSun(layers.sun)
drawFrame(layers.frame)
drawPlanetRow(layers.map)
drawCatalog(layers.catalog)
drawMeta(layers.meta)
