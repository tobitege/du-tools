using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

return await App.RunAsync(args);

static class App
{
    internal const string DefaultProtocolVersion = "2024-11-05";
    internal const int DefaultMcpRequestTimeoutMs = 30000;
    private static readonly Regex LuaIdentifierRegex = new("^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);

    public static async Task<int> RunAsync(string[] args)
    {
        try
        {
            var options = AppOptions.Parse(args);
            if (options.ShowHelp)
            {
                PrintUsage();
                return 0;
            }

            var serverPath = ResolveServerPath(options.ServerPath);
            var outputPath = ResolveOutputPath(options.OutputPath, options.ConstructId);
            Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);

            Console.Error.WriteLine($"Using MCP server: {serverPath}");
            Console.Error.WriteLine($"Writing export to: {outputPath}");
            var export = await RunNodeExportHelperAsync(options, serverPath, CancellationToken.None);

            var luaText = RenderLuaDocument(export);
            await File.WriteAllTextAsync(outputPath, luaText, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            Console.WriteLine($"Exported {export.Count} element row(s) to {outputPath}");
            return 0;
        }
        catch (ArgumentException ex)
        {
            Console.Error.WriteLine($"Argument error: {ex.Message}");
            Console.Error.WriteLine();
            PrintUsage();
            return 2;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error: {ex.Message}");
            return 1;
        }
    }

    private static async Task<List<long>> ResolveRequestedIndustryIdsAsync(McpProcessClient client, AppOptions options, CancellationToken cancellationToken)
    {
        var explicitIds = await LoadExplicitIdsAsync(options, cancellationToken);
        if (explicitIds.Count > 0)
        {
            Console.Error.WriteLine($"Using {explicitIds.Count} explicitly requested id(s).");
            return explicitIds;
        }

        Console.Error.WriteLine("Resolving all industry element ids from construct index...");
        return await LoadAllIndustryIdsAsync(client, options, cancellationToken);
    }

    private static async Task<List<long>> LoadExplicitIdsAsync(AppOptions options, CancellationToken cancellationToken)
    {
        var ordered = new List<long>();
        var seen = new HashSet<long>();

        foreach (var id in options.Ids)
        {
            if (seen.Add(id))
            {
                ordered.Add(id);
            }
        }

        return ordered;
    }

    private static async Task<List<long>> LoadAllIndustryIdsAsync(McpProcessClient client, AppOptions options, CancellationToken cancellationToken)
    {
        Console.Error.WriteLine("Calling du_construct_describe to enumerate industry types...");
        var describeResult = await client.CallToolAsync(
            "du_construct_describe",
            new JsonObject
            {
                ["playerId"] = options.PlayerId,
                ["constructId"] = options.ConstructId,
                ["timeoutMs"] = 5000
            },
            cancellationToken);

        var structuredContent = GetStructuredContent(describeResult);
        var typeCounts = structuredContent["typeCounts"] as JsonArray
            ?? throw new InvalidOperationException("du_construct_describe did not return typeCounts.");

        var industryTypes = typeCounts
            .OfType<JsonObject>()
            .Where(static entry => string.Equals(entry["category"]?.GetValue<string>(), "industry", StringComparison.Ordinal))
            .Select(static entry =>
            {
                var typeName = entry["typeName"]?.GetValue<string>()
                    ?? throw new InvalidOperationException("Industry typeCounts entry is missing typeName.");
                var count = entry["count"]?.GetValue<int>()
                    ?? throw new InvalidOperationException($"Industry typeCounts entry for {typeName} is missing count.");
                return new IndustryTypeCount(typeName, count);
            })
            .OrderBy(static entry => entry.TypeName, StringComparer.Ordinal)
            .ToArray();

        var orderedIds = new List<long>();
        var seen = new HashSet<long>();

        foreach (var industryType in industryTypes)
        {
            Console.Error.WriteLine($"  Enumerating {industryType.TypeName} ({industryType.Count})...");

            var queryResult = await client.CallToolAsync(
                "du_construct_index_query",
                new JsonObject
                {
                    ["playerId"] = options.PlayerId,
                    ["constructId"] = options.ConstructId,
                    ["category"] = "industry",
                    ["exactName"] = industryType.TypeName,
                    ["limit"] = industryType.Count,
                    ["timeoutMs"] = 15000
                },
                cancellationToken);

            var queryStructuredContent = GetStructuredContent(queryResult);
            var results = queryStructuredContent["results"] as JsonArray
                ?? throw new InvalidOperationException($"du_construct_index_query for {industryType.TypeName} did not return results.");

            if (results.Count != industryType.Count)
            {
                throw new InvalidOperationException(
                    $"Construct index query for {industryType.TypeName} returned {results.Count} rows, expected {industryType.Count}.");
            }

            foreach (var resultNode in results)
            {
                var result = resultNode as JsonObject
                    ?? throw new InvalidOperationException($"Construct index query for {industryType.TypeName} returned a non-object result.");
                var id = result["id"]?.GetValue<long>()
                    ?? throw new InvalidOperationException($"Construct index query for {industryType.TypeName} returned a result without id.");
                if (seen.Add(id))
                {
                    orderedIds.Add(id);
                }
            }
        }

        if (orderedIds.Count == 0)
        {
            throw new InvalidOperationException("No industry ids were discovered from the construct index.");
        }

        Console.Error.WriteLine($"Resolved {orderedIds.Count} unique industry element id(s) from the construct index.");
        return orderedIds;
    }

    private static string ResolveServerPath(string? explicitServerPath)
    {
        if (!string.IsNullOrWhiteSpace(explicitServerPath))
        {
            var fullPath = Path.GetFullPath(explicitServerPath);
            if (!File.Exists(fullPath))
            {
                throw new ArgumentException($"Server path does not exist: {fullPath}");
            }

            return fullPath;
        }

        var envPath = Environment.GetEnvironmentVariable("DU_MCP_BRIDGE_SERVER_CMD");
        if (!string.IsNullOrWhiteSpace(envPath))
        {
            var fullPath = Path.GetFullPath(envPath);
            if (File.Exists(fullPath))
            {
                return fullPath;
            }
        }

        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            var current = new DirectoryInfo(start);
            while (current is not null)
            {
                var candidate = Path.Combine(current.FullName, "DuMcpBridge", "run-mcp.cmd");
                if (File.Exists(candidate))
                {
                    return candidate;
                }

                current = current.Parent;
            }
        }

        throw new ArgumentException("Could not resolve DuMcpBridge\\run-mcp.cmd. Pass --server-path explicitly.");
    }

