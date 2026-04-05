# Publishes the base extractor payload plus additive extractor modules to live runtime override paths.
#
# Usage:
#   .\tools\publish-extractor-payload.ps1
#   .\tools\publish-extractor-payload.ps1 -DumpDir "D:\MyDUserver\tmp\ui-dumps"
param(
    [string]$DumpDir = "D:\MyDUserver\tmp\ui-dumps"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))
$payloadFile = Join-Path $repoRoot "payload\ModUiToolbox-payload.js"
$moduleDir = Join-Path $repoRoot "payload\ModUiToolbox-payload.modules"

$overrideRoot = Join-Path $DumpDir "payload-overrides"
$singleOverrideFile = Join-Path $overrideRoot "ModUiToolbox-payload.override.js"
$moduleOverrideDir = Join-Path $overrideRoot "ModUiToolbox-payload.modules"

New-Item -ItemType Directory -Path $overrideRoot -Force | Out-Null
New-Item -ItemType Directory -Path $moduleOverrideDir -Force | Out-Null

Copy-Item -Path $payloadFile -Destination $singleOverrideFile -Force
if (Test-Path $moduleDir) {
    Remove-Item -Path (Join-Path $moduleOverrideDir "*") -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -Path (Join-Path $moduleDir "*") -Destination $moduleOverrideDir -Force
}

Write-Host "Published extractor payload to:"
Write-Host "  $singleOverrideFile"
Write-Host "  $moduleOverrideDir"
