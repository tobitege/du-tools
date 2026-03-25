-- Extracted/adapted from the programming-board screen payload used by
-- ScreenOutput(...): render lines of text on a linked screen.

local samples = {
  { name = "Montserrat", size = 34, text = "Montserrat - The quick brown fox jumps over the lazy dog 0123456789" },
  { name = "RobotoCondensed", size = 32, text = "RobotoCondensed - Clean UI text and readable labels" },
  { name = "Play", size = 40, text = "Play - Heading sample with crisp display shapes" },
  { name = "Montserrat-Light", size = 40, text = "Montserrat-Light - Lighter body copy sample" },
  { name = "FiraMono", size = 30, text = "FiraMono - Monospace diagnostics and logs" },
  { name = "FiraMono-Bold", size = 30, text = "FiraMono-Bold - DU-style mono emphasis sample" },
}

setBackgroundColor(0.04, 0.05, 0.08)

local layer = createLayer()
local rx, ry = getResolution()
local y = 42
local margin = 34

setNextFillColor(layer, 0.82, 0.88, 1, 1)
local titleFont = loadFont("Play", 64)
addText(layer, titleFont, "Font Examples", margin, y)
y = y + 84

setNextFillColor(layer, 0.5, 0.62, 0.85, 1)
local subtitleFont = loadFont("Montserrat", 24)
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