    private static string ResolveOutputPath(string? outputPath, long constructId)
    {
        if (!string.IsNullOrWhiteSpace(outputPath))
        {
            return Path.GetFullPath(outputPath);
        }

        return Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), $"industry-batch-export-{constructId}.lua"));
    }

    private static async Task<JsonObject> RunNodeExportHelperAsync(AppOptions options, string serverPath, CancellationToken cancellationToken)
    {
        var helperPath = ResolveHelperPath();
        var startInfo = new ProcessStartInfo
        {
            FileName = "node",
            WorkingDirectory = Directory.GetCurrentDirectory(),
            RedirectStandardOutput = true,
            RedirectStandardInput = false,
            RedirectStandardError = false,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        startInfo.ArgumentList.Add(helperPath);
        startInfo.ArgumentList.Add("--player-id");
        startInfo.ArgumentList.Add(options.PlayerId.ToString(CultureInfo.InvariantCulture));
        startInfo.ArgumentList.Add("--construct-id");
        startInfo.ArgumentList.Add(options.ConstructId.ToString(CultureInfo.InvariantCulture));
        startInfo.ArgumentList.Add("--batch-size");
        startInfo.ArgumentList.Add(options.BatchSize.ToString(CultureInfo.InvariantCulture));
        startInfo.ArgumentList.Add("--timeout-ms");
        startInfo.ArgumentList.Add(options.TimeoutMs.ToString(CultureInfo.InvariantCulture));
        startInfo.ArgumentList.Add("--server-path");
        startInfo.ArgumentList.Add(serverPath);
        startInfo.ArgumentList.Add("--protocol-version");
        startInfo.ArgumentList.Add(options.ProtocolVersion);

        foreach (var id in options.Ids)
        {
            startInfo.ArgumentList.Add("--id");
            startInfo.ArgumentList.Add(id.ToString(CultureInfo.InvariantCulture));
        }

        if (options.Verbose)
        {
            startInfo.ArgumentList.Add("--verbose");
        }

        var process = Process.Start(startInfo) ?? throw new InvalidOperationException("Failed to start Node export helper.");
        var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);
        var stdout = await stdoutTask;

        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException($"Node export helper exited with code {process.ExitCode}.");
        }

        if (string.IsNullOrWhiteSpace(stdout))
        {
            throw new InvalidOperationException("Node export helper did not produce any JSON output.");
        }

        return JsonNode.Parse(stdout) as JsonObject
            ?? throw new InvalidOperationException("Node export helper returned a non-object JSON payload.");
    }

    private static string ResolveHelperPath()
    {
        var baseDirectory = AppContext.BaseDirectory;
        var candidate = Path.Combine(baseDirectory, "mcp-export-helper.mjs");
        if (File.Exists(candidate))
        {
            return candidate;
        }

        candidate = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "mcp-export-helper.mjs"));
        if (File.Exists(candidate))
        {
            return candidate;
        }

        throw new InvalidOperationException("Could not resolve mcp-export-helper.mjs.");
    }

    private static JsonArray ToJsonArray(IEnumerable<long> values)
    {
        var array = new JsonArray();
        foreach (var value in values)
        {
            array.Add(value);
        }

        return array;
    }

    private static JsonObject GetStructuredContent(JsonObject toolResult)
    {
        return toolResult["structuredContent"] as JsonObject
            ?? throw new InvalidOperationException("MCP tool result did not contain structuredContent.");
    }

    private static void AppendJsonArrayItems(JsonNode? source, JsonArray destination)
    {
        if (source is not JsonArray array)
        {
            return;
        }

        foreach (var item in array)
        {
            destination.Add(item?.DeepClone());
        }
    }

    private static void PrintUsage()
    {
        Console.WriteLine(
            """
            indy-export-csharp

            Uses DuMcpBridge for construct-side industry discovery, then reads server SQL data for the actual export rows and writes them as Lua tables.

            Required:
              --player-id <id>       Requester player id
              --construct-id <id>    Target construct id

            Default behavior:
              Without any explicit ids, the exporter resolves all construct-local industry ids
              through DuMcpBridge and exports the full construct in batches.

            Optional input restriction:
              --id <id[,id2,...]>    One or more local industry ids; can be repeated

            Optional:
              --batch-size <n>       Reserved helper batch option (default: 100)
              --timeout-ms <n>       MCP timeout for construct discovery calls (default: 5000)
              --output <path>        Output Lua path (default: ./industry-batch-export-<construct-id>.lua)
              --server-path <path>   Path to DuMcpBridge\run-mcp.cmd
              --protocol-version <v> MCP protocol version (default: 2024-11-05)
              --verbose              Forward bridge stderr while running
              --help                 Show this help

            Example:
              dotnet run --project . -- --player-id 10000 --construct-id 1002090 --output factory.lua
            """);
    }

    private static string RenderLuaDocument(JsonObject export)
    {
        var builder = new StringBuilder();
        builder.Append("return ");
        WriteLuaValue(builder, export, 0);
        builder.AppendLine();
        return builder.ToString();
    }

    private static void WriteLuaValue(StringBuilder builder, JsonNode? node, int indentLevel)
    {
        switch (node)
        {
            case null:
                builder.Append("nil");
                return;

            case JsonObject jsonObject:
                WriteLuaObject(builder, jsonObject, indentLevel);
                return;

            case JsonArray jsonArray:
                WriteLuaArray(builder, jsonArray, indentLevel);
                return;

            case JsonValue jsonValue:
                WriteLuaScalar(builder, jsonValue);
                return;

            default:
                throw new InvalidOperationException($"Unsupported JsonNode type: {node.GetType().FullName}");
        }
    }

    private static void WriteLuaObject(StringBuilder builder, JsonObject jsonObject, int indentLevel)
    {
        if (jsonObject.Count == 0)
        {
            builder.Append("{}");
            return;
        }

        builder.AppendLine("{");
        foreach (var pair in jsonObject)
        {
            builder.Append(new string(' ', (indentLevel + 1) * 4));
            builder.Append(RenderLuaKey(pair.Key));
            builder.Append(" = ");
            WriteLuaValue(builder, pair.Value, indentLevel + 1);
            builder.AppendLine(",");
        }

        builder.Append(new string(' ', indentLevel * 4));
        builder.Append("}");
    }

    private static void WriteLuaArray(StringBuilder builder, JsonArray jsonArray, int indentLevel)
    {
        if (jsonArray.Count == 0)
        {
            builder.Append("{}");
            return;
        }

        builder.AppendLine("{");
        foreach (var item in jsonArray)
        {
            builder.Append(new string(' ', (indentLevel + 1) * 4));
            WriteLuaValue(builder, item, indentLevel + 1);
            builder.AppendLine(",");
        }

        builder.Append(new string(' ', indentLevel * 4));
        builder.Append("}");
    }

    private static void WriteLuaScalar(StringBuilder builder, JsonValue jsonValue)
    {
        if (jsonValue.TryGetValue<string>(out var stringValue))
        {
            builder.Append(RenderLuaString(stringValue));
            return;
        }

        if (jsonValue.TryGetValue<bool>(out var boolValue))
        {
            builder.Append(boolValue ? "true" : "false");
            return;
        }

        if (jsonValue.TryGetValue<long>(out var longValue))
        {
            builder.Append(longValue.ToString(CultureInfo.InvariantCulture));
            return;
        }

        if (jsonValue.TryGetValue<double>(out var doubleValue))
        {
            if (double.IsNaN(doubleValue) || double.IsInfinity(doubleValue))
            {
                throw new InvalidOperationException("Lua export does not support NaN or Infinity values.");
            }

            builder.Append(doubleValue.ToString("R", CultureInfo.InvariantCulture));
            return;
        }

        if (jsonValue.TryGetValue<decimal>(out var decimalValue))
        {
            builder.Append(decimalValue.ToString(CultureInfo.InvariantCulture));
            return;
        }

        builder.Append(jsonValue.ToJsonString());
    }

    private static string RenderLuaKey(string key)
    {
        // JSON object keys are always strings; emit pure digit ids as Lua numeric keys: [4140] not ["4140"].
        if (long.TryParse(key, NumberStyles.None, CultureInfo.InvariantCulture, out var numericKey) &&
            numericKey >= 0 &&
            string.Equals(key, numericKey.ToString(CultureInfo.InvariantCulture), StringComparison.Ordinal))
        {
            return $"[{numericKey.ToString(CultureInfo.InvariantCulture)}]";
        }

        return LuaIdentifierRegex.IsMatch(key)
            ? key
            : $"[{RenderLuaString(key)}]";
    }

    private static string RenderLuaString(string value)
    {
        var builder = new StringBuilder(value.Length + 8);
        builder.Append('"');
        foreach (var ch in value)
        {
            switch (ch)
            {
                case '\\':
                    builder.Append("\\\\");
                    break;
                case '"':
                    builder.Append("\\\"");
                    break;
                case '\n':
                    builder.Append("\\n");
                    break;
                case '\r':
                    builder.Append("\\r");
                    break;
                case '\t':
                    builder.Append("\\t");
                    break;
                default:
                    if (char.IsControl(ch))
                    {
                        builder.Append('\\');
                        builder.Append(((int)ch).ToString("D3", CultureInfo.InvariantCulture));
                    }
                    else
                    {
                        builder.Append(ch);
                    }

                    break;
            }
        }

        builder.Append('"');
        return builder.ToString();
    }
}

