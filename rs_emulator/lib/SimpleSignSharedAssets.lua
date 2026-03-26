local vars = require("lib.SimpleSignSharedVars")

local M = {}

local function getCache()
  simpleSignSharedAssetsCache = simpleSignSharedAssetsCache or {
    vars = vars,
    stage = 0,
    ready = false,
  }

  if simpleSignSharedAssetsCache.vars == nil then
    simpleSignSharedAssetsCache.vars = vars
  end

  return simpleSignSharedAssetsCache
end

function M.prepareStep()
  local cache = getCache()
  if cache.ready then
    return cache, true
  end

  local stage = cache.stage or 0
  if stage == 0 then
    local prepared = require("lib.SimpleSignMasterPrepared")
    cache.masterSvg = prepared.svg
    cache.masterShapes = prepared.shapes
    cache.masterColors = prepared.colors
    cache.stage = 1
    return cache, false
  end
  if stage == 1 then
    local prepared = require("lib.SimpleSignBoardPrepared")
    cache.boardSvg = prepared.svg
    cache.boardShapes = prepared.shapes
    cache.boardColors = prepared.colors
    cache.stage = 2
    return cache, false
  end
  local prepared = require("lib.SimpleSignLogoPrepared")
  cache.logoSvg = prepared.svg
  cache.logoShapes = prepared.shapes
  cache.logoColors = prepared.colors
  cache.ready = true
  cache.stage = 3
  return cache, true
end

function M.get()
  local cache, ready = M.prepareStep()
  while not ready do
    cache, ready = M.prepareStep()
  end
  return cache
end

return M
