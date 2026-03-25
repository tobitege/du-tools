-- RenderScript Emulator example
-- Tries to use vanilla Dual Universe rslib when available.
-- Globals intentionally persist between frames/reruns.

local ok, rslib = pcall(require, "rslib")

local function clamp(value, low, high)
  if value < low then
    return low
  end
  if value > high then
    return high
  end
  return value
end

frame = (frame or 0) + 1
spin = (spin or 0) + 0.045
pulse = (pulse or 0) + 0.09

local rx, ry = getResolution()
local centerX, centerY = rx / 2, ry / 2

setBackgroundColor(0.05, 0.06, 0.1)

local bg = createLayer()
local scene = createLayer()
local fx = createLayer()
local ui = createLayer()

titleFont = titleFont or loadFont("Play", 34)
bodyFont = bodyFont or loadFont("Montserrat", 18)
monoFont = monoFont or loadFont("FiraMono", 14)

local titleSize = clamp(34 + math.sin(pulse * 0.6) * 5, 28, 40)
local bodySize = clamp(18 + math.cos(pulse * 0.5) * 2, 16, 22)
local monoSize = clamp(14 + math.sin(pulse * 1.1) * 1.5, 12, 16)

setFontSize(titleFont, titleSize)
setFontSize(bodyFont, bodySize)
setFontSize(monoFont, monoSize)

setDefaultStrokeWidth(scene, Shape_Line, 3)
setDefaultStrokeColor(scene, Shape_Line, 0.85, 0.9, 1.0, 0.65)
setDefaultFillColor(scene, Shape_Polygon, 0.2, 0.75, 0.95, 0.18)
setDefaultStrokeColor(scene, Shape_Polygon, 0.5, 0.9, 1.0, 0.9)
setDefaultStrokeWidth(scene, Shape_Polygon, 2)
setDefaultFillColor(scene, Shape_BoxRounded, 0.12, 0.18, 0.28, 0.95)
setDefaultStrokeColor(scene, Shape_BoxRounded, 0.45, 0.75, 0.98, 1)
setDefaultStrokeWidth(scene, Shape_BoxRounded, 2)
setDefaultTextAlign(ui, AlignH_Left, AlignV_Baseline)

for i = 0, 7 do
  local x = i * (rx / 8)
  setNextStrokeColor(bg, 0.2 + i * 0.07, 0.35, 0.55 + i * 0.04, 0.22)
  setNextStrokeWidth(bg, 1)
  addLine(bg, x, 0, x, ry)
end

for i = 0, 7 do
  local y = i * (ry / 8)
  setNextStrokeColor(bg, 0.18, 0.32 + i * 0.04, 0.55, 0.18)
  setNextStrokeWidth(bg, 1)
  addLine(bg, 0, y, rx, y)
end

local orbit = 170 + math.sin(pulse) * 36
local orbX = centerX + math.cos(spin) * orbit
local orbY = centerY + math.sin(spin * 1.3) * 110

setLayerOrigin(scene, centerX, centerY)
setLayerRotation(scene, math.sin(spin * 0.6) * 0.12)

setNextFillColor(scene, 0.12, 0.16, 0.24, 0.92)
addBoxRounded(scene, centerX - 250, centerY - 170, 500, 340, 28)

setNextStrokeColor(scene, 0.3, 0.85, 1, 0.9)
setNextStrokeWidth(scene, 4)
addBezier(scene, centerX - 220, centerY + 70, centerX - 40, centerY - 160, centerX + 180, centerY + 30)

setNextFillColor(scene, 0.18, 0.7, 0.96, 0.22)
setNextStrokeColor(scene, 0.5, 0.92, 1.0, 0.95)
setNextStrokeWidth(scene, 2)
addQuad(scene, centerX - 170, centerY + 40, centerX - 40, centerY - 130, centerX + 110, centerY - 70, centerX + 30, centerY + 90)

setNextFillColor(scene, 0.95, 0.42, 0.3, 0.85)
addTriangle(scene, centerX + 120, centerY + 120, centerX + 210, centerY + 10, centerX + 260, centerY + 140)

setNextFillColor(scene, 0.98, 0.84, 0.24, 1)
addCircle(scene, orbX, orbY, 20 + math.sin(pulse * 1.8) * 6)

setNextStrokeColor(scene, 0.98, 0.84, 0.24, 0.55)
setNextStrokeWidth(scene, 2)
addLine(scene, centerX, centerY, orbX, orbY)

setLayerClipRect(fx, centerX - 210, centerY - 110, 420, 220)
setLayerOrigin(fx, centerX, centerY)
setLayerRotation(fx, -spin * 0.75)
setLayerScale(fx, 1 + math.sin(pulse) * 0.08, 1)

