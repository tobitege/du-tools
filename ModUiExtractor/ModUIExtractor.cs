using Orleans;
using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Data.Common;
using System.Security.Cryptography;
using System.Reflection;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Collections.Concurrent;
using Backend;
using NQ;
using NQ.Interfaces;
using NQutils;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;
#if DU_CHAT_SERVER_READ
using NQutils.Sql;
#endif

public sealed class UiDumpPacketEnvelope
{
    public string? type { get; set; }
    public string? dumpId { get; set; }
    public string? section { get; set; }
    public int? part { get; set; }
    public int? total { get; set; }
    public string? timestamp { get; set; }
}

sealed class LuaMcpResultChunkAssembly
{
    public object Gate { get; } = new();
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public int ExpectedTotal { get; set; }
    public Dictionary<int, string> Chunks { get; } = new();
}

sealed class ServerChatSqlTable
{
    public string Schema { get; set; } = "";
    public string Table { get; set; } = "";
    public Dictionary<string, string> Columns { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
}

sealed class IdeImportResultState
{
    public string RequestId { get; set; } = "";
    public bool Success { get; set; }
    public bool Retryable { get; set; } = true;
    public string Status { get; set; } = "";
    public DateTime ReceivedAtUtc { get; set; } = DateTime.UtcNow;
    public JObject Payload { get; set; } = new JObject();
}

sealed class IdeImportWatchState
{
    public DateTime LastObservedWriteUtc { get; set; } = DateTime.MinValue;
    public string LastObservedContent { get; set; } = "";
    public string LastAttemptedRequestId { get; set; } = "";
    public DateTime LastAttemptAtUtc { get; set; } = DateTime.MinValue;
}

public sealed class MyDuMod : IMod
{
    private const string ModName = "NQ.UIExtractor";
    private const ulong ActionRunSafe = 1;
    private const ulong ActionRunDeep = 2;
    private const ulong ActionExtractAllCss = 3;
    private const ulong ActionExtractFromTargetFile = 4;
    private const ulong ActionInjectLuaProbe = 5;
    private const ulong ActionExtractAllScripts = 6;
    private const ulong ActionIngestPacket = 900001;
    private const ulong PrivateChatChannelId = 2;
    private const string EmbeddedPayloadResourceName = "ModUiExtractor-payload.js";
    private const string EmbeddedLuaProbeResourceName = "lua-editor-probe.js";
    private const string PayloadOverridesDirectoryName = "payload-overrides";
    private const string RuntimeExtractorPayloadFileName = "ModUiExtractor-payload.override.js";
    private const string RuntimeLuaProbePayloadFileName = "lua-editor-probe.override.js";
    private const string RuntimeLuaProbeModulesDirectoryName = "lua-editor-probe.modules";
    private const string RuntimeLuaProbeModulesManifestFileName = "manifest.txt";
    private const string IdeImportFilePattern = "ide_import.player-*.json";

    /// <summary>
    /// Outer IIFE for lua-editor-probe module concat. Must match <c>tools/build-lua-probe.ps1</c>
    /// (<c>LuaProbeIifePreamble</c> / <c>LuaProbeIifePostamble</c>); module files omit this wrapper so they parse in the IDE.
    /// </summary>
    private const string LuaProbeModulesPreamble = "(function () {\r\n  \"use strict\";\r\n\r\n";

    private const string LuaProbeModulesPostamble = "\r\n})();";
    private const string DefaultTargetStylesheetHref = "coui://data/gui/hud/dpu_editor/css/dpu_editor.css";
    private const string TargetStylesheetFileName = "target-stylesheet-url.txt";
    private const string McpBridgeDirectoryName = "mcp-bridge";
    private const string McpBridgeCommandsDirectoryName = "commands";
    private const string McpBridgeEventsDirectoryName = "events";
    private const string McpBridgeStateDirectoryName = "state";
    private const string McpBridgeProcessedCommandsDirectoryName = "processed-commands";
    private const int MaxLuaMcpResultChunkCount = 256;
    private static readonly TimeSpan LuaMcpResultChunkTtl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan IdeImportResultTtl = TimeSpan.FromMinutes(10);

    private IServiceProvider services = null!;
    private IClusterClient orleans = null!;
    private IPub pub = null!;
    private ILogger logger = null!;
    private string outputDirectory = "";
    private string payloadOverridesDirectory = "";
    private string targetStylesheetFilePath = "";
    private string runtimeExtractorPayloadPath = "";
    private string runtimeLuaProbePayloadPath = "";
    private string runtimeLuaProbeModulesDirectoryPath = "";
    private string runtimeLuaProbeModulesManifestPath = "";
    private string mcpBridgeRootDirectory = "";
    private string mcpBridgeCommandsDirectory = "";
    private string mcpBridgeEventsDirectory = "";
    private string mcpBridgeStateDirectory = "";
    private string mcpBridgeProcessedCommandsDirectory = "";
    private string payloadJs = "";
    private string luaProbeJs = "";
    private readonly ConcurrentDictionary<string, object> dumpFileLocks = new();
    private readonly ConcurrentDictionary<string, LuaMcpResultChunkAssembly> luaMcpResultChunkAssemblies = new();
    private readonly ConcurrentDictionary<string, IdeImportResultState> ideImportResultsByRequestId = new ConcurrentDictionary<string, IdeImportResultState>(StringComparer.Ordinal);

    public string GetName()
    {
        return ModName;
    }

    private Task? ideImportTask;
    private Task? mcpBridgeCommandTask;

    public Task Initialize(IServiceProvider isp)
    {
        services = isp;
        orleans = isp.GetRequiredService<IClusterClient>();
        pub = isp.GetRequiredService<IPub>();
        logger = isp.GetRequiredService<ILogger<MyDuMod>>();

        var runtimeLayoutResolved = TryResolveServerRoot(AppContext.BaseDirectory, out var serverRoot);
        if (!runtimeLayoutResolved)
        {
            logger.LogWarning(
                "UIExtractor could not resolve server root from AppContext.BaseDirectory ({BaseDir}); falling back to current directory ({CurrentDir})",
                AppContext.BaseDirectory,
                serverRoot);
        }

        outputDirectory = Path.Combine(serverRoot, "tmp", "ui-dumps");
        Directory.CreateDirectory(outputDirectory);
        payloadOverridesDirectory = Path.Combine(outputDirectory, PayloadOverridesDirectoryName);
        Directory.CreateDirectory(payloadOverridesDirectory);

        targetStylesheetFilePath = Path.Combine(outputDirectory, TargetStylesheetFileName);
        runtimeExtractorPayloadPath = Path.Combine(payloadOverridesDirectory, RuntimeExtractorPayloadFileName);
        runtimeLuaProbePayloadPath = Path.Combine(payloadOverridesDirectory, RuntimeLuaProbePayloadFileName);
        runtimeLuaProbeModulesDirectoryPath = Path.Combine(payloadOverridesDirectory, RuntimeLuaProbeModulesDirectoryName);
        runtimeLuaProbeModulesManifestPath = Path.Combine(runtimeLuaProbeModulesDirectoryPath, RuntimeLuaProbeModulesManifestFileName);
        mcpBridgeRootDirectory = Path.Combine(outputDirectory, McpBridgeDirectoryName);
        mcpBridgeCommandsDirectory = Path.Combine(mcpBridgeRootDirectory, McpBridgeCommandsDirectoryName);
        mcpBridgeEventsDirectory = Path.Combine(mcpBridgeRootDirectory, McpBridgeEventsDirectoryName);
        mcpBridgeStateDirectory = Path.Combine(mcpBridgeRootDirectory, McpBridgeStateDirectoryName);
        mcpBridgeProcessedCommandsDirectory = Path.Combine(mcpBridgeStateDirectory, McpBridgeProcessedCommandsDirectoryName);
        Directory.CreateDirectory(runtimeLuaProbeModulesDirectoryPath);
        Directory.CreateDirectory(mcpBridgeCommandsDirectory);
        Directory.CreateDirectory(mcpBridgeEventsDirectory);
        Directory.CreateDirectory(mcpBridgeStateDirectory);
        Directory.CreateDirectory(mcpBridgeProcessedCommandsDirectory);
        EnsureTargetStylesheetFile();

        payloadJs = LoadEmbeddedScriptSafe(EmbeddedPayloadResourceName, "extractor payload");
        if (string.IsNullOrWhiteSpace(payloadJs))
        {
            logger.LogError("UIExtractor payload JS is empty; injection action will fail");
        }
        else
        {
            EnsureRuntimeOverrideFile(runtimeExtractorPayloadPath, payloadJs, "extractor payload");
        }

        luaProbeJs = LoadEmbeddedScriptSafe(EmbeddedLuaProbeResourceName, "lua probe");
        if (string.IsNullOrWhiteSpace(luaProbeJs))
        {
            logger.LogError("UIExtractor Lua probe JS is empty; probe action will fail");
        }
        else
        {
            EnsureRuntimeOverrideFile(runtimeLuaProbePayloadPath, luaProbeJs, "lua probe");
        }

        logger.LogInformation(
            "UIExtractor initialized. Payload bytes={PayloadSize}, LuaProbe bytes={LuaProbeSize}, output={OutputDirectory}, overrides={OverridesDir}, extractorOverride={ExtractorOverridePath}, luaProbeOverride={LuaProbeOverridePath}, luaProbeModulesDir={LuaProbeModulesDir}, luaProbeModulesManifest={LuaProbeModulesManifest}, targetStylesheetFile={TargetStylesheetFile}, mcpBridgeRoot={McpBridgeRoot}, mcpBridgeCommands={McpBridgeCommands}, mcpBridgeEvents={McpBridgeEvents}",
            payloadJs.Length,
            luaProbeJs.Length,
            outputDirectory,
            payloadOverridesDirectory,
            runtimeExtractorPayloadPath,
            runtimeLuaProbePayloadPath,
            runtimeLuaProbeModulesDirectoryPath,
            runtimeLuaProbeModulesManifestPath,
            targetStylesheetFilePath,
            mcpBridgeRootDirectory,
            mcpBridgeCommandsDirectory,
            mcpBridgeEventsDirectory);

        ideImportTask = Task.Run(WatchIdeImportFile);
        mcpBridgeCommandTask = Task.Run(WatchMcpBridgeCommands);

        return Task.CompletedTask;
    }

