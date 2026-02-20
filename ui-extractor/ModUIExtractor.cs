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
    private const ulong ActionIngestPacket = 900001;
    private const ulong PrivateChatChannelId = 2;
    private const string EmbeddedPayloadResourceName = "ui-extractor-payload.js";
    private const string DefaultTargetStylesheetHref = "coui://data/gui/hud/dpu_editor/css/dpu_editor.css";
    private const string TargetStylesheetFileName = "target-stylesheet-url.txt";

    private IClusterClient orleans = null!;
    private IPub pub = null!;
    private ILogger logger = null!;
    private string outputDirectory = "";
    private string targetStylesheetFilePath = "";
    private string payloadJs = "";
    private readonly ConcurrentDictionary<string, object> dumpFileLocks = new();

    public string GetName()
    {
        return ModName;
    }

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
        targetStylesheetFilePath = Path.Combine(outputDirectory, TargetStylesheetFileName);
        EnsureTargetStylesheetFile();

        payloadJs = LoadEmbeddedPayloadSafe();
        if (string.IsNullOrWhiteSpace(payloadJs))
        {
            logger.LogError("UIExtractor payload JS is empty; injection action will fail");
        }

        logger.LogInformation(
            "UIExtractor initialized. Payload bytes={PayloadSize}, output={OutputDirectory}, targetStylesheetFile={TargetStylesheetFile}",
            payloadJs.Length,
            outputDirectory,
            targetStylesheetFilePath);

        return Task.CompletedTask;
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

    private async Task InjectPayload(ulong playerId, JObject config, string notifyMessage, string modeTag)
    {
        if (string.IsNullOrWhiteSpace(payloadJs))
        {
            await Notify(playerId, "UI extractor payload is unavailable on server.");
            return;
        }

        config["modName"] = GetName();
        config["actionId"] = (long)ActionIngestPacket;

        var injectCode = $"window.__UI_EXTRACTOR_CONFIG={config.ToString(Newtonsoft.Json.Formatting.None)};\n{payloadJs}";

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

            await Notify(playerId, notifyMessage);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "UIExtractor injection failed for player {PlayerId}", playerId);
            await Notify(playerId, "UI dump injection failed. Check Orleans logs.");
        }
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

    private string LoadEmbeddedPayloadSafe()
    {
        try
        {
            var asm = Assembly.GetExecutingAssembly();
            var resourceName = asm.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith(EmbeddedPayloadResourceName, StringComparison.OrdinalIgnoreCase));

            if (string.IsNullOrWhiteSpace(resourceName))
            {
                logger.LogError("UIExtractor payload resource not found: {ResourceHint}", EmbeddedPayloadResourceName);
                return "";
            }

            using var stream = asm.GetManifestResourceStream(resourceName);
            if (stream is null)
            {
                logger.LogError("UIExtractor resource stream is null: {ResourceName}", resourceName);
                return "";
            }

            using var reader = new StreamReader(stream, Encoding.UTF8);
            return reader.ReadToEnd();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "UIExtractor failed to load embedded payload");
            return "";
        }
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