sealed record AppOptions(
    long PlayerId,
    long ConstructId,
    IReadOnlyList<long> Ids,
    int BatchSize,
    int TimeoutMs,
    string? OutputPath,
    string? ServerPath,
    string ProtocolVersion,
    bool Verbose,
    bool ShowHelp)
{
    public static AppOptions Parse(string[] args)
    {
        long? playerId = null;
        long? constructId = null;
        var ids = new List<long>();
        var batchSize = 100;
        var timeoutMs = 5000;
        string? outputPath = null;
        string? serverPath = null;
        var protocolVersion = App.DefaultProtocolVersion;
        var verbose = false;
        var showHelp = false;

        for (var index = 0; index < args.Length; index += 1)
        {
            var arg = args[index];
            switch (arg)
            {
                case "--help":
                case "-h":
                case "/?":
                    showHelp = true;
                    break;

                case "--verbose":
                    verbose = true;
                    break;

                case "--player-id":
                    playerId = ParseLong(RequireValue(args, ref index, arg), arg);
                    break;

                case "--construct-id":
                    constructId = ParseLong(RequireValue(args, ref index, arg), arg);
                    break;

                case "--id":
                    ids.AddRange(ParseIdList(RequireValue(args, ref index, arg), arg));
                    break;

                case "--batch-size":
                    batchSize = ParseInt(RequireValue(args, ref index, arg), arg, minimum: 1, maximum: 250);
                    break;

                case "--timeout-ms":
                    timeoutMs = ParseInt(RequireValue(args, ref index, arg), arg, minimum: 250, maximum: 15000);
                    break;

                case "--output":
                    outputPath = RequireValue(args, ref index, arg);
                    break;

                case "--server-path":
                    serverPath = RequireValue(args, ref index, arg);
                    break;

                case "--protocol-version":
                    protocolVersion = RequireValue(args, ref index, arg);
                    break;

                default:
                    if (arg.StartsWith("--player-id=", StringComparison.Ordinal))
                    {
                        playerId = ParseLong(arg["--player-id=".Length..], "--player-id");
                    }
                    else if (arg.StartsWith("--construct-id=", StringComparison.Ordinal))
                    {
                        constructId = ParseLong(arg["--construct-id=".Length..], "--construct-id");
                    }
                    else if (arg.StartsWith("--id=", StringComparison.Ordinal))
                    {
                        ids.AddRange(ParseIdList(arg["--id=".Length..], "--id"));
                    }
                    else if (arg.StartsWith("--batch-size=", StringComparison.Ordinal))
                    {
                        batchSize = ParseInt(arg["--batch-size=".Length..], "--batch-size", minimum: 1, maximum: 250);
                    }
                    else if (arg.StartsWith("--timeout-ms=", StringComparison.Ordinal))
                    {
                        timeoutMs = ParseInt(arg["--timeout-ms=".Length..], "--timeout-ms", minimum: 250, maximum: 15000);
                    }
                    else if (arg.StartsWith("--output=", StringComparison.Ordinal))
                    {
                        outputPath = arg["--output=".Length..];
                    }
                    else if (arg.StartsWith("--server-path=", StringComparison.Ordinal))
                    {
                        serverPath = arg["--server-path=".Length..];
                    }
                    else if (arg.StartsWith("--protocol-version=", StringComparison.Ordinal))
                    {
                        protocolVersion = arg["--protocol-version=".Length..];
                    }
                    else
                    {
                        throw new ArgumentException($"Unknown argument: {arg}");
                    }

                    break;
            }
        }

        if (!showHelp)
        {
            if (playerId is null)
            {
                throw new ArgumentException("Missing required argument --player-id.");
            }

            if (constructId is null)
            {
                throw new ArgumentException("Missing required argument --construct-id.");
            }
        }

        return new AppOptions(
            PlayerId: playerId ?? 0,
            ConstructId: constructId ?? 0,
            Ids: ids,
            BatchSize: batchSize,
            TimeoutMs: timeoutMs,
            OutputPath: outputPath,
            ServerPath: serverPath,
            ProtocolVersion: protocolVersion,
            Verbose: verbose,
            ShowHelp: showHelp);
    }

    private static string RequireValue(string[] args, ref int index, string option)
    {
        var nextIndex = index + 1;
        if (nextIndex >= args.Length)
        {
            throw new ArgumentException($"Missing value for {option}.");
        }

        index = nextIndex;
        return args[index];
    }

    private static long ParseLong(string value, string option)
    {
        if (!long.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) || parsed < 0)
        {
            throw new ArgumentException($"Invalid numeric value for {option}: {value}");
        }

        return parsed;
    }

    private static int ParseInt(string value, string option, int minimum, int maximum)
    {
        if (!int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) || parsed < minimum || parsed > maximum)
        {
            throw new ArgumentException($"Invalid numeric value for {option}: {value} (expected {minimum}..{maximum})");
        }

        return parsed;
    }

    private static IEnumerable<long> ParseIdList(string value, string option)
    {
        foreach (var segment in value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            yield return ParseLong(segment, option);
        }
    }
}