    private async Task WatchIdeImportFile()
    {
        var watchStates = new Dictionary<string, IdeImportWatchState>(StringComparer.OrdinalIgnoreCase);
        while (true)
        {
            try
            {
                await Task.Delay(500);

                CleanupExpiredIdeImportResults(DateTime.UtcNow);

                if (!Directory.Exists(payloadOverridesDirectory))
                {
                    continue;
                }

                var importPaths = Directory
                    .GetFiles(payloadOverridesDirectory, IdeImportFilePattern)
                    .OrderBy(static path => path, StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                var activePaths = new HashSet<string>(importPaths, StringComparer.OrdinalIgnoreCase);
                foreach (var knownPath in watchStates.Keys.ToArray())
                {
                    if (!activePaths.Contains(knownPath))
                    {
                        watchStates.Remove(knownPath);
                    }
                }

                foreach (var importPath in importPaths)
                {
                    await ProcessIdeImportFile(importPath, watchStates);
                }
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "UIExtractor IDE import watcher tick failed");
            }
        }
    }

    private async Task ProcessIdeImportFile(string importPath, Dictionary<string, IdeImportWatchState> watchStates)
    {
        IdeImportWatchState watchState;
        if (!watchStates.TryGetValue(importPath, out watchState))
        {
            watchState = new IdeImportWatchState();
            watchStates[importPath] = watchState;
        }

        DateTime writeTime;
        string content;
        try
        {
            writeTime = File.GetLastWriteTimeUtc(importPath);
            content = await File.ReadAllTextAsync(importPath);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "UIExtractor failed to read IDE import file {ImportPath}", importPath);
            return;
        }

        var hasPotentialChange = writeTime != watchState.LastObservedWriteUtc || !string.Equals(content, watchState.LastObservedContent, StringComparison.Ordinal);

        JObject obj;
        try
        {
            obj = JObject.Parse(content);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "UIExtractor failed to parse IDE import file {ImportPath}", importPath);
            return;
        }

        if (!TryParseIdeImportPayload(obj, importPath, out var playerId, out var requestId, out var targetKind, out var code))
        {
            return;
        }

        IdeImportResultState resultState;
        if (ideImportResultsByRequestId.TryGetValue(requestId, out resultState))
        {
            watchState.LastObservedWriteUtc = writeTime;
            watchState.LastObservedContent = content;
            watchState.LastAttemptedRequestId = requestId;
            watchState.LastAttemptAtUtc = resultState.ReceivedAtUtc;
            return;
        }

        var shouldAttempt =
            hasPotentialChange ||
            !string.Equals(watchState.LastAttemptedRequestId, requestId, StringComparison.Ordinal) ||
            watchState.LastAttemptAtUtc == DateTime.MinValue;

        if (!shouldAttempt)
        {
            return;
        }

        var serializedPayload = obj.ToString(Newtonsoft.Json.Formatting.None);
        var injectCode =
            "(function(){" +
            "var payload=" + serializedPayload + ";" +
            "var probe=window.__UI_EXTRACTOR_LUA_PROBE_STATE__;" +
            "if(probe&&typeof probe.applyIdeImport==='function'){probe.applyIdeImport(payload);}" +
            "})();";
        var modeTag = string.Equals(targetKind, "screen_editor", StringComparison.OrdinalIgnoreCase)
            ? "ide-sync-screen"
            : "ide-sync";

