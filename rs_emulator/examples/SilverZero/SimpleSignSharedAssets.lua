local SvgParser = require("lib.SvgParser")
local SvgShapeClassifier = require("lib.SvgShapeClassifier")

local vars = require("examples.SilverZero.SimpleSignSharedVars")
local masterArtboardSvg = require("examples.SilverZero.SimpleSignMasterArtboardSvg")
local boardSvg = require("examples.SilverZero.SimpleSignBoardSvg")
local logoSvg = require("examples.SilverZero.SimpleSignLogoSvg")

local M = {}

local function parseSingleSvg(source, label)
  local doc = SvgParser.parse(source)
  local svgEntry = doc and doc.svgs and doc.svgs[1] or nil
  if not svgEntry then
    error("Failed to parse shared SimpleSign asset: " .. label)
  end
  return svgEntry
end

function M.get()
  _G.__simpleSignSharedAssets = _G.__simpleSignSharedAssets or {}
  local cache = _G.__simpleSignSharedAssets

  if not cache.masterSvg then
    cache.vars = vars

    cache.masterSvg = parseSingleSvg(masterArtboardSvg, "master-artboard")
    cache.boardSvg = parseSingleSvg(boardSvg, "board")
    cache.logoSvg = parseSingleSvg(logoSvg, "logo")

    cache.masterShapes = SvgShapeClassifier.classifySvg(cache.masterSvg, {
      vars = cache.vars,
    })
    cache.boardShapes = SvgShapeClassifier.classifySvg(cache.boardSvg, {
      vars = cache.vars,
    })
    cache.logoShapes = SvgShapeClassifier.classifySvg(cache.logoSvg, {
      vars = cache.vars,
    })
  end

  return cache
end

return M
