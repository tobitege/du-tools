#
# Live input/measurement harness for Dual Universe client-pixel actions.
# In agent-driven DU sessions, prefer ScreenShotNet window captures for
# visual confirmation and use this script for the input and coordinate checks.
# See ../du-visual-subagent.md and live_lua_coding/du-client-pixel-live-tests.md.
#

param(
    [ValidateSet("all", "cursor", "checkbox")]
    [string]$Mode = "all",
    [string]$WindowTitle = "Dual Universe",
    [string]$AhkPath = "C:\Program Files\tools\AutoHotkey\v2\AutoHotkey64.exe",
    [string]$ArtifactDir = ".\test-artifacts\du-client-px",
    [switch]$CaptureArtifacts,
    [switch]$EnterFreeCursorUi,
    [switch]$RestoreAfterFreeCursorUi,
    [int]$FreeCursorUiSettleMs = 400,
    [int]$CursorInsetPx = 30,
    [int]$SettleMs = 180,
    [double]$CheckboxXRatio = 0.485,
    [double]$CheckboxYRatio = 0.451,
    [double]$CheckboxChangeMinRatio = 0.020,
    [double]$CheckboxRestoreMaxRatio = 0.003,
    [int]$ColorDeltaThreshold = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;

namespace LiveBoard {
    public static class NativeMethods {
        [StructLayout(LayoutKind.Sequential)]
        public struct RECT {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT {
            public int X;
            public int Y;
        }

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

        [DllImport("user32.dll", SetLastError = false)]
        public static extern bool SetProcessDPIAware();
    }
}
"@

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$controlCenterScript = Join-Path $scriptDir "du_control_center.ahk"

[void][LiveBoard.NativeMethods]::SetProcessDPIAware()

function Resolve-OutputDirectory {
    param([string]$BasePath)

    if ([System.IO.Path]::IsPathRooted($BasePath)) {
        return [System.IO.Path]::GetFullPath($BasePath)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $scriptDir $BasePath))
}

function Ensure-FileExists {
    param(
        [string]$Path,
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Label not found: $Path"
    }
}

function Get-DuWindowContext {
    param([string]$TitleFragment)

    $process = Get-Process |
        Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*$TitleFragment*" } |
        Select-Object -First 1

    if ($null -eq $process) {
        throw "Could not find a visible window with title fragment '$TitleFragment'."
    }

    $hwnd = [IntPtr]$process.MainWindowHandle
    $clientRect = New-Object LiveBoard.NativeMethods+RECT
    if (-not [LiveBoard.NativeMethods]::GetClientRect($hwnd, [ref]$clientRect)) {
        throw "GetClientRect failed for hwnd $($process.MainWindowHandle)."
    }

    $origin = New-Object LiveBoard.NativeMethods+POINT
    $origin.X = 0
    $origin.Y = 0
    if (-not [LiveBoard.NativeMethods]::ClientToScreen($hwnd, [ref]$origin)) {
        throw "ClientToScreen failed for hwnd $($process.MainWindowHandle)."
    }

    $clientWidth = $clientRect.Right - $clientRect.Left
    $clientHeight = $clientRect.Bottom - $clientRect.Top

    if ($clientWidth -le 0 -or $clientHeight -le 0) {
        throw "Client rect is invalid: ${clientWidth}x${clientHeight}."
    }

    return [pscustomobject]@{
        ProcessName = $process.ProcessName
        WindowTitle = $process.MainWindowTitle
        Hwnd = $hwnd
        ClientLeft = $origin.X
        ClientTop = $origin.Y
        ClientWidth = $clientWidth
        ClientHeight = $clientHeight
    }
}

function Convert-ClientToScreenPoint {
    param(
        $WindowContext,
        [int]$ClientX,
        [int]$ClientY
    )

    return [pscustomobject]@{
        X = $WindowContext.ClientLeft + $ClientX
        Y = $WindowContext.ClientTop + $ClientY
    }
}

function Get-CursorScreenPosition {
    $cursor = [System.Windows.Forms.Cursor]::Position
    return [pscustomobject]@{
        X = $cursor.X
        Y = $cursor.Y
    }
}

function Invoke-DuControlCenter {
    param(
        [string]$Action,
        [hashtable]$Options
    )

    $args = @(
        $controlCenterScript,
        $Action,
        "--window-title",
        $WindowTitle
    )

    foreach ($entry in $Options.GetEnumerator()) {
        $args += $entry.Key
        $args += [string]$entry.Value
    }

    $stdoutFile = [System.IO.Path]::GetTempFileName()
    $stderrFile = [System.IO.Path]::GetTempFileName()
    try {
        $process = Start-Process -FilePath $AhkPath -ArgumentList $args -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
        $exitCode = $process.ExitCode
        $text = [System.IO.File]::ReadAllText($stdoutFile).Trim()
        $stderrText = [System.IO.File]::ReadAllText($stderrFile).Trim()
    } finally {
        if (Test-Path -LiteralPath $stdoutFile) {
            Remove-Item -LiteralPath $stdoutFile -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path -LiteralPath $stderrFile) {
            Remove-Item -LiteralPath $stderrFile -Force -ErrorAction SilentlyContinue
        }
    }

    if ([string]::IsNullOrWhiteSpace($text)) {
        if ([string]::IsNullOrWhiteSpace($stderrText)) {
            throw "du_control_center.ahk returned no output for action '$Action'."
        }
        throw "du_control_center.ahk returned no stdout for action '$Action'. stderr: $stderrText"
    }

    try {
        $parsed = $text | ConvertFrom-Json
    } catch {
        throw "Could not parse du_control_center.ahk output for action '$Action': $text"
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Result = $parsed
        Raw = $text
    }
}

function Assert-PointMatches {
    param(
        [string]$Label,
        [int]$ExpectedX,
        [int]$ExpectedY,
        [int]$ActualX,
        [int]$ActualY,
        [int]$TolerancePx = 1
    )

    if ([Math]::Abs($ExpectedX - $ActualX) -gt $TolerancePx -or [Math]::Abs($ExpectedY - $ActualY) -gt $TolerancePx) {
        throw "$Label mismatch. Expected ($ExpectedX,$ExpectedY), got ($ActualX,$ActualY)."
    }
}

function Invoke-DuActionAndRequireSuccess {
    param(
        [string]$Action,
        [hashtable]$Options = @{}
    )

    $response = Invoke-DuControlCenter -Action $Action -Options $Options
    if ($response.ExitCode -ne 0 -or -not $response.Result.ok) {
        throw "Action '$Action' failed: $($response.Raw)"
    }
    return $response
}

function New-ScreenCaptureBitmap {
    param(
        [int]$ScreenX,
        [int]$ScreenY,
        [int]$Width,
        [int]$Height
    )

    $bitmap = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CopyFromScreen($ScreenX, $ScreenY, 0, 0, $bitmap.Size)
    } finally {
        $graphics.Dispose()
    }

    return $bitmap
}