        watchState.LastAttemptAtUtc = DateTime.UtcNow;
        watchState.LastAttemptedRequestId = requestId;
        await InjectJavaScript(playerId, injectCode, modeTag, notifyMessage: null, notifyPlayer: false);
    }

    private static bool TryParseIdeImportPayload(
        JObject obj,
        string importPath,
        out ulong playerId,
        out string requestId,
        out string targetKind,
        out string code)
    {
        playerId = 0;
        requestId = "";
        targetKind = "lua_editor";
        code = "";

        if (!obj.TryGetValue("playerId", out var playerIdToken) || playerIdToken.Type == JTokenType.Null)
        {
            return false;
        }

        try
        {
            playerId = playerIdToken.Value<ulong>();
        }
        catch
        {
            return false;
        }

        if (playerId == 0)
        {
            return false;
        }

        if (obj.TryGetValue("code", out var codeToken))
        {
            code = codeToken.Type == JTokenType.Null ? string.Empty : (codeToken.Value<string>() ?? string.Empty);
        }

        requestId = obj["requestId"]?.Value<string>()?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(requestId))
        {
            return false;
        }

        targetKind = obj["targetKind"]?.Value<string>()?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(targetKind))
        {
            targetKind = Path.GetFileName(importPath).IndexOf("screen_editor", StringComparison.OrdinalIgnoreCase) >= 0
                ? "screen_editor"
                : "lua_editor";
        }
        targetKind = string.Equals(targetKind, "screen_editor", StringComparison.OrdinalIgnoreCase)
            ? "screen_editor"
            : "lua_editor";
        obj["targetKind"] = targetKind;

        return true;
    }

    private void RegisterIdeImportResult(JObject packetData)
    {
        var requestId = packetData["requestId"]?.Value<string>()?.Trim();
        if (string.IsNullOrWhiteSpace(requestId))
        {
            return;
        }

        var state = new IdeImportResultState
        {
            RequestId = requestId,
            Success = packetData["success"]?.Value<bool>() ?? false,
            Retryable = packetData["retryable"]?.Value<bool?>() ?? true,
            Status = packetData["status"]?.Value<string>() ?? "",
            ReceivedAtUtc = DateTime.UtcNow,
            Payload = packetData
        };

        ideImportResultsByRequestId[requestId] = state;
    }

    private void CleanupExpiredIdeImportResults(DateTime nowUtc)
    {
        foreach (var entry in ideImportResultsByRequestId)
        {
            if (nowUtc - entry.Value.ReceivedAtUtc <= IdeImportResultTtl)
            {
                continue;
            }

            ideImportResultsByRequestId.TryRemove(entry.Key, out _);
        }
    }

    private async Task WatchMcpBridgeCommands()
    {
        while (true)
        {
            try
            {
                await Task.Delay(500);

                if (!Directory.Exists(mcpBridgeCommandsDirectory))
                {
                    continue;
                }

                foreach (var commandPath in Directory.GetFiles(mcpBridgeCommandsDirectory, "*.json").OrderBy(static p => p, StringComparer.OrdinalIgnoreCase))
                {
                    await ProcessMcpBridgeCommandFile(commandPath);
                }
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "UIExtractor MCP bridge command watcher tick failed");
            }
        }
    }

    private async Task ProcessMcpBridgeCommandFile(string commandPath)
    {
        var commandId = Path.GetFileNameWithoutExtension(commandPath);
        ulong? playerId = null;
        var targetKind = "bridge";
        string? boardId = null;

        try
        {
            var raw = await File.ReadAllTextAsync(commandPath, Encoding.UTF8);
            var command = JObject.Parse(raw);

            commandId = command["commandId"]?.Value<string>() ?? commandId;
            if (command.TryGetValue("playerId", out var playerIdToken) && playerIdToken.Type != JTokenType.Null)
            {
                playerId = playerIdToken.Value<ulong>();
            }

            targetKind = command.SelectToken("target.kind")?.Value<string>()?.Trim() ?? "bridge";
            boardId = command.SelectToken("target.boardId")?.Value<string>();
            var action = command["action"]?.Value<string>()?.Trim() ?? "";
            var payload = command["payload"] as JObject ?? new JObject();

            if (!playerId.HasValue || playerId.Value == 0)
            {
                await AppendMcpBridgeEvent(
                    targetKind,
                    "command_result",
                    null,
                    new JObject
                    {
                        ["commandId"] = commandId,
                        ["status"] = "rejected",
                        ["reason"] = "missing_player_id"
                    },
                    boardId);

                MoveMcpBridgeCommandToProcessed(commandPath, commandId);
                return;
            }

            if (await TryProcessServerChatBridgeCommand(commandId, targetKind, action, payload, playerId.Value, boardId))
            {
                MoveMcpBridgeCommandToProcessed(commandPath, commandId);
                return;
            }

            if (!TryBuildMcpBridgeCommandScript(commandId, targetKind, action, payload, out var injectCode, out var summary, out var status, out var details))
            {
                await AppendMcpBridgeEvent(
                    targetKind,
                    "command_result",
                    playerId,
                    new JObject
                    {
                        ["commandId"] = commandId,
                        ["status"] = status,
                        ["reason"] = details ?? "unsupported_command",
                        ["action"] = action
                    },
                    boardId);

                MoveMcpBridgeCommandToProcessed(commandPath, commandId);
                return;
            }

            var injected = await InjectJavaScript(
                playerId.Value,
                injectCode,
                $"mcp-bridge:{targetKind}:{action}",
                notifyMessage: null,
                notifyPlayer: false);

            await AppendMcpBridgeEvent(
                targetKind,
                "command_result",
                playerId,
                new JObject
                {
                    ["commandId"] = commandId,
                    ["status"] = injected ? "injected" : "inject_failed",
                    ["action"] = action,
                    ["summary"] = summary
                },
                boardId);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "UIExtractor failed to process MCP bridge command file {CommandPath}", commandPath);

            await AppendMcpBridgeEvent(
                targetKind,
                "command_result",
                playerId,
                new JObject
                {
                    ["commandId"] = commandId,
                    ["status"] = "processing_failed",
                    ["reason"] = ex.Message
                },
                boardId);
        }
        finally
        {
            MoveMcpBridgeCommandToProcessed(commandPath, commandId);
        }
    }

    private void MoveMcpBridgeCommandToProcessed(string commandPath, string commandId)
    {
        try
        {
            if (!File.Exists(commandPath))
            {
                return;
            }

            Directory.CreateDirectory(mcpBridgeProcessedCommandsDirectory);
            var processedFileName = Path.GetFileName(commandPath);
            var processedPath = Path.Combine(mcpBridgeProcessedCommandsDirectory, processedFileName);
            if (File.Exists(processedPath))
            {
                processedPath = Path.Combine(
                    mcpBridgeProcessedCommandsDirectory,
                    DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff") + "-" + processedFileName);
            }

            File.Move(commandPath, processedPath, true);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "UIExtractor failed to move processed MCP bridge command {CommandId}", commandId);
        }
    }

    private async Task<bool> TryProcessServerChatBridgeCommand(
        string commandId,
        string targetKind,
        string action,
        JObject payload,
        ulong playerId,
        string? boardId)
    {
        if (!string.Equals(targetKind, "server_chat", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!string.Equals(action, "probe_call", StringComparison.OrdinalIgnoreCase))
        {
            await AppendMcpBridgeEvent(
                "server_chat",
                "command_result",
                playerId,
                new JObject
                {
                    ["commandId"] = commandId,
                    ["status"] = "rejected",
                    ["reason"] = "unsupported_action",
                    ["action"] = action
                },
                boardId);
            return true;
        }

        var probeMethod = payload["probeMethod"]?.Value<string>()?.Trim() ?? "";
        if (!string.Equals(probeMethod, "snapshot", StringComparison.OrdinalIgnoreCase))
        {
            await AppendMcpBridgeEvent(
                "server_chat",
                "command_result",
                playerId,
                new JObject
                {
                    ["commandId"] = commandId,
                    ["status"] = "rejected",
                    ["reason"] = "unsupported_probe_method",
                    ["action"] = action,
                    ["probeMethod"] = probeMethod
                },
                boardId);
            return true;
        }

        var resultPayload = await BuildServerChatSnapshotPayload(commandId, playerId, payload);
        await AppendMcpBridgeEvent("server_chat", "server_chat_snapshot", playerId, resultPayload, boardId);

        var success = resultPayload["success"]?.Value<bool>() ?? false;
        var error = resultPayload["error"]?.Value<string>();
        await AppendMcpBridgeEvent(
            "server_chat",
            "command_result",
            playerId,
            new JObject
            {
                ["commandId"] = commandId,
                ["status"] = success ? "completed" : "rejected",
                ["action"] = action,
                ["summary"] = "server_chat snapshot",
                ["probeMethod"] = probeMethod,
                ["reason"] = error is null ? JValue.CreateNull() : error
            },
            boardId);

        return true;
    }

    private async Task<JObject> BuildServerChatSnapshotPayload(string commandId, ulong playerId, JObject payload)
    {
        var probeArgs = payload["probeArgs"] as JArray;
        var requestedLimit = probeArgs != null && probeArgs.Count > 0
            ? probeArgs[0]?.Value<int?>()
            : null;
        var limit = ClampServerChatSnapshotLimit(requestedLimit ?? 120);

#if DU_CHAT_SERVER_READ
        var sql = services.GetService<ISql>();
        if (sql is null)
        {
            return CreateServerChatSnapshotFailure(commandId, "server_chat_sql_service_unavailable");
        }

        ITransactionnalSqlConnection? transaction = null;
        try
        {
            transaction = await sql.Transaction("uiextractor_server_chat_snapshot");
            var schema = await ResolveServerChatSchemaAsync(transaction);
            if (schema is null)
            {
                return CreateServerChatSnapshotFailure(commandId, "server_chat_schema_not_found");
            }

            var query = BuildServerChatSnapshotQuery(schema, playerId, limit);
            var messages = await transaction.QueryWithResults(
                async result =>
                {
                    var rows = new List<JObject>();
                    while (await result.Read())
                    {
                        var reader = result.GetReader();
                        var channelType = ReadDbInt32(reader, "channel_type");
                        var targetId = ReadDbUInt64(reader, "target_id");
                        var roomName = ReadDbString(reader, "room_name");
                        var channelName = ReadServerChatChannelName(channelType, roomName);
                        rows.Add(
                            new JObject
                            {
                                ["channelId"] = BuildServerChatChannelId(channelType, targetId, roomName),
                                ["channelName"] = channelName is null ? JValue.CreateNull() : channelName,
                                ["fromId"] = ReadDbUInt64(reader, "from_id"),
                                ["fromName"] = ReadDbString(reader, "from_name"),
                                ["text"] = ReadDbString(reader, "message_text") ?? "",
                                ["fromMe"] = false,
                                ["isAdmin"] = false,
                                ["isCommunityHelper"] = false,
                                ["isNotification"] = false,
                                ["date"] = ReadDbUtcIsoString(reader, "message_date"),
                                ["className"] = new JArray()
                            });
                    }

                    return rows;
                },
                query,
                Array.Empty<object>());

            try
            {
                await transaction.Rollback();
            }
            catch
            {
            }

            return new JObject
            {
                ["commandId"] = commandId,
                ["success"] = true,
                ["error"] = JValue.CreateNull(),
                ["snapshot"] = new JObject
                {
                    ["visible"] = true,
                    ["open"] = true,
                    ["source"] = "server_chat_optin",
                    ["selectedChannelId"] = JValue.CreateNull(),
                    ["selectedChannelName"] = JValue.CreateNull(),
                    ["messageCount"] = messages.Count,
                    ["messages"] = new JArray(messages)
                }
            };
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "UIExtractor server_chat snapshot failed for player {PlayerId}", playerId);
            return CreateServerChatSnapshotFailure(commandId, ex.Message);
        }
        finally
        {
            if (transaction != null)
            {
                transaction.Dispose();
            }
        }
#else
        await Task.CompletedTask;
        return CreateServerChatSnapshotFailure(commandId, "server_chat_opt_in_disabled");
#endif
    }

    private static int ClampServerChatSnapshotLimit(int value)
    {
        return Math.Max(1, Math.Min(500, value));
    }

    private static JObject CreateServerChatSnapshotFailure(string commandId, string error)
    {
        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = false,
            ["error"] = error,
            ["snapshot"] = new JObject
            {
                ["visible"] = true,
                ["open"] = true,
                ["source"] = "server_chat_optin",
                ["selectedChannelId"] = JValue.CreateNull(),
                ["selectedChannelName"] = JValue.CreateNull(),
                ["messageCount"] = 0,
                ["messages"] = new JArray()
            }
        };
    }

