-- RenderScript conversion of SilverZero ContainerSignM.json

local SZ = require("lib.SilverZeroRsLib")

local theme = SZ.Themes.SilverZero
local resolutionX, resolutionY = getResolution()

local SOURCE_W = 231
local SOURCE_H = 156

local function vw(value)
  return SOURCE_W * value / 100
end

local function vh(value)
  return SOURCE_H * value / 100
end

local layout = {
  screenW = resolutionX,
  screenH = resolutionY,
  sourceW = SOURCE_W,
  sourceH = SOURCE_H,
  scale = math.min(resolutionX / SOURCE_W, resolutionY / SOURCE_H),
  scaleX = resolutionX / SOURCE_W,
  scaleY = resolutionY / SOURCE_H,
  x = 0,
  y = 0,
}

setBackgroundColor(theme.background[1], theme.background[2], theme.background[3])

local boardBounds = {
  x = vw(1.0),
  y = vh(1.0),
  w = vw(98.0),
  h = vh(98.0),
}

local tableHeaderFont = SZ.font("Arial", SZ.fontSizeVh(layout, 4))
local tableRowFont = SZ.font("Arial", SZ.fontSizeVh(layout, 3.4))

local layers = SZ.createLayers("background", "board", "hub", "gauge", "text")

local usagePercent = 64

local items = {
  { name = "Carbon Aged", amount = "1,250", unit = "L" },
  { name = "Scrap Alloy", amount = "482", unit = "L" },
  { name = "Silicon", amount = "3,120", unit = "L" },
  { name = "Titanium", amount = "98", unit = "kL" },
  { name = "Warp Cells", amount = "34", unit = "kg" },
}

local DETAIL_FRAME_PATH = [[
m99.6 6.2888c-1.438 0.072375-2.8288 0.34664-3.8529 1.1501-3.0602 2.4016-0.89232 10.959-0.88345 14.421h-22.167c-3.3461 2.21e-4 -7.7199-0.67138-10.718 1.1382-4.2871 2.5866-7.1371 9.1632-9.7417 13.287-5.6449 8.9427-11.612 17.687-17.321 26.584-18.562 28.932-37.736 57.462-56.203 86.452-4.9767 7.8128-10.268 15.402-15.145 23.274-2.6519 4.2816-6.205 8.1678-7.0128 13.302-2.0558 13.066-0.23575 27.783-0.23575 41.01 0 5.0641-1.4136 12.755 0.82153 17.424 2.8161 5.8832 12.436 3.3094 14.342 10.344 1.7026 6.2833 0.35243 14.511 0.35243 20.998 0 13.382 0.48121 26.582 1.0644 39.903 1.1762 26.86 0.04522 54.023 0.04522 80.91 0 23.32 1.1073 46.567 1.1073 69.826 0 44.316-0.87178 88.785 1.0644 133 0.69295 15.824 0.04522 31.82 0.04522 47.661 0 7.1489 1.5228 16.298-0.35243 23.215-1.8884 6.9672-11.614 4.5992-14.342 11.206-1.9622 4.7504-0.82392 11.519-0.82392 16.564 0 12.907-2.8339 29.711 0.88821 42.117 4.3852 14.616 17.684 28.525 26.163 41.01 18.206 26.808 35.274 54.472 54.014 80.91 6.4618 9.1152 12.584 18.442 18.814 27.708 2.639 3.9247 5.0852 9.6185 9.256 12.161 2.9593 1.8044 7.2596 1.1382 10.568 1.1382 7.5081 0 14.722 0.16867 22.167 1.1097 0 3.5479-1.665 12.924 1.7764 15.131 1.913 1.227 4.97 0.48944 7.0914 0.42626 5.5341-0.16625 11.087-0.0405 16.624-0.0405h356.89c364.91 0 730.06-1.1073 1095.1-1.1073h311.45c4.9987 0 16.303 2.0991 20.393-1.1406 3.4138-2.71 1.7741-11.591 1.7741-15.485h22.167c3.6354-9.5e-4 7.759 0.46801 10.885-1.7764 4.6551-3.3517 7.8025-10.117 10.906-14.85 6.5505-10.016 13.311-19.881 19.817-29.925 17.645-27.251 36.42-53.738 54.176-80.91 4.8657-7.436 9.9529-14.729 14.819-22.167 2.0726-3.181 4.988-6.3485 6.2295-9.9751 1.596-4.6418 0.6548-10.673 0.6548-15.519 0-9.973-0.111-19.953 0-29.925 0.068-5.2359 2.1833-11.369-0.033-16.376-2.7267-6.1692-12.114-4.0143-14.021-11.354-1.9951-7.6333-0.3549-17.597-0.3549-25.47v-52.095c0-106 1.7071-212.04 2.2169-318.1 0.023-4.981-0.5545-15.358 2.8814-19.245 3.3141-3.7363 10.85-3.2691 13.078-7.8201 2.0617-4.2051 0.6668-11.573 0.6668-16.162 0-13.366 2.2493-29-0.3-42.117-1.064-5.4232-5.0662-9.8858-7.9701-14.409-5.6859-8.8447-11.459-17.664-17.012-26.601-17.401-28.016-35.912-55.382-53.757-83.127-5.4753-8.5277-10.973-17.037-16.559-25.491-2.4826-3.7455-4.3767-8.704-8.0009-11.523-2.9594-2.3002-7.0499-1.7771-10.563-1.7788h-23.274v-16.626c-466.31 0-932.44-1.1073-1398.8-1.1073-108.9 0-217.98-1.1073-326.97-1.1073h-89.779c-1.2087 0.00217-2.6935-0.12715-4.1315-0.054757z
]]

