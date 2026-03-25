local SZ = require("lib.SilverZeroRsLib")

local resolutionX, resolutionY = getResolution()
local messageText = "SilverZero's Lab"

local theme = {
    background = { 0.00, 0.00, 0.00, 1.0 },
    primary = { 1.00, 0.00, 0.00, 1.0 },
    highlight = { 0.73, 0.73, 0.73, 1.0 },
    textColor = { 1.00, 1.00, 1.00, 1.0 },
}

local layers = SZ.createLayers("background", "board", "text")
local screenLayout = {
    screenW = resolutionX,
    screenH = resolutionY,
    sourceW = resolutionX,
    sourceH = resolutionY,
    scale = 1,
    x = 0,
    y = 0,
}

setNextFillColor(layers.background, theme.background[1], theme.background[2], theme.background[3], theme.background[4])
addBox(layers.background, 0, 0, resolutionX, resolutionY)
setBackgroundColor(theme.background[1], theme.background[2], theme.background[3], theme.background[4])

SZ.simpleSignBoard(layers.board, screenLayout, {
    x = 0,
    y = 0,
    w = resolutionX,
    h = resolutionY,
}, {
    outlineColor = theme.primary,
    highlightColor = theme.highlight,
    outlineWidth = 0.5,
    highlightWidth = 0.5,
})

local textFont = SZ.font("Georgia", math.floor(math.min(resolutionX * 0.10, resolutionY * 0.28)))
setNextTextAlign(layers.text, AlignH_Center, AlignV_Middle)
setNextFillColor(layers.text, theme.textColor[1], theme.textColor[2], theme.textColor[3], theme.textColor[4])
addText(layers.text, textFont, messageText, resolutionX * 0.5, resolutionY * 0.42)
