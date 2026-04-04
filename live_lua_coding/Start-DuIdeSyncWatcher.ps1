param(
    [string]$DumpDir = "D:\MyDUserver\tmp\ui-dumps",
    [string]$IdePath = "cursor",
    [switch]$ForceNew
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
$syncScript = Join-Path $repoRoot "ModUiToolbox\tools\sync-ide.ps1"

if (-not (Test-Path $syncScript)) {
    throw "sync-ide.ps1 not found at $syncScript"
}

$pwsh = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if ([string]::IsNullOrWhiteSpace($pwsh)) {
    throw "pwsh.exe not found in PATH"
}

$resolvedDumpDir = [System.IO.Path]::GetFullPath($DumpDir)

function Get-SyncIdeWatcherProcess {
    param([string]$ResolvedDumpDir)

    $escapedDumpDir = [Regex]::Escape($ResolvedDumpDir)
    Get-CimInstance Win32_Process |
        Where-Object {
            $_.Name -match '^(pwsh|powershell)(\.exe)?$' -and
            $_.CommandLine -match 'sync-ide\.ps1' -and
            $_.CommandLine -match $escapedDumpDir
        } |
        Select-Object ProcessId, Name, CommandLine
}

$existing = @(Get-SyncIdeWatcherProcess -ResolvedDumpDir $resolvedDumpDir)

if ($existing.Count -gt 0 -and -not $ForceNew) {
    Write-Host "sync-ide watcher already running for $resolvedDumpDir"
    $existing | Format-Table -AutoSize
    Write-Host ""
    Write-Host "No new watcher started."
    Write-Host "This helper does not start or stop DuMcpBridge/MCP."
    return
}

$argumentList = @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", $syncScript,
    "-DumpDir", $resolvedDumpDir,
    "-IdePath", $IdePath
)

$process = Start-Process `
    -FilePath $pwsh `
    -ArgumentList $argumentList `
    -WorkingDirectory (Join-Path $repoRoot "ModUiToolbox") `
    -PassThru

Write-Host "Started sync-ide watcher."
Write-Host ("PID: {0}" -f $process.Id)
Write-Host ("DumpDir: {0}" -f $resolvedDumpDir)
Write-Host ("IdePath: {0}" -f $IdePath)
Write-Host ""
Write-Host "This helper only manages sync-ide.ps1."
Write-Host "DuMcpBridge/MCP remains manual and is not started or stopped here."
