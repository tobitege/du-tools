param(
    [string]$TestDir = ".\test-ui-dumps-no-player"
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
New-Item -ItemType Directory -Path "$resolvedTestDir\ide-workspace" | Out-Null

$SnippetFile = "$resolvedTestDir\ide-workspace\snippet.lua"
$ImportFile = "$resolvedTestDir\payload-overrides\ide_import.json"
$syncOutLog = "$resolvedTestDir\sync-out.log"
$syncErrLog = "$resolvedTestDir\sync-err.log"

Set-Content -Path $SnippetFile -Value "print('initial')" -Encoding UTF8

Write-Host "1. Starting sync watcher with no NDJSON context..."
$syncProcess = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -File `"$syncScript`" -DumpDir `"$resolvedTestDir`" -IdePath `"`"" -PassThru -RedirectStandardOutput $syncOutLog -RedirectStandardError $syncErrLog -WindowStyle Hidden

try {
    Start-Sleep -Seconds 2

    Write-Host "2. Editing snippet.lua before any player/sync packet..."
    Add-Content -Path $SnippetFile -Value "`nprint('edited-without-player-context')"

    Start-Sleep -Seconds 2

    if (Test-Path $ImportFile) {
        throw "ide_import.json should not be written without a valid player context"
    }

    if (Test-Path $syncOutLog) {
        $log = Get-Content $syncOutLog -Raw
        if ($log -notmatch "Skipping IDE import write because no valid player context") {
            throw "Expected warning about missing player context"
        }
    }

    Write-Host "`n[OK] TEST PASSED: no import write occurs without player context." -ForegroundColor Green
}
finally {
    Write-Host "3. Cleaning up..."
    if ($null -ne $syncProcess -and -not $syncProcess.HasExited) {
        Stop-Process -Id $syncProcess.Id -Force
        Start-Sleep -Milliseconds 500
    }
}
