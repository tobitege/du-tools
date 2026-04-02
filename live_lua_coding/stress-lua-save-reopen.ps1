param(
    [int]$PlayerId = 10000,
    [int]$Attempts = 50,
    [string]$WindowTitle = "Dual Universe",
    [string]$SlotName = "library",
    [string]$FilterName = "onStart()",
    [int]$SelectSettleMs = 1500,
    [int]$OpenTimeoutMs = 10000,
    [int]$ProbeTimeoutMs = 12000,
    [int]$SaveCloseTimeoutMs = 8000,
    [switch]$ContinueOnRecovery
)

$ErrorActionPreference = "Stop"

$repoRoot = "d:\github\du-tobi"
$serverRoot = "D:\MyDUserver"
$dumpRoot = Join-Path $serverRoot "tmp\ui-dumps"
$bridgeRoot = Join-Path $dumpRoot "mcp-bridge"
$commandsDir = Join-Path $bridgeRoot "commands"
$eventsFile = Join-Path (Join-Path $bridgeRoot "events") "bridge-events.ndjson"
$ahkExe = "C:\Program Files\tools\AutoHotkey\v2\AutoHotkey64.exe"
$ahkScript = Join-Path $repoRoot "DuMcpBridge\ahk\du_bridge_input.ahk"
$resultsDir = Join-Path $repoRoot "tmp\stress-results"

[System.IO.Directory]::CreateDirectory($resultsDir) | Out-Null

$toggleFunctionBody = @'
var manager = window.LUAEditorManager || null;
var cm = manager && typeof manager.getLuaEditor === "function" ? manager.getLuaEditor() : null;
if (!manager || typeof manager.setCodeLuaEditor !== "function" || !cm || typeof cm.getValue !== "function") {
  return { ok: false, reason: "lua_bridge_unavailable" };
}
var before = String(cm.getValue() || "");
var marker = "\n-- sv-hold-test";
var hasMarker = before.indexOf(marker) >= 0;
var after = hasMarker ? before.replace(marker, "") : (before + marker);
manager.setCodeLuaEditor(after);
return {
  ok: true,
  changed: before !== after,
  markerPresent: !hasMarker,
  beforeLength: before.length,
  afterLength: after.length
};
'@

function Get-NewCommandFileName {
    $createdAtUtc = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH-mm-ss.fffZ")
    $commandId = [guid]::NewGuid().ToString()
    return @{
        CommandId = $commandId
        CreatedAtUtc = [DateTime]::UtcNow.ToString("o")
        Path = Join-Path $commandsDir ("{0}-{1}.json" -f $createdAtUtc, $commandId)
    }
}

function Write-BridgeCommand {
    param(
        [string]$TargetKind,
        [string]$Action,
        [hashtable]$Payload
    )

    $meta = Get-NewCommandFileName
    $command = [ordered]@{
        commandId = $meta.CommandId
        createdAtUtc = $meta.CreatedAtUtc
        playerId = $PlayerId
        target = @{
            kind = $TargetKind
            boardId = $null
        }
        action = $Action
        payload = $Payload
    }

    $json = $command | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($meta.Path, $json + "`n", [System.Text.UTF8Encoding]::new($false))
    return $meta.CommandId
}

function Read-BridgeEvents {
    if (-not [System.IO.File]::Exists($eventsFile)) {
        return @()
    }

    $lines = [System.IO.File]::ReadAllLines($eventsFile)
    $events = New-Object System.Collections.Generic.List[object]
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if (-not $trimmed) {
            continue
        }
        try {
            $events.Add(($trimmed | ConvertFrom-Json))
        } catch {
        }
    }
    return $events
}

function Wait-BridgeEvent {
    param(
        [string]$CommandId,
        [string]$EventType,
        [int]$TimeoutMs
    )

    $deadline = [DateTime]::UtcNow.AddMilliseconds([Math]::Max($TimeoutMs, 250))
    while ([DateTime]::UtcNow -lt $deadline) {
        $events = Read-BridgeEvents
        for ($index = $events.Count - 1; $index -ge 0; $index -= 1) {
            $event = $events[$index]
            if ($event.type -ne $EventType) {
                continue
            }
            if (-not $event.payload -or $event.payload.commandId -ne $CommandId) {
                continue
            }
            return $event
        }
        Start-Sleep -Milliseconds 250
    }
    throw "Timed out waiting for $EventType for command $CommandId"
}

