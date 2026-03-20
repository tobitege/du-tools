# Composes and publishes the Lua probe to live runtime override paths.
# Why: one command to keep both override modes in sync:
# 1) single-file override (lua-editor-probe.override.js)
# 2) module override directory (lua-editor-probe.modules/* + manifest)
#
# Usage:
#   .\tools\publish-lua-probe.ps1
#   .\tools\publish-lua-probe.ps1 -DumpDir "D:\MyDUserver\tmp\ui-dumps"
#
# Notes:
# - Calls build-lua-probe.ps1 first, so payload/lua-editor-probe.js is current.
# - Safe to rerun; files are overwritten in place.
param(
    [string]$DumpDir = "D:\MyDUserver\tmp\ui-dumps"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))
$buildScript = Join-Path $scriptDir "build-lua-probe.ps1"
$moduleDir = Join-Path $repoRoot "payload\lua-editor-probe.modules"
$payloadFile = Join-Path $repoRoot "payload\lua-editor-probe.js"
$buildStampFile = Join-Path $repoRoot "payload\lua-editor-probe.build.json"

& $buildScript -ModuleDir $moduleDir -OutFile $payloadFile

$overrideRoot = Join-Path $DumpDir "payload-overrides"
$moduleOverrideDir = Join-Path $overrideRoot "lua-editor-probe.modules"
$singleOverrideFile = Join-Path $overrideRoot "lua-editor-probe.override.js"
$overrideBuildStamp = Join-Path $overrideRoot "lua-editor-probe.build.json"

New-Item -ItemType Directory -Path $overrideRoot -Force | Out-Null
New-Item -ItemType Directory -Path $moduleOverrideDir -Force | Out-Null

Copy-Item -Path $payloadFile -Destination $singleOverrideFile -Force
if (Test-Path $buildStampFile) {
    Copy-Item -Path $buildStampFile -Destination $overrideBuildStamp -Force
}
Copy-Item -Path (Join-Path $moduleDir "*") -Destination $moduleOverrideDir -Force

Write-Host "Published lua probe to:"
Write-Host "  $singleOverrideFile"
Write-Host "  $overrideBuildStamp (build stamp for chat line)"
Write-Host "  $moduleOverrideDir"
