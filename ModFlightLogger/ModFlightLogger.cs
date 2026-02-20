using Orleans;
using System;
using System.IO;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using Backend;
using Backend.Scenegraph;
using NQ;
using NQ.Interfaces;
using NQutils;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

/// <summary>
/// FlightLogger mod - captures telemetry from Lua and logs to file with optional chat summaries.
///
/// Lua usage from control seat:
///   system.modAction("NQ.FlightLogger", 1, constructId, 0, 0, telemetryJson)
///
/// Where telemetryJson is a JSON string containing flight data like:
///   {"pos":{"x":1,"y":2,"z":3},"vel":{"x":0.1,"y":0.2,"z":0.3},"speed":123.4,...}
/// </summary>
public class FlightLoggerState
{
    public ulong ConstructId { get; set; }
    public ulong PlayerId { get; set; }
    public string LogPath { get; set; } = "";
    public long MessageCount { get; set; }
    public DateTime LastSummaryTime { get; set; }
    public DateTime StartTime { get; set; }
    public int SummaryInterval { get; set; }
    public DateTime LastSampleTimeUtc { get; set; }
    public double? LastTelemetryTimeSeconds { get; set; }
    public Vector3D? LastVelocity { get; set; }
    public Vector3D? LastAcceleration { get; set; }
    public double? LastAltitude { get; set; }
    public double MaxBrakeForceObserved { get; set; }
}

public class TelemetryEntry
{
    public DateTime timestamp { get; set; }
    public ulong playerId { get; set; }
    public ulong constructId { get; set; }
    public JObject? data { get; set; }
}

public struct Vector3D
{
    public double X { get; }
    public double Y { get; }
    public double Z { get; }

    public Vector3D(double x, double y, double z)
    {
        X = x;
        Y = y;
        Z = z;
    }

    public double Length() => Math.Sqrt((X * X) + (Y * Y) + (Z * Z));

    public Vector3D Normalize()
    {
        var len = Length();
        if (len <= 1e-9)
        {
            return new Vector3D(0, 0, 0);
        }

        return this / len;
    }

    public static double Dot(Vector3D a, Vector3D b) => (a.X * b.X) + (a.Y * b.Y) + (a.Z * b.Z);
    public static Vector3D operator +(Vector3D a, Vector3D b) => new Vector3D(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
    public static Vector3D operator -(Vector3D a, Vector3D b) => new Vector3D(a.X - b.X, a.Y - b.Y, a.Z - b.Z);
    public static Vector3D operator /(Vector3D a, double d) => new Vector3D(a.X / d, a.Y / d, a.Z / d);
    public static Vector3D operator *(Vector3D a, double d) => new Vector3D(a.X * d, a.Y * d, a.Z * d);
}

public sealed class PlanetDescriptor
{
    public ulong Id { get; set; }
    public string Name { get; set; } = "";
    public Vector3D Center { get; set; }
    public double ReferenceRadius { get; set; }
}

public sealed class PlanetContext
{
    public ulong Id { get; set; }
    public string Name { get; set; } = "";
    public Vector3D Center { get; set; }
    public double DistanceToCenter { get; set; }
    public double DistanceToSurface { get; set; }
    public double ReferenceRadius { get; set; }
    public Vector3D? WorldPosition { get; set; }
}

public class MyDuMod : IMod
{
    private IClusterClient orleans = null!;
    private ILogger logger = null!;
    private IPlanetList planetList = null!;
    private IScenegraph scenegraph = null!;
    private readonly ConcurrentDictionary<ulong, FlightLoggerState> activeLoggers = new();
    private readonly ConcurrentDictionary<ulong, SemaphoreSlim> constructLocks = new();
    private readonly SemaphoreSlim planetCacheGate = new(1, 1);
    private List<PlanetDescriptor> planetCache = new();
    private DateTime planetCacheUpdatedUtc = DateTime.MinValue;