#if DU_CHAT_SERVER_READ
    private async Task<Dictionary<string, ServerChatSqlTable>?> ResolveServerChatSchemaAsync(ISqlHandle sql)
    {
        const string query = @"
SELECT table_schema, table_name, column_name
FROM information_schema.columns
WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
ORDER BY table_schema, table_name, ordinal_position";

        var tables = await sql.QueryWithResults(
            async result =>
            {
                var resolved = new Dictionary<string, ServerChatSqlTable>(StringComparer.OrdinalIgnoreCase);
                while (await result.Read())
                {
                    var reader = result.GetReader();
                    var schemaName = ReadDbString(reader, "table_schema") ?? "";
                    var tableName = ReadDbString(reader, "table_name") ?? "";
                    var columnName = ReadDbString(reader, "column_name") ?? "";
                    if (schemaName.Length == 0 || tableName.Length == 0 || columnName.Length == 0)
                    {
                        continue;
                    }

                    var key = schemaName + "." + tableName;
                    ServerChatSqlTable table;
                    if (!resolved.TryGetValue(key, out table))
                    {
                        table = new ServerChatSqlTable
                        {
                            Schema = schemaName,
                            Table = tableName
                        };
                        resolved[key] = table;
                    }

                    table.Columns[NormalizeServerChatSqlName(columnName)] = columnName;
                }

                return resolved;
            },
            query,
            Array.Empty<object>());

        var subscription = tables.Values.FirstOrDefault(static table =>
            table.Columns.ContainsKey(NormalizeServerChatSqlName("playerid")) &&
            table.Columns.ContainsKey(NormalizeServerChatSqlName("channelid")));
        var channel = tables.Values.FirstOrDefault(static table =>
            table.Columns.ContainsKey(NormalizeServerChatSqlName("id")) &&
            table.Columns.ContainsKey(NormalizeServerChatSqlName("channel")) &&
            table.Columns.ContainsKey(NormalizeServerChatSqlName("roomname")) &&
            (
                table.Columns.ContainsKey(NormalizeServerChatSqlName("targetid")) ||
                table.Columns.ContainsKey(NormalizeServerChatSqlName("othertargetid"))
            ));
        var message = tables.Values.FirstOrDefault(static table =>
            table.Columns.ContainsKey(NormalizeServerChatSqlName("id")) &&
            table.Columns.ContainsKey(NormalizeServerChatSqlName("channelid")) &&
            table.Columns.ContainsKey(NormalizeServerChatSqlName("senderid")) &&
            table.Columns.ContainsKey(NormalizeServerChatSqlName("message")) &&
            table.Columns.ContainsKey(NormalizeServerChatSqlName("date")));
        var player = tables.Values.FirstOrDefault(static table =>
            table.Columns.ContainsKey(NormalizeServerChatSqlName("id")) &&
            table.Columns.ContainsKey(NormalizeServerChatSqlName("displayname")));

        if (subscription is null || channel is null || message is null || player is null)
        {
            return null;
        }

        return new Dictionary<string, ServerChatSqlTable>(StringComparer.OrdinalIgnoreCase)
        {
            ["subscription"] = subscription,
            ["channel"] = channel,
            ["message"] = message,
            ["player"] = player
        };
    }

    private static string BuildServerChatSnapshotQuery(
        Dictionary<string, ServerChatSqlTable> schema,
        ulong playerId,
        int limit)
    {
        var subscription = schema["subscription"];
        var channel = schema["channel"];
        var message = schema["message"];
        var player = schema["player"];

        return
            "SELECT " +
            "c." + QuoteSqlIdentifier(RequireColumn(channel, "channel")) + " AS channel_type, " +
            "c." + QuoteSqlIdentifier(RequireFirstColumn(channel, "targetid", "othertargetid")) + " AS target_id, " +
            "c." + QuoteSqlIdentifier(RequireColumn(channel, "roomname")) + " AS room_name, " +
            "m." + QuoteSqlIdentifier(RequireColumn(message, "senderid")) + " AS from_id, " +
            "p." + QuoteSqlIdentifier(RequireColumn(player, "displayname")) + " AS from_name, " +
            "m." + QuoteSqlIdentifier(RequireColumn(message, "message")) + " AS message_text, " +
            "m." + QuoteSqlIdentifier(RequireColumn(message, "date")) + " AS message_date " +
            "FROM (" +
            "SELECT DISTINCT cs." + QuoteSqlIdentifier(RequireColumn(subscription, "channelid")) + " AS channel_id " +
            "FROM " + QuoteSqlTable(subscription) + " cs " +
            "WHERE cs." + QuoteSqlIdentifier(RequireColumn(subscription, "playerid")) + " = " + playerId.ToString(System.Globalization.CultureInfo.InvariantCulture) + " " +
            "UNION " +
            "SELECT DISTINCT mself." + QuoteSqlIdentifier(RequireColumn(message, "channelid")) + " AS channel_id " +
            "FROM " + QuoteSqlTable(message) + " mself " +
            "WHERE mself." + QuoteSqlIdentifier(RequireColumn(message, "senderid")) + " = " + playerId.ToString(System.Globalization.CultureInfo.InvariantCulture) +
            ") relevant_channels " +
            "JOIN " + QuoteSqlTable(channel) + " c ON c." + QuoteSqlIdentifier(RequireColumn(channel, "id")) + " = relevant_channels.channel_id " +
            "JOIN " + QuoteSqlTable(message) + " m ON m." + QuoteSqlIdentifier(RequireColumn(message, "channelid")) + " = c." + QuoteSqlIdentifier(RequireColumn(channel, "id")) + " " +
            "LEFT JOIN " + QuoteSqlTable(player) + " p ON p." + QuoteSqlIdentifier(RequireColumn(player, "id")) + " = m." + QuoteSqlIdentifier(RequireColumn(message, "senderid")) + " " +
            "ORDER BY m." + QuoteSqlIdentifier(RequireColumn(message, "date")) + " DESC " +
            "LIMIT " + limit.ToString(System.Globalization.CultureInfo.InvariantCulture);
    }

    private static string RequireColumn(ServerChatSqlTable table, string lowerName)
    {
        string actualName;
        if (!table.Columns.TryGetValue(NormalizeServerChatSqlName(lowerName), out actualName))
        {
            throw new InvalidOperationException("Missing column " + lowerName + " on " + table.Schema + "." + table.Table);
        }

        return actualName;
    }

    private static string RequireFirstColumn(ServerChatSqlTable table, params string[] lowerNames)
    {
        if (lowerNames != null)
        {
            foreach (var lowerName in lowerNames)
            {
                string actualName;
                if (table.Columns.TryGetValue(NormalizeServerChatSqlName(lowerName), out actualName))
                {
                    return actualName;
                }
            }
        }

        throw new InvalidOperationException("Missing columns " + string.Join(", ", lowerNames ?? Array.Empty<string>()) + " on " + table.Schema + "." + table.Table);
    }

    private static string QuoteSqlTable(ServerChatSqlTable table)
    {
        return QuoteSqlIdentifier(table.Schema) + "." + QuoteSqlIdentifier(table.Table);
    }

    private static string QuoteSqlIdentifier(string value)
    {
        return "\"" + value.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";
    }

    private static string NormalizeServerChatSqlName(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "";
        }

        var builder = new StringBuilder(value.Length);
        foreach (var ch in value)
        {
            if (char.IsLetterOrDigit(ch))
            {
                builder.Append(char.ToLowerInvariant(ch));
            }
        }

        return builder.ToString();
    }
