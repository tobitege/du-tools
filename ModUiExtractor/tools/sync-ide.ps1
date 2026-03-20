param(
    [string]$DumpDir = "D:\MyDUserver\tmp\ui-dumps",
    [string]$IdePath = "code",
    [UInt64]$PlayerIdFilter = 0,
    [string]$NdjsonFile = "",
    [switch]$ReplayFromStart,
    [int]$SyncSessionTtlSeconds = 180,
    [int]$MaxSyncParts = 4096,
    [int]$MaxSyncSessions = 512
)

$WorkspaceDir = Join-Path $DumpDir "ide-workspace"
if (-not (Test-Path $WorkspaceDir)) {
    New-Item -ItemType Directory -Path $WorkspaceDir | Out-Null
}

$ImportDir = Join-Path $DumpDir "payload-overrides"
if (-not (Test-Path $ImportDir)) {
    New-Item -ItemType Directory -Path $ImportDir | Out-Null
}

$fileOffsets = @{}
$syncStates = @{}
$workspaceStates = @{}
$resolvedNdjsonFile = $null
$warnedNdjsonSourceMissing = $false
$tailFromEnd = -not $ReplayFromStart

if (-not [string]::IsNullOrWhiteSpace($NdjsonFile)) {
    if ([System.IO.Path]::IsPathRooted($NdjsonFile)) {
        $resolvedNdjsonFile = [System.IO.Path]::GetFullPath($NdjsonFile)
    } else {
        $resolvedNdjsonFile = [System.IO.Path]::GetFullPath((Join-Path $DumpDir $NdjsonFile))
    }
}

function Get-TextSha256Hex {
    param([string]$Text)

    $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha.ComputeHash($bytes)
    } finally {
        $sha.Dispose()
    }
    return (($hash | ForEach-Object { $_.ToString("x2") }) -join "")
}

function Get-TextHash32 {
    param([string]$Text)

    $hash = [uint32]2166136261
    foreach ($ch in [char[]][string]$Text) {
        $code = [int][char]$ch
        $bytes = @(
            [uint32]($code -band 0xFF),
            [uint32](($code -shr 8) -band 0xFF)
        )
        foreach ($b in $bytes) {
            $hash = [uint32]($hash -bxor $b)
            $hash = [uint32](($hash + ($hash -shl 1) + ($hash -shl 4) + ($hash -shl 7) + ($hash -shl 8) + ($hash -shl 24)) -band ([uint64]4294967295))
        }
    }
    return ("{0:x8}" -f $hash)
}

function Build-SyncKey {
    param(
        [object]$PlayerId,
        [string]$SyncId
    )
    return "$PlayerId::$SyncId"
}

function Get-PlayerWorkspaceDirName {
    param([object]$PlayerId)

    return ("player-" + [string]$PlayerId)
}

function Get-NormalizedTargetKind {
    param([string]$TargetKind)

    $normalized = ([string]$TargetKind).Trim().ToLowerInvariant()
    if ($normalized -eq "screen_editor") {
        return "screen_editor"
    }
    return "lua_editor"
}

function Write-AtomicUtf8File {
    param(
        [string]$Path,
        [string]$Content
    )

    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent | Out-Null
    }

    $tempPath = "$Path.tmp"
    Set-Content -Path $tempPath -Value $Content -Encoding UTF8
    Move-Item -Path $tempPath -Destination $Path -Force
}

function Write-AtomicJsonFile {
    param(
        [string]$Path,
        [object]$Object
    )

    $json = ConvertTo-Json -InputObject $Object -Compress -Depth 20
    Write-AtomicUtf8File -Path $Path -Content $json
}

