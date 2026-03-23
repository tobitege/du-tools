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
    [switch]$EmitJsonLog,
    [string]$JsonLogPath = ".\test-artifacts\du-camera-steering\last-run.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nudgeScript = Join-Path $scriptDir "du_view_nudge.ahk"

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

    $stdoutFile = [System.IO.Path]::GetTempFileName()
    $stderrFile = [System.IO.Path]::GetTempFileName()
    try {
        $process = Start-Process -FilePath $AhkPath -ArgumentList $args -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
        $exitCode = $process.ExitCode
        $stdout = [System.IO.File]::ReadAllText($stdoutFile).Trim()
        $stderr = [System.IO.File]::ReadAllText($stderrFile).Trim()
    } finally {
        if (Test-Path -LiteralPath $stdoutFile) {
            Remove-Item -LiteralPath $stdoutFile -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path -LiteralPath $stderrFile) {
            Remove-Item -LiteralPath $stderrFile -Force -ErrorAction SilentlyContinue
        }
    }

    if ([string]::IsNullOrWhiteSpace($stdout)) {
        if ([string]::IsNullOrWhiteSpace($stderr)) {
            throw "du_view_nudge.ahk returned no output."
        }
        throw "du_view_nudge.ahk returned no stdout. stderr: $stderr"
    }

    try {
        $parsed = $stdout | ConvertFrom-Json
    } catch {
        throw "Could not parse du_view_nudge.ahk output: $stdout"
    }

    if ($exitCode -ne 0 -or -not $parsed.ok) {
        throw "du_view_nudge.ahk failed: $stdout"
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Raw = $stdout
        Result = $parsed
    }
}

function Invoke-StepSequence {
    param([System.Collections.Generic.List[object]]$Steps)

    $runLog = New-Object System.Collections.Generic.List[object]

    for ($i = 0; $i -lt $Steps.Count; $i++) {
        $step = $Steps[$i]
        Write-Host ("[{0}/{1}] moveX={2} moveY={3} settleMs={4}" -f ($i + 1), $Steps.Count, $step.MoveX, $step.MoveY, $step.SettleMs) -ForegroundColor Cyan

        $response = Invoke-DuViewNudge -StepMoveX $step.MoveX -StepMoveY $step.MoveY -StepSettleMs $step.SettleMs
        $runLog.Add([pscustomobject]@{
            Index = $i + 1
            Label = $step.Label
            MoveX = $step.MoveX
            MoveY = $step.MoveY
            SettleMs = $step.SettleMs
            CursorX = [int]$response.Result.cursorX
            CursorY = [int]$response.Result.cursorY
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
Write-Host "Use DU screenshots before/after or between steps to judge aim-point movement at the screen center." -ForegroundColor Yellow

$runLog = Invoke-StepSequence -Steps $steps

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