local DETAIL_FRAME_SOURCE_TRANSFORM = {
  0.24053,
  0,
  0,
  0.24053,
  11.49,
  -0.708,
}

local DETAIL_FRAME_SOURCE_W = 327.2
local DETAIL_FRAME_SOURCE_H = 200

local function drawDonutProgress(targetLayout, layer, cx, cy, outerRadius, innerRadius, startDegrees, sweepDegrees, color)
  local segments = math.max(12, math.ceil(math.abs(sweepDegrees) / 8))

  setNextFillColor(layer, color[1], color[2], color[3], color[4] or 1)
  for segment = 1, segments do
    local a1 = math.rad(startDegrees + sweepDegrees * (segment - 1) / segments)
    local a2 = math.rad(startDegrees + sweepDegrees * segment / segments)

    local x1Outer = SZ.toScreenX(targetLayout, cx + math.cos(a1) * outerRadius)
    local y1Outer = SZ.toScreenY(targetLayout, cy + math.sin(a1) * outerRadius)
    local x2Outer = SZ.toScreenX(targetLayout, cx + math.cos(a2) * outerRadius)
    local y2Outer = SZ.toScreenY(targetLayout, cy + math.sin(a2) * outerRadius)
    local x2Inner = SZ.toScreenX(targetLayout, cx + math.cos(a2) * innerRadius)
    local y2Inner = SZ.toScreenY(targetLayout, cy + math.sin(a2) * innerRadius)
    local x1Inner = SZ.toScreenX(targetLayout, cx + math.cos(a1) * innerRadius)
    local y1Inner = SZ.toScreenY(targetLayout, cy + math.sin(a1) * innerRadius)

    addQuad(layer, x1Outer, y1Outer, x2Outer, y2Outer, x2Inner, y2Inner, x1Inner, y1Inner)
  end
end

local function drawBackground()
  setNextFillColor(layers.background, 0.31, 0, 0.05, 0.55)
  addBox(layers.background, 0, 0, resolutionX, resolutionY)
end

local function drawBoard()
  setNextFillColor(layers.board, 0.02, 0, 0.02, 0.82)
  addBox(
    layers.board,
    SZ.toScreenX(layout, boardBounds.x + vw(0.75)),
    SZ.toScreenY(layout, boardBounds.y + vh(0.75)),
    SZ.toScreenW(layout, boardBounds.w - vw(1.5)),
    SZ.toScreenH(layout, boardBounds.h - vh(1.5))
  )

  SZ.simpleSignBoard(layers.board, layout, boardBounds, {
    outlineColor = { 0.71, 0.06, 0.06, 0.95 },
    highlightColor = { 0.74, 0.74, 0.74, 0.78 },
    outlineWidth = 1.1,
    highlightWidth = 0.9,
  })
end

local function drawHubDecoration()
  local frameX = vw(11)
  local frameY = vh(8)
  local frameW = vw(46)
  local frameH = vh(54)

  -- The source path is stored horizontally. To draw it as the thin vertical frame,
  -- scale it into a pre-rotation box, then apply one explicit 90deg clockwise mapping.
  local scaleX = frameH / DETAIL_FRAME_SOURCE_W
  local scaleY = frameW / DETAIL_FRAME_SOURCE_H
  local source = DETAIL_FRAME_SOURCE_TRANSFORM

  local transform = {
    -scaleY * source[2],
    scaleX * source[1],
    -scaleY * source[4],
    scaleX * source[3],
    frameX + frameW - scaleY * source[6],
    frameY + scaleX * source[5],
  }

  SZ.drawPath(layers.hub, layout, DETAIL_FRAME_PATH, { 0.71, 0.06, 0.06, 0.62 }, 0.7, transform)
