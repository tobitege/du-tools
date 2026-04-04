FONT_BROWSER_PAGE = FONT_BROWSER_PAGE or 1

local PAGE_SIZE = 7
local SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog 0123456789"

local function clamp(value, minValue, maxValue)
    if value < minValue then
        return minValue
    end
    if value > maxValue then
        return maxValue
    end
    return value
end

local function drawPill(layer, x, y, width, height, color, shadow)
    if shadow then
        setNextShadow(layer, shadow[1], shadow[2], shadow[3], shadow[4], shadow[5])
    end
    setNextStrokeWidth(layer, 0)
    setNextFillColor(layer, color[1], color[2], color[3], color[4])
    addBoxRounded(layer, x, y, width, height, height * 0.5)
end

local function pointInPill(px, py, x, y, width, height)
    if px < x or px > x + width or py < y or py > y + height then
        return false
    end

    local radius = height * 0.5
    if px >= x + radius and px <= x + width - radius then
        return true
    end

    local centerX = x + radius
    if px > x + width * 0.5 then
        centerX = x + width - radius
    end
    local centerY = y + radius
    local dx = px - centerX
    local dy = py - centerY
    return dx * dx + dy * dy <= radius * radius
end

local function findFontName(fontNames, ...)
    local preferred = { ... }
    for preferredIndex = 1, #preferred do
        for fontIndex = 1, #fontNames do
            if fontNames[fontIndex] == preferred[preferredIndex] then
                return preferred[preferredIndex]
            end
        end
    end
    return fontNames[1]
end

local fontCount = getAvailableFontCount()
local fontNames = {}
for index = 1, fontCount do
    fontNames[index] = getAvailableFontName(index)
end

local pageCount = math.max(1, math.ceil(fontCount / PAGE_SIZE))
FONT_BROWSER_PAGE = clamp(FONT_BROWSER_PAGE, 1, pageCount)

local uiFontName = findFontName(fontNames, "Play", "BankGothic", "Montserrat", "FiraMono")
local uiFont = loadFont(uiFontName, 18)
local layer = createLayer()
local rx, ry = getResolution()
local cursorX, cursorY = getCursor()
local cursorReleased = getCursorReleased()
local wheelDelta = 0

if system and type(system.getMouseWheel) == "function" then
    wheelDelta = math.floor(math.max(math.min(-system.getMouseWheel(), 1), -1) + 0.5)
end

if wheelDelta ~= 0 then
    FONT_BROWSER_PAGE = clamp(FONT_BROWSER_PAGE + wheelDelta, 1, pageCount)
end

local visiblePageCount = pageCount

local buttonWidth = 54
local buttonHeight = 20
local buttonGap = 12
local buttonsWidth = visiblePageCount * buttonWidth + math.max(0, visiblePageCount - 1) * buttonGap
local buttonsX = math.floor((rx - buttonsWidth) * 0.5)
local buttonsY = ry - 38
local hoveredPage = nil
local pillPageTarget = nil

for pageIndex = 1, visiblePageCount do
    local buttonX = buttonsX + (pageIndex - 1) * (buttonWidth + buttonGap)
    if pointInPill(cursorX, cursorY, buttonX, buttonsY, buttonWidth, buttonHeight) then
        hoveredPage = pageIndex
        pillPageTarget = pageIndex
    end
end

if cursorReleased then
    if pillPageTarget ~= nil then
        FONT_BROWSER_PAGE = pillPageTarget
    elseif cursorX >= 0 and cursorY >= 0 then
        if cursorX < rx * 0.5 then
            FONT_BROWSER_PAGE = clamp(FONT_BROWSER_PAGE - 1, 1, pageCount)
        else
            FONT_BROWSER_PAGE = clamp(FONT_BROWSER_PAGE + 1, 1, pageCount)
        end
    end
end

local activePage = FONT_BROWSER_PAGE
local startIndex = (activePage - 1) * PAGE_SIZE + 1
local endIndex = math.min(fontCount, startIndex + PAGE_SIZE - 1)

