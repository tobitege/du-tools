-- DU-Animated-Atom
-- v1.0
-- Port of the original HTML/CSS version to RenderScript/Lua for the emulator.
-- Source: https://github.com/EricHamby/DU-LUA-Scripts

local rx, ry = getResolution()
local t = getTime()

local bgLayer = createLayer()
local orbitBackLayer = createLayer()
local electronBackLayer = createLayer()
local nucleusLayer = createLayer()
local orbitFrontLayer = createLayer()
local electronFrontLayer = createLayer()

local cx = rx * 0.50
local cy = ry * 0.56
local orbitRadiusX = rx * 0.18
local orbitRadiusY = ry * 0.075
local electronRadius = math.min(rx, ry) * 0.018
local nucleusRadius = math.min(rx, ry) * 0.042
local segments = 64
local orbitAngles = {
  math.rad(32),
  math.rad(-32),
}

setBackgroundColor(1, 1, 1)

local gradientSteps = 18
for index = 0, gradientSteps - 1 do
  local ratio = index / math.max(1, gradientSteps - 1)
  local shade = 236 / 255 + (1 - 236 / 255) * ratio
  setNextFillColor(bgLayer, shade, shade, shade, 1)
  addBox(bgLayer, 0, (ry / gradientSteps) * index, rx, (ry / gradientSteps) + 2)
end

local function orbitPoint(rotation, angle)
  local ex = math.cos(angle) * orbitRadiusX
  local ey = math.sin(angle) * orbitRadiusY
  local cosRot = math.cos(rotation)
  local sinRot = math.sin(rotation)
  return cx + ex * cosRot - ey * sinRot, cy + ex * sinRot + ey * cosRot
end

local function drawArc(layer, rotation, startAngle, endAngle, alpha)
  for index = 0, segments - 1 do
    local t0 = index / segments
    local t1 = (index + 1) / segments
    local a0 = startAngle + (endAngle - startAngle) * t0
    local a1 = startAngle + (endAngle - startAngle) * t1
    local x0, y0 = orbitPoint(rotation, a0)
    local x1, y1 = orbitPoint(rotation, a1)
    setNextStrokeColor(layer, 0, 0, 0, alpha)
    setNextStrokeWidth(layer, math.max(2, orbitRadiusY * 0.045))
    addLine(layer, x0, y0, x1, y1)
  end
end

local function drawElectron(layer, rotation, angle, alpha)
  local ex, ey = orbitPoint(rotation, angle)
  setNextShadow(layer, electronRadius * 1.6, 0, 0, 0, alpha * 0.35)
  setNextFillColor(layer, 0, 0, 0, alpha)
  addCircle(layer, ex, ey, electronRadius)
end

for _, rotation in ipairs(orbitAngles) do
  drawArc(orbitBackLayer, rotation, math.pi, math.pi * 2, 0.10)
end

local electronAngleA = t * math.pi * 2
local electronAngleB = electronAngleA + math.pi

if math.sin(electronAngleA) < 0 then
  drawElectron(electronBackLayer, orbitAngles[1], electronAngleA, 0.16)
end
if math.sin(electronAngleB) < 0 then
  drawElectron(electronBackLayer, orbitAngles[2], electronAngleB, 0.16)
end

setNextShadow(nucleusLayer, nucleusRadius * 1.8, 0, 0, 0, 0.14)
setNextFillColor(nucleusLayer, 0, 0, 0, 0.12)
addCircle(nucleusLayer, cx, cy, nucleusRadius * 1.3)

setNextFillColor(nucleusLayer, 0, 0, 0, 0.22)
addCircle(nucleusLayer, cx, cy, nucleusRadius)

setNextFillColor(nucleusLayer, 1, 1, 1, 0.25)
addCircle(nucleusLayer, cx - nucleusRadius * 0.18, cy - nucleusRadius * 0.2, nucleusRadius * 0.28)

for _, rotation in ipairs(orbitAngles) do
  drawArc(orbitFrontLayer, rotation, 0, math.pi, 0.20)
end

if math.sin(electronAngleA) >= 0 then
  drawElectron(electronFrontLayer, orbitAngles[1], electronAngleA, 0.28)
end
if math.sin(electronAngleB) >= 0 then
  drawElectron(electronFrontLayer, orbitAngles[2], electronAngleB, 0.28)
end

requestAnimationFrame(1)
