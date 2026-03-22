-- RenderScript Emulator example
-- Tries to use vanilla Dual Universe rslib when available.
-- Globals intentionally persist between frames/reruns.

local ok, rslib = pcall(require, "rslib")

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

local titleFont = loadFont("Play-Bold", 34)
local bodyFont = loadFont("Montserrat", 18)
local monoFont = loadFont("FiraMono-Bold", 14)

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

setNextFillColor(ui, 0.95, 0.97, 1, 1)
addText(ui, titleFont, ok and "rslib test scene" or "RenderScript test scene", 48, 72)

setNextFillColor(ui, 0.72, 0.8, 0.9, 1)
addText(ui, bodyFont, string.format("frame %d  spin %.2f", frame, spin), 48, 106)

setNextFillColor(ui, ok and 0.4 or 1, ok and 0.92 or 0.45, ok and 0.6 or 0.35, 1)
addText(ui, bodyFont, ok and "rslib loaded via require(\"rslib\")" or "rslib not found - set DU_LUA_ROOT in .env.local", 48, 136)

setNextFillColor(ui, 0.8, 0.88, 1, 0.95)
addText(ui, monoFont, "Commands: boxRounded, circle, line, triangle, quad, bezier, clip, layer rotation, text", 48, ry - 54)

if ok then
  rslib.drawRenderCost()
  rslib.print("rslib active", "frame", frame)
end

requestAnimationFrame(1)
