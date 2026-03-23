#
# Live in-world camera steering harness for Dual Universe.
# Uses the existing relative mouse nudge helper and logs repeatable step
# sequences so visible aim-point drift can be judged against the screen center.
#

param(
    [ValidateSet("single", "repeatability", "round_trip", "ladder_x", "ladder_y")]
    [string]$Mode = "single",
    [string]$WindowTitle = "Dual Universe",
    [string]$AhkPath = "C:\Program Files\tools\AutoHotkey\v2\AutoHotkey64.exe",
    [int]$MoveX = 0,
    [int]$MoveY = 0,
    [int]$RepeatCount = 5,
    [int]$SettleMs = 600,
    [string]$SweepValues = "5,10,20,40,80,120",
    [switch]$ReturnToStart,
    [switch]$PauseBetweenSteps,
    [switch]$CaptureArtifacts,
    [string]$ArtifactDir = ".\test-artifacts\du-camera-steering",
    [switch]$CaptureFullClient,
    [int]$CaptureRegionWidth = 800,
    [int]$CaptureRegionHeight = 600,
    [switch]$EmitJsonLog,
    [string]$JsonLogPath = ".\test-artifacts\du-camera-steering\last-run.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

namespace LiveBoardCamera {
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
$nudgeScript = Join-Path $scriptDir "du_view_nudge.ahk"

[void][LiveBoardCamera.NativeMethods]::SetProcessDPIAware()

function Resolve-OutputPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $scriptDir $Path))
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