    // Configuration
    private const ulong LUA_ACTION_BASE = 1_000_000;
    private const int DEFAULT_SUMMARY_INTERVAL = 100; // Send chat summary every N messages
    private const string DEFAULT_TMP_DIR = "tmp";
    private const string DEFAULT_LOG_DIR_NAME = "flight-logs";
    private static readonly TimeSpan PLANET_CACHE_TTL = TimeSpan.FromMinutes(10);
    private const double STANDARD_GRAVITY = 9.80665;
    private string logDirectory = Path.Combine(DEFAULT_TMP_DIR, DEFAULT_LOG_DIR_NAME);
    private int defaultSummaryInterval = DEFAULT_SUMMARY_INTERVAL;

    public string GetName()
    {
        return "NQ.FlightLogger";
    }

    public Task Initialize(IServiceProvider isp)
    {
        this.orleans = isp.GetRequiredService<IClusterClient>();
        this.logger = isp.GetRequiredService<ILogger<MyDuMod>>();
        this.planetList = isp.GetRequiredService<IPlanetList>();
        this.scenegraph = isp.GetRequiredService<IScenegraph>();

        var resolvedFromLayout = TryResolveServerRoot(AppContext.BaseDirectory, out var serverRoot);
        if (!resolvedFromLayout)
        {
            logger.LogWarning(
                "FlightLogger could not detect 'wincs\\all' runtime layout from AppContext.BaseDirectory ({BaseDir}). Falling back to current directory ({CurrentDir})",
                AppContext.BaseDirectory,
                serverRoot);
        }

        logDirectory = Path.Combine(serverRoot, DEFAULT_TMP_DIR, DEFAULT_LOG_DIR_NAME);

        if (!Directory.Exists(logDirectory))
        {
            Directory.CreateDirectory(logDirectory);
        }

        logger.LogInformation("FlightLogger mod initialized. Log directory: {LogDir}", logDirectory);
        return Task.CompletedTask;
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

    public Task<ModInfo> GetModInfoFor(ulong playerId, bool admin)
    {
        var res = new ModInfo
        {
            name = GetName(),
            actions = new List<ModActionDefinition>(),
        };

        // Action 1: Log telemetry data (called from Lua)
        res.actions.Add(new ModActionDefinition
        {
            id = 1,
            label = "FlightLogger\\Log Telemetry",
            context = ModActionContext.Element,
        });

        // Action 2: Start logging session for a construct
        res.actions.Add(new ModActionDefinition
        {
            id = 2,
            label = "FlightLogger\\Start Session",
            context = ModActionContext.Construct,
        });

        // Action 3: Stop logging session
        res.actions.Add(new ModActionDefinition
        {
            id = 3,
            label = "FlightLogger\\Stop Session",
            context = ModActionContext.Construct,
        });

        // Action 4: Set summary interval (payload = interval number)
        res.actions.Add(new ModActionDefinition
        {
            id = 4,
            label = "FlightLogger\\Set Summary Interval",
            context = ModActionContext.Construct,
        });

        return Task.FromResult(res);
    }

    public async Task TriggerAction(ulong playerId, ModAction action)
    {
        if (action.actionId >= LUA_ACTION_BASE)
        {
            await LogTelemetry(playerId, action);
            return;
        }

        switch (action.actionId)
        {
            case 1: // Log telemetry (from Lua or element action)
                await LogTelemetry(playerId, action);
                break;

            case 2: // Start session
                await StartSession(playerId, await ResolveConstructId(playerId, action.constructId));
                break;

            case 3: // Stop session
                await StopSession(playerId, await ResolveConstructId(playerId, action.constructId));
                break;

            case 4: // Set summary interval
                await SetSummaryInterval(playerId, action.constructId, action.payload);
                break;

            default:
                logger.LogDebug("Unhandled action {ActionId} from player {PlayerId}", action.actionId, playerId);
                break;
        }
    }

    private async Task LogTelemetry(ulong playerId, ModAction action)
    {
        var constructId = await ResolveConstructId(playerId, action.constructId);
        if (constructId == 0)
        {
            logger.LogWarning("Cannot resolve construct for telemetry from player {PlayerId}", playerId);
            return;
        }

        // Auto-start session if not active.
        await StartSession(playerId, constructId);
        await WriteTelemetryEntry(playerId, constructId, action.payload);
    }

    private async Task WriteTelemetryEntry(ulong playerId, ulong constructId, string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
        {
            logger.LogWarning("Empty telemetry payload from player {PlayerId}", playerId);
            return;
        }

        JObject data;
        try
        {
            var token = JToken.Parse(payload);
            if (token is not JObject obj)
            {
                logger.LogWarning("Telemetry payload from player {PlayerId} is not a JSON object", playerId);
                return;
            }

            data = obj;
        }
        catch (JsonReaderException ex)
        {
            logger.LogWarning("Invalid JSON payload from player {PlayerId}: {Error}", playerId, ex.Message);
            return;
        }

        var gate = GetConstructLock(constructId);
        FlightLoggerState? state = null;
        var shouldSendSummary = false;
        var messageCount = 0L;
        PlanetContext? planetContext = null;

        try
        {
            planetContext = await TryBuildPlanetContext(playerId, data);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Failed to enrich telemetry with planet context for player {PlayerId}", playerId);
        }

        await gate.WaitAsync();
        try
        {
            if (!activeLoggers.TryGetValue(constructId, out state))
            {
                logger.LogWarning("No active session for construct {ConstructId}", constructId);
                return;
            }

            var entry = new TelemetryEntry
            {
                timestamp = DateTime.UtcNow,
                playerId = playerId,
                constructId = constructId,
                data = data
            };

            EnrichTelemetryData(state, data, planetContext);

            var line = JsonConvert.SerializeObject(entry, Formatting.None);
            await File.AppendAllTextAsync(state.LogPath, line + Environment.NewLine);

            state.MessageCount++;
            messageCount = state.MessageCount;

            var interval = state.SummaryInterval > 0 ? state.SummaryInterval : DEFAULT_SUMMARY_INTERVAL;
            if (interval > 0 && messageCount % interval == 0)
            {
                state.LastSummaryTime = DateTime.UtcNow;
                shouldSendSummary = true;
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error writing telemetry for construct {ConstructId}", constructId);
        }
        finally
        {
            gate.Release();
        }

        if (shouldSendSummary)
        {
            await SendChatSummary(playerId, messageCount, data);
        }
    }

    private async Task StartSession(ulong playerId, ulong constructId)
    {
        if (constructId == 0)
        {
            logger.LogWarning("Refusing to start logging session for construct 0");
            return;
        }

        if (activeLoggers.ContainsKey(constructId))
        {
            return;
        }

        var gate = GetConstructLock(constructId);
        await gate.WaitAsync();
        string? fileName = null;

        try
        {
            if (activeLoggers.ContainsKey(constructId))
            {
                return;
            }

            var now = DateTime.UtcNow;
            var timestamp = now.ToString("yyyyMMdd-HHmmss");
            fileName = $"flight-{constructId}-{timestamp}.ndjson";
            var logPath = Path.Combine(logDirectory, fileName);

            var state = new FlightLoggerState
            {
                ConstructId = constructId,
                PlayerId = playerId,
                LogPath = logPath,
                MessageCount = 0,
                StartTime = now,
                LastSummaryTime = now,
                SummaryInterval = defaultSummaryInterval
            };

            var sessionStartEntry = new
            {
                type = "session_start",
                timestamp = now,
                playerId,
                constructId
            };

            var headerLine = JsonConvert.SerializeObject(sessionStartEntry, Formatting.None);
            await File.WriteAllTextAsync(logPath, headerLine + Environment.NewLine);

            activeLoggers[constructId] = state;
            logger.LogInformation("Started flight logging session for construct {ConstructId} -> {LogPath}", constructId, logPath);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to start session for construct {ConstructId}", constructId);
            return;
        }
        finally
        {
            gate.Release();
        }

        if (!string.IsNullOrEmpty(fileName))
        {
            await SendChatMessage(playerId, $"Flight logging started. File: {fileName}");
        }
    }

    private async Task StopSession(ulong playerId, ulong constructId)
    {
        if (constructId == 0)
        {
            logger.LogWarning("Refusing to stop logging session for construct 0");
            return;
        }

        var gate = GetConstructLock(constructId);
        await gate.WaitAsync();
        string? summary = null;

        try
        {
            if (!activeLoggers.TryGetValue(constructId, out var state))
            {
                logger.LogWarning("No active session for construct {ConstructId}", constructId);
                return;
            }

            var now = DateTime.UtcNow;
            var duration = now - state.StartTime;
            var sessionEndEntry = new
            {
                type = "session_end",
                timestamp = now,
                playerId,
                constructId,
                messageCount = state.MessageCount,
                durationSeconds = duration.TotalSeconds
            };

            var endLine = JsonConvert.SerializeObject(sessionEndEntry, Formatting.None);
            await File.AppendAllTextAsync(state.LogPath, endLine + Environment.NewLine);

            activeLoggers.TryRemove(constructId, out _);

            summary = $"Flight logging stopped. Messages: {state.MessageCount}, Duration: {duration:hh\\:mm\\:ss}, File: {Path.GetFileName(state.LogPath)}";
            logger.LogInformation("Stopped flight logging for construct {ConstructId}. {Summary}", constructId, summary);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to stop session for construct {ConstructId}", constructId);
            return;
        }
        finally
        {
            gate.Release();
        }

        if (summary != null)
        {
            await SendChatMessage(playerId, summary);
        }
    }

    private async Task SetSummaryInterval(ulong playerId, ulong constructId, string? payload)
    {
        if (!int.TryParse(payload, out var interval) || interval <= 0)
        {
            await SendChatMessage(playerId, "Invalid summary interval. Use a positive integer.");
            return;
        }

        defaultSummaryInterval = interval;

        if (constructId == 0)
        {
            constructId = await GetPlayerConstructId(playerId);
        }

        var appliedToSession = false;
        if (constructId != 0)
        {
            var gate = GetConstructLock(constructId);
            await gate.WaitAsync();
            try
            {
                if (activeLoggers.TryGetValue(constructId, out var state))
                {
                    state.SummaryInterval = interval;
                    appliedToSession = true;
                }
            }
            finally
            {
                gate.Release();
            }
        }

        logger.LogInformation(
            "Summary interval set to {Interval} by player {PlayerId} (construct: {ConstructId}, activeSessionUpdated: {Updated})",
            interval,
            playerId,
            constructId,
            appliedToSession);

        if (appliedToSession)
        {
            await SendChatMessage(playerId, $"Summary interval set to {interval} for construct {constructId}.");
        }
        else
        {
            await SendChatMessage(playerId, $"Default summary interval set to {interval}.");
        }
    }

    private async Task<ulong> ResolveConstructId(ulong playerId, ulong constructId)
    {
        if (constructId != 0)
        {
            return constructId;
        }

        return await GetPlayerConstructId(playerId);
    }

    private async Task<ulong> GetPlayerConstructId(ulong playerId)
    {
        try
        {
            var posUpdate = await orleans.GetPlayerGrain(playerId).GetPositionUpdate();
            return posUpdate.localPosition.constructId;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to get construct ID for player {PlayerId}", playerId);
            return 0;
        }
    }

    private async Task SendChatSummary(ulong playerId, long messageCount, JObject latestData)
    {
        try
        {
            var summary = FormatSummary(messageCount, latestData);
            await SendChatMessage(playerId, summary);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send chat summary");
        }
    }

    private string FormatSummary(long messageCount, JObject data)
    {
        var parts = new List<string>
        {
            $"[FlightLog #{messageCount}]"
        };

        if (data.TryGetValue("speed", out var speedToken))
        {
            parts.Add($"Speed: {speedToken}");
        }

        if (data.TryGetValue("altitude", out var altToken))
        {
            parts.Add($"Alt: {altToken}");
        }

        if (data.TryGetValue("heading", out var headingToken))
        {
            parts.Add($"HDG: {headingToken}");
        }

        if (data.TryGetValue("mass", out var massToken))
        {
            parts.Add($"Mass: {massToken}");
        }

        if (data.TryGetValue("planetId", out var planetIdToken))
        {
            parts.Add($"Planet: {planetIdToken}");
        }

        if (data.TryGetValue("derived", out var derivedToken) && derivedToken is JObject derived)
        {
            if (TryGetDouble(derived, "gLoad", out var gLoad))
            {
                parts.Add($"g: {gLoad:0.00}");
            }

            if (TryGetDouble(derived, "brakeForceAppliedEst", out var brakeForce))
            {
                parts.Add($"BrakeN: {brakeForce:0}");
            }
        }

        return string.Join(" | ", parts);
    }

    private SemaphoreSlim GetConstructLock(ulong constructId)
    {
        return constructLocks.GetOrAdd(constructId, _ => new SemaphoreSlim(1, 1));
    }

    private async Task SendChatMessage(ulong playerId, string message)
    {
        try
        {
            await orleans.GetChatGrain(playerId).SendMessage(new MessageContent
            {
                channel = new MessageChannel
                {
                    channel = MessageChannelType.HELP
                },
                message = message
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send chat message to player {PlayerId}", playerId);
        }
    }

    private void EnrichTelemetryData(FlightLoggerState state, JObject data, PlanetContext? planetContext)
    {
        var now = DateTime.UtcNow;
        var derived = data["derived"] as JObject ?? new JObject();
        data["derived"] = derived;

        if (planetContext != null)
        {
            var planetObject = data["planet"] as JObject ?? new JObject();
            planetObject["id"] = planetContext.Id;
            planetObject["name"] = planetContext.Name;
            planetObject["distanceToCenter"] = planetContext.DistanceToCenter;
            planetObject["distanceToSurface"] = planetContext.DistanceToSurface;
            planetObject["referenceRadius"] = planetContext.ReferenceRadius;
            data["planet"] = planetObject;
            data["planetId"] = planetContext.Id;
            data["planetName"] = planetContext.Name;
            derived["distanceToPlanetSurface"] = planetContext.DistanceToSurface;
        }

        var dt = ComputeDeltaTime(state, data, now);
        if (dt <= 1e-6)
        {
            state.LastSampleTimeUtc = now;
            return;
        }

        derived["dt"] = dt;

        var hasVelocity = TryGetVector(data, "vel", out var velocity) || TryGetVector(data, "velocity", out velocity);
        if (hasVelocity)
        {
            var speedFromVelocity = velocity.Length();
            derived["speedFromVelocity"] = speedFromVelocity;

            if (state.LastVelocity.HasValue)
            {
                var acceleration = (velocity - state.LastVelocity.Value) / dt;
                var accelMag = acceleration.Length();
                derived["accel"] = ToJObject(acceleration);
                derived["accelMag"] = accelMag;
                derived["gLoad"] = accelMag / STANDARD_GRAVITY;

                if (speedFromVelocity > 0.1)
                {
                    var fwd = velocity.Normalize();
                    var accelLong = Vector3D.Dot(acceleration, fwd);
                    var accelLatSq = Math.Max(0, (accelMag * accelMag) - (accelLong * accelLong));
                    var accelLat = Math.Sqrt(accelLatSq);
                    derived["accelLong"] = accelLong;
                    derived["accelLat"] = accelLat;
                    derived["gLong"] = accelLong / STANDARD_GRAVITY;
                    derived["gLat"] = accelLat / STANDARD_GRAVITY;

                    if (TryGetDouble(data, "mass", out var mass) && accelLong < 0)
                    {
                        var decelForce = mass * (-accelLong);
                        derived["decelForceEst"] = decelForce;

                        if (TryGetBrakeCommand(data, out var brakeCmd) && brakeCmd > 0)
                        {
                            var applied = decelForce;
                            if (applied > state.MaxBrakeForceObserved)
                            {
                                state.MaxBrakeForceObserved = applied;
                            }

                            derived["brakeForceAppliedEst"] = applied;
                            derived["brakeForceMaxObserved"] = state.MaxBrakeForceObserved;
                        }
                    }
                }

                if (state.LastAcceleration.HasValue)
                {
                    var jerk = (acceleration - state.LastAcceleration.Value) / dt;
                    derived["jerk"] = ToJObject(jerk);
                    derived["jerkMag"] = jerk.Length();
                }

                if (planetContext != null)
                {
                    var radialUnit = ((planetContext.WorldPosition ?? planetContext.Center) - planetContext.Center).Normalize();
                    var verticalSpeed = Vector3D.Dot(velocity, radialUnit);
                    derived["verticalSpeed"] = verticalSpeed;
                    var radialAccel = Vector3D.Dot(acceleration, radialUnit);
                    derived["radialAcceleration"] = radialAccel;
                    derived["gravityProxy"] = radialAccel < 0 ? -radialAccel : 0;
                }
                else if (TryGetDouble(data, "altitude", out var altitudeFromPayload) && state.LastAltitude.HasValue)
                {
                    derived["verticalSpeed"] = (altitudeFromPayload - state.LastAltitude.Value) / dt;
                }

                state.LastAcceleration = acceleration;
            }

            state.LastVelocity = velocity;
        }
        else if (TryGetDouble(data, "altitude", out var altitudeOnly) && state.LastAltitude.HasValue)
        {
            derived["verticalSpeed"] = (altitudeOnly - state.LastAltitude.Value) / dt;
        }

        if (TryGetDouble(data, "altitude", out var altitude))
        {
            state.LastAltitude = altitude;
        }

        state.LastSampleTimeUtc = now;
    }

    private double ComputeDeltaTime(FlightLoggerState state, JObject data, DateTime now)
    {
        if (TryGetDouble(data, "t", out var telemetryTime))
        {
            if (state.LastTelemetryTimeSeconds.HasValue)
            {
                var telemetryDt = telemetryTime - state.LastTelemetryTimeSeconds.Value;
                state.LastTelemetryTimeSeconds = telemetryTime;
                if (telemetryDt > 1e-6)
                {
                    return telemetryDt;
                }
            }
            else
            {
                state.LastTelemetryTimeSeconds = telemetryTime;
            }
        }

        if (state.LastSampleTimeUtc != default)
        {
            var serverDt = (now - state.LastSampleTimeUtc).TotalSeconds;
            if (serverDt > 1e-6)
            {
                return serverDt;
            }
        }

        return 0;
    }

    private async Task TryRefreshPlanetCache()
    {
        var now = DateTime.UtcNow;
        if (planetCache.Count > 0 && (now - planetCacheUpdatedUtc) <= PLANET_CACHE_TTL)
        {
            return;
        }

        await planetCacheGate.WaitAsync();
        try
        {
            now = DateTime.UtcNow;
            if (planetCache.Count > 0 && (now - planetCacheUpdatedUtc) <= PLANET_CACHE_TTL)
            {
                return;
            }

            var cache = new List<PlanetDescriptor>();
            foreach (var planet in planetList.GetPlanetList())
            {
                var pid = planet.rData.constructId;
                var center = await scenegraph.GetCenterWorldPosition((ConstructId)pid, planet.rData.geometry.size);
                var properties = await planetList.GetPlanetProperties((ConstructId)pid);
                var radius = properties != null && properties.altitudeReferenceRadius > 0
                    ? properties.altitudeReferenceRadius
                    : Math.Max(1.0, planet.rData.geometry.size / 2.0);

                cache.Add(new PlanetDescriptor
                {
                    Id = pid,
                    Name = planet.rData.name ?? $"planet-{pid}",
                    Center = new Vector3D(center.x, center.y, center.z),
                    ReferenceRadius = radius
                });
            }

            planetCache = cache;
            planetCacheUpdatedUtc = now;
        }
        finally
        {
            planetCacheGate.Release();
        }
    }

    private async Task<PlanetContext?> TryBuildPlanetContext(ulong playerId, JObject data)
    {
        await TryRefreshPlanetCache();
        if (planetCache.Count == 0)
        {
            return null;
        }

        var hasPayloadPosition = TryGetVector(data, "pos", out var worldPosition);
        if (!hasPayloadPosition)
        {
            var posUpdate = await orleans.GetPlayerGrain(playerId).GetPositionUpdate();
            worldPosition = new Vector3D(
                posUpdate.universePosition.x,
                posUpdate.universePosition.y,
                posUpdate.universePosition.z);
        }

        PlanetDescriptor? nearest = null;
        var bestDistance = double.MaxValue;
        foreach (var planet in planetCache)
        {
            var distanceToCenter = (worldPosition - planet.Center).Length();
            if (distanceToCenter < bestDistance)
            {
                bestDistance = distanceToCenter;
                nearest = planet;
            }
        }

        if (nearest == null)
        {
            return null;
        }

        var surfaceDistance = bestDistance - nearest.ReferenceRadius;
        return new PlanetContext
        {
            Id = nearest.Id,
            Name = nearest.Name,
            Center = nearest.Center,
            DistanceToCenter = bestDistance,
            DistanceToSurface = surfaceDistance,
            ReferenceRadius = nearest.ReferenceRadius,
            WorldPosition = worldPosition
        };
    }

    private static bool TryGetDouble(JObject data, string key, out double value)
    {
        value = 0;
        if (!data.TryGetValue(key, out var token))
        {
            return false;
        }

        return TryGetDouble(token, out value);
    }

    private static bool TryGetDouble(JToken? token, out double value)
    {
        value = 0;
        if (token == null || token.Type == JTokenType.Null)
        {
            return false;
        }

        if (token.Type == JTokenType.Integer || token.Type == JTokenType.Float)
        {
            value = token.Value<double>();
            return true;
        }

        if (token.Type == JTokenType.String && double.TryParse(token.Value<string>(), out var parsed))
        {
            value = parsed;
            return true;
        }

        return false;
    }

    private static bool TryGetVector(JObject data, string key, out Vector3D vector)
    {
        vector = default;
        if (!data.TryGetValue(key, out var token))
        {
            return false;
        }

        return TryGetVector(token, out vector);
    }

    private static bool TryGetVector(JToken token, out Vector3D vector)
    {
        vector = default;

        if (token is JObject obj)
        {
            if (TryGetDouble(obj, "x", out var x) &&
                TryGetDouble(obj, "y", out var y) &&
                TryGetDouble(obj, "z", out var z))
            {
                vector = new Vector3D(x, y, z);
                return true;
            }

            return false;
        }

        if (token is JArray arr && arr.Count >= 3)
        {
            if (TryGetDouble(arr[0], out var x) &&
                TryGetDouble(arr[1], out var y) &&
                TryGetDouble(arr[2], out var z))
            {
                vector = new Vector3D(x, y, z);
                return true;
            }
        }

        return false;
    }

    private static bool TryGetBrakeCommand(JObject data, out double brakeCmd)
    {
        brakeCmd = 0;
        if (TryGetDouble(data, "brakeCmd", out brakeCmd) ||
            TryGetDouble(data, "brake", out brakeCmd) ||
            TryGetDouble(data, "brakeInput", out brakeCmd) ||
            TryGetDouble(data, "brakeCommand", out brakeCmd))
        {
            return true;
        }

        return false;
    }

    private static JObject ToJObject(Vector3D vector)
    {
        return new JObject
        {
            ["x"] = vector.X,
            ["y"] = vector.Y,
            ["z"] = vector.Z
        };
    }
}
