param(
    [string]$TestDir = ".\test-ui-dumps-replay"
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

$FileA = "$resolvedTestDir\a.ndjson"
$FileB = "$resolvedTestDir\b.ndjson"
Set-Content -Path $FileA -Value "" -Encoding UTF8
Set-Content -Path $FileB -Value "" -Encoding UTF8

$WorkspaceDir = "$resolvedTestDir\ide-workspace"
$SnippetFile = "$WorkspaceDir\snippet.lua"
$syncOutLog = "$resolvedTestDir\sync-out.log"
$syncErrLog = "$resolvedTestDir\sync-err.log"

function Add-NdjsonLine {
    param(
        [string]$Path,
        [hashtable]$Packet
    )
    $line = $Packet | ConvertTo-Json -Depth 20 -Compress
    $attempts = 0
    while ($true) {
        try {
            Add-Content -Path $Path -Value $line -Encoding UTF8
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
    Write-Host "2. Writing initial lua_ide_sync packet to a.ndjson..."
    Add-NdjsonLine -Path $FileA -Packet @{
        serverTimestamp = (Get-Date).ToString("O")
        playerId = 12345
        packet = @{
            type = "lua_ide_sync"
            dumpId = "dump-a"
            timestamp = (Get-Date).ToString("O")
            data = @{
                syncId = "sync-a-1"
                part = 1
                total = 1
                codeChunk = "print('from-a-initial')"
            }
        }
    }

    Write-Host "3. Waiting for snippet.lua..."
    $timeout = 12
    while (-not (Test-Path $SnippetFile) -and $timeout -gt 0) {
        Start-Sleep -Seconds 1
        $timeout--
    }
    if (-not (Test-Path $SnippetFile)) {
        throw "snippet.lua not created"
    }

    $initialContent = Get-Content $SnippetFile -Raw
    if ($initialContent -notmatch "from-a-initial") {
        throw "Unexpected initial snippet content"
    }
    $initialWrite = [System.IO.File]::GetLastWriteTimeUtc($SnippetFile)

    Write-Host "4. Switching activity to b.ndjson (noise packet)..."
    Add-NdjsonLine -Path $FileB -Packet @{
        serverTimestamp = (Get-Date).ToString("O")
        playerId = 999
        packet = @{
            type = "noise"
            dumpId = "dump-b"
            timestamp = (Get-Date).ToString("O")
            data = @{ value = 1 }
        }
    }

    Start-Sleep -Milliseconds 900

    Write-Host "5. Touching a.ndjson with non-sync line (should NOT replay old sync)..."
    Add-NdjsonLine -Path $FileA -Packet @{
        serverTimestamp = (Get-Date).ToString("O")
        playerId = 12345
        packet = @{
            type = "noise"
            dumpId = "dump-a"
            timestamp = (Get-Date).ToString("O")
            data = @{ value = 2 }
        }
    }

    Start-Sleep -Seconds 2

    $afterWrite = [System.IO.File]::GetLastWriteTimeUtc($SnippetFile)
    $afterContent = Get-Content $SnippetFile -Raw
    if ($afterContent -notmatch "from-a-initial") {
        throw "Snippet content changed unexpectedly"
    }
    if ($afterWrite -ne $initialWrite) {
        throw "Snippet was rewritten unexpectedly (replay regression)"
    }

    if (Test-Path $syncOutLog) {
        $log = Get-Content $syncOutLog -Raw
        $reassembleMatches = ([regex]::Matches($log, "Reassembled IDE sync packet")).Count
        if ($reassembleMatches -ne 1) {
            throw "Expected exactly 1 reassembly, got $reassembleMatches"
        }
    }

    Write-Host "`n[OK] TEST PASSED: no replay on dump-file switching." -ForegroundColor Green
}
finally {
    Write-Host "6. Cleaning up..."
    if ($null -ne $syncProcess -and -not $syncProcess.HasExited) {
        Stop-Process -Id $syncProcess.Id -Force
        Start-Sleep -Milliseconds 500
    }
}
