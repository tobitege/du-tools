-- Extracted/adapted from the programming-board screen payload used by
-- ScreenOutput(...): render lines of text on a linked screen.

local samples = {
  { name = "Arial", size = 34, text = "Arial - The quick brown fox jumps over the lazy dog 0123456789" },
  { name = "Verdana", size = 32, text = "Verdana - Clean UI text and readable labels" },
  { name = "Georgia", size = 40, text = "Georgia - Serif sample for headings" },
  { name = "Times New Roman", size = 40, text = "Times New Roman - Traditional serif body copy" },
  { name = "Courier New", size = 30, text = "Courier New - Monospace diagnostics and logs" },
  { name = "FiraMono", size = 30, text = "FiraMono - DU-style mono sample if available" },
}

setBackgroundColor(0.04, 0.05, 0.08)

local layer = createLayer()
local rx, ry = getResolution()
local y = 42
local margin = 34

setNextFillColor(layer, 0.82, 0.88, 1, 1)
local titleFont = loadFont("Georgia", 64)
addText(layer, titleFont, "Font Examples", margin, y)
y = y + 84

setNextFillColor(layer, 0.5, 0.62, 0.85, 1)
local subtitleFont = loadFont("Arial", 24)
addText(layer, subtitleFont, string.format("Resolution: %dx%d", rx, ry), margin, y)
y = y + 54

for _, sample in ipairs(samples) do
  local font = loadFont(sample.name, sample.size)
  local _, lineHeight = getTextBounds(font, sample.text)

  setNextFillColor(layer, 0.93, 0.95, 1, 1)
  addText(layer, font, sample.text, margin, y)

  y = y + math.max(lineHeight, sample.size) + 24
  if y > ry - 60 then
    break
  end
end
