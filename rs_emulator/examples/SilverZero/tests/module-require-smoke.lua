package.path = "../../../?.lua;../../../?/init.lua;" .. package.path

local function check(moduleName, expectedField)
  local ok, value = pcall(require, moduleName)
  if not ok then
    print(string.format('require("%s") failed:', moduleName))
    print(value)
    return false
  end

  print(string.format('require("%s") ok', moduleName))
  print(string.format("type(%s.%s) = %s", moduleName, expectedField, type(value[expectedField])))
  return true
end

local okLib = check("lib.SilverZeroRsLib", "layoutForScreen")
local okParser = check("lib.SvgParser", "parse")
local okClassifier = check("lib.SvgShapeClassifier", "classifyItem")

if okLib and okParser and okClassifier then
  print("module require smoke test passed")
else
  os.exit(1)
end
