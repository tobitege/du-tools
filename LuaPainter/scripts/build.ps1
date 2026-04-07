# Builds the monolithic Lua Painter probe payload from ordered module files.
#
# Why: this project is self-contained in:
#   LuaPainter
#
# Sources live in js/modules/* and the build produces a single:
#   build/lua-painter-probe.js
#
# Usage:
#   .\scripts\build.ps1
#
# Notes:
# - Module order is read from js/manifest.txt (comments/blank lines ignored).
# - CSS is inlined into the final payload so the JS is fully self-contained.
# - Does NOT modify ModUiToolbox at all.
param(
    [string]$ProjectDir = "",
    [ValidateSet("web", "ingame")]
    [string]$Target = "web"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if ([string]::IsNullOrWhiteSpace($ProjectDir)) {
    # Default: project dir is parent of scripts/ folder
    $ProjectDir = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))
}

$moduleDir = Join-Path $ProjectDir "js\modules"
$manifestName = if ($Target -eq "ingame") { "manifest.ingame.txt" } else { "manifest.txt" }
$manifestPath = Join-Path $ProjectDir ("js\" + $manifestName)
$cssPath = Join-Path $ProjectDir "js\assets\lua-painter.css"
$outDir = Join-Path $ProjectDir "build"
$artifactSuffix = if ($Target -eq "ingame") { ".ingame" } else { "" }
$outFile = Join-Path $outDir ("lua-painter-probe" + $artifactSuffix + ".js")
$runtimeModuleJsFile = Join-Path $outDir ("lua-painter-runtime-module" + $artifactSuffix + ".js")
$runtimeModuleJsonFile = Join-Path $outDir ("lua-painter-runtime-module" + $artifactSuffix + ".json")

# Validate paths
if (-not (Test-Path $manifestPath)) {
    throw "Manifest not found: $manifestPath"
}

if (-not (Test-Path $moduleDir)) {
    throw "Module directory not found: $moduleDir"
}

# Ensure output directory exists
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

# Read manifest
$moduleEntries = New-Object System.Collections.Generic.List[string]
foreach ($rawLine in (Get-Content $manifestPath)) {
    $line = [string]$rawLine
    if ($null -eq $line) { continue }
    $line = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line.StartsWith("#")) { continue }
    $moduleEntries.Add($line)
}

if ($moduleEntries.Count -eq 0) {
    throw "No module entries found in $manifestPath"
}

$moduleDirFull = [System.IO.Path]::GetFullPath($moduleDir)
$builder = New-Object System.Text.StringBuilder

# Add CSS injection (inline)
$cssContent = ""
if (Test-Path $cssPath) {
    $cssContent = [System.IO.File]::ReadAllText($cssPath, [System.Text.Encoding]::UTF8)
}

# Escape CSS for embedding in JS string
$cssEscaped = $cssContent -replace '\\', '\\\\' -replace '"', '\"' -replace "`r", '' -replace "`n", '\n'
$cssJsBlock = @"
// Inlined CSS
(function injectCSS() {
  var existing = document.getElementById('lua-painter-styles');
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
  var style = document.createElement('style');
  style.id = 'lua-painter-styles';
  style.textContent = "$cssEscaped";
  document.head.appendChild(style);
})();

"@

[void]$builder.Append($cssJsBlock)

# Read and concatenate modules
foreach ($entry in $moduleEntries) {
    $candidatePath = Join-Path $moduleDir $entry
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

    $lineComment = "// --- $entry ---"
    [void]$builder.Append($lineComment)
    [void]$builder.Append("`r`n")
    [void]$builder.Append($text)
    if (-not $text.EndsWith("`n")) {
        [void]$builder.Append("`r`n")
    }
    [void]$builder.Append("`r`n")
}

# No outer wrapper - modules are already IIFEs, just concatenate them
$timestamp = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
$composed = "// Lua Painter Probe`r`n// Project: $ProjectDir`r`n// Built: $timestamp`r`n`r`n" + $builder.ToString()