function New-ClientRegionBitmap {
    param(
        $WindowContext,
        [int]$ClientX,
        [int]$ClientY,
        [int]$Width,
        [int]$Height
    )

    $screenPoint = Convert-ClientToScreenPoint -WindowContext $WindowContext -ClientX $ClientX -ClientY $ClientY
    return New-ScreenCaptureBitmap -ScreenX $screenPoint.X -ScreenY $screenPoint.Y -Width $Width -Height $Height
}

function Save-BitmapIfNeeded {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [string]$Path
    )

    $directory = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Get-BitmapDifference {
    param(
        [System.Drawing.Bitmap]$Before,
        [System.Drawing.Bitmap]$After,
        [int]$PerPixelThreshold
    )

    if ($Before.Width -ne $After.Width -or $Before.Height -ne $After.Height) {
        throw "Bitmap sizes do not match."
    }

    $changedPixels = 0
    $deltaSum = 0.0
    $totalPixels = $Before.Width * $Before.Height

    for ($y = 0; $y -lt $Before.Height; $y++) {
        for ($x = 0; $x -lt $Before.Width; $x++) {
            $left = $Before.GetPixel($x, $y)
            $right = $After.GetPixel($x, $y)
            $delta = [Math]::Abs($left.R - $right.R) + [Math]::Abs($left.G - $right.G) + [Math]::Abs($left.B - $right.B)
            $deltaSum += $delta
            if ($delta -ge $PerPixelThreshold) {
                $changedPixels++
            }
        }
    }

    return [pscustomobject]@{
        ChangedPixels = $changedPixels
        TotalPixels = $totalPixels
        ChangedRatio = $changedPixels / [double]$totalPixels
        AverageChannelDelta = $deltaSum / ([double]$totalPixels * 3.0)
    }
}