end

local function drawGauge()
  local gaugeBounds = {
    x = vw(67.4),
    y = vh(22.0),
    w = vw(22.0),
    h = vw(22.0),
  }
  local gaugeLayout = SZ.relativeLayout(layout, gaugeBounds, 100, 100, {
    preserveAspect = true,
  })
  local gaugeFont = SZ.font("Arial", math.max(1, math.floor(SZ.toScreenW(gaugeLayout, 12) + 0.5)))
  local cx = 50
  local cy = 50
  local outerRadius = 38
  local progressOuter = 31
  local progressInner = 24
  local innerRadius = 20

  setNextFillColor(layers.gauge, 0, 0, 0, 0)
  setNextStrokeColor(layers.gauge, 0.71, 0.06, 0.06, 0.95)
  setNextStrokeWidth(layers.gauge, math.max(1, gaugeLayout.scale))
  addCircle(layers.gauge, SZ.toScreenX(gaugeLayout, cx), SZ.toScreenY(gaugeLayout, cy), SZ.toScreenW(gaugeLayout, outerRadius))

  for dot = 0, 39 do
    local angle = math.rad(dot * (360 / 40) - 90)
    local dotRadius = 33.5
    local dotX = cx + math.cos(angle) * dotRadius
    local dotY = cy + math.sin(angle) * dotRadius

    setNextFillColor(layers.gauge, 0.74, 0.74, 0.74, 0.95)
    addCircle(layers.gauge, SZ.toScreenX(gaugeLayout, dotX), SZ.toScreenY(gaugeLayout, dotY), math.max(1, SZ.toScreenW(gaugeLayout, 0.32)))
  end

  drawDonutProgress(gaugeLayout, layers.gauge, cx, cy, progressOuter, progressInner, -90, 360 * usagePercent / 100, {
    0.22,
    0.93,
    0.30,
    0.90,
  })

  setNextFillColor(layers.gauge, 0.08, 0.02, 0.05, 0.96)
  addCircle(layers.gauge, SZ.toScreenX(gaugeLayout, cx), SZ.toScreenY(gaugeLayout, cy), SZ.toScreenW(gaugeLayout, innerRadius))

  SZ.text(layers.text, gaugeLayout, gaugeFont, string.format("%d%%", usagePercent), cx, cy + 1.0, theme, {
    alignX = AlignH_Center,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })
end

local function drawTable()
  local listLeftX = 15
  local listRightX = 131
  local nameX = 18
  local quantityRightX = 114
  local unitX = 120
  local headerY = 26
  local rowStartY = 41
  local rowHeight = 9.1
  local dividerX = 106

  SZ.divider(layers.hub, layout, listLeftX, 35, listRightX, 35, theme, {
    color = { 0.71, 0.06, 0.06, 0.58 },
    width = 0.5,
  })

  SZ.divider(layers.hub, layout, dividerX, 29, dividerX, 78, theme, {
    color = { 0.71, 0.06, 0.06, 0.24 },
    width = 0.45,
  })

  SZ.text(layers.text, layout, tableHeaderFont, "Item", nameX, headerY, theme, {
    alignX = AlignH_Left,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })
  SZ.text(layers.text, layout, tableHeaderFont, "Amount", quantityRightX, headerY, theme, {
    alignX = AlignH_Right,
    alignY = AlignV_Middle,
    color = theme.textPrimary,
  })

  for index, item in ipairs(items) do
    local y = rowStartY + (index - 1) * rowHeight
    local rowDividerY = y + rowHeight * 0.58

    SZ.divider(layers.hub, layout, listLeftX, rowDividerY, listRightX, rowDividerY, theme, {
      color = { 0.71, 0.06, 0.06, index == #items and 0.18 or 0.28 },
      width = 0.34,
    })

    SZ.text(layers.text, layout, tableRowFont, item.name, nameX, y, theme, {
      alignX = AlignH_Left,
      alignY = AlignV_Middle,
      color = theme.textPrimary,
    })
    SZ.text(layers.text, layout, tableRowFont, item.amount, quantityRightX, y, theme, {
      alignX = AlignH_Right,
      alignY = AlignV_Middle,
      color = theme.textPrimary,
    })
    SZ.text(layers.text, layout, tableRowFont, item.unit, unitX, y, theme, {
      alignX = AlignH_Left,
      alignY = AlignV_Middle,
      color = theme.textPrimary,
    })
  end
end

drawBackground()
drawBoard()
drawHubDecoration()
drawGauge()
drawTable()
