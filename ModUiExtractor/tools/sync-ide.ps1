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

$LuaFile = Join-Path $WorkspaceDir "snippet.lua"
$ImportDir = Join-Path $DumpDir "payload-overrides"
if (-not (Test-Path $ImportDir)) {
    New-Item -ItemType Directory -Path $ImportDir | Out-Null
}
$ImportFile = Join-Path $ImportDir "ide_import.json"

$fileOffsets = @{}
$syncStates = @{}
$currentPlayerId = 0
$lastLuaContent = $null
$warnedNoPlayerContext = $false
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

function Write-IdeImportFile {
    param(
        [string]$Code,
        [object]$PlayerId
    )

    $safeCode = [string]$Code
    $payload = @{
        playerId = $PlayerId
        code = $safeCode
        codeCharLength = $safeCode.Length
        codeUtf8Bytes = [System.Text.Encoding]::UTF8.GetByteCount($safeCode)
        codeHash32 = Get-TextHash32 -Text $safeCode
        codeSha256 = Get-TextSha256Hex -Text $safeCode
    }
    $json = $payload | ConvertTo-Json -Compress
    $tempFile = "$ImportFile.tmp"
    Set-Content -Path $tempFile -Value $json -Encoding UTF8
    Move-Item -Path $tempFile -Destination $ImportFile -Force
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

    # Evict stale/incomplete sync sessions to avoid unbounded memory growth.
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

    # Check for Lua file changes
    if (Test-Path $LuaFile) {
        try {
            $code = Get-Content $LuaFile -Raw -Encoding UTF8
            if ($null -eq $lastLuaContent) {
                $lastLuaContent = $code
            } elseif ($code -ne $lastLuaContent) {
                Start-Sleep -Milliseconds 100
                $code = Get-Content $LuaFile -Raw -Encoding UTF8
                if ($code -ne $lastLuaContent) {
                    if ([long]$currentPlayerId -le 0) {
                        if (-not $warnedNoPlayerContext) {
                            Write-Host "WARNING: Skipping IDE import write because no valid player context has been seen yet."
                            $warnedNoPlayerContext = $true
                        }
                        $lastLuaContent = $code
                        continue
                    }

                    $importMeta = Write-IdeImportFile -Code $code -PlayerId $currentPlayerId
                    $lastLuaContent = $code
                    $warnedNoPlayerContext = $false
                    Write-Host ("Saved changes to IDE import file (Player {0}, chars {1}, utf8 {2}, h32 {3}, sha256 {4})." -f
                        $currentPlayerId,
                        [int]$importMeta.codeCharLength,
                        [int]$importMeta.codeUtf8Bytes,
                        [string]$importMeta.codeHash32,
                        [string]$importMeta.codeSha256)
                }
            }
        } catch {
            Write-Host "WARNING: Failed to read snippet file: $_"
        }
    }

    # Process all .ndjson files incrementally (per-file offsets avoid replay)
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

    # Prune offsets for files that no longer exist.
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
            # File was truncated/rotated; restart from beginning.
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
                                # Drop oldest session if we're at capacity.
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
                                Set-Content -Path $LuaFile -Value $fullCode -Encoding UTF8
                                try {
                                    $lastLuaContent = Get-Content $LuaFile -Raw -Encoding UTF8
                                } catch {
                                    $lastLuaContent = $fullCode
                                }
                                $currentPlayerId = $state.playerId
                                $h32 = Get-TextHash32 -Text $lastLuaContent
                                $sha = Get-TextSha256Hex -Text $lastLuaContent
                                $utf8Bytes = [System.Text.Encoding]::UTF8.GetByteCount([string]$lastLuaContent)
                                Write-Host ("Reassembled IDE sync packet to {0} (Player {1}, Sync {2}, chars {3}, utf8 {4}, h32 {5}, sha256 {6})" -f
                                    $LuaFile,
                                    $currentPlayerId,
                                    $syncId,
                                    [int]([string]$lastLuaContent).Length,
                                    [int]$utf8Bytes,
                                    $h32,
                                    $sha)

                                if ($null -ne $IdePath -and $IdePath -ne "") {
                                    Start-Process -NoNewWindow -FilePath $IdePath -ArgumentList "`"$LuaFile`""
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
