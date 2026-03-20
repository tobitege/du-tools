# Builds the monolithic Lua probe payload from ordered module files.
# Why: we keep source maintainable in payload/lua-editor-probe.modules/*
# while still generating one final script for injection compatibility.
# The outer IIFE + "use strict" are injected here so every module file is valid
# standalone JavaScript (IDE/linter friendly); do not put (function(){...})(); in modules.
# Keep $luaProbeIifePreamble / $luaProbeIifePostamble in sync with ModUIExtractor.cs
# (LuaProbeModulesPreamble / LuaProbeModulesPostamble) for runtime module override injection.
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

$luaProbeIifePreamble = "(function () {`r`n  ""use strict"";`r`n`r`n"
$luaProbeIifePostamble = "`r`n})();"
$composed = $luaProbeIifePreamble + $builder.ToString() + $luaProbeIifePostamble
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$payloadDir = Join-Path $repoRoot "payload"

function Get-LuaProbeContentSha256Hex([string]$Text) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = $utf8NoBom.GetBytes($Text)
    $hashBytes = $sha.ComputeHash($bytes)
    return ([BitConverter]::ToString($hashBytes)).Replace("-", "").ToLowerInvariant()
}

function Write-LuaProbeBuildJson {
    param(
        [string]$ScriptContent,
        [string]$ProbeBuild,
        [string]$PayloadDirectory,
        [string]$ModulesDirectory
    )
    $hashHex = Get-LuaProbeContentSha256Hex $ScriptContent
    $short = if ($hashHex.Length -ge 8) { $hashHex.Substring(0, 8) } else { $hashHex }
    $utc = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
    $obj = [ordered]@{
        probeBuild     = $ProbeBuild
        buildUtc       = $utc
        contentSha256  = $hashHex
        contentSha256Short = $short
    }
    $json = ($obj | ConvertTo-Json -Compress)
    $outPayload = Join-Path $PayloadDirectory "lua-editor-probe.build.json"
    $outMod = Join-Path $ModulesDirectory "lua-editor-probe.build.json"
    [System.IO.File]::WriteAllText($outPayload, $json, $utf8NoBom)
    [System.IO.File]::WriteAllText($outMod, $json, $utf8NoBom)
}

function Sync-LuaProbeBuildMetadata {
    param(
        [string]$ScriptContent,
        [bool]$BundleWasJustWritten
    )
    $hashHex = Get-LuaProbeContentSha256Hex $ScriptContent
    $outPayload = Join-Path $payloadDir "lua-editor-probe.build.json"
    $needsWrite = $BundleWasJustWritten
    if (-not $needsWrite -and (Test-Path $outPayload)) {
        try {
            $prev = Get-Content $outPayload -Raw -Encoding UTF8 | ConvertFrom-Json
            $prevHash = [string]$prev.contentSha256
            if ($prevHash -ne $hashHex) { $needsWrite = $true }
        }
        catch {
            $needsWrite = $true
        }
    }
    elseif (-not (Test-Path $outPayload)) {
        $needsWrite = $true
    }
    if (-not $needsWrite) {
        return
    }
    $probeBuild = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")
    Write-LuaProbeBuildJson -ScriptContent $ScriptContent -ProbeBuild $probeBuild -PayloadDirectory $payloadDir -ModulesDirectory $ModuleDir
}

$existing = ""
if (Test-Path $OutFile) {
    $existing = [System.IO.File]::ReadAllText($OutFile, $utf8NoBom)
}

if ($existing -eq $composed) {
    Write-Host "lua-editor-probe.js is up to date."
    Sync-LuaProbeBuildMetadata -ScriptContent $existing -BundleWasJustWritten $false
    exit 0
}

if ($CheckOnly) {
    Write-Host "lua-editor-probe.js is out of date."
    exit 2
}

[System.IO.File]::WriteAllText($OutFile, $composed, $utf8NoBom)
Sync-LuaProbeBuildMetadata -ScriptContent $composed -BundleWasJustWritten $true
Write-Host "Wrote $OutFile from $($moduleEntries.Count) modules."