setBackgroundColor(0.05, 0.06, 0.09)

setFontSize(uiFont, 42)
setNextFillColor(layer, 0.92, 0.95, 1, 1)
setNextShadow(layer, 4, 0.02, 0.04, 0.07, 0.55)
addText(layer, uiFont, "Font Catalog", 34, 44)

setFontSize(uiFont, 18)
setNextFillColor(layer, 0.62, 0.72, 0.9, 1)
addText(layer, uiFont, string.format("%d fonts  |  page %d of %d  |  %02d-%02d", fontCount, activePage, pageCount, startIndex, endIndex), 38, 86)

setFontSize(uiFont, 12)
setNextFillColor(layer, 0.56, 0.64, 0.8, 1)
addText(layer, uiFont, "Pills: jump directly", 38, ry - 18)
setNextTextAlign(layer, AlignH_Right, AlignV_Baseline)
addText(layer, uiFont, "Left half: previous  |  Right half: next", rx - 38, ry - 18)
setNextTextAlign(layer, AlignH_Left, AlignV_Baseline)

local rowY = 126
local rowHeight = 63
for listIndex = 0, PAGE_SIZE - 1 do
    local fontIndex = startIndex + listIndex
    if fontIndex > fontCount then
        break
    end

    local fontName = fontNames[fontIndex]
    local sampleFont = loadFont(fontName, 10)
    local blockY = rowY + listIndex * rowHeight

    setFontSize(sampleFont, 23)
    setNextFillColor(layer, 0.94, 0.96, 1, 1)
    addText(layer, sampleFont, string.format("%02d. %s", fontIndex, fontName), 44, blockY)

    setFontSize(sampleFont, 10)
    setNextFillColor(layer, 0.72, 0.8, 0.94, 0.95)
    addText(layer, sampleFont, SAMPLE_TEXT, 72, blockY + 24)

    setNextStrokeColor(layer, 0.15, 0.19, 0.29, 0.65)
    setNextStrokeWidth(layer, 1)
    addLine(layer, 40, blockY + 42, rx - 40, blockY + 42)
end

for pageIndex = 1, visiblePageCount do
    local buttonX = buttonsX + (pageIndex - 1) * (buttonWidth + buttonGap)
    local isActive = pageIndex == activePage
    local isHovered = pageIndex == hoveredPage
    local fill = { 0.17, 0.22, 0.31, 0.78 }
    local label = { 0.72, 0.79, 0.92, 0.95 }
    local stroke = { 0.76, 0.82, 0.92, 0.92 }

    if isActive then
        fill = { 0.9, 0.76, 0.28, 0.95 }
        label = { 0.08, 0.1, 0.14, 1 }
        stroke = { 1, 0.96, 0.84, 0.95 }
    elseif isHovered then
        fill = { 0.3, 0.42, 0.62, 0.92 }
        label = { 0.96, 0.98, 1, 1 }
        stroke = { 0.9, 0.95, 1, 0.95 }
    end

    drawPill(layer, buttonX, buttonsY, buttonWidth, buttonHeight, fill, { 4, 0, 0, 0, 0.24 })
    setNextStrokeWidth(layer, 1)
    setNextStrokeColor(layer, stroke[1], stroke[2], stroke[3], stroke[4])
    setNextFillColor(layer, 0, 0, 0, 0)
    addBoxRounded(layer, buttonX, buttonsY, buttonWidth, buttonHeight, buttonHeight * 0.5)
    setFontSize(uiFont, 12)
    setNextFillColor(layer, label[1], label[2], label[3], label[4])
    setNextTextAlign(layer, AlignH_Center, AlignV_Middle)
    addText(layer, uiFont, tostring(pageIndex), buttonX + buttonWidth * 0.5, buttonsY + buttonHeight * 0.5)
end

requestAnimationFrame(1)
