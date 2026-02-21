param(
    [string]$TestDir = ".\test-ui-dumps"
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

# Setup test directory structure
if (Test-Path $resolvedTestDir) {
    Remove-Item -Recurse -Force $resolvedTestDir
}
New-Item -ItemType Directory -Path $resolvedTestDir | Out-Null
New-Item -ItemType Directory -Path "$resolvedTestDir\payload-overrides" | Out-Null

$NdjsonFile = "$resolvedTestDir\test-dump.ndjson"
$WorkspaceDir = "$resolvedTestDir\ide-workspace"
$SnippetFile = "$WorkspaceDir\snippet.lua"
$ImportFile = "$resolvedTestDir\payload-overrides\ide_import.json"

Write-Host "1. Creating mock NDJSON file..."
$mockPacket = @{
    serverTimestamp = (Get-Date).ToString("O")
    playerId = 12345
    packet = @{
        type = "lua_ide_sync"
        dumpId = "test-dump"
        timestamp = (Get-Date).ToString("O")
        data = @{
            syncId = "sync-1"
            part = 1
            total = 1
            codeChunk = "print('Hello from simulated game client!')"
        }
    }
}
$mockPacket | ConvertTo-Json -Depth 10 -Compress | Out-File -FilePath $NdjsonFile -Encoding UTF8

Write-Host "2. Starting sync-ide.ps1 in replay mode (from beginning) in the background..."
$syncProcess = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -File `"$syncScript`" -DumpDir `"$resolvedTestDir`" -IdePath `"`" -ReplayFromStart" -PassThru -RedirectStandardOutput "$resolvedTestDir\sync-out.log" -RedirectStandardError "$resolvedTestDir\sync-err.log" -WindowStyle Hidden

try {
    Write-Host "3. Waiting for sync-ide.ps1 to process the NDJSON and create snippet.lua..."
    $timeout = 10
    while (-not (Test-Path $SnippetFile) -and $timeout -gt 0) {
        Start-Sleep -Seconds 1
        $timeout--
    }

    if (-not (Test-Path $SnippetFile)) {
        throw "Test failed: snippet.lua was not created."
    }

    $snippetContent = Get-Content $SnippetFile -Raw
    Write-Host "   -> snippet.lua created with content: $snippetContent"

    Write-Host "4. Simulating IDE edit by appending to snippet.lua (sleeping 2s first to guarantee LastWriteTime change)..."
    Start-Sleep -Seconds 2
    Add-Content -Path $SnippetFile -Value "`nprint('Hello from simulated IDE!')"

    Write-Host "5. Waiting for sync-ide.ps1 to detect the edit and create ide_import.json..."
    $timeout = 10
    while (-not (Test-Path $ImportFile) -and $timeout -gt 0) {
        Start-Sleep -Seconds 1
        $timeout--
    }

    if (-not (Test-Path $ImportFile)) {
        throw "Test failed: ide_import.json was not created."
    }

    $importContent = Get-Content $ImportFile -Raw | ConvertFrom-Json
    Write-Host "   -> ide_import.json created. Captured code:"
    Write-Host $importContent.code

    if ($importContent.code -match "Hello from simulated IDE!") {
        Write-Host "`n[OK] TEST PASSED: 2-way file synchronization works perfectly!" -ForegroundColor Green
    } else {
        throw "Test failed: ide_import.json did not contain the edited code."
    }
} finally {
    Write-Host "6. Cleaning up..."
    if ($null -ne $syncProcess -and -not $syncProcess.HasExited) {
        Stop-Process -Id $syncProcess.Id -Force
        Start-Sleep -Seconds 1
    }
    # Remove-Item -Recurse -Force $TestDir
}