function Get-CursorTestPoints {
    param(
        $WindowContext,
        [int]$InsetPx
    )

    $maxX = [Math]::Max(0, $WindowContext.ClientWidth - 1)
    $maxY = [Math]::Max(0, $WindowContext.ClientHeight - 1)
    $insetX = [Math]::Min($InsetPx, $maxX)
    $insetY = [Math]::Min($InsetPx, $maxY)

    $rawPoints = @(
        [pscustomobject]@{ Label = "top_left"; X = $insetX; Y = $insetY }
        [pscustomobject]@{ Label = "top_right"; X = [Math]::Max(0, $maxX - $insetX); Y = $insetY }
        [pscustomobject]@{ Label = "center"; X = [Math]::Round($maxX / 2.0); Y = [Math]::Round($maxY / 2.0) }
        [pscustomobject]@{ Label = "bottom_left"; X = $insetX; Y = [Math]::Max(0, $maxY - $insetY) }
        [pscustomobject]@{ Label = "bottom_right"; X = [Math]::Max(0, $maxX - $insetX); Y = [Math]::Max(0, $maxY - $insetY) }
    )

    $seen = @{}
    $points = New-Object System.Collections.Generic.List[object]
    foreach ($point in $rawPoints) {
        $key = "$($point.X),$($point.Y)"
        if (-not $seen.ContainsKey($key)) {
            $seen[$key] = $true
            $points.Add($point)
        }
    }

    return $points
}

function Test-UiCalibrateCursor {
    param($WindowContext)

    Write-Host ""
    Write-Host "[cursor] Verifying ui_calibrate against the live client rect..." -ForegroundColor Cyan
    if ($EnterFreeCursorUi) {
        Write-Host "         Entering free-cursor UI via Escape before the cursor assertions." -ForegroundColor Yellow
    } else {
        Write-Host "         Expectation: Dual Universe is already on a free-cursor UI surface." -ForegroundColor Yellow
    }

    $openedFreeCursorUi = $false
    try {
        if ($EnterFreeCursorUi) {
            [void](Invoke-DuActionAndRequireSuccess -Action "open_options")
            Start-Sleep -Milliseconds $FreeCursorUiSettleMs
            $openedFreeCursorUi = $true
            $WindowContext = Get-DuWindowContext -TitleFragment $WindowTitle
        }

        $points = Get-CursorTestPoints -WindowContext $WindowContext -InsetPx $CursorInsetPx

        foreach ($point in $points) {
            $response = Invoke-DuControlCenter -Action "ui_calibrate" -Options @{
                "--client-x" = $point.X
                "--client-y" = $point.Y
            }

            if ($response.ExitCode -ne 0 -or -not $response.Result.ok) {
                throw "[cursor:$($point.Label)] ui_calibrate failed: $($response.Raw)"
            }

            $expected = Convert-ClientToScreenPoint -WindowContext $WindowContext -ClientX $point.X -ClientY $point.Y
            $cursor = Get-CursorScreenPosition

            Assert-PointMatches -Label "[cursor:$($point.Label)] result cursor" -ExpectedX $expected.X -ExpectedY $expected.Y -ActualX ([int]$response.Result.cursorX) -ActualY ([int]$response.Result.cursorY)
            Assert-PointMatches -Label "[cursor:$($point.Label)] system cursor" -ExpectedX $expected.X -ExpectedY $expected.Y -ActualX $cursor.X -ActualY $cursor.Y

            if ([int]$response.Result.clientX -ne $point.X -or [int]$response.Result.clientY -ne $point.Y) {
                throw "[cursor:$($point.Label)] client coordinates echoed back as $($response.Result.clientX),$($response.Result.clientY) instead of $($point.X),$($point.Y)."
            }

            Write-Host ("  OK {0,-12} client=({1,4},{2,4}) screen=({3,4},{4,4})" -f $point.Label, $point.X, $point.Y, $expected.X, $expected.Y) -ForegroundColor Green
        }
    } finally {
        if ($openedFreeCursorUi -and $RestoreAfterFreeCursorUi) {
            Write-Host "         Restoring the prior in-world state via Escape." -ForegroundColor Yellow
            [void](Invoke-DuActionAndRequireSuccess -Action "close_options")
            Start-Sleep -Milliseconds $FreeCursorUiSettleMs
        }
    }
}

