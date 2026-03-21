local RenderScript = require("RenderScript")
local render = RenderScript.Instance()

local layer = render.CreateLayer()
local font = render.LoadFont("Arial", 28)
local bounds = render.GetTextBounds(font, "Wrapper OK")

render.SetBackgroundColor(0.04, 0.06, 0.09)
render.SetDefaultFillColor(layer, RSShape.Box, 0.14, 0.18, 0.24, 1)
render.AddBox(layer, 96, 120, bounds.x + 96, bounds.y + 88)

render.SetNextFillColor(layer, 0.92, 0.95, 1, 1)
render.AddText(layer, font, "Wrapper OK", 144, 176)

render.SetNextFillColor(layer, 0.35, 0.78, 0.98, 1)
render.AddCircle(layer, 144 + bounds.x, 168, 18)

render.Log("RenderScript.Instance() example executed")
