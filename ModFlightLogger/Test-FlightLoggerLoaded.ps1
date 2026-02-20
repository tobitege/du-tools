param(
    [string]$ServerRoot = "D:\MyDUserver",
    [string]$ModDllName = "ModFlightLogger.dll"
)

$ErrorActionPreference = "Stop"

$modDllPath = Join-Path $ServerRoot ("wincs\all\Mods\{0}" -f $ModDllName)
$orleansLogPath = Join-Path $ServerRoot "logs\Grains_dev.log"

Write-Host "== FlightLogger Load Check =="
Write-Host "ServerRoot: $ServerRoot"

if (-not (Test-Path $modDllPath)) {
    Write-Warning "Mod DLL not found at expected path."
    Write-Host "Checked: $modDllPath"
} else {
    Write-Host "Mod DLL found:"
    Write-Host "  $modDllPath"
}

if (-not (Test-Path $orleansLogPath)) {
    Write-Error "Expected Orleans log file not found: $orleansLogPath"
}

$loadPatterns = @(
    "FlightLogger mod initialized",
    "ModManagerGrain.*ModFlightLogger\\.dll initialized"
)

$loadMatches = Select-String -Path $orleansLogPath -Pattern $loadPatterns -ErrorAction SilentlyContinue

if (-not $loadMatches) {
    Write-Warning "No FlightLogger load markers found in Orleans log: $orleansLogPath"
    exit 1
}

$latestMatches = $loadMatches | Select-Object -Last 10
$hasInit = $loadMatches | Where-Object { $_.Line -match "FlightLogger mod initialized" }
$hasModManager = $loadMatches | Where-Object { $_.Line -match "Mod .*ModFlightLogger\\.dll initialized" }

Write-Host ""
Write-Host "Latest relevant log lines:"
$latestMatches | ForEach-Object {
    Write-Host ("{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line)
}

Write-Host ""
if ($hasInit -or $hasModManager) {
    if ($hasInit -and $hasModManager) {
        Write-Host "PASS: FlightLogger appears loaded by ModManager and initialized." -ForegroundColor Green
    } elseif ($hasInit) {
        Write-Host "PASS: FlightLogger initialization marker found in Orleans logs." -ForegroundColor Green
    } else {
        Write-Host "PASS: ModManager reports ModFlightLogger.dll initialized." -ForegroundColor Green
    }
    exit 0
}

Write-Warning "Partial evidence found, but full initialization markers are incomplete."
exit 2
