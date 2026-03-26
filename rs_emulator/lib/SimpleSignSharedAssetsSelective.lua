local vars = require("lib.SimpleSignSharedVars")

local M = {}

local function getCache()
  simpleSignSharedAssetsSelectiveCache = simpleSignSharedAssetsSelectiveCache or {
    vars = vars,
  }

  return simpleSignSharedAssetsSelectiveCache
end

function M.prepareStep(options)
  local cache = getCache()
  options = options or {}

  if options.master and cache.masterSvg == nil then
    local prepared = require("lib.SimpleSignMasterPrepared")
    cache.masterSvg = prepared.svg
    cache.masterShapes = prepared.shapes
    cache.masterColors = prepared.colors
    return cache, false
  end

  if options.board and cache.boardSvg == nil then
    local prepared = require("lib.SimpleSignBoardPrepared")
    cache.boardSvg = prepared.svg
    cache.boardShapes = prepared.shapes
    cache.boardColors = prepared.colors
    return cache, false
  end

  if options.logo and cache.logoSvg == nil then
    local prepared = require("lib.SimpleSignLogoPrepared")
    cache.logoSvg = prepared.svg
    cache.logoShapes = prepared.shapes
    cache.logoColors = prepared.colors
    return cache, false
  end

  return cache, true
end

function M.get(options)
  local cache, ready = M.prepareStep(options)
  while not ready do
    cache, ready = M.prepareStep(options)
  end
  return cache
end

return M
