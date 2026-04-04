param(
    [string]$DumpDir = "D:\MyDUserver\tmp\ui-dumps",
    [int]$Port = 8765,
    [UInt64]$PlayerId = 10000
)

$ErrorActionPreference = "Stop"

function Resolve-RigPath {
    param(
        [string]$Path,
        [string]$BasePath
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return [System.IO.Path]::GetFullPath($BasePath)
    }
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $BasePath $Path))
}

function Get-ContentType {
    param([string]$FilePath)
    switch ([System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()) {
        ".html" { return "text/html; charset=utf-8" }
        ".css" { return "text/css; charset=utf-8" }
        ".js" { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".svg" { return "image/svg+xml" }
        ".txt" { return "text/plain; charset=utf-8" }
        default { return "application/octet-stream" }
    }
}

function Send-Bytes {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [byte[]]$Bytes,
        [string]$ContentType,
        [int]$StatusCode = 200
    )
    $Response.StatusCode = $StatusCode
    $Response.ContentType = $ContentType
    $Response.ContentLength64 = $Bytes.Length
    $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    $Response.OutputStream.Close()
}

function Send-Json {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [object]$Payload,
        [int]$StatusCode = 200
    )
    $json = $Payload | ConvertTo-Json -Depth 20 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    Send-Bytes -Response $Response -Bytes $bytes -ContentType "application/json; charset=utf-8" -StatusCode $StatusCode
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

function Get-IdeImportPath {
    param(
        [string]$PayloadOverridesDir,
        [UInt64]$TargetPlayerId
    )

    $playerScoped = Join-Path $PayloadOverridesDir ("ide_import.player-" + [string]$TargetPlayerId + ".lua_editor.json")
    if (Test-Path $playerScoped) {
        return $playerScoped
    }

    $legacy = Join-Path $PayloadOverridesDir "ide_import.json"
    if (Test-Path $legacy) {
        return $legacy
    }

    return $playerScoped
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$uiRoot = Resolve-RigPath -Path "..\..\lua_editor" -BasePath $scriptDir
$probeScriptPath = Resolve-RigPath -Path "..\payload\lua-editor-probe.js" -BasePath $scriptDir
$bridgeScriptPath = Resolve-RigPath -Path ".\lua-editor-rig-bridge.js" -BasePath $scriptDir
$themeCatalogPath = Resolve-RigPath -Path "..\payload\theme-imports\flowery-daisy-palettes.compact.json" -BasePath $scriptDir
$dumpRoot = Resolve-RigPath -Path $DumpDir -BasePath (Get-Location).Path

if (-not (Test-Path $uiRoot)) {
    throw "UI root not found: $uiRoot"
}
if (-not (Test-Path $probeScriptPath)) {
    throw "Probe script not found: $probeScriptPath"
}
if (-not (Test-Path $bridgeScriptPath)) {
    throw "Rig bridge script not found: $bridgeScriptPath"
}
if (-not (Test-Path $themeCatalogPath)) {
    throw "Theme catalog not found: $themeCatalogPath"
}

New-Item -ItemType Directory -Path $dumpRoot -Force | Out-Null
$payloadOverridesDir = Join-Path $dumpRoot "payload-overrides"
New-Item -ItemType Directory -Path $payloadOverridesDir -Force | Out-Null

$dumpFile = Join-Path $dumpRoot "rig-lua-editor.ndjson"
$importFile = Get-IdeImportPath -PayloadOverridesDir $payloadOverridesDir -TargetPlayerId $PlayerId
$indexPath = Join-Path $uiRoot "index.html"
$lastIdeImportAck = $null
$rigStartedUtc = (Get-Date).ToUniversalTime()

if (-not (Test-Path $indexPath)) {
    throw "index.html not found in lua_editor: $indexPath"
}

$uiRootFull = [System.IO.Path]::GetFullPath($uiRoot)

$listener = [System.Net.HttpListener]::new()
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    throw "Failed to start rig server on $prefix. Error: $($_.Exception.Message)"
}

Write-Host "Lua editor rig server started."
Write-Host "URL: $prefix"
Write-Host "UI root: $uiRootFull"
Write-Host "Dump dir: $dumpRoot"
Write-Host "NDJSON file: $dumpFile"
Write-Host "Import file (preferred): $importFile"
Write-Host "Rig started (UTC): $($rigStartedUtc.ToString('O'))"
Write-Host "PlayerId: $PlayerId"
Write-Host "Press Ctrl+C to stop."

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response

        try {
            $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
            if ([string]::IsNullOrWhiteSpace($path)) {
                $path = "/"
            }

            if ($req.HttpMethod -eq "POST" -and $path -eq "/api/mod-action") {
                $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
                $body = $reader.ReadToEnd()
                $reader.Close()

                if ([string]::IsNullOrWhiteSpace($body)) {
                    Send-Json -Response $res -Payload @{ ok = $false; error = "empty body" } -StatusCode 400
                    continue
                }

                $action = $body | ConvertFrom-Json
                $effectivePlayerId = $PlayerId
                if ($null -ne $action.playerId) {
                    try {
                        $effectivePlayerId = [UInt64]$action.playerId
                    } catch {
                        $effectivePlayerId = $PlayerId
                    }
                }

                $packet = $null
                if ($null -ne $action.payload -and -not [string]::IsNullOrWhiteSpace([string]$action.payload)) {
                    try {
                        $packet = ([string]$action.payload) | ConvertFrom-Json
                    } catch {
                        $packet = [ordered]@{
                            type = "raw_payload"
                            parseError = $_.Exception.Message
                            payload = [string]$action.payload
                        }
                    }
                } else {
                    $packet = [ordered]@{
                        type = "empty_payload"
                    }
                }

                $packetType = "unknown"
                if ($null -ne $packet -and $null -ne $packet.type) {
                    $packetType = [string]$packet.type
                }
                if ($packetType -eq "lua_ide_sync" -and $null -ne $packet.data) {
                    $syncId = [string]$packet.data.syncId
                    $part = 0
                    $total = 0
                    $chunkChars = 0
                    try { if ($null -ne $packet.data.part) { $part = [int]$packet.data.part } } catch {}
                    try { if ($null -ne $packet.data.total) { $total = [int]$packet.data.total } } catch {}
                    try { if ($null -ne $packet.data.codeChunk) { $chunkChars = ([string]$packet.data.codeChunk).Length } } catch {}
                    Write-Host ("mod-action lua_ide_sync received (Player {0}, Sync {1}, Part {2}/{3}, chunkChars {4})" -f
                        $effectivePlayerId,
                        $syncId,
                        $part,
                        $total,
                        $chunkChars)
                } else {
                    Write-Host ("mod-action packet received (Player {0}, Type {1})" -f
                        $effectivePlayerId,
                        $packetType)
                }

                $line = [ordered]@{
                    serverTimestamp = (Get-Date).ToUniversalTime().ToString("O")
                    playerId = $effectivePlayerId
                    packet = $packet
                }

                Add-Content -Path $dumpFile -Value (($line | ConvertTo-Json -Depth 30 -Compress)) -Encoding UTF8
                $responsePayload = [ordered]@{
                    ok = $true
                    dumpFile = $dumpFile
                    playerId = $effectivePlayerId
                }
                if ($packetType -eq "theme_catalog_request") {
                    $catalogName = ""
                    $requestId = ""
                    try { if ($null -ne $packet.data.catalogName) { $catalogName = [string]$packet.data.catalogName } } catch {}
                    try { if ($null -ne $packet.data.requestId) { $requestId = [string]$packet.data.requestId } } catch {}
                    if ($catalogName -eq "flowery-daisy") {
                        $catalogJson = Get-Content -LiteralPath $themeCatalogPath -Raw
                        $responsePayload.themeCatalogPayload = [ordered]@{
                            requestId = $requestId
                            catalogName = $catalogName
                            success = $true
                            catalog = $catalogJson | ConvertFrom-Json
                            error = $null
                        }
                    } else {
                        $responsePayload.themeCatalogPayload = [ordered]@{
                            requestId = $requestId
                            catalogName = $catalogName
                            success = $false
                            catalog = $null
                            error = "unsupported_catalog"
                        }
                    }
                }
                Send-Json -Response $res -Payload $responsePayload
                continue
            }

            if ($req.HttpMethod -eq "GET" -and $path -eq "/api/ide-import") {
                $lastWriteUtcClient = [string]$req.QueryString["lastWriteUtc"]
                $importFile = Get-IdeImportPath -PayloadOverridesDir $payloadOverridesDir -TargetPlayerId $PlayerId
                if (-not (Test-Path $importFile)) {
                    Send-Json -Response $res -Payload @{
                        updated = $false
                        exists = $false
                        lastWriteUtc = ""
                    }
                    continue
                }

                $writeUtcDate = [System.IO.File]::GetLastWriteTimeUtc($importFile)
                $writeUtc = $writeUtcDate.ToString("O")
                if ($writeUtcDate -lt $rigStartedUtc) {
                    Send-Json -Response $res -Payload @{
                        updated = $false
                        exists = $true
                        staleIgnored = $true
                        lastWriteUtc = $writeUtc
                        rigStartedUtc = $rigStartedUtc.ToString("O")
                    }
                    continue
                }
                if (-not [string]::IsNullOrWhiteSpace($lastWriteUtcClient) -and $lastWriteUtcClient -eq $writeUtc) {
                    Send-Json -Response $res -Payload @{
                        updated = $false
                        exists = $true
                        lastWriteUtc = $writeUtc
                    }
                    continue
                }

                $raw = Get-Content $importFile -Raw -Encoding UTF8
                try {
                    $obj = $raw | ConvertFrom-Json
                    $code = [string]$obj.code
                    $charLength = if ($null -ne $obj.codeCharLength) { [int]$obj.codeCharLength } else { $code.Length }
                    $utf8Bytes = if ($null -ne $obj.codeUtf8Bytes) { [int]$obj.codeUtf8Bytes } else { [System.Text.Encoding]::UTF8.GetByteCount($code) }
                    $hash32 = if ($null -ne $obj.codeHash32 -and -not [string]::IsNullOrWhiteSpace([string]$obj.codeHash32)) { [string]$obj.codeHash32 } else { Get-TextHash32 -Text $code }
                    $sha256 = if ($null -ne $obj.codeSha256 -and -not [string]::IsNullOrWhiteSpace([string]$obj.codeSha256)) { [string]$obj.codeSha256 } else { Get-TextSha256Hex -Text $code }
                    Send-Json -Response $res -Payload @{
                        updated = $true
                        exists = $true
                        lastWriteUtc = $writeUtc
                        playerId = $obj.playerId
                        code = $code
                        codeCharLength = $charLength
                        codeUtf8Bytes = $utf8Bytes
                        codeHash32 = $hash32
                        codeSha256 = $sha256
                    }
                } catch {
                    Send-Json -Response $res -Payload @{
                        updated = $false
                        exists = $true
                        lastWriteUtc = $writeUtc
                        parseError = $_.Exception.Message
                    }
                }
                continue
            }

            if ($req.HttpMethod -eq "POST" -and $path -eq "/api/ide-import-ack") {
                $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
                $body = $reader.ReadToEnd()
                $reader.Close()

                if ([string]::IsNullOrWhiteSpace($body)) {
                    Send-Json -Response $res -Payload @{ ok = $false; error = "empty body" } -StatusCode 400
                    continue
                }

                try {
                    $ack = $body | ConvertFrom-Json
                    $lastIdeImportAck = [ordered]@{
                        receivedAtUtc = (Get-Date).ToUniversalTime().ToString("O")
                        stage = [string]$ack.stage
                        applied = if ($null -ne $ack.applied) { [bool]$ack.applied } else { $false }
                        match = if ($null -ne $ack.match) { [bool]$ack.match } else { $false }
                        playerId = if ($null -ne $ack.playerId) { [UInt64]$ack.playerId } else { 0 }
                        lastWriteUtc = [string]$ack.lastWriteUtc
                        expectedCharLength = if ($null -ne $ack.expectedCharLength) { [int]$ack.expectedCharLength } else { 0 }
                        actualCharLength = if ($null -ne $ack.actualCharLength) { [int]$ack.actualCharLength } else { 0 }
                        expectedHash32 = [string]$ack.expectedHash32
                        actualHash32 = [string]$ack.actualHash32
                    }

                    $result = if ($lastIdeImportAck.match) { "MATCH" } else { "MISMATCH" }
                    Write-Host ("IDE import ACK: {0} (stage={1}, applied={2}, player={3}, write={4}, expected={5}/{6}, actual={7}/{8})" -f
                        $result,
                        $lastIdeImportAck.stage,
                        $lastIdeImportAck.applied,
                        $lastIdeImportAck.playerId,
                        $lastIdeImportAck.lastWriteUtc,
                        $lastIdeImportAck.expectedCharLength,
                        $lastIdeImportAck.expectedHash32,
                        $lastIdeImportAck.actualCharLength,
                        $lastIdeImportAck.actualHash32)

                    Send-Json -Response $res -Payload @{ ok = $true; result = $result; ack = $lastIdeImportAck }
                } catch {
                    Send-Json -Response $res -Payload @{ ok = $false; error = $_.Exception.Message } -StatusCode 400
                }
                continue
            }

            if ($req.HttpMethod -eq "GET" -and $path -eq "/api/ide-import-ack/latest") {
                if ($null -eq $lastIdeImportAck) {
                    Send-Json -Response $res -Payload @{ ok = $true; exists = $false }
                } else {
                    Send-Json -Response $res -Payload @{ ok = $true; exists = $true; ack = $lastIdeImportAck }
                }
                continue
            }

            if ($req.HttpMethod -eq "GET" -and ($path -eq "/" -or $path -eq "/index.html")) {
                $html = Get-Content $indexPath -Raw -Encoding UTF8
                if ($html -notmatch "lua-editor-rig-bridge.js") {
                    $bridgeVersion = [System.IO.File]::GetLastWriteTimeUtc($bridgeScriptPath).Ticks
                    $rigConfigScript = "<script>window.__UI_TOOLBOX_RIG_CONFIG = { playerId: $PlayerId };</script>"
                    $bridgeScript = "<script src=`"/rig/bridge.js?v=$bridgeVersion`"></script>"
                    $html = $html -replace "</body>", "$rigConfigScript`r`n$bridgeScript`r`n</body>"
                }
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($html)
                Send-Bytes -Response $res -Bytes $bytes -ContentType "text/html; charset=utf-8"
                continue
            }

            if ($req.HttpMethod -eq "GET" -and $path -eq "/rig/bridge.js") {
                $bytes = [System.IO.File]::ReadAllBytes($bridgeScriptPath)
                Send-Bytes -Response $res -Bytes $bytes -ContentType "application/javascript; charset=utf-8"
                continue
            }

            if ($req.HttpMethod -eq "GET" -and $path -eq "/probe/lua-editor-probe.js") {
                $bytes = [System.IO.File]::ReadAllBytes($probeScriptPath)
                Send-Bytes -Response $res -Bytes $bytes -ContentType "application/javascript; charset=utf-8"
                continue
            }

            if ($req.HttpMethod -eq "GET") {
                $relative = $path.TrimStart("/")
                if ($relative.Contains("..")) {
                    Send-Json -Response $res -Payload @{ ok = $false; error = "invalid path" } -StatusCode 400
                    continue
                }

                $candidate = [System.IO.Path]::GetFullPath((Join-Path $uiRootFull ($relative -replace "/", "\")))
                if (-not $candidate.StartsWith($uiRootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
                    Send-Json -Response $res -Payload @{ ok = $false; error = "path outside root" } -StatusCode 403
                    continue
                }

                if (Test-Path $candidate -PathType Leaf) {
                    $bytes = [System.IO.File]::ReadAllBytes($candidate)
                    $contentType = Get-ContentType -FilePath $candidate
                    Send-Bytes -Response $res -Bytes $bytes -ContentType $contentType
                    continue
                }
            }

            Send-Json -Response $res -Payload @{ ok = $false; error = "not found"; path = $path } -StatusCode 404
        } catch {
            try {
                Send-Json -Response $res -Payload @{
                    ok = $false
                    error = $_.Exception.Message
                } -StatusCode 500
            } catch {
                $res.OutputStream.Close()
            }
        }
    }
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