function Invoke-ProbeCall {
    param(
        [string]$Method,
        [string[]]$ProbeArgs = @(),
        [int]$TimeoutMs = $ProbeTimeoutMs
    )

    $commandId = Write-BridgeCommand -TargetKind "lua_editor" -Action "probe_call" -Payload @{
        probeMethod = $Method
        probeArgs = $ProbeArgs
    }
    $event = Wait-BridgeEvent -CommandId $commandId -EventType "probe_result" -TimeoutMs $TimeoutMs
    if (-not $event.payload.success) {
        $errorText = if ($event.payload.error) { [string]$event.payload.error } else { "probe_failed" }
        throw "Probe call $Method failed: $errorText"
    }
    return $event
}

function Get-LuaDescribe {
    $event = Invoke-ProbeCall -Method "describe" -ProbeArgs @() -TimeoutMs $ProbeTimeoutMs
    return $event.payload.result
}

function Wait-LuaVisible {
    param(
        [bool]$Visible,
        [int]$TimeoutMs
    )

    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
    $last = $null
    while ([DateTime]::UtcNow -lt $deadline) {
        $last = Get-LuaDescribe
        if ([bool]$last.visible -eq $Visible) {
            return $last
        }
        Start-Sleep -Milliseconds 250
    }
    if ($null -ne $last) {
        return $last
    }
    throw "Timed out waiting for lua_editor visible=$Visible"
}

function Invoke-NativeAhk {
    param(
        [ValidateSet("ctrl_l", "send_key")]
        [string]$Action,
        [bool]$SendEscapeFirst = $false,
        [string]$Key = ""
    )

    $args = @(
        $ahkScript,
        $Action,
        "--window-title", $WindowTitle,
        "--activate", "true",
        "--send-escape-first", ($(if ($SendEscapeFirst) { "true" } else { "false" }))
    )
    if ($Key) {
        $args += @("--key", $Key)
    }
    $args += @("--repeat", "1", "--delay-ms", "120")
    $output = & $ahkExe @args
    if ($LASTEXITCODE -ne 0) {
        throw "AHK action $Action failed with exit code $LASTEXITCODE"
    }
    if (-not $output) {
        throw "AHK action $Action returned no output"
    }
    return ($output | ConvertFrom-Json)
}

function Open-LuaEditorNative {
    $native = Invoke-NativeAhk -Action "ctrl_l"
    if (-not $native.ok) {
        throw "Ctrl+L failed: $($native.error)"
    }

    $recoveryAttempted = $false
    $recoveryEscapeSent = $false
    $recoveryReturnToWorldSent = $false
    $selection = $null

    try {
        $selection = Wait-LuaVisible -Visible $true -TimeoutMs $OpenTimeoutMs
    } catch {
        $recoveryAttempted = $true
        $escape = Invoke-NativeAhk -Action "send_key" -Key "Escape"
        $recoveryEscapeSent = [bool]$escape.ok
        if (-not $recoveryEscapeSent) {
            throw "Recovery Escape failed: $($escape.error)"
        }
        Start-Sleep -Milliseconds 250
        $retry = Invoke-NativeAhk -Action "ctrl_l"
        if (-not $retry.ok) {
            throw "Recovery Ctrl+L failed: $($retry.error)"
        }
        try {
            $selection = Wait-LuaVisible -Visible $true -TimeoutMs $OpenTimeoutMs
        } catch {
            $returnToWorld = Invoke-NativeAhk -Action "send_key" -Key "Escape"
            $recoveryReturnToWorldSent = [bool]$returnToWorld.ok
            throw "Lua editor did not reopen after recovery"
        }
    }

    [pscustomobject]@{
        Invoked = $true
        EditorReady = $true
        RecoveryAttempted = $recoveryAttempted
        RecoveryEscapeSent = $recoveryEscapeSent
        RecoveryReturnToWorldSent = $recoveryReturnToWorldSent
        Visible = [bool]$selection.visible
        Title = [string]$selection.title
        SelectedSlot = [string]$selection.selectedSlot
        SelectedFilter = [string]$selection.selectedFilter
        CodeLength = [int]$selection.codeLength
    }
}

function Save-LuaEditor {
    $commandId = Write-BridgeCommand -TargetKind "lua_editor" -Action "save" -Payload @{
        save = $true
        waitForEditor = $false
    }
    return Wait-BridgeEvent -CommandId $commandId -EventType "command_result" -TimeoutMs 15000
}

