param(
    [string]$LuaExe = "C:\lua\5.1\lua.exe"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LuaExe)) {
    throw "Lua executable not found: $LuaExe"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$tempLua = Join-Path $env:TEMP "du-tobi-screenlayouteditor-offline.lua"

$lua = @'
dofile("ScreenLayoutEditor.lua")
local mod = SCREEN_LAYOUT_EDITOR_MODULE
if type(mod) ~= "table" then
  error("SCREEN_LAYOUT_EDITOR_MODULE missing")
end

local function printKV(key, value)
  io.write(key .. "=" .. tostring(value) .. "\n")
end

local state = mod.createState(1920, 1080)
printKV("empty_env_len", #mod.getOutputEnvelope(state))

mod.commitDocument(state)
local env = mod.getOutputEnvelope(state)
printKV("default_env_len", #env)
printKV("default_patch_len", #mod.serializeLayoutPatch(state.document))

local canvas = mod.findElement(state.document, "main_canvas")
canvas.x = 279
canvas.y = 139
canvas.w = 583
canvas.h = 332
state.documentDirty = true
mod.commitDocument(state)

local movedPatch = mod.serializeLayoutPatch(state.document)
local movedDoc, movedErr = mod.deserializeLayoutPatch(movedPatch, 1920, 1080)
if not movedDoc then
  error("deserializeLayoutPatch failed: " .. tostring(movedErr))
end

local movedCanvas = mod.findElement(movedDoc, "main_canvas")
local record = mod.buildPersistenceRecord(movedDoc, 50000)
local delta = mod.serializeTransportDelta(state.document, "main_canvas", 1920, 1080)
local deltaRev, deltaId, dx, dy, dw, dh = delta:match("^d|([^|]+)|([^|]+)|([^|]+)|([^|]+)|([^|]+)|([^|]+)|")
if not deltaRev then
  error("serializeTransportDelta did not produce delta transport")
end
if deltaId ~= "main_canvas" then
  error("delta transport does not use stable element id: " .. tostring(deltaId))
end
printKV("moved_env_len", #mod.getOutputEnvelope(state))
printKV("moved_patch_len", #movedPatch)
printKV("record_len", record.length)
printKV("record_fits", tostring(record.fits))
printKV("record_has_sx", tostring(record.text:find('"sx":"') ~= nil))
printKV("record_has_sy", tostring(record.text:find('"sy":"') ~= nil))
printKV("record_has_si", tostring(record.text:find('"si":"main_canvas"') ~= nil))
printKV("delta_rev", deltaRev)
printKV("delta_id", deltaId)
printKV("delta_rect", table.concat({dx, dy, dw, dh}, ","))
printKV("canvas", string.format("%d,%d,%d,%d", movedCanvas.x, movedCanvas.y, movedCanvas.w, movedCanvas.h))
printKV("output", mod.getOutputEnvelope(state))
'@

Set-Content -LiteralPath $tempLua -Value $lua -Encoding utf8
try {
    Push-Location $repoRoot
    & $LuaExe $tempLua
}
finally {
    Pop-Location
    Remove-Item -LiteralPath $tempLua -ErrorAction SilentlyContinue
}
