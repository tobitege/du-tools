param(
    [string]$TestDir = ".\test-ui-dumps-interleaved"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))
$toolsDir = Join-Path $repoRoot "tools"
$syncScript = Join-Path $toolsDir "sync-ide.ps1"

if ([System.IO.Path]::IsPathRooted($TestDir)) {
    $resolvedTestDir = [System.IO.Path]::GetFullPath($TestDir)
} else {
    $resolvedTestDir = [System.IO.Path]::GetFullPath((Join-Path $scriptDir $TestDir))
}

if (Test-Path $resolvedTestDir) {
    Remove-Item -Recurse -Force $resolvedTestDir
}
New-Item -ItemType Directory -Path $resolvedTestDir | Out-Null
New-Item -ItemType Directory -Path "$resolvedTestDir\payload-overrides" | Out-Null

$NdjsonFile = "$resolvedTestDir\test-dump.ndjson"
Set-Content -Path $NdjsonFile -Value "" -Encoding UTF8

$WorkspaceDir = "$resolvedTestDir\ide-workspace"
$SnippetFile = "$WorkspaceDir\snippet.lua"
$syncOutLog = "$resolvedTestDir\sync-out.log"
$syncErrLog = "$resolvedTestDir\sync-err.log"

function Add-NdjsonLine {
    param([hashtable]$Packet)
    $line = $Packet | ConvertTo-Json -Depth 20 -Compress
    $attempts = 0
    while ($true) {
        try {
            Add-Content -Path $NdjsonFile -Value $line -Encoding UTF8
            return
        } catch {
            $attempts++
            if ($attempts -ge 30) {
                throw
            }
            Start-Sleep -Milliseconds 100
        }
    }
}

Write-Host "1. Starting sync watcher in replay mode..."
$syncProcess = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -File `"$syncScript`" -DumpDir `"$resolvedTestDir`" -IdePath `"`" -ReplayFromStart" -PassThru -RedirectStandardOutput $syncOutLog -RedirectStandardError $syncErrLog -WindowStyle Hidden

try {
    Write-Host "2. Writing interleaved sessions (A part1, B complete, A part2)..."
    Add-NdjsonLine -Packet @{
        serverTimestamp = (Get-Date).ToString("O")
        playerId = 111
        packet = @{
            type = "lua_ide_sync"
            dumpId = "dump-i"
            timestamp = (Get-Date).ToString("O")
            data = @{
                syncId = "sync-a"
                part = 1
                total = 2
                codeChunk = "print('A1')`n"
            }
        }
    }

    Start-Sleep -Milliseconds 250

    Add-NdjsonLine -Packet @{
        serverTimestamp = (Get-Date).ToString("O")
        playerId = 222
        packet = @{
            type = "lua_ide_sync"
            dumpId = "dump-i"
            timestamp = (Get-Date).ToString("O")
            data = @{
                syncId = "sync-b"
                part = 1
                total = 1
                codeChunk = "print('B')"
            }
        }
    }

    Start-Sleep -Milliseconds 250

    Add-NdjsonLine -Packet @{
        serverTimestamp = (Get-Date).ToString("O")
        playerId = 111
        packet = @{
            type = "lua_ide_sync"
            dumpId = "dump-i"
            timestamp = (Get-Date).ToString("O")
            data = @{
                syncId = "sync-a"
                part = 2
                total = 2
                codeChunk = "print('A2')"
            }
        }
    }

    Write-Host "3. Waiting for final snippet..."
    $timeout = 12
    while (-not (Test-Path $SnippetFile) -and $timeout -gt 0) {
        Start-Sleep -Seconds 1
        $timeout--
    }
    if (-not (Test-Path $SnippetFile)) {
        throw "snippet.lua not created"
    }

    Start-Sleep -Seconds 2
    $snippetContent = Get-Content $SnippetFile -Raw
    if ($snippetContent -notmatch "print\('A1'\)" -or $snippetContent -notmatch "print\('A2'\)") {
        throw "Interleaved sync assembly failed; expected completed sync-a payload"
    }

    if (Test-Path $syncOutLog) {
        $log = Get-Content $syncOutLog -Raw
        if ($log -notmatch "Player 111" -or $log -notmatch "Player 222") {
            throw "Expected reassembly logs for both isolated sessions (players 111 and 222)"
        }
    }

    Write-Host "`n[OK] TEST PASSED: interleaved sync sessions remain isolated." -ForegroundColor Green
}
finally {
    Write-Host "4. Cleaning up..."
    if ($null -ne $syncProcess -and -not $syncProcess.HasExited) {
        Stop-Process -Id $syncProcess.Id -Force
        Start-Sleep -Milliseconds 500
    }
}
