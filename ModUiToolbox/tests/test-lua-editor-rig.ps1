param(
    [string]$TestDir = ".\test-ui-dumps-rig",
    [int]$Port = 8876,
    [UInt64]$PlayerId = 98765,
    [switch]$KeepArtifacts
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))
$toolsDir = Join-Path $repoRoot "tools"
$rigScript = Join-Path $toolsDir "lua-editor-rig.ps1"
$syncScript = Join-Path $toolsDir "sync-ide.ps1"
if ([System.IO.Path]::IsPathRooted($TestDir)) {
    $resolvedTestDir = [System.IO.Path]::GetFullPath($TestDir)
} else {
    $resolvedTestDir = [System.IO.Path]::GetFullPath((Join-Path $scriptDir $TestDir))
}
$workspaceDir = Join-Path $resolvedTestDir ("ide-workspace\player-" + [string]$PlayerId + "\lua_editor")
$snippetFile = Join-Path $workspaceDir "snippet.lua"
$importFile = Join-Path $resolvedTestDir ("payload-overrides\ide_import.player-" + [string]$PlayerId + ".lua_editor.json")
$rigLog = Join-Path $resolvedTestDir "rig-out.log"
$rigErr = Join-Path $resolvedTestDir "rig-err.log"
$syncLog = Join-Path $resolvedTestDir "sync-out.log"
$syncErr = Join-Path $resolvedTestDir "sync-err.log"

if (Test-Path $resolvedTestDir) {
    Remove-Item -Recurse -Force $resolvedTestDir
}
New-Item -ItemType Directory -Path $resolvedTestDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $resolvedTestDir "payload-overrides") | Out-Null

$rigProcess = $null
$syncProcess = $null
$testPassed = $false

try {
    Write-Host "1. Starting local rig server..."
    $rigArgs = "-NoProfile -File `"$rigScript`" -DumpDir `"$resolvedTestDir`" -Port $Port -PlayerId $PlayerId"
    $rigProcess = Start-Process -FilePath "powershell.exe" -ArgumentList $rigArgs -PassThru -RedirectStandardOutput $rigLog -RedirectStandardError $rigErr -WindowStyle Hidden

    Write-Host "2. Waiting for rig server to become healthy..."
    $timeout = 20
    $healthy = $false
    while ($timeout -gt 0) {
        try {
            $health = Invoke-RestMethod -Method GET -Uri "http://localhost:$Port/api/ide-import" -TimeoutSec 2
            if ($null -ne $health) {
                $healthy = $true
                break
            }
        } catch {
        }
        Start-Sleep -Seconds 1
        $timeout--
    }
    if (-not $healthy) {
        throw "Rig server did not become healthy in time."
    }

    Write-Host "3. Starting sync-ide watcher in replay mode..."
    $syncArgs = "-NoProfile -File `"$syncScript`" -DumpDir `"$resolvedTestDir`" -IdePath `"`" -ReplayFromStart"
    $syncProcess = Start-Process -FilePath "powershell.exe" -ArgumentList $syncArgs -PassThru -RedirectStandardOutput $syncLog -RedirectStandardError $syncErr -WindowStyle Hidden

    Write-Host "4. Sending simulated IDE Sync packet through rig API..."
    $packet = @{
        type = "lua_ide_sync"
        dumpId = "rig-test-dump"
        timestamp = (Get-Date).ToString("O")
        data = @{
            syncId = "rig-sync-1"
            part = 1
            total = 1
            codeChunk = "print('Hello from local rig!')"
        }
    } | ConvertTo-Json -Depth 10 -Compress

    $action = @{
        modName = "NQ.UIToolbox"
        actionId = 900001
        args = @()
        playerId = $PlayerId
        payload = $packet
    } | ConvertTo-Json -Depth 10 -Compress

    Invoke-RestMethod -Method POST -Uri "http://localhost:$Port/api/mod-action" -ContentType "application/json" -Body $action | Out-Null

    Write-Host "5. Waiting for snippet.lua output..."
    $timeout = 15
    while (-not (Test-Path $snippetFile) -and $timeout -gt 0) {
        Start-Sleep -Seconds 1
        $timeout--
    }
    if (-not (Test-Path $snippetFile)) {
        throw "snippet.lua was not created."
    }

    $snippet = Get-Content $snippetFile -Raw
    if ($snippet -notmatch "Hello from local rig!") {
        throw "snippet.lua did not contain the expected exported code."
    }
    Write-Host "   -> snippet.lua created."

    Write-Host "6. Editing snippet.lua to simulate IDE save..."
    Start-Sleep -Seconds 2
    Add-Content -Path $snippetFile -Value "`nprint('Edit from rig test')"

    Write-Host "7. Waiting for ide_import.json..."
    $timeout = 15
    $import = $null
    while ($timeout -gt 0) {
        if (Test-Path $importFile) {
            $import = Get-Content $importFile -Raw | ConvertFrom-Json
            if ($import.code -match "Edit from rig test") {
                break
            }
        }
        Start-Sleep -Seconds 1
        $timeout--
    }
    if ($null -eq $import -or $import.code -notmatch "Edit from rig test") {
        throw "ide_import.json does not include the edited content."
    }
    Write-Host "   -> ide_import.json created."

    Write-Host "8. Verifying /api/ide-import returns updated payload..."
    $apiImport = Invoke-RestMethod -Method GET -Uri "http://localhost:$Port/api/ide-import" -TimeoutSec 5
    if (-not $apiImport.updated) {
        throw "/api/ide-import did not report an update."
    }
    if ($apiImport.code -notmatch "Edit from rig test") {
        throw "/api/ide-import did not return edited code."
    }

    Write-Host "`n[OK] TEST PASSED: local rig + sync watcher loop is working." -ForegroundColor Green
    $testPassed = $true
} finally {
    Write-Host "9. Cleaning up..."
    if ($null -ne $syncProcess -and -not $syncProcess.HasExited) {
        Stop-Process -Id $syncProcess.Id -Force
    }
    if ($null -ne $rigProcess -and -not $rigProcess.HasExited) {
        Stop-Process -Id $rigProcess.Id -Force
    }
    if (-not $KeepArtifacts -and $testPassed -and (Test-Path $resolvedTestDir)) {
        $removed = $false
        for ($attempt = 0; $attempt -lt 10 -and -not $removed; $attempt++) {
            try {
                Remove-Item -Recurse -Force $resolvedTestDir
                $removed = $true
            } catch {
                Start-Sleep -Milliseconds 250
            }
        }
        if (-not $removed) {
            Write-Host "WARNING: Could not remove test artifacts at $resolvedTestDir. Use -KeepArtifacts to silence this warning."
        }
    }
}
