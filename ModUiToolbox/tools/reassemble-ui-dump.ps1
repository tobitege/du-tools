param(
    [Parameter(Mandatory = $true)]
    [string]$InputNdjson,

    [Parameter(Mandatory = $true)]
    [string]$OutDir,

    [switch]$WrapHtmlSplitDocument
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

function Get-PropertyValue {
    param(
        $Object,
        [string]$Name,
        $Default = $null
    )

    if ($null -eq $Object) {
        return $Default
    }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -ne $property) {
        return $property.Value
    }
    return $Default
}

function Get-LatestPacket {
    param(
        [System.Collections.IEnumerable]$Packets
    )

    $items = @($Packets)
    if ($items.Count -eq 0) {
        return $null
    }
    return ($items | Sort-Object @{ Expression = { [string](Get-PropertyValue -Object $_ -Name "timestamp" -Default "") } } | Select-Object -Last 1)
}

function Test-HtmlDocumentClosed {
    param(
        [string]$HtmlText
    )

    if ([string]::IsNullOrWhiteSpace($HtmlText)) {
        return $false
    }

    return [bool]([regex]::IsMatch($HtmlText.TrimEnd(), '</body>\s*</html>\s*$', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase))
}

function Get-SectionDiagnostics {
    param(
        [string]$SectionName,
        [array]$Packets,
        [string]$Joined,
        $StartPacket
    )

    $firstPacket = $null
    if ($Packets.Count -gt 0) {
        $firstPacket = $Packets[0]
    }
    $meta = Get-PropertyValue -Object $firstPacket -Name "meta" -Default $null
    $startConfig = Get-PropertyValue -Object $StartPacket -Name "config" -Default $null
    $startHtmlSelector = [string](Get-PropertyValue -Object $startConfig -Name "htmlSelector" -Default "")

    $sourceKind = [string](Get-PropertyValue -Object $meta -Name "sourceKind" -Default "")
    $selector = [string](Get-PropertyValue -Object $meta -Name "selector" -Default "")
    $requestedSelector = [string](Get-PropertyValue -Object $meta -Name "requestedSelector" -Default "")
    if ([string]::IsNullOrWhiteSpace($requestedSelector)) {
        $requestedSelector = $selector
    }
    if ($SectionName -eq "html" -and [string]::IsNullOrWhiteSpace($requestedSelector)) {
        $requestedSelector = $startHtmlSelector
    }
    if ($SectionName -eq "html" -and [string]::IsNullOrWhiteSpace($sourceKind)) {
        if ([string]::IsNullOrWhiteSpace($requestedSelector)) {
            $sourceKind = "document"
        } else {
            $sourceKind = "fragment"
        }
    }
    if ($SectionName -ne "html" -and [string]::IsNullOrWhiteSpace($sourceKind)) {
        $sourceKind = "section"
    }
    if ($SectionName -eq "html" -and [string]::IsNullOrWhiteSpace($selector) -and $sourceKind -eq "fragment") {
        $selector = $requestedSelector
    }

    $collectionTruncated = [bool](Get-PropertyValue -Object $meta -Name "collectionTruncated" -Default $false)
    if (-not $collectionTruncated) {
        $collectionTruncated = [bool](Get-PropertyValue -Object $meta -Name "truncated" -Default $false)
    }
    $transportTruncated = [bool](Get-PropertyValue -Object $meta -Name "transportTruncated" -Default $false)
    if (-not $transportTruncated) {
        $transportTruncated = [bool](Get-PropertyValue -Object $meta -Name "payloadTruncated" -Default $false)
    }

    $originalLength = Get-PropertyValue -Object $meta -Name "originalLength" -Default $null
    if ($null -eq $originalLength -or -not ($originalLength -is [ValueType])) {
        $originalLength = Get-PropertyValue -Object $meta -Name "originalPayloadLength" -Default $null
    }
    if ($null -eq $originalLength -or -not ($originalLength -is [ValueType])) {
        $originalLength = $Joined.Length
    }
    $originalLength = [int]$originalLength

    $sentLength = Get-PropertyValue -Object $meta -Name "sentLength" -Default $null
    if ($null -eq $sentLength -or -not ($sentLength -is [ValueType])) {
        $sentLength = $Joined.Length
    }
    $sentLength = [int]$sentLength

    $reportedComplete = Get-PropertyValue -Object $meta -Name "complete" -Default $null
    $hasDocumentClosingTags = $null
    if ($SectionName -eq "html" -and $sourceKind -eq "document") {
        $hasDocumentClosingTags = Test-HtmlDocumentClosed -HtmlText $Joined
    }

    $lengthMatches = ($Joined.Length -eq $sentLength)
    $complete = ($collectionTruncated -eq $false) -and ($transportTruncated -eq $false) -and $lengthMatches
    if ($reportedComplete -is [bool]) {
        $complete = $complete -and [bool]$reportedComplete
    }
    if ($hasDocumentClosingTags -is [bool]) {
        $complete = $complete -and $hasDocumentClosingTags
    }

    return [ordered]@{
        sourceKind = $sourceKind
        selector = $selector
        requestedSelector = $requestedSelector
        originalLength = $originalLength
        sentLength = $sentLength
        reassembledLength = $Joined.Length
        collectionTruncated = $collectionTruncated
        transportTruncated = $transportTruncated
        reportedComplete = $reportedComplete
        complete = $complete
        hasDocumentClosingTags = $hasDocumentClosingTags
        fallbackToDocument = [bool](Get-PropertyValue -Object $meta -Name "fallbackToDocument" -Default $false)
    }
}