for i = 0, 5 do
  local alpha = 0.1 + i * 0.06
  local radius = 34 + i * 22
  setNextFillColor(fx, 0.25, 0.75, 1, alpha)
  addCircle(fx, centerX, centerY, radius)
end

local titleText = ok and "rslib test scene" or "RenderScript test scene"
local titleW, titleH = getTextBounds(titleFont, titleText)
local titleX = clamp(48 + math.sin(spin * 0.75) * 42, 32, rx - titleW - 32)
local titleY = clamp(72 + math.cos(spin * 0.45) * 10, titleH + 12, centerY - 170)

setNextFillColor(ui, 0.88 + math.sin(pulse) * 0.08, 0.9 + math.sin(pulse * 0.6) * 0.05, 1, 1)
addText(ui, titleFont, titleText, titleX, titleY)

local frameText = string.format("frame %d  spin %.2f", frame, spin)
local frameW = getTextBounds(bodyFont, frameText)
local frameX = clamp(48 + math.sin(spin * 0.55 + 0.8) * 28, 32, rx - frameW - 32)
local frameY = clamp(106 + math.sin(spin * 0.9) * 10, titleY + 26, centerY - 130)

setNextFillColor(ui, 0.72, 0.8 + math.sin(pulse * 0.7) * 0.08, 0.9 + math.cos(pulse * 0.5) * 0.06, 1)
addText(ui, bodyFont, frameText, frameX, frameY)

local statusText = ok and "rslib loaded via require(\"rslib\")" or "rslib not found - set DU_LUA_ROOT in .env.local"
local statusW = getTextBounds(bodyFont, statusText)
local statusX = clamp(48 + math.cos(spin * 0.65) * 24, 32, rx - statusW - 32)
local statusY = clamp(136 + math.sin(spin * 0.85 + 0.7) * 12, frameY + 24, centerY - 90)

setNextFillColor(ui, ok and 0.45 or 1, ok and 0.95 or 0.55, ok and 0.65 or 0.4, 1)
addText(ui, bodyFont, statusText, statusX, statusY)

local orbitText = ok and "text rail online" or "waiting for DU include path"
local orbitW, orbitH = getTextBounds(bodyFont, orbitText)
local orbitTextX = centerX + math.cos(spin * 0.82) * 320
local orbitTextY = centerY + math.sin(spin * 1.14) * 220
orbitTextX = clamp(orbitTextX, orbitW * 0.5 + 28, rx - orbitW * 0.5 - 28)
orbitTextY = clamp(orbitTextY, orbitH * 0.5 + 28, ry - orbitH * 0.5 - 48)

setNextTextAlign(ui, AlignH_Center, AlignV_Middle)
setNextFillColor(ui, 0.35 + math.sin(pulse * 1.7) * 0.15, 0.82, 1, 0.95)
addText(ui, bodyFont, orbitText, orbitTextX, orbitTextY)

local pulseText = string.format("pulse %.2f", math.sin(pulse))
local pulseW, pulseH = getTextBounds(monoFont, pulseText)
local pulseTextX = clamp(orbX + math.cos(pulse * 1.3) * 130, pulseW * 0.5 + 28, rx - pulseW * 0.5 - 28)
local pulseTextY = clamp(orbY - 92 + math.sin(pulse * 1.6) * 42, pulseH * 0.5 + 28, ry - pulseH * 0.5 - 48)

setNextTextAlign(ui, AlignH_Center, AlignV_Middle)
setNextFillColor(ui, 1, 0.82 + math.sin(pulse * 2.2) * 0.12, 0.32 + math.cos(pulse) * 0.08, 1)
addText(ui, monoFont, pulseText, pulseTextX, pulseTextY)

local footerText = "Commands: boxRounded, circle, line, triangle, quad, bezier, clip, layer rotation, text"
local footerW = getTextBounds(monoFont, footerText)
local footerX = clamp(48 + math.sin(spin * 0.42) * 18, 28, rx - footerW - 28)
local footerY = clamp(ry - 54 + math.sin(pulse * 0.9) * 5, ry - 72, ry - 34)

setNextTextAlign(ui, AlignH_Left, AlignV_Descender)
setNextFillColor(ui, 0.78 + math.sin(pulse * 0.8) * 0.08, 0.88, 1, 0.95)
addText(ui, monoFont, footerText, footerX, footerY)

if ok then
  rslib.drawRenderCost()
  rslib.print("rslib active", "frame", frame)
end

requestAnimationFrame(1)