#endif

    private static string? BuildServerChatChannelId(int? channelType, ulong? targetId, string? roomName)
    {
        if (channelType == 2 && !string.IsNullOrWhiteSpace(roomName))
        {
            return "room_" + roomName.Trim().ToLowerInvariant();
        }

        if (channelType == 5)
        {
            return "room_local";
        }

        if (targetId.HasValue)
        {
            return targetId.Value.ToString(System.Globalization.CultureInfo.InvariantCulture);
        }

        return null;
    }

    private static string? ReadServerChatChannelName(int? channelType, string? roomName)
    {
        if (!string.IsNullOrWhiteSpace(roomName))
        {
            return roomName;
        }

        if (!channelType.HasValue)
        {
            return null;
        }

        switch (channelType.Value)
        {
            case 0:
                return "General";
            case 1:
                return "Private";
            case 2:
                return "Room";
            case 3:
                return "Org";
            case 4:
                return "Construct";
            case 5:
                return "Local";
            case 6:
                return "Help";
            default:
                return null;
        }
    }

    private static string? ReadDbString(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        var value = reader.GetValue(ordinal);
        return value?.ToString();
    }

    private static int? ReadDbInt32(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        return Convert.ToInt32(reader.GetValue(ordinal), System.Globalization.CultureInfo.InvariantCulture);
    }

    private static ulong? ReadDbUInt64(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        return Convert.ToUInt64(reader.GetValue(ordinal), System.Globalization.CultureInfo.InvariantCulture);
    }

    private static string? ReadDbUtcIsoString(DbDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        var value = reader.GetValue(ordinal);
        if (value is DateTime dateTime)
        {
            return dateTime.Kind == DateTimeKind.Utc
                ? dateTime.ToString("O")
                : DateTime.SpecifyKind(dateTime, DateTimeKind.Utc).ToString("O");
        }

        return value?.ToString();
    }

    private bool TryBuildMcpBridgeCommandScript(
        string commandId,
        string targetKind,
        string action,
        JObject payload,
        out string injectCode,
        out string summary,
        out string status,
        out string? details)
    {
        injectCode = "";
        summary = "";
        status = "unsupported_command";
        details = null;

        if (string.Equals(targetKind, "lua_editor", StringComparison.OrdinalIgnoreCase))
        {
            if (string.Equals(action, "set_code", StringComparison.OrdinalIgnoreCase))
            {
                status = "rejected";
                details = "inline_set_code_disabled_use_ide_import";
                return false;
            }

            if (string.Equals(action, "save", StringComparison.OrdinalIgnoreCase))
            {
                injectCode =
                    "(function(){" +
                    "if(window.LUAEditorManager&&typeof LUAEditorManager.apply==='function'){LUAEditorManager.apply();}" +
                    "})();";
                summary = "lua_editor save";
                status = "ok";
                return true;
            }

            if (string.Equals(action, "probe_call", StringComparison.OrdinalIgnoreCase))
            {
                var probeMethod = payload["probeMethod"]?.Value<string>()?.Trim();
                var probeArgsToken = payload["probeArgs"] as JArray ?? new JArray();
                if (string.IsNullOrWhiteSpace(probeMethod))
                {
                    status = "rejected";
                    details = "missing_probe_method";
                    return false;
                }

                if (string.Equals(probeMethod, "set_code", StringComparison.OrdinalIgnoreCase))
                {
                    status = "rejected";
                    details = "inline_probe_set_code_disabled_use_ide_import";
                    return false;
                }

                var escapedCommandId = Newtonsoft.Json.JsonConvert.SerializeObject(commandId);
                var escapedProbeMethod = Newtonsoft.Json.JsonConvert.SerializeObject(probeMethod);
                var escapedProbeArgs = probeArgsToken.ToString(Newtonsoft.Json.Formatting.None);
                var escapedTargetKind = Newtonsoft.Json.JsonConvert.SerializeObject("lua_editor");
                injectCode =
                    "(function(){" +
                    "var probe=window.__UI_EXTRACTOR_LUA_PROBE_STATE__;" +
                    "if(!probe){return;}" +
                    "var commandId=" + escapedCommandId + ";" +
                    "var targetKind=" + escapedTargetKind + ";" +
                    "var method=" + escapedProbeMethod + ";" +
                    "var args=" + escapedProbeArgs + ";" +
                    "if(probe.mcp&&typeof probe.mcp.invokeForTarget==='function'){probe.mcp.invokeForTarget(commandId,targetKind,method,args);return;}" +
                    "if(typeof probe.invokeMcpCommandForTarget==='function'){probe.invokeMcpCommandForTarget(commandId,targetKind,method,args);return;}" +
                    "if(probe.mcp&&typeof probe.mcp.invoke==='function'){probe.mcp.invoke(commandId,method,args);return;}" +
                    "if(typeof probe.invokeMcpCommand==='function'){probe.invokeMcpCommand(commandId,method,args);}" +
                    "})();";
                summary = "lua_editor probe_call " + probeMethod;
                status = "ok";
                return true;
            }
        }

        if (string.Equals(targetKind, "screen_editor", StringComparison.OrdinalIgnoreCase))
        {
            if (string.Equals(action, "set_code", StringComparison.OrdinalIgnoreCase))
            {
                status = "rejected";
                details = "inline_set_code_disabled_use_ide_import";
                return false;
            }

            if (string.Equals(action, "save", StringComparison.OrdinalIgnoreCase))
            {
                var waitForEditor = payload["waitForEditor"]?.Value<bool>() ?? false;
                var maxAttempts = payload["maxAttempts"]?.Value<int?>() ?? 10;
                var retryDelayMs = payload["retryDelayMs"]?.Value<int?>() ?? 2000;
                maxAttempts = Math.Max(1, Math.Min(120, maxAttempts));
                retryDelayMs = Math.Max(50, Math.Min(10000, retryDelayMs));
                var waitLiteral = waitForEditor ? "true" : "false";
                var escapedCommandId = Newtonsoft.Json.JsonConvert.SerializeObject(commandId);
                var escapedTargetKind = Newtonsoft.Json.JsonConvert.SerializeObject("screen_editor");
                var escapedProbeMethod = Newtonsoft.Json.JsonConvert.SerializeObject("apply");
                injectCode =
                    "(function(){" +
                    "var waitForEditor=" + waitLiteral + ";" +
                    "var maxAttempts=" + maxAttempts + ";" +
                    "var retryDelayMs=" + retryDelayMs + ";" +
                    "var attempt=0;" +
                    "var savePanel=function(){" +
                    "var probe=window.__UI_EXTRACTOR_LUA_PROBE_STATE__;" +
                    "var snapshot=null;" +
                    "try{" +
                    "if(probe&&probe.mcp&&typeof probe.mcp.describeScreenEditor==='function'){" +
                    "snapshot=probe.mcp.describeScreenEditor();" +
                    "}" +
                    "}catch(_ignoreScreenProbeDescribe){}" +
                    "if(snapshot&&snapshot.visible===true){" +
                    "if(probe&&probe.mcp&&typeof probe.mcp.invokeForTarget==='function'){" +
                    "probe.mcp.invokeForTarget(" + escapedCommandId + "," + escapedTargetKind + "," + escapedProbeMethod + ",[]);" +
                    "return;" +
                    "}" +
                    "if(probe&&typeof probe.invokeMcpCommandForTarget==='function'){" +
                    "probe.invokeMcpCommandForTarget(" + escapedCommandId + "," + escapedTargetKind + "," + escapedProbeMethod + ",[]);" +
                    "return;" +
                    "}" +
                    "}" +
                    "var panel=window.screenContentEditorPanel;" +
                    "if(panel&&panel.textEditor){" +
                    "if(window.CPPScreenContentEditor&&typeof CPPScreenContentEditor.save==='function'){" +
                    "CPPScreenContentEditor.save(panel.textEditor.value,panel.isInHTMLMode);" +
                    "if(typeof CPPScreenContentEditor.close==='function'){CPPScreenContentEditor.close();}" +
                    "}" +
                    "return;" +
                    "}" +
                    "attempt+=1;" +
                    "if(waitForEditor&&attempt<maxAttempts&&typeof window.setTimeout==='function'){" +
                    "window.setTimeout(savePanel,retryDelayMs);" +
                    "}" +
                    "};" +
                    "savePanel();" +
                    "})();";
                summary = waitForEditor ? "screen_editor save + wait" : "screen_editor save";
                status = "ok";
                return true;
            }

            if (string.Equals(action, "probe_call", StringComparison.OrdinalIgnoreCase))
            {
                var probeMethod = payload["probeMethod"]?.Value<string>()?.Trim();
                var probeArgsToken = payload["probeArgs"] as JArray ?? new JArray();
                if (string.IsNullOrWhiteSpace(probeMethod))
                {
                    status = "rejected";
                    details = "missing_probe_method";
                    return false;
                }

                if (string.Equals(probeMethod, "set_code", StringComparison.OrdinalIgnoreCase))
                {
                    status = "rejected";
                    details = "inline_probe_set_code_disabled_use_ide_import";
                    return false;
                }

                var escapedCommandId = Newtonsoft.Json.JsonConvert.SerializeObject(commandId);
                var escapedProbeMethod = Newtonsoft.Json.JsonConvert.SerializeObject(probeMethod);
                var escapedProbeArgs = probeArgsToken.ToString(Newtonsoft.Json.Formatting.None);
                var escapedTargetKind = Newtonsoft.Json.JsonConvert.SerializeObject("screen_editor");
                injectCode =
                    "(function(){" +
                    "var probe=window.__UI_EXTRACTOR_LUA_PROBE_STATE__;" +
                    "if(!probe){return;}" +
                    "var commandId=" + escapedCommandId + ";" +
                    "var targetKind=" + escapedTargetKind + ";" +
                    "var method=" + escapedProbeMethod + ";" +
                    "var args=" + escapedProbeArgs + ";" +
                    "if(probe.mcp&&typeof probe.mcp.invokeForTarget==='function'){probe.mcp.invokeForTarget(commandId,targetKind,method,args);return;}" +
                    "if(typeof probe.invokeMcpCommandForTarget==='function'){probe.invokeMcpCommandForTarget(commandId,targetKind,method,args);return;}" +
                    "if(probe.mcp&&typeof probe.mcp.invoke==='function'){probe.mcp.invoke(commandId,method,args);return;}" +
                    "if(typeof probe.invokeMcpCommand==='function'){probe.invokeMcpCommand(commandId,method,args);}" +
                    "})();";
                summary = "screen_editor probe_call " + probeMethod;
                status = "ok";
                return true;
            }
        }

        details = "unsupported_target_or_action";
        return false;
    }

    public Task<ModInfo> GetModInfoFor(ulong playerId, bool admin)
    {
        var info = new ModInfo
        {
            name = GetName(),
            actions = new List<ModActionDefinition>
            {
                new ModActionDefinition
                {
                    id = ActionRunSafe,
                    label = "UI Extractor\\Run UI Dump (Safe)",
                    context = ModActionContext.Global
                },
                new ModActionDefinition
                {
                    id = ActionRunDeep,
                    label = "UI Extractor\\Run UI Dump (Deep)",
                    context = ModActionContext.Global
                },
                new ModActionDefinition
                {
                    id = ActionExtractAllCss,
                    label = "UI Extractor\\Extract Stylesheet\\ALL .css files (full)",
                    context = ModActionContext.Global
                },
                new ModActionDefinition
                {
                    id = ActionExtractFromTargetFile,
                    label = "UI Extractor\\Extract Stylesheet\\From target-stylesheet-url.txt",
                    context = ModActionContext.Global
                },
                new ModActionDefinition
                {
                    id = ActionExtractAllScripts,
                    label = "UI Extractor\\Extract Scripts\\ALL .js files (full)",
                    context = ModActionContext.Global
                },
                new ModActionDefinition
                {
                    id = ActionInjectLuaProbe,
                    label = "UI Extractor\\Inject LUA editor probe",
                    context = ModActionContext.Element
                }
            }
        };

        return Task.FromResult(info);
    }

    public async Task TriggerAction(ulong playerId, ModAction action)
    {
        switch (action.actionId)
        {
            case ActionRunSafe:
                await InjectFullDumpPayload(playerId, deepMode: false);
                return;
            case ActionRunDeep:
                await InjectFullDumpPayload(playerId, deepMode: true);
                return;
            case ActionExtractAllCss:
                await InjectAllStylesheetsPayload(playerId);
                return;
            case ActionExtractFromTargetFile:
                await InjectStylesheetFromTargetFile(playerId);
                return;
            case ActionInjectLuaProbe:
                await InjectLuaProbePayload(playerId, action);
                return;
            case ActionExtractAllScripts:
                await InjectAllScriptsPayload(playerId);
                return;
            case ActionIngestPacket:
                await IngestPacket(playerId, action.payload);
                return;
            default:
                logger.LogDebug("UIExtractor ignoring action {ActionId} from player {PlayerId}", action.actionId, playerId);
                return;
        }
    }

    private async Task InjectFullDumpPayload(ulong playerId, bool deepMode)
    {
        var config = new JObject
        {
            ["mode"] = "full_dump",
            ["phaseDelayMs"] = deepMode ? 2 : 10,
            ["maxHtmlChars"] = deepMode ? 1_500_000 : 700_000,
            ["maxScripts"] = deepMode ? 800 : 300,
            ["maxStyleSheets"] = deepMode ? 200 : 80,
            ["maxCssRulesPerSheet"] = deepMode ? 2500 : 1200,
            ["maxTotalCssChars"] = deepMode ? 2_500_000 : 1_000_000,
            ["maxElementsPerSelector"] = deepMode ? 80 : 30
        };

        await InjectPayload(
            playerId,
            config,
            $"UI dump requested ({(deepMode ? "deep" : "safe")}). Writing packets to server tmp/ui-dumps.",
            deepMode ? "full-deep" : "full-safe");
    }

    private async Task InjectSingleStylesheetPayload(ulong playerId, string stylesheetHref, string requestedBy)
    {
        if (string.IsNullOrWhiteSpace(stylesheetHref))
        {
            await Notify(playerId, "Stylesheet target is empty.");
            return;
        }

        var config = new JObject
        {
            ["mode"] = "single_stylesheet",
            ["targetStylesheetHref"] = stylesheetHref,
            ["phaseDelayMs"] = 1,
            ["maxPayloadChars"] = 8_000_000
        };

        await InjectPayload(
            playerId,
            config,
            $"Stylesheet extract requested: {stylesheetHref}",
            requestedBy);
    }

    private async Task InjectAllStylesheetsPayload(ulong playerId)
    {
        var config = new JObject
        {
            ["mode"] = "all_stylesheets",
            ["phaseDelayMs"] = 20,
            ["chunkSize"] = 9_000,
            ["maxPayloadChars"] = 8_000_000,
            ["allStylesheetOnlyCssHref"] = true,
            ["allStylesheetMaxSheets"] = 512,
            ["allStylesheetMaxSheetChars"] = 12_000_000,
            ["allStylesheetPacketDelayMs"] = 25
        };

        await InjectPayload(
            playerId,
            config,
            "All stylesheet extraction requested. This may produce a large dump.",
            "all-stylesheets");
    }

    private async Task InjectAllScriptsPayload(ulong playerId)
    {
        var config = new JObject
        {
            ["mode"] = "all_scripts",
            ["phaseDelayMs"] = 20,
            ["chunkSize"] = 9_000,
            ["maxPayloadChars"] = 8_000_000,
            ["allScriptsOnlyJsSrc"] = true,
            ["allScriptsMaxScripts"] = 1024,
            ["allScriptsMaxScriptChars"] = 16_000_000,
            ["allScriptsPacketDelayMs"] = 25
        };

        await InjectPayload(
            playerId,
            config,
            "All script extraction requested. This can produce a very large dump.",
            "all-scripts");
    }

    private async Task InjectStylesheetFromTargetFile(ulong playerId)
    {
        if (!TryReadTargetStylesheetHref(out var href, out var error))
        {
            await Notify(playerId, "No stylesheet URL configured. Update tmp/ui-dumps/target-stylesheet-url.txt");
            logger.LogWarning("UIExtractor target stylesheet URL missing: {Reason}", error);
            return;
        }

        await InjectSingleStylesheetPayload(playerId, href, "target-file");
    }

    private async Task InjectLuaProbePayload(ulong playerId, ModAction action)
    {
        var luaProbeScript = ResolveLuaProbeScript(out var usingRuntimeOverride, out var usingRuntimeModules);
        if (string.IsNullOrWhiteSpace(luaProbeScript))
        {
            await Notify(playerId, "Lua probe payload is unavailable on server.");
            return;
        }

        var config = new JObject
        {
            ["modName"] = GetName(),
            ["actionId"] = (long)ActionIngestPacket,
            ["injectActionId"] = (long)ActionInjectLuaProbe,
            ["constructId"] = (long)action.constructId,
            ["installedAt"] = DateTime.UtcNow.ToString("O")
        };

        var injectCode = $"window.__UI_EXTRACTOR_LUA_PROBE_CONFIG={config.ToString(Newtonsoft.Json.Formatting.None)};\n{luaProbeScript}";
        var notifyMessage = action.constructId == 0
            ? "Lua probe injected. Open a control unit context menu and click Edit Lua."
            : $"Lua probe injected for construct {action.constructId}. Open Edit Lua now.";
        if (usingRuntimeModules)
        {
            notifyMessage += " (runtime override modules active)";
        }
        else if (usingRuntimeOverride)
        {
            notifyMessage += " (runtime override script active)";
        }

        notifyMessage += FormatLuaProbeInjectChatSuffix(luaProbeScript);

        await InjectJavaScript(playerId, injectCode, "lua-probe", notifyMessage);
    }

    private async Task InjectPayload(ulong playerId, JObject config, string notifyMessage, string modeTag)
    {
        var extractorScript = ResolveRuntimeScript(runtimeExtractorPayloadPath, payloadJs, "extractor payload", out var usingRuntimeOverride);
        if (string.IsNullOrWhiteSpace(extractorScript))
        {
            await Notify(playerId, "UI extractor payload is unavailable on server.");
            return;
        }

        var requestedMode = "";
        if (config.TryGetValue("mode", out var modeToken))
        {
            requestedMode = modeToken.Type == JTokenType.Null ? "" : (modeToken.Value<string>() ?? "");
        }

        if (usingRuntimeOverride && !RuntimeScriptLikelySupportsMode(extractorScript, requestedMode))
        {
            logger.LogWarning(
                "UIExtractor runtime override does not appear to support mode {Mode}; falling back to embedded payload for this injection",
                requestedMode);
            extractorScript = payloadJs;
            usingRuntimeOverride = false;
        }

        config["modName"] = GetName();
        config["actionId"] = (long)ActionIngestPacket;

        var effectiveNotifyMessage = usingRuntimeOverride
            ? $"{notifyMessage} (runtime override script active)"
            : notifyMessage;

        var injectCode = $"window.__UI_EXTRACTOR_CONFIG={config.ToString(Newtonsoft.Json.Formatting.None)};\n{extractorScript}";
        await InjectJavaScript(playerId, injectCode, modeTag, effectiveNotifyMessage);
    }

    private static bool RuntimeScriptLikelySupportsMode(string script, string mode)
    {
        if (string.IsNullOrWhiteSpace(mode) || string.Equals(mode, "full_dump", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(script))
        {
            return false;
        }

        var quotedMode = "\"" + mode + "\"";
        return script.Contains(quotedMode, StringComparison.OrdinalIgnoreCase);
    }

    private async Task<bool> InjectJavaScript(ulong playerId, string injectCode, string modeTag, string? notifyMessage = null, bool notifyPlayer = true)
    {
        try
        {
            await pub.NotifyTopic(
                Topics.PlayerNotifications(playerId),
                new NQutils.Messages.ModTriggerHudEventRequest(
                    new ModTriggerHudEvent
                    {
                        eventName = "modinjectjs",
                        eventPayload = injectCode
                    }));

            logger.LogInformation(
                "UIExtractor injected payload for player {PlayerId} (mode={Mode}, bytes={Bytes})",
                playerId,
                modeTag,
                injectCode.Length);

            if (notifyPlayer && !string.IsNullOrWhiteSpace(notifyMessage))
            {
                await Notify(playerId, notifyMessage);
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "UIExtractor injection failed for player {PlayerId}", playerId);
            if (notifyPlayer)
            {
                await Notify(playerId, "UI injection failed. Check Orleans logs.");
            }

            return false;
        }
    }

    private Task AppendMcpBridgeEvent(string sourceKind, string eventType, ulong? playerId, JObject payload, string? boardId = null)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(mcpBridgeEventsDirectory))
            {
                return Task.CompletedTask;
            }

            var eventPath = Path.Combine(mcpBridgeEventsDirectory, "bridge-events.ndjson");
            var line = new JObject
            {
                ["eventId"] = Guid.NewGuid().ToString("N"),
                ["createdAtUtc"] = DateTime.UtcNow.ToString("O"),
                ["playerId"] = playerId.HasValue ? JToken.FromObject(playerId.Value) : JValue.CreateNull(),
                ["source"] = new JObject
                {
                    ["kind"] = sourceKind,
                    ["boardId"] = boardId is null ? JValue.CreateNull() : boardId
                },
                ["type"] = eventType,
                ["payload"] = payload
            };

            var fileLock = dumpFileLocks.GetOrAdd(eventPath, _ => new object());
            lock (fileLock)
            {
                File.AppendAllText(eventPath, line.ToString(Newtonsoft.Json.Formatting.None) + Environment.NewLine, Encoding.UTF8);
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "UIExtractor failed to append MCP bridge event {EventType}", eventType);
        }

        return Task.CompletedTask;
    }

    private static string ResolveProbeTargetKind(JObject payload)
    {
        var raw = payload["targetKind"]?.Value<string>()?.Trim();
        if (string.Equals(raw, "screen_editor", StringComparison.OrdinalIgnoreCase))
        {
            return "screen_editor";
        }

        return "lua_editor";
    }

    private void EnsureTargetStylesheetFile()
    {
        try
        {
            if (File.Exists(targetStylesheetFilePath))
            {
                return;
            }

            var template = string.Join(
                Environment.NewLine,
                new[]
                {
                    "# One coui:// stylesheet URL per line. First non-empty, non-comment line is used.",
                    "# Example:",
                    "# coui://data/gui/hud/dpu_editor/css/dpu_editor.css",
                    DefaultTargetStylesheetHref,
                    ""
                });

            File.WriteAllText(targetStylesheetFilePath, template, Encoding.UTF8);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "UIExtractor failed to create stylesheet target file: {TargetFile}", targetStylesheetFilePath);
        }
    }

    private bool TryReadTargetStylesheetHref(out string href, out string error)
    {
        href = "";
        error = "";

        try
        {
            if (!File.Exists(targetStylesheetFilePath))
            {
                EnsureTargetStylesheetFile();
            }

            if (!File.Exists(targetStylesheetFilePath))
            {
                error = "Target stylesheet file is missing";
                return false;
            }

            foreach (var rawLine in File.ReadAllLines(targetStylesheetFilePath))
            {
                var line = rawLine.Trim();
                if (line.Length == 0 || line.StartsWith("#", StringComparison.Ordinal))
                {
                    continue;
                }

                href = line;
                return true;
            }

            error = "No non-comment URL line found";
            return false;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            logger.LogWarning(ex, "UIExtractor failed to read stylesheet target file: {TargetFile}", targetStylesheetFilePath);
            return false;
        }
    }

    private async Task IngestPacket(ulong playerId, string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
        {
            logger.LogDebug("UIExtractor received empty packet payload from player {PlayerId}", playerId);
            return;
        }

        JObject? parsedPacket = null;
        string? parseError = null;
        UiDumpPacketEnvelope? envelope = null;

        try
        {
            parsedPacket = JObject.Parse(payload);
            envelope = parsedPacket.ToObject<UiDumpPacketEnvelope>();
        }
        catch (Exception ex)
        {
            parseError = ex.Message;
        }

        var dumpId = SanitizeDumpId(envelope?.dumpId);
        var dumpPath = Path.Combine(outputDirectory, $"{dumpId}.ndjson");

        var line = new JObject
        {
            ["serverTimestamp"] = DateTime.UtcNow.ToString("O"),
            ["playerId"] = playerId
        };

        if (parsedPacket is not null)
        {
            line["packet"] = parsedPacket;
        }
        else
        {
            line["packetRaw"] = payload;
            line["packetParseError"] = parseError ?? "unknown parse error";
        }

        var fileLock = dumpFileLocks.GetOrAdd(dumpId, _ => new object());
        lock (fileLock)
        {
            File.AppendAllText(dumpPath, line.ToString(Newtonsoft.Json.Formatting.None) + Environment.NewLine);
        }

        if (parsedPacket is not null)
        {
            var packetType = parsedPacket["type"]?.Value<string>()?.Trim() ?? "";
            if (string.Equals(packetType, "lua_mcp_result", StringComparison.OrdinalIgnoreCase))
            {
                var packetData = parsedPacket["data"] as JObject ?? new JObject();
                await AppendMcpBridgeEvent(ResolveProbeTargetKind(packetData), "probe_result", playerId, packetData);
            }
            else if (string.Equals(packetType, "lua_mcp_result_chunk", StringComparison.OrdinalIgnoreCase))
            {
                var packetData = parsedPacket["data"] as JObject ?? new JObject();
                var assembledPayload = TryAssembleLuaMcpResultChunk(playerId, packetData);
                if (assembledPayload is not null)
                {
                    await AppendMcpBridgeEvent(ResolveProbeTargetKind(assembledPayload), "probe_result", playerId, assembledPayload);
                }
            }
            else if (string.Equals(packetType, "chat_snapshot", StringComparison.OrdinalIgnoreCase))
            {
                var packetData = parsedPacket["data"] as JObject ?? new JObject();
                await AppendMcpBridgeEvent("lua_editor", "chat_snapshot", playerId, packetData);
            }
            else if (string.Equals(packetType, "chat_send_result", StringComparison.OrdinalIgnoreCase))
            {
                var packetData = parsedPacket["data"] as JObject ?? new JObject();
                await AppendMcpBridgeEvent("lua_editor", "chat_send_result", playerId, packetData);
            }
            else if (string.Equals(packetType, "chat_channel_result", StringComparison.OrdinalIgnoreCase))
            {
                var packetData = parsedPacket["data"] as JObject ?? new JObject();
                await AppendMcpBridgeEvent("lua_editor", "chat_channel_result", playerId, packetData);
            }
            else if (string.Equals(packetType, "ide_import_result", StringComparison.OrdinalIgnoreCase))
            {
                var packetData = parsedPacket["data"] as JObject ?? new JObject();
                RegisterIdeImportResult(packetData);
            }
        }

        if (envelope?.type == "ui_dump_complete")
        {
            logger.LogInformation(
                "UIExtractor dump complete for player {PlayerId}. dumpId={DumpId}, output={DumpPath}",
                playerId,
                dumpId,
                dumpPath);
            await Notify(playerId, $"UI dump completed: {dumpId}");
        }
        else if (envelope?.type == "ui_dump_fatal")
        {
            logger.LogWarning(
                "UIExtractor dump fatal event from player {PlayerId}. dumpId={DumpId}, output={DumpPath}",
                playerId,
                dumpId,
                dumpPath);
            await Notify(playerId, $"UI dump failed: {dumpId} (check logs)");
        }
    }

    private JObject? TryAssembleLuaMcpResultChunk(ulong playerId, JObject packetData)
    {
        CleanupExpiredLuaMcpResultChunks(DateTime.UtcNow);

        var packetId = packetData["packetId"]?.Value<string>()?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(packetId))
        {
            logger.LogDebug("UIExtractor ignored lua_mcp_result_chunk without packetId for player {PlayerId}", playerId);
            return null;
        }

        var total = packetData["total"]?.Value<int>() ?? 0;
        var part = packetData["part"]?.Value<int>() ?? 0;
        var jsonChunk = packetData["jsonChunk"]?.Value<string>() ?? "";
        if (total <= 0 || total > MaxLuaMcpResultChunkCount || part <= 0 || part > total)
        {
            logger.LogDebug(
                "UIExtractor ignored invalid lua_mcp_result_chunk metadata for player {PlayerId}: packetId={PacketId}, part={Part}, total={Total}",
                playerId,
                packetId,
                part,
                total);
            luaMcpResultChunkAssemblies.TryRemove(BuildLuaMcpResultChunkKey(playerId, packetId), out _);
            return null;
        }

        var assemblyKey = BuildLuaMcpResultChunkKey(playerId, packetId);
        var state = luaMcpResultChunkAssemblies.GetOrAdd(
            assemblyKey,
            static _ => new LuaMcpResultChunkAssembly());

        lock (state.Gate)
        {
            if (state.ExpectedTotal != 0 && state.ExpectedTotal != total)
            {
                state.ExpectedTotal = total;
                state.Chunks.Clear();
            }
            else if (state.ExpectedTotal == 0)
            {
                state.ExpectedTotal = total;
            }

            state.UpdatedAtUtc = DateTime.UtcNow;
            state.Chunks[part] = jsonChunk;
            if (state.Chunks.Count < state.ExpectedTotal)
            {
                return null;
            }

            var builder = new StringBuilder();
            for (var i = 1; i <= state.ExpectedTotal; i += 1)
            {
                if (!state.Chunks.TryGetValue(i, out var chunkPart))
                {
                    return null;
                }

                builder.Append(chunkPart);
            }

            luaMcpResultChunkAssemblies.TryRemove(assemblyKey, out _);
            try
            {
                return JObject.Parse(builder.ToString());
            }
            catch (Exception ex)
            {
                logger.LogWarning(
                    ex,
                    "UIExtractor failed to parse reassembled lua_mcp_result chunk payload for player {PlayerId}: packetId={PacketId}",
                    playerId,
                    packetId);
                return null;
            }
        }
    }

    private void CleanupExpiredLuaMcpResultChunks(DateTime nowUtc)
    {
        foreach (var entry in luaMcpResultChunkAssemblies)
        {
            if (nowUtc - entry.Value.UpdatedAtUtc <= LuaMcpResultChunkTtl)
            {
                continue;
            }

            luaMcpResultChunkAssemblies.TryRemove(entry.Key, out _);
        }
    }

    private static string BuildLuaMcpResultChunkKey(ulong playerId, string packetId)
    {
        return playerId.ToString(System.Globalization.CultureInfo.InvariantCulture) + ":" + packetId;
    }

    private string LoadEmbeddedScriptSafe(string resourceHint, string scriptLabel)
    {
        try
        {
            var asm = Assembly.GetExecutingAssembly();
            var resourceName = asm.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith(resourceHint, StringComparison.OrdinalIgnoreCase));

            if (string.IsNullOrWhiteSpace(resourceName))
            {
                logger.LogError("UIExtractor {ScriptLabel} resource not found: {ResourceHint}", scriptLabel, resourceHint);
                return "";
            }

            using var stream = asm.GetManifestResourceStream(resourceName);
            if (stream is null)
            {
                logger.LogError("UIExtractor {ScriptLabel} resource stream is null: {ResourceName}", scriptLabel, resourceName);
                return "";
            }

            using var reader = new StreamReader(stream, Encoding.UTF8);
            return reader.ReadToEnd();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "UIExtractor failed to load embedded script {ScriptLabel}", scriptLabel);
            return "";
        }
    }

    private void EnsureRuntimeOverrideFile(string path, string seedScript, string scriptLabel)
    {
        try
        {
            if (File.Exists(path) || string.IsNullOrWhiteSpace(seedScript))
            {
                return;
            }

            File.WriteAllText(path, seedScript, Encoding.UTF8);
            logger.LogInformation(
                "UIExtractor created runtime override for {ScriptLabel} at {Path}. Edit this file while the server is running; next injection uses the updated script.",
                scriptLabel,
                path);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "UIExtractor failed to create runtime override file for {ScriptLabel}: {Path}", scriptLabel, path);
        }
    }

    private string ResolveLuaProbeScript(out bool usingRuntimeOverride, out bool usingRuntimeModules)
    {
        usingRuntimeOverride = false;
        usingRuntimeModules = false;

        var moduleScript = ResolveRuntimeModuleScript(
            runtimeLuaProbeModulesDirectoryPath,
            runtimeLuaProbeModulesManifestPath,
            "lua probe",
            out var moduleCount);

        if (!string.IsNullOrWhiteSpace(moduleScript))
        {
            usingRuntimeOverride = true;
            usingRuntimeModules = true;
            logger.LogInformation(
                "UIExtractor using runtime lua probe modules from {ModulesDir} ({ModuleCount} files)",
                runtimeLuaProbeModulesDirectoryPath,
                moduleCount);
            return moduleScript;
        }

        return ResolveRuntimeScript(runtimeLuaProbePayloadPath, luaProbeJs, "lua probe", out usingRuntimeOverride);
    }

    /// <summary>
    /// Chat suffix from the actual script bytes injected (SHA-256 of UTF-8 probe body + inject UTC time).
    /// Matches <c>contentSha256Short</c> in <c>lua-editor-probe.build.json</c> after <c>build-lua-probe.ps1</c>.
    /// </summary>
    private static string FormatLuaProbeInjectChatSuffix(string luaProbeScript)
    {
        if (string.IsNullOrWhiteSpace(luaProbeScript))
        {
            return "";
        }

        try
        {
            var utf8 = Encoding.UTF8.GetBytes(luaProbeScript);
            var hashBytes = SHA256.HashData(utf8);
            var hex = Convert.ToHexString(hashBytes).ToLowerInvariant();
            var shortHex = hex.Length >= 8 ? hex.Substring(0, 8) : hex;
            var injectUtc = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
            return $" [probe {injectUtc} {shortHex}]";
        }
        catch
        {
            return "";
        }
    }

    private string ResolveRuntimeModuleScript(string moduleDirectoryPath, string manifestPath, string scriptLabel, out int moduleCount)
    {
        moduleCount = 0;

        try
        {
            if (!File.Exists(manifestPath))
            {
                return "";
            }

            var moduleEntries = new List<string>();
            foreach (var rawLine in File.ReadAllLines(manifestPath, Encoding.UTF8))
            {
                var line = rawLine?.Trim() ?? "";
                if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#", StringComparison.Ordinal))
                {
                    continue;
                }
                moduleEntries.Add(line);
            }

            if (moduleEntries.Count == 0)
            {
                logger.LogWarning(
                    "UIExtractor runtime module manifest for {ScriptLabel} has no module entries: {ManifestPath}",
                    scriptLabel,
                    manifestPath);
                return "";
            }

            var moduleDirFull = Path.GetFullPath(moduleDirectoryPath);
            var moduleDirPrefix = moduleDirFull.EndsWith(Path.DirectorySeparatorChar)
                ? moduleDirFull
                : moduleDirFull + Path.DirectorySeparatorChar;

            var scriptBuilder = new StringBuilder();
            foreach (var entry in moduleEntries)
            {
                var modulePath = Path.GetFullPath(Path.Combine(moduleDirectoryPath, entry));
                if (!modulePath.StartsWith(moduleDirPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    logger.LogWarning(
                        "UIExtractor runtime module entry escapes module directory for {ScriptLabel}: {Entry}",
                        scriptLabel,
                        entry);
                    return "";
                }

                if (!File.Exists(modulePath))
                {
                    logger.LogWarning(
                        "UIExtractor runtime module file missing for {ScriptLabel}: {ModulePath}",
                        scriptLabel,
                        modulePath);
                    return "";
                }

                var moduleText = File.ReadAllText(modulePath, Encoding.UTF8);
                if (string.IsNullOrWhiteSpace(moduleText))
                {
                    logger.LogWarning(
                        "UIExtractor runtime module file is empty for {ScriptLabel}: {ModulePath}",
                        scriptLabel,
                        modulePath);
                    return "";
                }

                scriptBuilder.Append(moduleText);
                if (!moduleText.EndsWith('\n'))
                {
                    scriptBuilder.AppendLine();
                }
                moduleCount += 1;
            }

            return LuaProbeModulesPreamble + scriptBuilder.ToString() + LuaProbeModulesPostamble;
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "UIExtractor failed to read runtime module manifest for {ScriptLabel} from {ManifestPath}; using single-file fallback",
                scriptLabel,
                manifestPath);
            return "";
        }
    }

    private string ResolveRuntimeScript(string runtimePath, string embeddedFallbackScript, string scriptLabel, out bool usingRuntimeOverride)
    {
        usingRuntimeOverride = false;

        try
        {
            if (File.Exists(runtimePath))
            {
                var runtimeScript = File.ReadAllText(runtimePath, Encoding.UTF8);
                if (!string.IsNullOrWhiteSpace(runtimeScript))
                {
                    usingRuntimeOverride = true;
                    return runtimeScript;
                }

                logger.LogWarning(
                    "UIExtractor runtime override for {ScriptLabel} is empty at {Path}; using embedded fallback",
                    scriptLabel,
                    runtimePath);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "UIExtractor failed to read runtime override for {ScriptLabel} from {Path}; using embedded fallback",
                scriptLabel,
                runtimePath);
        }

        return embeddedFallbackScript;
    }

    private static bool TryResolveServerRoot(string baseDirectory, out string serverRoot)
    {
        var runtimeDir = new DirectoryInfo(baseDirectory);
        if (runtimeDir.Exists &&
            string.Equals(runtimeDir.Name, "all", StringComparison.OrdinalIgnoreCase) &&
            runtimeDir.Parent is DirectoryInfo wincsDir &&
            string.Equals(wincsDir.Name, "wincs", StringComparison.OrdinalIgnoreCase) &&
            wincsDir.Parent is DirectoryInfo rootDir)
        {
            serverRoot = rootDir.FullName;
            return true;
        }

        serverRoot = Directory.GetCurrentDirectory();
        return false;
    }

    private static string SanitizeDumpId(string? dumpIdRaw)
    {
        var fallback = "dump-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff");
        if (string.IsNullOrWhiteSpace(dumpIdRaw))
        {
            return fallback;
        }

        var sb = new StringBuilder(dumpIdRaw.Length);
        foreach (var ch in dumpIdRaw)
        {
            if (char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' || ch == '.')
            {
                sb.Append(ch);
            }
            else
            {
                sb.Append('_');
            }
        }

        var sanitized = sb.ToString().Trim('_', '.');
        if (string.IsNullOrWhiteSpace(sanitized))
        {
            return fallback;
        }
        if (sanitized.Length > 96)
        {
            sanitized = sanitized.Substring(0, 96);
        }

        return sanitized;
    }

    private async Task Notify(ulong playerId, string message)
    {
        try
        {
            await orleans.GetChatGrain(PrivateChatChannelId).SendMessage(
                new MessageContent
                {
                    channel = new MessageChannel
                    {
                        channel = MessageChannelType.PRIVATE,
                        targetId = playerId
                    },
                    message = message
                });
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "UIExtractor notification failed for player {PlayerId}", playerId);
        }
    }
}
