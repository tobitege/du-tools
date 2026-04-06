param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-ManifestPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$InputPath
    )

    if (-not (Test-Path -LiteralPath $InputPath)) {
        throw "Path not found: $InputPath"
    }

    $item = Get-Item -LiteralPath $InputPath
    if ($item.PSIsContainer) {
        $manifestPath = Join-Path $item.FullName "manifest.json"
        if (-not (Test-Path -LiteralPath $manifestPath)) {
            throw "manifest.json not found under: $($item.FullName)"
        }
        return $manifestPath
    }

    if ($item.Name -ieq "manifest.json") {
        return $item.FullName
    }

    throw "Expected a reassembled dump directory or manifest.json path, got: $InputPath"
}

$manifestPath = Resolve-ManifestPath -InputPath $Path
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json -ErrorAction Stop
$sections = @($manifest.sections)
$summary = [ordered]@{
    dumpId = [string]$manifest.dumpId
    complete = [bool]$manifest.complete
    completionReportedComplete = $manifest.completionReportedComplete
    htmlSelector = [string]$manifest.htmlSelector
    fatalCount = [int]$manifest.fatals
    warningCount = @($manifest.warnings).Count
    sectionCount = $sections.Count
    incompleteSections = @($sections | Where-Object { -not [bool]$_.complete } | ForEach-Object { [string]$_.name })
    sections = @(
        $sections | ForEach-Object {
            [ordered]@{
                name = [string]$_.name
                sourceKind = [string]$_.sourceKind
                selector = [string]$_.selector
                complete = [bool]$_.complete
                originalLength = [int]$_.originalLength
                sentLength = [int]$_.sentLength
                reassembledLength = [int]$_.reassembledLength
                collectionTruncated = [bool]$_.collectionTruncated
                transportTruncated = [bool]$_.transportTruncated
                hasDocumentClosingTags = $_.hasDocumentClosingTags
                warnings = @($_.warnings)
            }
        }
    )
}

if ($AsJson) {
    $summary | ConvertTo-Json -Depth 20
    exit 0
}

Write-Output ("Dump: {0}" -f $summary.dumpId)
Write-Output ("Complete: {0}" -f $summary.complete)
if ($null -ne $summary.completionReportedComplete) {
    Write-Output ("ui_dump_complete.complete: {0}" -f $summary.completionReportedComplete)
}
if (-not [string]::IsNullOrWhiteSpace($summary.htmlSelector)) {
    Write-Output ("Requested htmlSelector: {0}" -f $summary.htmlSelector)
}
if ($summary.warningCount -gt 0) {
    Write-Output ("Warnings: {0}" -f ((@($manifest.warnings) -join " | ")))
}
foreach ($section in $summary.sections) {
    $line = "{0}: kind={1}; complete={2}; lengths={3}/{4}/{5}" -f `
        $section.name, `
        $section.sourceKind, `
        $section.complete, `
        $section.originalLength, `
        $section.sentLength, `
        $section.reassembledLength
    if (-not [string]::IsNullOrWhiteSpace($section.selector)) {
        $line += "; selector=" + $section.selector
    }
    if ($section.collectionTruncated) {
        $line += "; collectionTruncated=true"
    }
    if ($section.transportTruncated) {
        $line += "; transportTruncated=true"
    }
    if ($null -ne $section.hasDocumentClosingTags) {
        $line += "; documentClosed=" + $section.hasDocumentClosingTags
    }
    if (@($section.warnings).Count -gt 0) {
        $line += "; warnings=" + ((@($section.warnings) -join ", "))
    }
    Write-Output $line
}