function Test-ControlsCheckboxClick {
    param($WindowContext)

    Write-Host ""
    Write-Host "[checkbox] Verifying click_client_px on Controls -> Settings -> Invert Y-axis..." -ForegroundColor Cyan
    Write-Host "           Precondition: the Dual Universe Options window must already show Controls -> Settings." -ForegroundColor Yellow

    $checkboxX = [Math]::Round($WindowContext.ClientWidth * $CheckboxXRatio)
    $checkboxY = [Math]::Round($WindowContext.ClientHeight * $CheckboxYRatio)
    $regionSize = [Math]::Max(36, [Math]::Round([Math]::Min($WindowContext.ClientWidth, $WindowContext.ClientHeight) * 0.055))
    $regionHalf = [Math]::Floor($regionSize / 2)
    $regionX = [Math]::Max(0, [Math]::Min($WindowContext.ClientWidth - $regionSize, $checkboxX - $regionHalf))
    $regionY = [Math]::Max(0, [Math]::Min($WindowContext.ClientHeight - $regionSize, $checkboxY - $regionHalf))

    $before = $null
    $afterFirst = $null
    $afterSecond = $null

    try {
        $before = New-ClientRegionBitmap -WindowContext $WindowContext -ClientX $regionX -ClientY $regionY -Width $regionSize -Height $regionSize

        $clickOne = Invoke-DuControlCenter -Action "click_client_px" -Options @{
            "--client-x" = $checkboxX
            "--client-y" = $checkboxY
        }
        if ($clickOne.ExitCode -ne 0 -or -not $clickOne.Result.ok) {
            throw "[checkbox] First click failed: $($clickOne.Raw)"
        }

        Start-Sleep -Milliseconds $SettleMs
        $afterFirst = New-ClientRegionBitmap -WindowContext $WindowContext -ClientX $regionX -ClientY $regionY -Width $regionSize -Height $regionSize

        $clickTwo = Invoke-DuControlCenter -Action "click_client_px" -Options @{
            "--client-x" = $checkboxX
            "--client-y" = $checkboxY
        }
        if ($clickTwo.ExitCode -ne 0 -or -not $clickTwo.Result.ok) {
            throw "[checkbox] Second click failed: $($clickTwo.Raw)"
        }

        Start-Sleep -Milliseconds $SettleMs
        $afterSecond = New-ClientRegionBitmap -WindowContext $WindowContext -ClientX $regionX -ClientY $regionY -Width $regionSize -Height $regionSize

        $firstDiff = Get-BitmapDifference -Before $before -After $afterFirst -PerPixelThreshold $ColorDeltaThreshold
        $restoreDiff = Get-BitmapDifference -Before $before -After $afterSecond -PerPixelThreshold $ColorDeltaThreshold

        if ($firstDiff.ChangedRatio -lt $CheckboxChangeMinRatio) {
            throw ("[checkbox] First click did not visibly change the checkbox region enough. Changed ratio was {0:N4}, expected at least {1:N4}." -f $firstDiff.ChangedRatio, $CheckboxChangeMinRatio)
        }

        if ($restoreDiff.ChangedRatio -gt $CheckboxRestoreMaxRatio) {
            throw ("[checkbox] Second click did not restore the original checkbox region. Changed ratio was {0:N4}, expected at most {1:N4}." -f $restoreDiff.ChangedRatio, $CheckboxRestoreMaxRatio)
        }

        $screenPoint = Convert-ClientToScreenPoint -WindowContext $WindowContext -ClientX $checkboxX -ClientY $checkboxY
        Write-Host ("  OK checkbox toggle changed ratio {0:N4}, restored ratio {1:N4}, point client=({2},{3}) screen=({4},{5})" -f $firstDiff.ChangedRatio, $restoreDiff.ChangedRatio, $checkboxX, $checkboxY, $screenPoint.X, $screenPoint.Y) -ForegroundColor Green

        if ($CaptureArtifacts) {
            $outputDir = Resolve-OutputDirectory -BasePath $ArtifactDir
            Save-BitmapIfNeeded -Bitmap $before -Path (Join-Path $outputDir "checkbox-before.png")
            Save-BitmapIfNeeded -Bitmap $afterFirst -Path (Join-Path $outputDir "checkbox-after-first-click.png")
            Save-BitmapIfNeeded -Bitmap $afterSecond -Path (Join-Path $outputDir "checkbox-after-second-click.png")
        }
    } finally {
        if ($null -ne $before) { $before.Dispose() }
        if ($null -ne $afterFirst) { $afterFirst.Dispose() }
        if ($null -ne $afterSecond) { $afterSecond.Dispose() }
    }
}

Ensure-FileExists -Path $controlCenterScript -Label "du_control_center.ahk"
Ensure-FileExists -Path $AhkPath -Label "AutoHotkey executable"

$windowContext = Get-DuWindowContext -TitleFragment $WindowTitle
Write-Host ("Found window '{0}' ({1}x{2} client, hwnd {3})." -f $windowContext.WindowTitle, $windowContext.ClientWidth, $windowContext.ClientHeight, $windowContext.Hwnd) -ForegroundColor White

if ($Mode -eq "all" -or $Mode -eq "cursor") {
    Test-UiCalibrateCursor -WindowContext $windowContext
}

if ($Mode -eq "all" -or $Mode -eq "checkbox") {
    Test-ControlsCheckboxClick -WindowContext $windowContext
}

Write-Host ""
Write-Host "Live client-pixel tests passed." -ForegroundColor Green
