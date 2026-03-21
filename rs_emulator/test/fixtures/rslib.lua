local rslib = {}

function rslib.drawRenderCost()
  local rx, ry = getResolution()
  local layer = createLayer()
  local font = loadFont("FiraMono-Bold", 16)
  local rc, rcm = getRenderCost(), getRenderCostMax()
  setNextFillColor(layer, 1, 1, 1, 1)
  setNextTextAlign(layer, AlignH_Left, AlignV_Descender)
  addText(layer, font, string.format("render cost: %d / %d", rc, rcm), 16, ry - 8)
end

function rslib.print(...)
  local args = { ... }
  local strs = {}
  for i, arg in ipairs(args) do
    strs[i] = tostring(arg)
  end
  logMessage(table.concat(strs, "\t"))
end

return rslib
