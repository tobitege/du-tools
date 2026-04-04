param(
    [Parameter(Mandatory = $true)]
    [string]$InputNdjson,

    [Parameter(Mandatory = $true)]
    [string]$OutDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputNdjson)) {
    throw "Input file not found: $InputNdjson"
}

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$dumps = @{}

function Get-OrCreateDump {
    param([string]$DumpId)

    if (-not $dumps.ContainsKey($DumpId)) {
        $dumps[$DumpId] = [ordered]@{
            dumpId   = $DumpId
            starts   = New-Object System.Collections.ArrayList
            completes = New-Object System.Collections.ArrayList
            fatals   = New-Object System.Collections.ArrayList
            sections = @{}
        }
    }
    return $dumps[$DumpId]
}

function Add-SectionPacket {
    param(
        [hashtable]$DumpEntry,
        [string]$Section,
        $Packet
    )

    if (-not $DumpEntry.sections.ContainsKey($Section)) {
        $DumpEntry.sections[$Section] = New-Object System.Collections.ArrayList
    }
    [void]$DumpEntry.sections[$Section].Add($Packet)
}

function Invoke-HtmlSplitIfAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HtmlPath,

        [Parameter(Mandatory = $true)]
        [string]$DumpDir
    )

    if (-not (Test-Path -LiteralPath $HtmlPath)) {
        return
    }

    $splitterScript = Join-Path $PSScriptRoot "split-html-dump.py"
    if (-not (Test-Path -LiteralPath $splitterScript)) {
        return
    }

    $outputDir = Join-Path $DumpDir "html"
    $pythonExecutable = $null
    $pythonArgs = @()

    $pythonCommand = Get-Command -Name "python" -ErrorAction SilentlyContinue
    if ($null -ne $pythonCommand) {
        $pythonExecutable = $pythonCommand.Source
        $pythonArgs = @(
            $splitterScript,
            "--input", $HtmlPath,
            "--out-dir", $outputDir
        )
    } else {
        $pyLauncher = Get-Command -Name "py" -ErrorAction SilentlyContinue
        if ($null -ne $pyLauncher) {
            $pythonExecutable = $pyLauncher.Source
            $pythonArgs = @(
                "-3",
                $splitterScript,
                "--input", $HtmlPath,
                "--out-dir", $outputDir
            )
        }
    }

    if ([string]::IsNullOrWhiteSpace([string]$pythonExecutable)) {
        Write-Warning "HTML split skipped: Python is not available on PATH."
        return
    }

    $splitOutput = & $pythonExecutable @pythonArgs 2>&1
    $splitExitCode = $LASTEXITCODE
    if ($splitExitCode -ne 0) {
        Write-Warning ("HTML split failed for {0} (exit={1})" -f $HtmlPath, $splitExitCode)
        if ($splitOutput) {
            $flat = (($splitOutput | Out-String).Trim() -replace "\r?\n", " | ")
            Write-Warning ("splitter output: {0}" -f $flat)
        }
        return
    }

    $indexPath = Join-Path $outputDir "index.md"
    if (Test-Path -LiteralPath $indexPath) {
        Write-Output ("Split html roots to {0}" -f $outputDir)
    } else {
        Write-Warning ("HTML split command succeeded but {0} was not found." -f $indexPath)
    }
}

Get-Content -LiteralPath $InputNdjson | ForEach-Object {
    $line = $_
    if ([string]::IsNullOrWhiteSpace($line)) {
        return
    }

    $row = $null
    try {
        $row = $line | ConvertFrom-Json -ErrorAction Stop
    } catch {
        return
    }

    $packet = $null
    if ($row.PSObject.Properties.Name -contains "packet") {
        # Server-side NDJSON written by ModUIToolbox wraps payload in "packet".
        $packet = $row.packet
    } elseif ($row.PSObject.Properties.Name -contains "data") {
        # Keep compatibility with older wrappers that used "data".
        $packet = $row.data
    } else {
        $packet = $row
    }
    if ($null -eq $packet) {
        return
    }

    if (-not ($packet.PSObject.Properties.Name -contains "type")) {
        return
    }
    if (-not ($packet.PSObject.Properties.Name -contains "dumpId")) {
        return
    }

    $type = [string]$packet.type
    $dumpId = [string]$packet.dumpId
    if ([string]::IsNullOrWhiteSpace($dumpId)) {
        return
    }

    $entry = Get-OrCreateDump -DumpId $dumpId

    switch ($type) {
        "ui_dump_start" {
            [void]$entry.starts.Add($packet)
        }
        "ui_dump_complete" {
            [void]$entry.completes.Add($packet)
        }
        "ui_dump_fatal" {
            [void]$entry.fatals.Add($packet)
        }
        "ui_dump" {
            $section = "unknown"
            if ($packet.PSObject.Properties.Name -contains "section" -and -not [string]::IsNullOrWhiteSpace([string]$packet.section)) {
                $section = [string]$packet.section
            }
            Add-SectionPacket -DumpEntry $entry -Section $section -Packet $packet
        }
        default {
            # ignore other payload types
        }
    }
}

