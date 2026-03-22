-- DU-Locura-Screens-And-Signs
-- Visit GitHub/LocuraDU For Information / Updates / Downloads
-- Code: GitHub/CredenceHamby & CodePen/PoJzvay
-- Design: GitHub/CredenceHamby & CodePen/PoJzvay
-- Built using the wonderful tools at https://du-lua.dev/
-- Love With Your Heart, Use Your Head For Everything Else - Captain Disillusion
-- Port of the HTML version to RenderScript/Lua for the emulator.

local backgroundImage = loadImage("assets.prod.novaquark.com/130546/9598ee2a-c7bf-433f-8de0-24f033d470f3.png")

local rx, ry = getResolution()
local imageLayer = createLayer()
local textLayer = createLayer()
local needsAnotherFrame = false

setBackgroundColor(0x1A / 255, 0x1F / 255, 0x24 / 255)
setDefaultTextAlign(textLayer, AlignH_Center, AlignV_Middle)

local function drawCoverImage(layer, imageId, x, y, width, height)
  if imageId == 0 then
    return
  end

  if not isImageLoaded(imageId) then
    needsAnotherFrame = true
    return
  end

  local imageW, imageH = getImageSize(imageId)
  if imageW <= 0 or imageH <= 0 then
    return
  end

  local imageAspect = imageW / imageH
  local targetAspect = width / height

  local srcX = 0
  local srcY = 0
  local srcW = imageW
  local srcH = imageH

  if imageAspect > targetAspect then
    srcW = imageH * targetAspect
    srcX = (imageW - srcW) * 0.5
  else
    srcH = imageW / targetAspect
    srcY = (imageH - srcH) * 0.5
  end

  addImageSub(layer, imageId, x, y, width, height, srcX, srcY, srcW, srcH)
end

drawCoverImage(imageLayer, backgroundImage, 0, 0, rx, ry)

local title = "LOCURA"
local titleFont = loadFont("Montserrat-Bold", math.max(80, math.floor(ry * 0.32)))
local maxWidth = rx * 0.92
local maxHeight = ry * 0.62

for _ = 1, 24 do
  local textW, textH = getTextBounds(titleFont, title)
  local currentSize = getFontSize(titleFont)

  if textW > maxWidth or textH > maxHeight then
    setFontSize(titleFont, math.max(64, math.floor(currentSize * 0.94)))
  elseif textW < rx * 0.82 then
    setFontSize(titleFont, math.floor(currentSize * 1.03))
  else
    break
  end
end

setNextFillColor(textLayer, 0xBE / 255, 0xB9 / 255, 0xA3 / 255, 1)
addText(textLayer, titleFont, title, rx * 0.5, ry * 0.5)

if needsAnotherFrame then
  requestAnimationFrame(1)
end
