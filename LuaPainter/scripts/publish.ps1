# Publish Lua Painter as a runtime lua-probe module.
#
# Workflow:
# 1. Build the web bundle (lua-painter-probe.js) and the ingame payload/runtime-module wrapper.
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
$runtimeModuleSrc = Join-Path $buildOutDir "lua-painter-runtime-module.ingame.js"
$runtimeModuleMeta = Join-Path $buildOutDir "lua-painter-runtime-module.ingame.json"
$debugPayload = Join-Path $buildOutDir "lua-painter-probe.ingame.js"

function Invoke-CheckedPowerShellScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScriptPath,
        [Parameter(Mandatory = $true)]
        [string]$FailureMessage,
        [Parameter()]
        [hashtable]$Parameters = @{}
    )

    $global:LASTEXITCODE = 0
    & $ScriptPath @Parameters
    if (-not $?) {
        throw $FailureMessage
    }
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage with exit code $LASTEXITCODE"
    }
}

Write-Host "Building web bundle (harness / lua-painter-probe.js)..."
Invoke-CheckedPowerShellScript -ScriptPath $buildScript -FailureMessage "Web build failed" -Parameters @{
    ProjectDir = $projectDir
    Target = "web"
}

Write-Host "Building Lua Painter runtime module (ingame)..."
Invoke-CheckedPowerShellScript -ScriptPath $buildScript -FailureMessage "Build failed" -Parameters @{
    ProjectDir = $projectDir
    Target = "ingame"
}

if (-not (Test-Path $runtimeModuleSrc)) {
    throw "Runtime module JS not found: $runtimeModuleSrc"
}
if (-not (Test-Path $runtimeModuleMeta)) {
    throw "Runtime module metadata not found: $runtimeModuleMeta"
}

$moduleTargetDir = Join-Path $ModUiToolboxDir "payload\lua-editor-runtime-modules\lua-painter"
New-Item -ItemType Directory -Path $moduleTargetDir -Force | Out-Null

Copy-Item -Path $runtimeModuleSrc -Destination (Join-Path $moduleTargetDir "module.js") -Force
Copy-Item -Path $runtimeModuleMeta -Destination (Join-Path $moduleTargetDir "module.json") -Force

if (Test-Path $debugPayload) {
    Copy-Item -Path $debugPayload -Destination (Join-Path $moduleTargetDir "lua-painter-probe.js") -Force
}

# Clean legacy direct-injection artifacts from earlier experiments.
$overrideRoot = Join-Path $DumpDir "payload-overrides"
$legacyFiles = @(
    (Join-Path $overrideRoot "lua-painter-probe.js"),
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
Invoke-CheckedPowerShellScript -ScriptPath $canonicalPublish -FailureMessage "ModUiToolbox publish failed" -Parameters @{
    DumpDir = $DumpDir
}

Write-Host ""
Write-Host "Lua Painter runtime module published:"
Write-Host "  $(Join-Path $moduleTargetDir 'module.json')"
Write-Host "  $(Join-Path $moduleTargetDir 'module.js')"
Write-Host "  $(Join-Path $moduleTargetDir 'lua-painter-probe.js')"
