# Builds the monolithic Lua probe payload from ordered module files.
# Why: we keep source maintainable in payload/lua-editor-probe.modules/*
# while still generating one final script for injection compatibility.
#
# Usage:
#   .\tools\build-lua-probe.ps1
#   .\tools\build-lua-probe.ps1 -CheckOnly
#   .\tools\build-lua-probe.ps1 -ModuleDir "<path>" -OutFile "<path>"
#
# Notes:
# - Module order is read from manifest.txt (comments/blank lines ignored).
# - Manifest entries are constrained to the module directory (path escape guard).
# - -CheckOnly exits 0 when up to date, 2 when rebuild is needed.
param(
    [string]$ModuleDir = "",
    [string]$OutFile = "",
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))

if ([string]::IsNullOrWhiteSpace($ModuleDir)) {
    $ModuleDir = Join-Path $repoRoot "payload\lua-editor-probe.modules"
}
if ([string]::IsNullOrWhiteSpace($OutFile)) {
    $OutFile = Join-Path $repoRoot "payload\lua-editor-probe.js"
}

$manifestPath = Join-Path $ModuleDir "manifest.txt"
if (-not (Test-Path $manifestPath)) {
    throw "Manifest not found: $manifestPath"
}

$moduleEntries = New-Object System.Collections.Generic.List[string]
foreach ($rawLine in (Get-Content $manifestPath)) {
    $line = [string]$rawLine
    if ($null -eq $line) {
        continue
    }
    $line = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }
    if ($line.StartsWith("#")) {
        continue
    }
    $moduleEntries.Add($line)
}

if ($moduleEntries.Count -eq 0) {
    throw "No module entries found in $manifestPath"
}

$moduleDirFull = [System.IO.Path]::GetFullPath($ModuleDir)
$builder = New-Object System.Text.StringBuilder

foreach ($entry in $moduleEntries) {
    $candidatePath = Join-Path $ModuleDir $entry
    $fullPath = [System.IO.Path]::GetFullPath($candidatePath)
    if (-not $fullPath.StartsWith($moduleDirFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Manifest entry escapes module directory: $entry"
    }
    if (-not (Test-Path $fullPath)) {
        throw "Module file not found: $fullPath"
    }

    $text = [System.IO.File]::ReadAllText($fullPath, [System.Text.Encoding]::UTF8)
    if ([string]::IsNullOrWhiteSpace($text)) {
        throw "Module file is empty: $fullPath"
    }

    [void]$builder.Append($text)
    if (-not $text.EndsWith("`n")) {
        [void]$builder.Append("`r`n")
    }
}

$composed = $builder.ToString()
$existing = ""
if (Test-Path $OutFile) {
    $existing = [System.IO.File]::ReadAllText($OutFile, [System.Text.Encoding]::UTF8)
}

if ($existing -eq $composed) {
    Write-Host "lua-editor-probe.js is up to date."
    exit 0
}

if ($CheckOnly) {
    Write-Host "lua-editor-probe.js is out of date."
    exit 2
}

[System.IO.File]::WriteAllText($OutFile, $composed, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $OutFile from $($moduleEntries.Count) modules."
