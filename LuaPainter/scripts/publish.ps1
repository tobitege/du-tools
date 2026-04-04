# Publish Lua Painter as a runtime lua-probe module.
#
# Workflow:
# 1. Build the web bundle (hud-editor-probe.js) and the ingame payload/runtime-module wrapper.
# 2. Copy the generated runtime-module files into ModUiToolbox source.
# 3. Publish the lua probe via ModUiToolbox's canonical publish script.
param(
    [string]$ModUiToolboxDir = "D:\github\du-tobi\ModUiToolbox",
    [string]$DumpDir = "D:\MyDUserver\tmp\ui-dumps"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))

$buildScript = Join-Path $scriptDir "build.ps1"
$buildOutDir = Join-Path $projectDir "build"
$runtimeModuleSrc = Join-Path $buildOutDir "hud-editor-runtime-module.ingame.js"
$runtimeModuleMeta = Join-Path $buildOutDir "hud-editor-runtime-module.ingame.json"
$debugPayload = Join-Path $buildOutDir "hud-editor-probe.ingame.js"

Write-Host "Building web bundle (harness / hud-editor-probe.js)..."
& $buildScript -ProjectDir $projectDir -Target web
if ($LASTEXITCODE -ne 0) {
    throw "Web build failed with exit code $LASTEXITCODE"
}

Write-Host "Building Lua Painter runtime module (ingame)..."
& $buildScript -ProjectDir $projectDir -Target ingame
if ($LASTEXITCODE -ne 0) {
    throw "Build failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path $runtimeModuleSrc)) {
    throw "Runtime module JS not found: $runtimeModuleSrc"
}
if (-not (Test-Path $runtimeModuleMeta)) {
    throw "Runtime module metadata not found: $runtimeModuleMeta"
}

$moduleTargetDir = Join-Path $ModUiToolboxDir "payload\lua-editor-runtime-modules\hud-editor"
New-Item -ItemType Directory -Path $moduleTargetDir -Force | Out-Null

Copy-Item -Path $runtimeModuleSrc -Destination (Join-Path $moduleTargetDir "module.js") -Force
Copy-Item -Path $runtimeModuleMeta -Destination (Join-Path $moduleTargetDir "module.json") -Force

if (Test-Path $debugPayload) {
    Copy-Item -Path $debugPayload -Destination (Join-Path $moduleTargetDir "hud-editor-probe.js") -Force
}

# Clean legacy direct-injection artifacts from earlier experiments.
$overrideRoot = Join-Path $DumpDir "payload-overrides"
$legacyFiles = @(
    (Join-Path $overrideRoot "hud-editor-probe.js"),
    (Join-Path $overrideRoot "combined-probe.js"),
    (Join-Path $overrideRoot "combined-probe.build.json")
)
foreach ($legacyFile in $legacyFiles) {
    if (Test-Path $legacyFile) {
        Remove-Item -Path $legacyFile -Force -ErrorAction SilentlyContinue
    }
}

$canonicalPublish = Join-Path $ModUiToolboxDir "tools\publish-lua-probe.ps1"
if (-not (Test-Path $canonicalPublish)) {
    throw "Canonical lua probe publish script not found: $canonicalPublish"
}

Write-Host "Publishing via ModUiToolbox canonical workflow..."
& $canonicalPublish -DumpDir $DumpDir
if ($LASTEXITCODE -ne 0) {
    throw "ModUiToolbox publish failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Lua Painter runtime module published:"
Write-Host "  $(Join-Path $moduleTargetDir 'module.json')"
Write-Host "  $(Join-Path $moduleTargetDir 'module.js')"
Write-Host "  $(Join-Path $moduleTargetDir 'hud-editor-probe.js')"
