-- Welcome to RenderScript Emulator!
-- Press Ctrl+Enter or click Run to execute

local layer = createLayer()
local font = loadFont("Arial", 24)

setBackgroundColor(0.05, 0.05, 0.1)

-- Draw a gradient-like row of boxes
for i = 0, 9 do
  local r = i * 0.1
  local g = 0.5 - i * 0.03
  local b = 1.0 - i * 0.08
  setNextFillColor(layer, r, g, b, 1)
  addBox(layer, 50 + i * 95, 100, 80, 80)
end

-- Draw some circles
setNextFillColor(layer, 1, 0.4, 0.3, 1)
addCircle(layer, 200, 350, 60)

setNextFillColor(layer, 0.3, 1, 0.4, 0.8)
addCircle(layer, 400, 350, 60)

setNextFillColor(layer, 0.4, 0.3, 1, 0.6)
addCircle(layer, 600, 350, 60)

-- Rounded box
setNextFillColor(layer, 0.2, 0.6, 0.8, 1)
addBoxRounded(layer, 150, 480, 400, 120, 20)

-- Text
setNextFillColor(layer, 1, 1, 1, 1)
addText(layer, font, "Hello RenderScript!", 180, 560)

-- Lines
setNextStrokeColor(layer, 1, 1, 0, 1)
setNextStrokeWidth(layer, 2)
addLine(layer, 700, 100, 900, 250)
addLine(layer, 900, 100, 700, 250)

-- Triangle
setNextFillColor(layer, 0.8, 0.3, 0.8, 1)
addTriangle(layer, 800, 400, 750, 520, 920, 520)
