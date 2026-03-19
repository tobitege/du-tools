using Orleans;
using System;
using System.IO;
using System.Text;
using System.Linq;
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

public sealed class UiDumpPacketEnvelope
{
    public string? type { get; set; }
    public string? dumpId { get; set; }
    public string? section { get; set; }
    public int? part { get; set; }
    public int? total { get; set; }
    public string? timestamp { get; set; }
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
    private const string DefaultTargetStylesheetHref = "coui://data/gui/hud/dpu_editor/css/dpu_editor.css";
    private const string TargetStylesheetFileName = "target-stylesheet-url.txt";
    private const string McpBridgeDirectoryName = "mcp-bridge";
    private const string McpBridgeCommandsDirectoryName = "commands";
    private const string McpBridgeEventsDirectoryName = "events";
    private const string McpBridgeStateDirectoryName = "state";
    private const string McpBridgeProcessedCommandsDirectoryName = "processed-commands";

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

    public string GetName()
    {
        return ModName;
    }

    private Task? ideImportTask;
    private Task? mcpBridgeCommandTask;

    public Task Initialize(IServiceProvider isp)
    {
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
        var importPath = Path.Combine(payloadOverridesDirectory, "ide_import.json");
        var lastProcessedWrite = DateTime.MinValue;
        var lastProcessedContent = "";

        while (true)
        {
            try
            {
                await Task.Delay(500);
                if (File.Exists(importPath))
                {
                    var writeTime = File.GetLastWriteTimeUtc(importPath);
                    var content = await File.ReadAllTextAsync(importPath);
                    var hasPotentialChange = writeTime != lastProcessedWrite || !string.Equals(content, lastProcessedContent, StringComparison.Ordinal);

                    if (hasPotentialChange)
                    {
                        var obj = JObject.Parse(content);
                        if (obj.TryGetValue("playerId", out var pidToken) && obj.TryGetValue("code", out var codeToken))
                        {
                            var playerId = pidToken.Value<ulong>();
                            var code = codeToken.Type == JTokenType.Null ? string.Empty : (codeToken.Value<string>() ?? string.Empty);

                            var escapedCode = Newtonsoft.Json.JsonConvert.SerializeObject(code);
                            var js = $"if (window.__UI_EXTRACTOR_LUA_PROBE_STATE__ && window.__UI_EXTRACTOR_LUA_PROBE_STATE__.applyIdeCode) window.__UI_EXTRACTOR_LUA_PROBE_STATE__.applyIdeCode({escapedCode});";

                            await InjectJavaScript(playerId, js, "ide-sync", "Code imported from IDE");

                            // Advance checkpoints only after successful parse + inject.
                            lastProcessedWrite = writeTime;
                            lastProcessedContent = content;
                        }
                    }
                }
            }
            catch (Exception)
            {
                // Ignore transient read errors
            }
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
                var code = payload["code"]?.Value<string>();
                if (code is null)
                {
                    status = "rejected";
                    details = "missing_code";
                    return false;
                }

                var save = payload["save"]?.Value<bool>() ?? false;
                var escapedCode = Newtonsoft.Json.JsonConvert.SerializeObject(code);
                var saveLiteral = save ? "true" : "false";
                injectCode =
                    "(function(){" +
                    "var code=" + escapedCode + ";" +
                    "var applied=false;" +
                    "if(window.__UI_EXTRACTOR_LUA_PROBE_STATE__&&typeof window.__UI_EXTRACTOR_LUA_PROBE_STATE__.applyIdeCode==='function'){" +
                    "window.__UI_EXTRACTOR_LUA_PROBE_STATE__.applyIdeCode(code);" +
                    "applied=true;" +
                    "}else if(window.LUAEditorManager&&typeof LUAEditorManager.getLuaEditor==='function'){" +
                    "var cm=LUAEditorManager.getLuaEditor();" +
                    "if(cm&&typeof cm.setValue==='function'){cm.setValue(code);applied=true;}" +
                    "}" +
                    "if(applied&&" + saveLiteral + "&&window.LUAEditorManager&&typeof LUAEditorManager.apply==='function'){LUAEditorManager.apply();}" +
                    "})();";
                summary = save ? "lua_editor set_code + save" : "lua_editor set_code";
                status = "ok";
                return true;
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

                var escapedCommandId = Newtonsoft.Json.JsonConvert.SerializeObject(commandId);
                var escapedProbeMethod = Newtonsoft.Json.JsonConvert.SerializeObject(probeMethod);
                var escapedProbeArgs = probeArgsToken.ToString(Newtonsoft.Json.Formatting.None);
                injectCode =
                    "(function(){" +
                    "var probe=window.__UI_EXTRACTOR_LUA_PROBE_STATE__;" +
                    "if(!probe){return;}" +
                    "var commandId=" + escapedCommandId + ";" +
                    "var method=" + escapedProbeMethod + ";" +
                    "var args=" + escapedProbeArgs + ";" +
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
                var code = payload["code"]?.Value<string>();
                if (code is null)
                {
                    status = "rejected";
                    details = "missing_code";
                    return false;
                }

                var save = payload["save"]?.Value<bool>() ?? false;
                var isHtmlMode = payload["isHtmlMode"]?.Value<bool?>();
                var waitForEditor = payload["waitForEditor"]?.Value<bool>() ?? false;
                var maxAttempts = payload["maxAttempts"]?.Value<int?>() ?? 10;
                var retryDelayMs = payload["retryDelayMs"]?.Value<int?>() ?? 2000;
                maxAttempts = Math.Max(1, Math.Min(120, maxAttempts));
                retryDelayMs = Math.Max(50, Math.Min(10000, retryDelayMs));
                var escapedCode = Newtonsoft.Json.JsonConvert.SerializeObject(code);
                var saveLiteral = save ? "true" : "false";
                var htmlModeLiteral = isHtmlMode.HasValue ? (isHtmlMode.Value ? "true" : "false") : "null";
                var waitLiteral = waitForEditor ? "true" : "false";
                injectCode =
                    "(function(){" +
                    "var code=" + escapedCode + ";" +
                    "var modeValue=" + htmlModeLiteral + ";" +
                    "var waitForEditor=" + waitLiteral + ";" +
                    "var maxAttempts=" + maxAttempts + ";" +
                    "var retryDelayMs=" + retryDelayMs + ";" +
                    "var attempt=0;" +
                    "var applyToPanel=function(){" +
                    "var panel=window.screenContentEditorPanel;" +
                    "if(panel&&panel.textEditor){" +
                    "if(typeof modeValue==='boolean'&&panel.HTMLNodes&&panel.HTMLNodes.isHTMLModeCheckbox){" +
                    "panel.HTMLNodes.isHTMLModeCheckbox.checked=modeValue;" +
                    "if(typeof panel._onSwitchMode==='function'){panel._onSwitchMode();}" +
                    "}" +
                    "panel.textEditor.value=code;" +
                    "if(typeof panel._onCodeChange==='function'){panel._onCodeChange();}" +
                    "if(" + saveLiteral + "&&window.CPPScreenContentEditor&&typeof CPPScreenContentEditor.save==='function'){" +
                    "CPPScreenContentEditor.save(panel.textEditor.value,panel.isInHTMLMode);" +
                    "if(typeof CPPScreenContentEditor.close==='function'){CPPScreenContentEditor.close();}" +
                    "}" +
                    "return;" +
                    "}" +
                    "attempt+=1;" +
                    "if(waitForEditor&&attempt<maxAttempts&&typeof window.setTimeout==='function'){" +
                    "window.setTimeout(applyToPanel,retryDelayMs);" +
                    "}" +
                    "};" +
                    "applyToPanel();" +
                    "})();";
                summary = save
                    ? (waitForEditor ? "screen_editor set_code + save + wait" : "screen_editor set_code + save")
                    : (waitForEditor ? "screen_editor set_code + wait" : "screen_editor set_code");
                status = "ok";
                return true;
            }

            if (string.Equals(action, "save", StringComparison.OrdinalIgnoreCase))
            {
                var waitForEditor = payload["waitForEditor"]?.Value<bool>() ?? false;
                var maxAttempts = payload["maxAttempts"]?.Value<int?>() ?? 10;
                var retryDelayMs = payload["retryDelayMs"]?.Value<int?>() ?? 2000;
                maxAttempts = Math.Max(1, Math.Min(120, maxAttempts));
                retryDelayMs = Math.Max(50, Math.Min(10000, retryDelayMs));
                var waitLiteral = waitForEditor ? "true" : "false";
                injectCode =
                    "(function(){" +
                    "var waitForEditor=" + waitLiteral + ";" +
                    "var maxAttempts=" + maxAttempts + ";" +
                    "var retryDelayMs=" + retryDelayMs + ";" +
                    "var attempt=0;" +
                    "var savePanel=function(){" +
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
                await AppendMcpBridgeEvent("lua_editor", "probe_result", playerId, packetData);
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

            return scriptBuilder.ToString();
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