function Invoke-HtmlSplitIfAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HtmlPath,

        [Parameter(Mandatory = $true)]
        [string]$DumpDir,

        [switch]$WrapDocument
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

    if ($WrapDocument) {
        $pythonArgs += "--wrap-document"
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
    } elseif (
        ($row.PSObject.Properties.Name -contains "data") -and
        -not ($row.PSObject.Properties.Name -contains "type")
    ) {
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
    $latestStart = Get-LatestPacket -Packets $entry.starts
    $latestComplete = Get-LatestPacket -Packets $entry.completes
    $manifestWarnings = New-Object System.Collections.ArrayList

    $manifest = [ordered]@{
        dumpId = $dumpId
        starts = $entry.starts.Count
        completes = $entry.completes.Count
        fatals = $entry.fatals.Count
        htmlSelector = [string](Get-PropertyValue -Object (Get-PropertyValue -Object $latestStart -Name "config" -Default $null) -Name "htmlSelector" -Default "")
        completionReportedComplete = Get-PropertyValue -Object $latestComplete -Name "complete" -Default $null
        complete = $true
        warnings = @()
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
        $diagnostics = Get-SectionDiagnostics -SectionName $sectionName -Packets $packets -Joined $joined -StartPacket $latestStart

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

        $sectionWarnings = New-Object System.Collections.ArrayList
        if ($missing.Count -gt 0) {
            [void]$sectionWarnings.Add("missing packet parts")
        }
        if ($diagnostics.collectionTruncated) {
            [void]$sectionWarnings.Add("collection truncated before chunking")
        }
        if ($diagnostics.transportTruncated) {
            [void]$sectionWarnings.Add("transport truncated before reassembly")
        }
        if ($sectionName -eq "html" -and $diagnostics.sourceKind -eq "document" -and $diagnostics.hasDocumentClosingTags -eq $false) {
            [void]$sectionWarnings.Add("full-document html is missing closing body/html tags")
        }

        $sectionComplete = ($missing.Count -eq 0) -and $diagnostics.complete
        if (-not $sectionComplete) {
            $manifest.complete = $false
            [void]$manifestWarnings.Add(("{0}: incomplete" -f $sectionName))
        }

        $manifest.sections += [ordered]@{
            name = $sectionName
            file = $manifestFile
            packets = $packets.Count
            expected = $totalExpected
            missingParts = $missing
            bytes = $joined.Length
            sourceKind = $diagnostics.sourceKind
            selector = $diagnostics.selector
            requestedSelector = $diagnostics.requestedSelector
            originalLength = $diagnostics.originalLength
            sentLength = $diagnostics.sentLength
            reassembledLength = $diagnostics.reassembledLength
            collectionTruncated = $diagnostics.collectionTruncated
            transportTruncated = $diagnostics.transportTruncated
            complete = $sectionComplete
            fallbackToDocument = $diagnostics.fallbackToDocument
            hasDocumentClosingTags = $diagnostics.hasDocumentClosingTags
            warnings = @($sectionWarnings)
        }
    }

    if ($entry.fatals.Count -gt 0) {
        $manifest.complete = $false
        [void]$manifestWarnings.Add("fatal event present")
    }
    if ($manifest.completionReportedComplete -is [bool] -and -not [bool]$manifest.completionReportedComplete) {
        $manifest.complete = $false
        [void]$manifestWarnings.Add("ui_dump_complete reported complete=false")
    }
    $manifest.warnings = @($manifestWarnings)

    if ($null -ne $htmlSectionPath) {
        Invoke-HtmlSplitIfAvailable -HtmlPath $htmlSectionPath -DumpDir $dumpDir -WrapDocument:$WrapHtmlSplitDocument
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
