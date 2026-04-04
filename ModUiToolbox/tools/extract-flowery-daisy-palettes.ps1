param(
    [string]$SourceDir = "D:\github\Flowery.NET\Flowery.NET\Themes\Palettes",
    [string]$OutFile = "",
    [switch]$PassThru
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))

if ([string]::IsNullOrWhiteSpace($OutFile)) {
    $OutFile = Join-Path $repoRoot "payload\theme-imports\flowery-daisy-palettes.compact.json"
}

function Get-ColorMap {
    param([string]$Path)

    [xml]$xml = Get-Content -LiteralPath $Path -Raw
    $map = [ordered]@{}
    foreach ($node in $xml.ResourceDictionary.Color) {
        if ($null -eq $node) {
            continue
        }
        $key = [string]$node.'x:Key'
        if ([string]::IsNullOrWhiteSpace($key)) {
            $key = [string]$node.Key
        }
        $value = [string]$node.InnerText
        if (-not [string]::IsNullOrWhiteSpace($key) -and -not [string]::IsNullOrWhiteSpace($value)) {
            $map[$key] = $value.Trim().ToUpperInvariant()
        }
    }
    return $map
}

function Get-ThemeLabel {
    param([string]$BaseName)

    $label = $BaseName -replace '^Daisy', ''
    if ([string]::IsNullOrWhiteSpace($label)) {
        return $BaseName
    }
    return "Daisy $label"
}

function Get-ThemeSlug {
    param([string]$BaseName)

    $tail = ($BaseName -replace '^Daisy', '')
    if ([string]::IsNullOrWhiteSpace($tail)) {
        return "daisy"
    }
    return ("daisy-" + $tail).ToLowerInvariant()
}

function New-CompactTheme {
    param(
        [string]$Path,
        [hashtable]$Colors
    )

    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($Path)
    return [ordered]@{
        n = Get-ThemeSlug $baseName
        l = Get-ThemeLabel $baseName
        d = $Colors["DaisyPrimaryColor"]
        p = $Colors["DaisyPrimaryColor"]
        pf = $Colors["DaisyPrimaryFocusColor"]
        pc = $Colors["DaisyPrimaryContentColor"]
        s = $Colors["DaisySecondaryColor"]
        a = $Colors["DaisyAccentColor"]
        nu = $Colors["DaisyNeutralColor"]
        nc = $Colors["DaisyNeutralContentColor"]
        b1 = $Colors["DaisyBase100Color"]
        b2 = $Colors["DaisyBase200Color"]
        b3 = $Colors["DaisyBase300Color"]
        bc = $Colors["DaisyBaseContentColor"]
        i = $Colors["DaisyInfoColor"]
        g = $Colors["DaisySuccessColor"]
        w = $Colors["DaisyWarningColor"]
        e = $Colors["DaisyErrorColor"]
    }
}

$requiredKeys = @(
    "DaisyPrimaryColor",
    "DaisyPrimaryFocusColor",
    "DaisyPrimaryContentColor",
    "DaisySecondaryColor",
    "DaisyAccentColor",
    "DaisyNeutralColor",
    "DaisyNeutralContentColor",
    "DaisyBase100Color",
    "DaisyBase200Color",
    "DaisyBase300Color",
    "DaisyBaseContentColor",
    "DaisyInfoColor",
    "DaisySuccessColor",
    "DaisyWarningColor",
    "DaisyErrorColor"
)

$excludedThemeSlugs = @(
    "daisy-caramellatte"
)

$files = Get-ChildItem -LiteralPath $SourceDir -Filter *.axaml | Sort-Object Name
$themes = New-Object System.Collections.Generic.List[object]

foreach ($file in $files) {
    $slug = Get-ThemeSlug ([System.IO.Path]::GetFileNameWithoutExtension($file.FullName))
    if ($excludedThemeSlugs -contains $slug) {
        continue
    }
    $colors = Get-ColorMap -Path $file.FullName
    $missing = @($requiredKeys | Where-Object { -not $colors.Contains($_) })
    if ($missing.Count -gt 0) {
        throw "Palette '$($file.FullName)' is missing keys: $($missing -join ', ')"
    }
    $themes.Add((New-CompactTheme -Path $file.FullName -Colors $colors))
}

$payload = [ordered]@{
    generatedUtc = [DateTime]::UtcNow.ToString("o")
    sourceDir = [System.IO.Path]::GetFullPath($SourceDir)
    compactSchema = [ordered]@{
        n = "theme slug"
        l = "label"
        d = "dot color"
        p = "primary"
        pf = "primary focus"
        pc = "primary content"
        s = "secondary"
        a = "accent"
        nu = "neutral"
        nc = "neutral content"
        b1 = "base 100"
        b2 = "base 200"
        b3 = "base 300"
        bc = "base content"
        i = "info"
        g = "success"
        w = "warning"
        e = "error"
    }
    duThemeInputs = @(
        "p",
        "pf",
        "pc",
        "nu",
        "nc",
        "b1",
        "b2",
        "b3",
        "bc",
        "i",
        "w",
        "e"
    )
    themeCount = $themes.Count
    themes = $themes
}

$outDir = Split-Path -Parent $OutFile
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$json = $payload | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($OutFile, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote compact palette file: $OutFile"

if ($PassThru) {
    $payload
}