if ($dumps.Count -eq 0) {
    Write-Output "No ui_dump packets found in: $InputNdjson"
    exit 0
}

foreach ($dumpId in $dumps.Keys) {
    $entry = $dumps[$dumpId]
    $dumpDir = Join-Path $OutDir $dumpId
    New-Item -ItemType Directory -Path $dumpDir -Force | Out-Null
    $scriptsDir = Join-Path $dumpDir "scripts"
    $htmlSectionPath = $null

    $manifest = [ordered]@{
        dumpId = $dumpId
        starts = $entry.starts.Count
        completes = $entry.completes.Count
        fatals = $entry.fatals.Count
        sections = @()
    }

    foreach ($sectionName in $entry.sections.Keys) {
        # Force array semantics even for single-packet sections.
        $packets = @($entry.sections[$sectionName] | Sort-Object @{Expression = { [int]($_.part) }}, @{Expression = { [string]($_.timestamp) }})

        $totalExpected = 0
        if ($packets.Count -gt 0 -and $packets[0].PSObject.Properties.Name -contains "total") {
            $totalExpected = [int]$packets[0].total
        }

        $parts = New-Object System.Collections.ArrayList
        foreach ($p in $packets) {
            [void]$parts.Add([int]$p.part)
        }

        $missing = @()
        if ($totalExpected -gt 0) {
            for ($i = 1; $i -le $totalExpected; $i++) {
                if ($parts -notcontains $i) {
                    $missing += $i
                }
            }
        }

        $joined = ($packets | ForEach-Object { [string]$_.data }) -join ""

        $sectionExt = ".txt"
        $sectionPath = ""

        if ($sectionName -eq "html") {
            $sectionExt = ".html"
            $sectionPath = Join-Path $dumpDir ($sectionName + $sectionExt)
            Set-Content -LiteralPath $sectionPath -Value $joined -Encoding UTF8
            $htmlSectionPath = $sectionPath
        } elseif ($sectionName -eq "stylesheet_extract_css" -or $sectionName -like "all_stylesheet_css_*") {
            $sectionExt = ".css"
            $sectionPath = Join-Path $dumpDir ($sectionName + $sectionExt)
            Set-Content -LiteralPath $sectionPath -Value $joined -Encoding UTF8
        } elseif ($sectionName -like "all_script_js_*") {
            $sectionExt = ".js"
            New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null
            $sectionPath = Join-Path $scriptsDir ($sectionName + $sectionExt)
            Set-Content -LiteralPath $sectionPath -Value $joined -Encoding UTF8
        } else {
            $parsed = $null
            $isJson = $false
            try {
                $parsed = $joined | ConvertFrom-Json -ErrorAction Stop
                $isJson = $true
            } catch {
                $isJson = $false
            }

            if ($isJson) {
                $sectionExt = ".json"
                $sectionPath = Join-Path $dumpDir ($sectionName + $sectionExt)
                ($parsed | ConvertTo-Json -Depth 100) | Set-Content -LiteralPath $sectionPath -Encoding UTF8
            } else {
                $sectionExt = ".txt"
                $sectionPath = Join-Path $dumpDir ($sectionName + $sectionExt)
                Set-Content -LiteralPath $sectionPath -Value $joined -Encoding UTF8
            }
        }

        $manifestFile = [System.IO.Path]::GetFileName($sectionPath)
        if ($sectionName -like "all_script_js_*") {
            $manifestFile = "scripts/" + [System.IO.Path]::GetFileName($sectionPath)
        }

        $manifest.sections += [ordered]@{
            name = $sectionName
            file = $manifestFile
            packets = $packets.Count
            expected = $totalExpected
            missingParts = $missing
            bytes = $joined.Length
        }
    }

    if ($null -ne $htmlSectionPath) {
        Invoke-HtmlSplitIfAvailable -HtmlPath $htmlSectionPath -DumpDir $dumpDir
    }

    if ($entry.starts.Count -gt 0) {
        ($entry.starts | ConvertTo-Json -Depth 40) | Set-Content -LiteralPath (Join-Path $dumpDir "events_start.json") -Encoding UTF8
    }
    if ($entry.completes.Count -gt 0) {
        ($entry.completes | ConvertTo-Json -Depth 40) | Set-Content -LiteralPath (Join-Path $dumpDir "events_complete.json") -Encoding UTF8
    }
    if ($entry.fatals.Count -gt 0) {
        ($entry.fatals | ConvertTo-Json -Depth 40) | Set-Content -LiteralPath (Join-Path $dumpDir "events_fatal.json") -Encoding UTF8
    }

    ($manifest | ConvertTo-Json -Depth 40) | Set-Content -LiteralPath (Join-Path $dumpDir "manifest.json") -Encoding UTF8
}

Write-Output ("Reassembled {0} dump(s) to {1}" -f $dumps.Count, $OutDir)