sealed record IndustryTypeCount(string TypeName, int Count);

sealed class McpProcessClient : IAsyncDisposable
{
    private readonly Process _process;
    private readonly Stream _stdin;
    private readonly Stream _stdout;
    private readonly Task _stderrPumpTask;
    private int _nextRequestId = 0;

    private McpProcessClient(Process process, bool verbose)
    {
        _process = process;
        _stdin = process.StandardInput.BaseStream;
        _stdout = process.StandardOutput.BaseStream;
        _stderrPumpTask = PumpStandardErrorAsync(process.StandardError, verbose, CancellationToken.None);
    }

    public static async Task<McpProcessClient> StartAsync(string serverPath, bool verbose, CancellationToken cancellationToken)
    {
        if (!File.Exists(serverPath))
        {
            throw new FileNotFoundException("MCP server launcher not found.", serverPath);
        }

        var startInfo = CreateStartInfo(serverPath);

        var process = Process.Start(startInfo) ?? throw new InvalidOperationException($"Failed to start MCP server: {serverPath}");
        await Task.Yield();
        cancellationToken.ThrowIfCancellationRequested();
        return new McpProcessClient(process, verbose);
    }

    private static ProcessStartInfo CreateStartInfo(string serverPath)
    {
        var serverDirectory = Path.GetDirectoryName(serverPath)
            ?? throw new InvalidOperationException($"Could not determine server directory for {serverPath}");

        var directServerScript = Path.Combine(serverDirectory, "dist", "server.js");
        if (serverPath.EndsWith(".cmd", StringComparison.OrdinalIgnoreCase) && File.Exists(directServerScript))
        {
            return new ProcessStartInfo
            {
                FileName = "node",
                Arguments = $"\"{directServerScript}\"",
                WorkingDirectory = serverDirectory,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
        }

        var commandProcessor = Environment.GetEnvironmentVariable("ComSpec");
        if (string.IsNullOrWhiteSpace(commandProcessor))
        {
            commandProcessor = "cmd.exe";
        }

        return new ProcessStartInfo
        {
            FileName = commandProcessor,
            Arguments = $"/d /s /c \"\"{serverPath}\"\"",
            WorkingDirectory = serverDirectory,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
    }

    public async Task InitializeAsync(string protocolVersion, CancellationToken cancellationToken)
    {
        var initializeParams = new JsonObject
        {
            ["protocolVersion"] = protocolVersion,
            ["capabilities"] = new JsonObject(),
            ["clientInfo"] = new JsonObject
            {
                ["name"] = "indy-export-csharp",
                ["version"] = "0.1.0"
            }
        };

        _ = await SendRequestAsync("initialize", initializeParams, cancellationToken);
        await SendNotificationAsync("notifications/initialized", new JsonObject(), cancellationToken);
    }

    public async Task<JsonObject> CallToolAsync(string toolName, JsonObject arguments, CancellationToken cancellationToken)
    {
        var requestParams = new JsonObject
        {
            ["name"] = toolName,
            ["arguments"] = arguments
        };

        return await SendRequestAsync("tools/call", requestParams, cancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            if (!_process.HasExited)
            {
                _process.Kill(entireProcessTree: true);
            }
        }
        catch
        {
        }

        try
        {
            await _stderrPumpTask;
        }
        catch
        {
        }

        _process.Dispose();
    }

    private async Task<JsonObject> SendRequestAsync(string method, JsonObject parameters, CancellationToken cancellationToken)
    {
        var requestId = Interlocked.Increment(ref _nextRequestId);
        await WriteMessageAsync(new JsonObject
        {
            ["jsonrpc"] = "2.0",
            ["id"] = requestId,
            ["method"] = method,
            ["params"] = parameters
        }, cancellationToken);

        var requestTimeout = TimeSpan.FromMilliseconds(App.DefaultMcpRequestTimeoutMs);
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(requestTimeout);

        while (true)
        {
            JsonObject message;
            try
            {
                message = await ReadMessageAsync(timeoutCts.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                throw new TimeoutException($"Timed out waiting for MCP response to {method} after {requestTimeout.TotalSeconds:0} seconds.");
            }

            var responseId = TryGetResponseId(message);
            if (responseId != requestId)
            {
                continue;
            }

            if (message["error"] is JsonNode errorNode)
            {
                throw new InvalidOperationException($"MCP request {method} failed: {errorNode.ToJsonString()}");
            }

            return message["result"] as JsonObject
                ?? throw new InvalidOperationException($"MCP response for {method} did not contain a result object.");
        }
    }

    private async Task SendNotificationAsync(string method, JsonObject parameters, CancellationToken cancellationToken)
    {
        await WriteMessageAsync(new JsonObject
        {
            ["jsonrpc"] = "2.0",
            ["method"] = method,
            ["params"] = parameters
        }, cancellationToken);
    }

    private async Task WriteMessageAsync(JsonObject message, CancellationToken cancellationToken)
    {
        var body = Encoding.UTF8.GetBytes(message.ToJsonString());
        var header = Encoding.ASCII.GetBytes($"Content-Length: {body.Length}\n\n");
        await _stdin.WriteAsync(header, cancellationToken);
        await _stdin.WriteAsync(body, cancellationToken);
        await _stdin.FlushAsync(cancellationToken);
    }

    private async Task<JsonObject> ReadMessageAsync(CancellationToken cancellationToken)
    {
        var contentLength = 0;
        while (true)
        {
            var line = await ReadAsciiLineAsync(_stdout, cancellationToken);
            if (line is null)
            {
                throw new EndOfStreamException("MCP server closed stdout before sending a full response.");
            }

            if (line.Length == 0)
            {
                break;
            }

            var separatorIndex = line.IndexOf(':');
            if (separatorIndex <= 0)
            {
                continue;
            }

            var headerName = line[..separatorIndex].Trim();
            var headerValue = line[(separatorIndex + 1)..].Trim();
            if (headerName.Equals("Content-Length", StringComparison.OrdinalIgnoreCase))
            {
                contentLength = int.Parse(headerValue, CultureInfo.InvariantCulture);
            }
        }

        if (contentLength <= 0)
        {
            throw new InvalidOperationException("Received an MCP message without a valid Content-Length header.");
        }

        var buffer = new byte[contentLength];
        await ReadExactlyAsync(_stdout, buffer, cancellationToken);

        return JsonNode.Parse(buffer) as JsonObject
            ?? throw new InvalidOperationException("Received a non-object MCP message.");
    }

    private static async Task<string?> ReadAsciiLineAsync(Stream stream, CancellationToken cancellationToken)
    {
        var bytes = new List<byte>();
        var buffer = new byte[1];

        while (true)
        {
            var read = await stream.ReadAsync(buffer, cancellationToken);
            if (read == 0)
            {
                if (bytes.Count == 0)
                {
                    return null;
                }

                throw new EndOfStreamException("Unexpected EOF while reading an MCP header line.");
            }

            var current = buffer[0];
            if (current == '\n')
            {
                break;
            }

            if (current != '\r')
            {
                bytes.Add(current);
            }
        }

        return Encoding.ASCII.GetString(bytes.ToArray());
    }

    private static async Task ReadExactlyAsync(Stream stream, byte[] buffer, CancellationToken cancellationToken)
    {
        var offset = 0;
        while (offset < buffer.Length)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(offset, buffer.Length - offset), cancellationToken);
            if (read == 0)
            {
                throw new EndOfStreamException("Unexpected EOF while reading an MCP message body.");
            }

            offset += read;
        }
    }

    private static int? TryGetResponseId(JsonObject message)
    {
        var idNode = message["id"];
        if (idNode is null)
        {
            return null;
        }

        if (idNode is JsonValue value && value.TryGetValue<int>(out var intId))
        {
            return intId;
        }

        if (idNode is JsonValue textValue && textValue.TryGetValue<string>(out var stringId) && int.TryParse(stringId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static async Task PumpStandardErrorAsync(StreamReader stderr, bool verbose, CancellationToken cancellationToken)
    {
        while (true)
        {
            var line = await stderr.ReadLineAsync(cancellationToken);
            if (line is null)
            {
                return;
            }

            if (verbose)
            {
                Console.Error.WriteLine($"[DuMcpBridge] {line}");
            }
        }
    }
}