function Resolve-OutputDirectory {
    param([string]$BasePath)

    if ([System.IO.Path]::IsPathRooted($BasePath)) {
        return [System.IO.Path]::GetFullPath($BasePath)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $scriptDir $BasePath))
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
    $clientRect = New-Object LiveBoardCamera.NativeMethods+RECT
    if (-not [LiveBoardCamera.NativeMethods]::GetClientRect($hwnd, [ref]$clientRect)) {
        throw "GetClientRect failed for hwnd $($process.MainWindowHandle)."
    }

    $origin = New-Object LiveBoardCamera.NativeMethods+POINT
    $origin.X = 0
    $origin.Y = 0
    if (-not [LiveBoardCamera.NativeMethods]::ClientToScreen($hwnd, [ref]$origin)) {
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

function Save-Bitmap {
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

function Save-CenteredClientCapture {
    param(
        $WindowContext,
        [string]$OutputPath,
        [int]$Width,
        [int]$Height
    )

    if ($CaptureFullClient) {
        $captureWidth = $WindowContext.ClientWidth
        $captureHeight = $WindowContext.ClientHeight
        $screenX = $WindowContext.ClientLeft
        $screenY = $WindowContext.ClientTop
    } else {
        $captureWidth = [Math]::Min($Width, $WindowContext.ClientWidth)
        $captureHeight = [Math]::Min($Height, $WindowContext.ClientHeight)
        $screenX = $WindowContext.ClientLeft + [Math]::Floor(($WindowContext.ClientWidth - $captureWidth) / 2)
        $screenY = $WindowContext.ClientTop + [Math]::Floor(($WindowContext.ClientHeight - $captureHeight) / 2)
    }

    $bitmap = New-ScreenCaptureBitmap -ScreenX $screenX -ScreenY $screenY -Width $captureWidth -Height $captureHeight
    try {
        Save-Bitmap -Bitmap $bitmap -Path $OutputPath
    } finally {
        $bitmap.Dispose()
    }
}

function Invoke-DuViewNudge {
    param(
        [int]$StepMoveX,
        [int]$StepMoveY,
        [int]$StepSettleMs
    )

    $args = @(
        $nudgeScript,
        $WindowTitle,
        [string]$StepMoveX,
        [string]$StepMoveY,
        [string]$StepSettleMs
    )

    & $AhkPath @args | Out-Null
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        throw "du_view_nudge.ahk failed with exit code $exitCode."
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Raw = ""
        Result = [pscustomobject]@{
            ok = $true
            cursorX = 0
            cursorY = 0
        }
    }
}

function Invoke-StepSequence {
    param(
        [System.Collections.Generic.List[object]]$Steps,
        [string]$CaptureDir
    )

    $runLog = New-Object System.Collections.Generic.List[object]
    $windowContext = $null

    if ($CaptureArtifacts) {
        $windowContext = Get-DuWindowContext -TitleFragment $WindowTitle
        $baselinePath = Join-Path $CaptureDir "000-baseline.png"
        Save-CenteredClientCapture -WindowContext $windowContext -OutputPath $baselinePath -Width $CaptureRegionWidth -Height $CaptureRegionHeight
        Write-Host ("Baseline capture saved to {0}" -f $baselinePath) -ForegroundColor DarkGray
    }

    for ($i = 0; $i -lt $Steps.Count; $i++) {
        $step = $Steps[$i]
        Write-Host ("[{0}/{1}] moveX={2} moveY={3} settleMs={4}" -f ($i + 1), $Steps.Count, $step.MoveX, $step.MoveY, $step.SettleMs) -ForegroundColor Cyan

        $response = Invoke-DuViewNudge -StepMoveX $step.MoveX -StepMoveY $step.MoveY -StepSettleMs $step.SettleMs
        $capturePath = $null

        if ($CaptureArtifacts) {
            $windowContext = Get-DuWindowContext -TitleFragment $WindowTitle
            $capturePath = Join-Path $CaptureDir ("{0:D3}-{1}.png" -f ($i + 1), $step.Label)
            Save-CenteredClientCapture -WindowContext $windowContext -OutputPath $capturePath -Width $CaptureRegionWidth -Height $CaptureRegionHeight
        }

        $runLog.Add([pscustomobject]@{
            Index = $i + 1
            Label = $step.Label
            MoveX = $step.MoveX
            MoveY = $step.MoveY
            SettleMs = $step.SettleMs
            CursorX = [int]$response.Result.cursorX
            CursorY = [int]$response.Result.cursorY
            CapturePath = $capturePath
            Raw = $response.Raw
        })

        if ($PauseBetweenSteps -and $i -lt ($Steps.Count - 1)) {
            Read-Host "Press Enter for the next steering step"
        }
    }

    return $runLog
}

function Add-Step {
    param(
        [System.Collections.Generic.List[object]]$Steps,
        [string]$Label,
        [int]$StepMoveX,
        [int]$StepMoveY,
        [int]$StepSettleMs
    )

    $Steps.Add([pscustomobject]@{
        Label = $Label
        MoveX = $StepMoveX
        MoveY = $StepMoveY
        SettleMs = $StepSettleMs
    }) | Out-Null
}

function Get-SweepInts {
    param([string]$RawValues)

    $values = New-Object System.Collections.Generic.List[int]
    foreach ($token in ($RawValues -split ",")) {
        $trimmed = $token.Trim()
        if ($trimmed.Length -le 0) {
            continue
        }
        $values.Add([int]$trimmed) | Out-Null
    }

    if ($values.Count -le 0) {
        throw "SweepValues did not contain any integers."
    }

    return $values
}

Ensure-FileExists -Path $AhkPath -Label "AutoHotkey executable"
Ensure-FileExists -Path $nudgeScript -Label "du_view_nudge.ahk"

$steps = New-Object System.Collections.Generic.List[object]
$captureDir = Resolve-OutputDirectory -BasePath $ArtifactDir

switch ($Mode) {
    "single" {
        Add-Step -Steps $steps -Label "single" -StepMoveX $MoveX -StepMoveY $MoveY -StepSettleMs $SettleMs
    }
    "repeatability" {
        for ($i = 1; $i -le $RepeatCount; $i++) {
            Add-Step -Steps $steps -Label ("repeat_{0}" -f $i) -StepMoveX $MoveX -StepMoveY $MoveY -StepSettleMs $SettleMs
        }
    }
    "round_trip" {
        for ($i = 1; $i -le $RepeatCount; $i++) {
            Add-Step -Steps $steps -Label ("forward_{0}" -f $i) -StepMoveX $MoveX -StepMoveY $MoveY -StepSettleMs $SettleMs
            Add-Step -Steps $steps -Label ("reverse_{0}" -f $i) -StepMoveX (-$MoveX) -StepMoveY (-$MoveY) -StepSettleMs $SettleMs
        }
    }
    "ladder_x" {
        foreach ($value in (Get-SweepInts -RawValues $SweepValues)) {
            Add-Step -Steps $steps -Label ("x_{0}" -f $value) -StepMoveX $value -StepMoveY 0 -StepSettleMs $SettleMs
            if ($ReturnToStart) {
                Add-Step -Steps $steps -Label ("x_return_{0}" -f $value) -StepMoveX (-$value) -StepMoveY 0 -StepSettleMs $SettleMs
            }
        }
    }
    "ladder_y" {
        foreach ($value in (Get-SweepInts -RawValues $SweepValues)) {
            Add-Step -Steps $steps -Label ("y_{0}" -f $value) -StepMoveX 0 -StepMoveY $value -StepSettleMs $SettleMs
            if ($ReturnToStart) {
                Add-Step -Steps $steps -Label ("y_return_{0}" -f $value) -StepMoveX 0 -StepMoveY (-$value) -StepSettleMs $SettleMs
            }
        }
    }
}

Write-Host ("Running camera steering mode '{0}' with {1} step(s)." -f $Mode, $steps.Count) -ForegroundColor White
if ($CaptureArtifacts) {
    if ($CaptureFullClient) {
        Write-Host ("Capturing full client screenshots to {0}" -f $captureDir) -ForegroundColor Yellow
    } else {
        Write-Host ("Capturing centered client screenshots to {0}" -f $captureDir) -ForegroundColor Yellow
    }
} else {
    Write-Host "Use DU screenshots before/after or between steps to judge aim-point movement at the screen center." -ForegroundColor Yellow
}

$runLog = Invoke-StepSequence -Steps $steps -CaptureDir $captureDir

if ($EmitJsonLog) {
    $resolvedPath = Resolve-OutputPath -Path $JsonLogPath
    $parent = Split-Path -Parent $resolvedPath
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    [pscustomobject]@{
        mode = $Mode
        windowTitle = $WindowTitle
        settleMs = $SettleMs
        moveX = $MoveX
        moveY = $MoveY
        repeatCount = $RepeatCount
        sweepValues = $SweepValues
        generatedAtUtc = (Get-Date).ToUniversalTime().ToString("O")
        steps = $runLog
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resolvedPath -Encoding UTF8

    Write-Host ("JSON log written to {0}" -f $resolvedPath) -ForegroundColor Green
}

Write-Host ""
Write-Host "Camera steering sequence completed." -ForegroundColor Green