function Select-LuaContext {
    $event = Invoke-ProbeCall -Method "select_context" -ProbeArgs @($SlotName, $FilterName, [string]$SelectSettleMs) -TimeoutMs ($ProbeTimeoutMs + $SelectSettleMs + 2000)
    return $event.payload.result
}

function Toggle-LuaMarker {
    $event = Invoke-ProbeCall -Method "raw_eval" -ProbeArgs @($toggleFunctionBody) -TimeoutMs $ProbeTimeoutMs
    return $event.payload.result
}

function Close-LuaEditorIfVisible {
    try {
        $describe = Get-LuaDescribe
        if ($describe.visible) {
            [void](Invoke-ProbeCall -Method "cancel" -ProbeArgs @() -TimeoutMs $ProbeTimeoutMs)
            Start-Sleep -Milliseconds 500
        }
    } catch {
    }
}

$results = New-Object System.Collections.Generic.List[object]
$startedAtUtc = [DateTime]::UtcNow.ToString("o")
$scriptFailed = $false
$failureReason = $null

try {
    Close-LuaEditorIfVisible

    for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
        Write-Host ("[{0}/{1}] open" -f $attempt, $Attempts)
        $open = Open-LuaEditorNative
        if ($open.RecoveryAttempted -and -not $ContinueOnRecovery) {
            throw "Recovery was required on open at attempt $attempt"
        }

        Write-Host ("[{0}/{1}] select {2}.{3}" -f $attempt, $Attempts, $SlotName, $FilterName)
        $selected = Select-LuaContext

        Write-Host ("[{0}/{1}] toggle marker" -f $attempt, $Attempts)
        $toggle = Toggle-LuaMarker
        if (-not $toggle.ok -or -not $toggle.changed) {
            throw "Marker toggle failed at attempt $attempt"
        }

        $dirtyDescribe = Get-LuaDescribe
        if (-not $dirtyDescribe.visible) {
            throw "Lua editor unexpectedly hidden before save at attempt $attempt"
        }

        Write-Host ("[{0}/{1}] save" -f $attempt, $Attempts)
        $saveEvent = Save-LuaEditor
        $afterClose = Wait-LuaVisible -Visible $false -TimeoutMs $SaveCloseTimeoutMs

        Write-Host ("[{0}/{1}] immediate reopen" -f $attempt, $Attempts)
        $reopen = Open-LuaEditorNative
        if ($reopen.RecoveryAttempted -and -not $ContinueOnRecovery) {
            throw "Recovery was required after save at attempt $attempt"
        }

        $record = [pscustomobject]@{
            attempt = $attempt
            openedTitle = $open.Title
            selectedSlot = [string]$selected.selectedSlot
            selectedFilter = [string]$selected.selectedFilter
            beforeLength = [int]$toggle.beforeLength
            afterLength = [int]$toggle.afterLength
            markerPresentAfterToggle = [bool]$toggle.markerPresent
            saveInjectedAtUtc = [string]$saveEvent.createdAtUtc
            closeVisible = [bool]$afterClose.visible
            reopenRecoveryAttempted = [bool]$reopen.RecoveryAttempted
            reopenRecoveryEscapeSent = [bool]$reopen.RecoveryEscapeSent
            reopenRecoveryReturnToWorldSent = [bool]$reopen.RecoveryReturnToWorldSent
            reopenTitle = $reopen.Title
            reopenCodeLength = [int]$reopen.CodeLength
        }
        $results.Add($record)
    }
} catch {
    $scriptFailed = $true
    $failureReason = $_.Exception.Message
    Write-Host ("FAILED: {0}" -f $failureReason)
} finally {
    Close-LuaEditorIfVisible
}

$summary = [ordered]@{
    startedAtUtc = $startedAtUtc
    finishedAtUtc = [DateTime]::UtcNow.ToString("o")
    playerId = $PlayerId
    attemptsRequested = $Attempts
    attemptsCompleted = $results.Count
    failed = $scriptFailed
    failureReason = $failureReason
    continueOnRecovery = [bool]$ContinueOnRecovery
    results = @($results)
}

$stamp = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")
$resultPath = Join-Path $resultsDir ("lua-save-reopen-stress-{0}.json" -f $stamp)
$summaryJson = $summary | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($resultPath, $summaryJson + "`n", [System.Text.UTF8Encoding]::new($false))

Write-Host ("Result file: {0}" -f $resultPath)
if ($scriptFailed) {
    exit 1
}