function Get-WorkspaceSpec {
    param(
        [string]$TargetKind,
        [object]$PlayerId
    )

    $normalizedTargetKind = Get-NormalizedTargetKind -TargetKind $TargetKind
    $playerWorkspaceDir = Join-Path $WorkspaceDir (Get-PlayerWorkspaceDirName -PlayerId $PlayerId)
    $targetWorkspaceDir = Join-Path $playerWorkspaceDir $normalizedTargetKind
    if (-not (Test-Path $targetWorkspaceDir)) {
        New-Item -ItemType Directory -Path $targetWorkspaceDir | Out-Null
    }

    $codeFileName = if ($normalizedTargetKind -eq "lua_editor") { "snippet.lua" } else { "snippet.txt" }
    return @{
        targetKind = $normalizedTargetKind
        workspaceDir = $targetWorkspaceDir
        playerId = [UInt64]$PlayerId
        codePath = (Join-Path $targetWorkspaceDir $codeFileName)
        metadataPath = (Join-Path $targetWorkspaceDir "snippet.sync.json")
        importPath = (Join-Path $ImportDir ("ide_import.player-" + [string]$PlayerId + "." + $normalizedTargetKind + ".json"))
    }
}

function Get-WorkspaceState {
    param([hashtable]$WorkspaceSpec)

    $key = [string]$WorkspaceSpec.codePath
    if (-not $workspaceStates.ContainsKey($key)) {
        $workspaceStates[$key] = @{
            targetKind = [string]$WorkspaceSpec.targetKind
            codePath = [string]$WorkspaceSpec.codePath
            metadataPath = [string]$WorkspaceSpec.metadataPath
            importPath = [string]$WorkspaceSpec.importPath
            playerId = 0
            lastCodeContent = $null
            lastCodeWriteUtc = [DateTime]::MinValue
            lastExportMeta = $null
            warnedNoPlayerContext = $false
        }
    }

    return $workspaceStates[$key]
}

function Write-WorkspaceSnapshot {
    param(
        [hashtable]$WorkspaceSpec,
        [string]$Code,
        [object]$Metadata
    )

    Write-AtomicUtf8File -Path ([string]$WorkspaceSpec.codePath) -Content ([string]$Code)
    Write-AtomicJsonFile -Path ([string]$WorkspaceSpec.metadataPath) -Object $Metadata
}

function Write-IdeImportFile {
    param(
        [hashtable]$WorkspaceState,
        [string]$Code
    )

    $safeCode = [string]$Code
    $requestId = "ide-import-" + [Guid]::NewGuid().ToString("N")
    $lastExportMeta = $WorkspaceState.lastExportMeta
    $payload = [ordered]@{
        requestId = $requestId
        targetKind = [string]$WorkspaceState.targetKind
        playerId = [UInt64]$WorkspaceState.playerId
        code = $safeCode
        codeCharLength = $safeCode.Length
        codeUtf8Bytes = [System.Text.Encoding]::UTF8.GetByteCount($safeCode)
        codeHash32 = Get-TextHash32 -Text $safeCode
        codeSha256 = Get-TextSha256Hex -Text $safeCode
        baseCodeHash32 = if ($null -ne $lastExportMeta) { [string]$lastExportMeta.codeHash32 } else { $null }
        baseCodeSha256 = if ($null -ne $lastExportMeta) { [string]$lastExportMeta.codeSha256 } else { $null }
        sourceSyncId = if ($null -ne $lastExportMeta) { [string]$lastExportMeta.syncId } else { $null }
        contextKey = if ($null -ne $lastExportMeta) { [string]$lastExportMeta.contextKey } else { $null }
        reference = if ($null -ne $lastExportMeta) { $lastExportMeta.reference } else { $null }
        exportedAtUtc = if ($null -ne $lastExportMeta) { [string]$lastExportMeta.exportedAtUtc } else { $null }
        workspaceCodePath = [string]$WorkspaceState.codePath
        workspaceMetaPath = [string]$WorkspaceState.metadataPath
        requestCreatedAtUtc = [DateTime]::UtcNow.ToString("O")
    }

    Write-AtomicJsonFile -Path ([string]$WorkspaceState.importPath) -Object $payload
    return $payload
}