$sourceBase64 = [Convert]::ToBase64String(([System.Text.UTF8Encoding]::new($false)).GetBytes($composed))
$runtimeModuleSource = @"
(function (ctx) {
  var sourceBase64 = "$sourceBase64";

  function decodeBase64Utf8(value) {
    var binary = window.atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (typeof window.TextDecoder === "function") {
      return new window.TextDecoder("utf-8").decode(bytes);
    }
    var fallback = "";
    for (var j = 0; j < bytes.length; j += 1) {
      fallback += String.fromCharCode(bytes[j]);
    }
    return fallback;
  }

  function safeDestroy(reason) {
    try {
      if (window.HudEditor && typeof window.HudEditor.destroy === "function") {
        window.HudEditor.destroy(reason || "runtime-module");
      }
    } catch (_ignoreHudDestroy) {}
    try {
      delete window.__HUD_EDITOR_RUNTIME_CTX__;
    } catch (_ignoreHudCtx) {}
  }

  function safeCloseUi(reason) {
    try {
      if (window.HudEditor && typeof window.HudEditor.closeShapeMenu === "function") {
        window.HudEditor.closeShapeMenu();
      }
    } catch (_ignoreHudCloseMenu) {}
    try {
      if (window.HudEditor && typeof window.HudEditor.closeUi === "function") {
        return window.HudEditor.closeUi(reason || "runtime-module-close-ui");
      }
      if (window.HudEditor && typeof window.HudEditor.goToStart === "function") {
        window.HudEditor.goToStart();
      }
      if (window.HudEditor && typeof window.HudEditor.exitEditMode === "function") {
        window.HudEditor.exitEditMode();
      }
      if (window.HudEditor && typeof window.HudEditor.updateToggleButton === "function") {
        window.HudEditor.updateToggleButton();
      }
    } catch (_ignoreHudCloseUi) {}
    return { closed: false };
  }

  return {
    install: function () {
      safeDestroy("runtime-module-reinstall");
      window.__HUD_EDITOR_RUNTIME_CTX__ = ctx || null;
      var source = decodeBase64Utf8(sourceBase64);
      (0, eval)(source);
    },
    closeUi: function (reason) {
      return safeCloseUi(reason || "runtime-module-close-ui");
    },
    uninstall: function () {
      safeDestroy("runtime-module-disable");
    }
  };
})
"@

$runtimeModuleJson = @{
    id = "lua-painter"
    name = "Lua Painter"
    description = "Lua Painter HUD layout editor"
    version = "0.1.0"
    order = 200
    defaultEnabled = $false
    entry = "module.js"
    config = @{}
} | ConvertTo-Json -Depth 6

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

# Check if content changed
$existing = ""
$existingRuntimeModule = ""
$existingRuntimeModuleJson = ""
if (Test-Path $outFile) {
    $existing = [System.IO.File]::ReadAllText($outFile, $utf8NoBom)
}
if (Test-Path $runtimeModuleJsFile) {
    $existingRuntimeModule = [System.IO.File]::ReadAllText($runtimeModuleJsFile, $utf8NoBom)
}
if (Test-Path $runtimeModuleJsonFile) {
    $existingRuntimeModuleJson = [System.IO.File]::ReadAllText($runtimeModuleJsonFile, $utf8NoBom)
}

if ($existing -eq $composed -and $existingRuntimeModule -eq $runtimeModuleSource -and $existingRuntimeModuleJson -eq $runtimeModuleJson) {
    Write-Host "lua-painter-probe ($Target) is up to date."
    exit 0
}

# Write output
[System.IO.File]::WriteAllText($outFile, $composed, $utf8NoBom)
[System.IO.File]::WriteAllText($runtimeModuleJsFile, $runtimeModuleSource, $utf8NoBom)
[System.IO.File]::WriteAllText($runtimeModuleJsonFile, $runtimeModuleJson, $utf8NoBom)

# Build metadata
function Get-ContentSha256Hex([string]$Text) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = $utf8NoBom.GetBytes($Text)
    $hashBytes = $sha.ComputeHash($bytes)
    return ([BitConverter]::ToString($hashBytes)).Replace("-", "").ToLowerInvariant()
}

$hashHex = Get-ContentSha256Hex $composed
$short = if ($hashHex.Length -ge 8) { $hashHex.Substring(0, 8) } else { $hashHex }
$buildUtc = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
$buildMeta = [ordered]@{
    project        = "lua-painter"
    buildUtc       = $buildUtc
    contentSha256  = $hashHex
    contentSha256Short = $short
    moduleCount    = $moduleEntries.Count
}
$metaJson = ($buildMeta | ConvertTo-Json -Compress)
$metaFile = Join-Path $outDir ("lua-painter-probe" + $artifactSuffix + ".build.json")
[System.IO.File]::WriteAllText($metaFile, $metaJson, $utf8NoBom)

Write-Host "lua-painter-probe ($Target) built from $($moduleEntries.Count) modules."
Write-Host "  SHA256: $short"
Write-Host "  Output: $outFile"
Write-Host "  Module: $runtimeModuleJsFile"
Write-Host "  Module Meta: $runtimeModuleJsonFile"
Write-Host "  Meta:   $metaFile"