Write-Host "Watching for IDE sync packets in $DumpDir..."
if ($PlayerIdFilter -gt 0) {
    Write-Host "Player filter enabled: $PlayerIdFilter"
}
if ($null -ne $resolvedNdjsonFile) {
    Write-Host "NDJSON source filter enabled: $resolvedNdjsonFile"
}
if ($tailFromEnd) {
    Write-Host "Live mode: tailing NDJSON from end on startup (existing content ignored)."
} else {
    Write-Host "Replay mode: reading NDJSON from beginning on startup."
}

while ($true) {
    $nowUtc = [DateTime]::UtcNow

    foreach ($key in @($syncStates.Keys)) {
        $state = $syncStates[$key]
        if ($null -eq $state) {
            $syncStates.Remove($key) | Out-Null
            continue
        }
        $lastUpdateUtc = $state.lastUpdateUtc
        if ($null -eq $lastUpdateUtc) {
            $syncStates.Remove($key) | Out-Null
            continue
        }
        if ((New-TimeSpan -Start $lastUpdateUtc -End $nowUtc).TotalSeconds -gt $SyncSessionTtlSeconds) {
            $syncStates.Remove($key) | Out-Null
        }
    }

    foreach ($workspaceKey in @($workspaceStates.Keys)) {
        $workspaceState = $workspaceStates[$workspaceKey]
        if ($null -eq $workspaceState) {
            $workspaceStates.Remove($workspaceKey) | Out-Null
            continue
        }

        $codePath = [string]$workspaceState.codePath
        if (-not (Test-Path $codePath)) {
            continue
        }

        try {
            $code = Get-Content $codePath -Raw -Encoding UTF8
            if ($null -eq $workspaceState.lastCodeContent) {
                $workspaceState.lastCodeContent = $code
            } elseif ($code -ne $workspaceState.lastCodeContent) {
                Start-Sleep -Milliseconds 100
                $code = Get-Content $codePath -Raw -Encoding UTF8
                if ($code -ne $workspaceState.lastCodeContent) {
                    if ([long]$workspaceState.playerId -le 0) {
                        if (-not $workspaceState.warnedNoPlayerContext) {
                            Write-Host ("WARNING: Skipping IDE import write because no valid player context has been seen yet for {0}." -f $codePath)
                            $workspaceState.warnedNoPlayerContext = $true
                        }
                        $workspaceState.lastCodeContent = $code
                        continue
                    }

                    $importMeta = Write-IdeImportFile -WorkspaceState $workspaceState -Code $code
                    $workspaceState.lastCodeContent = $code
                    $workspaceState.lastCodeWriteUtc = [System.IO.File]::GetLastWriteTimeUtc($codePath)
                    $workspaceState.warnedNoPlayerContext = $false
                    Write-Host ("Saved changes to IDE import file {0} (Target {1}, Player {2}, chars {3}, utf8 {4}, h32 {5}, sha256 {6})." -f
                        [string]$workspaceState.importPath,
                        [string]$workspaceState.targetKind,
                        [UInt64]$workspaceState.playerId,
                        [int]$importMeta.codeCharLength,
                        [int]$importMeta.codeUtf8Bytes,
                        [string]$importMeta.codeHash32,
                        [string]$importMeta.codeSha256)
                }
            }
        } catch {
            Write-Host ("WARNING: Failed to read workspace code file {0}: {1}" -f $codePath, $_)
        }
    }

    $dumpFiles = @()
    if ($null -ne $resolvedNdjsonFile) {
        if (Test-Path $resolvedNdjsonFile -PathType Leaf) {
            if ($warnedNdjsonSourceMissing) {
                Write-Host "NDJSON source file detected: $resolvedNdjsonFile"
                $warnedNdjsonSourceMissing = $false
            }
            $dumpFiles = @(Get-Item -Path $resolvedNdjsonFile)
        } else {
            if (-not $warnedNdjsonSourceMissing) {
                Write-Host "NDJSON source file not found yet: $resolvedNdjsonFile"
                $warnedNdjsonSourceMissing = $true
            }
        }
    } else {
        $dumpFiles = @(Get-ChildItem -Path $DumpDir -Filter "*.ndjson" | Sort-Object FullName)
    }

    $activeDumpPaths = @{}
    foreach ($df in $dumpFiles) {
        $activeDumpPaths[$df.FullName] = $true
    }
    foreach ($offsetPath in @($fileOffsets.Keys)) {
        if (-not $activeDumpPaths.ContainsKey($offsetPath)) {
            $fileOffsets.Remove($offsetPath) | Out-Null
        }
    }

    foreach ($dumpFile in $dumpFiles) {
        if (-not $fileOffsets.ContainsKey($dumpFile.FullName)) {
            if ($tailFromEnd) {
                try {
                    $fileOffsets[$dumpFile.FullName] = [long](Get-Item -Path $dumpFile.FullName).Length
                } catch {
                    $fileOffsets[$dumpFile.FullName] = 0L
                }
            } else {
                $fileOffsets[$dumpFile.FullName] = 0L
            }
        }

        $lastPosition = [long]$fileOffsets[$dumpFile.FullName]
        $fileInfo = New-Object System.IO.FileInfo($dumpFile.FullName)
        if ($fileInfo.Length -lt $lastPosition) {
            $lastPosition = 0L
        }

        if ($fileInfo.Length -gt $lastPosition) {
            $fs = New-Object System.IO.FileStream($dumpFile.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
            $fs.Position = $lastPosition
            $reader = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)

            while ($null -ne ($line = $reader.ReadLine())) {
                if ([string]::IsNullOrWhiteSpace($line)) { continue }
                try {
                    $json = $line | ConvertFrom-Json

                    $packet = $null
                    if ($null -ne $json.packet) { $packet = $json.packet }
                    elseif ($null -ne $json.data) { $packet = $json.data }
                    else { $packet = $json }

                    if ($packet.type -eq "lua_ide_sync") {
                        $playerId = $json.playerId
                        $effectivePlayerId = 0
                        if ($null -ne $playerId) {
                            try {
                                $effectivePlayerId = [UInt64]$playerId
                            } catch {
                                $effectivePlayerId = 0
                            }
                        }
                        if ($PlayerIdFilter -gt 0 -and $effectivePlayerId -ne $PlayerIdFilter) {
                            continue
                        }

                        $data = $packet.data
                        if ($null -eq $data) { continue }

                        $syncId = [string]$data.syncId
                        if ([string]::IsNullOrWhiteSpace($syncId)) { continue }

                        $total = [int]$data.total
                        $part = [int]$data.part
                        if ($total -le 0 -or $part -le 0) { continue }
                        if ($total -gt $MaxSyncParts) { continue }
                        if ($part -gt $total) { continue }

                        $syncKey = Build-SyncKey -PlayerId $effectivePlayerId -SyncId $syncId
                        if (-not $syncStates.ContainsKey($syncKey)) {
                            if ($syncStates.Count -ge $MaxSyncSessions) {
                                $oldestKey = $null
                                $oldestUtc = [DateTime]::MaxValue
                                foreach ($k in $syncStates.Keys) {
                                    $s = $syncStates[$k]
                                    if ($null -eq $s -or $null -eq $s.lastUpdateUtc) { continue }
                                    if ($s.lastUpdateUtc -lt $oldestUtc) {
                                        $oldestUtc = $s.lastUpdateUtc
                                        $oldestKey = $k
                                    }
                                }
                                if ($null -ne $oldestKey) {
                                    $syncStates.Remove($oldestKey) | Out-Null
                                }
                            }

                            $syncStates[$syncKey] = @{
                                expectedTotal = $total
                                chunks = @{}
                                playerId = $effectivePlayerId
                                targetKind = Get-NormalizedTargetKind -TargetKind ([string]$data.targetKind)
                                contextKey = if ($null -ne $data.contextKey) { [string]$data.contextKey } else { "" }
                                reference = if ($null -ne $data.reference) { $data.reference } else { $null }
                                exportedAtUtc = if ($null -ne $data.exportedAtUtc) { [string]$data.exportedAtUtc } else { [DateTime]::UtcNow.ToString("O") }
                                packetCodeHash32 = if ($null -ne $data.codeHash32) { [string]$data.codeHash32 } else { "" }
                                lastUpdateUtc = $nowUtc
                            }
                        }

                        $state = $syncStates[$syncKey]
                        if ($null -eq $state) { continue }

                        if ($total -gt 0 -and $total -le $MaxSyncParts) {
                            $state.expectedTotal = $total
                        }
                        $state.lastUpdateUtc = $nowUtc
                        $state.chunks[$part] = [string]$data.codeChunk

                        $expectedTotal = [int]$state.expectedTotal
                        if ($expectedTotal -gt 0 -and $state.chunks.Count -eq $expectedTotal) {
                            $fullCode = ""
                            for ($i = 1; $i -le $expectedTotal; $i++) {
                                if (-not $state.chunks.ContainsKey($i)) {
                                    $fullCode = $null
                                    break
                                }
                                $fullCode += [string]$state.chunks[$i]
                            }

                            if ($null -ne $fullCode) {
                                $workspaceSpec = Get-WorkspaceSpec -TargetKind ([string]$state.targetKind) -PlayerId $state.playerId
                                $h32 = Get-TextHash32 -Text $fullCode
                                $sha = Get-TextSha256Hex -Text $fullCode
                                $utf8Bytes = [System.Text.Encoding]::UTF8.GetByteCount([string]$fullCode)
                                $metadata = [ordered]@{
                                    targetKind = [string]$state.targetKind
                                    playerId = [UInt64]$state.playerId
                                    syncId = $syncId
                                    exportedAtUtc = [string]$state.exportedAtUtc
                                    contextKey = [string]$state.contextKey
                                    reference = $state.reference
                                    codeCharLength = [int]([string]$fullCode).Length
                                    codeUtf8Bytes = [int]$utf8Bytes
                                    codeHash32 = [string]$h32
                                    codeSha256 = [string]$sha
                                    packetCodeHash32 = [string]$state.packetCodeHash32
                                    codePath = [string]$workspaceSpec.codePath
                                    metadataPath = [string]$workspaceSpec.metadataPath
                                }

                                Write-WorkspaceSnapshot -WorkspaceSpec $workspaceSpec -Code $fullCode -Metadata $metadata

                                $workspaceState = Get-WorkspaceState -WorkspaceSpec $workspaceSpec
                                $workspaceState.targetKind = [string]$workspaceSpec.targetKind
                                $workspaceState.playerId = [UInt64]$state.playerId
                                $workspaceState.lastCodeContent = $fullCode
                                $workspaceState.lastCodeWriteUtc = [System.IO.File]::GetLastWriteTimeUtc([string]$workspaceSpec.codePath)
                                $workspaceState.lastExportMeta = $metadata
                                $workspaceState.warnedNoPlayerContext = $false

                                Write-Host ("Reassembled IDE sync packet to {0} (Target {1}, Player {2}, Sync {3}, chars {4}, utf8 {5}, h32 {6}, sha256 {7})" -f
                                    [string]$workspaceSpec.codePath,
                                    [string]$workspaceSpec.targetKind,
                                    [UInt64]$state.playerId,
                                    $syncId,
                                    [int]([string]$fullCode).Length,
                                    [int]$utf8Bytes,
                                    $h32,
                                    $sha)

                                if ($null -ne $IdePath -and $IdePath -ne "") {
                                    Start-Process -NoNewWindow -FilePath $IdePath -ArgumentList "`"$([string]$workspaceSpec.codePath)`""
                                }
                            }

                            $syncStates.Remove($syncKey) | Out-Null
                        }
                    }
                } catch {
                    # Ignore parsing errors
                }
            }
            $fileOffsets[$dumpFile.FullName] = $fs.Position
            $reader.Close()
            $fs.Close()
        }
    }

    Start-Sleep -Milliseconds 500
}
