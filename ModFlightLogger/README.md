# ModFlightLogger

FlightLogger is an embedded myDU server DLL mod. It records telemetry payloads from Lua into NDJSON files and sends periodic chat summaries.

## Requirements And Setup Instructions

1. Use a trusted build and runtime environment only.
2. The generic myDU docs say mods go in a `Mods` folder, but the real target is the `Mods` folder next to the Orleans executable used by your stack.
3. In your stack (`stack.yaml` runs `wincs/all/Grains.exe`), the correct target is `D:\MyDUserver\wincs\all\Mods`.
4. Use a myDU server install that has runtime assemblies in `D:\MyDUserver\wincs\all` (or set a different path at build time).
5. Ensure this directory contains these DLLs: `Backend.dll`, `Interfaces.dll`, `NQutils.dll`, `Router.Orleans.dll`.
6. Use .NET SDK 6+ on the build machine.
7. Keep the mod project output name starting with `Mod` (this project produces `ModFlightLogger.dll`).
8. Keep a class named `MyDuMod` implementing `IMod` in the DLL.
9. Keep `GetName()` unique across all loaded mods (this mod uses `NQ.FlightLogger`).
10. Keep `TriggerAction` thread-safe because myDU can call it from multiple tasks at the same time.
11. Build the mod.
12. Copy only `ModFlightLogger.dll` into the server `Mods` directory.
13. Restart Orleans (or restart the full stack) after copying the DLL.

## Build

Use default DU runtime path:

```bash
cd ModFlightLogger
dotnet build -c Release
```

Use a custom DU runtime DLL path:

```bash
dotnet build -c Release -p:DUExternalLibDir="D:\SomeOtherPath\wincs\all"
```

Build output DLL is typically:

```txt
ModFlightLogger\bin\Release\net6.0\win-x64\ModFlightLogger.dll
```

## Deploy

1. Copy `ModFlightLogger\bin\Release\net6.0\win-x64\ModFlightLogger.dll` to `D:\MyDUserver\wincs\all\Mods\ModFlightLogger.dll`.
2. Do not copy all dependency DLLs from `bin`.
3. Restart Orleans service (or the whole server stack).
4. Watch Orleans logs for `FlightLogger mod initialized`.

## Runtime Behavior

1. Log files are written under server root `tmp\flight-logs`: `tmp\flight-logs\flight-{constructId}-{timestamp}.ndjson` (for this stack: `D:\MyDUserver\tmp\flight-logs\...`).
2. Output format is strict NDJSON, including `session_start` and `session_end` records.
3. Sessions auto-start on first telemetry for a construct.
4. Chat summaries are sent to `HELP` channel every N messages (default 100).
5. The mod enriches each telemetry payload with:
   - `planetId`, `planetName`, and `planet` object (`distanceToCenter`, `distanceToSurface`, `referenceRadius`)
   - `derived` object (`dt`, `speedFromVelocity`, `accel`, `accelMag`, `accelLong`, `accelLat`, `gLoad`, `gLong`, `gLat`, `jerk`, `jerkMag`, `verticalSpeed`, `radialAcceleration`, `gravityProxy`, `decelForceEst`, `brakeForceAppliedEst`, `brakeForceMaxObserved`)

## Enrichment Notes

- `planetId` and `planetName` are based on nearest planet center in world space.
- `planet.distanceToSurface` is computed as `distanceToCenter - referenceRadius`.
- `derived.dt` uses telemetry `t` delta when available, else server receive time delta.
- `derived.accel` is computed from velocity delta / `dt`.
- `derived.gLoad`, `derived.gLong`, `derived.gLat` are acceleration values normalized by `9.80665`.
- `derived.jerk` is computed from acceleration delta / `dt`.
- `derived.verticalSpeed` uses radial projection when a nearest planet is known; otherwise it falls back to altitude delta / `dt`.
- `derived.gravityProxy` is a radial acceleration proxy (`max(0, -radialAcceleration)`), useful for trend analysis.
- `derived.decelForceEst` is `mass * max(0, -accelLong)`.
- `derived.brakeForceAppliedEst` and `derived.brakeForceMaxObserved` are tracked only when a brake command field is present (`brakeCmd`, `brake`, `brakeInput`, or `brakeCommand`).

## Action IDs

| ID | Purpose | Context |
| -- | ------- | ------- |
| 1 | Log telemetry (manual) | Element |
| 2 | Start logging session | Construct |
| 3 | Stop logging session | Construct |
| 4 | Set summary interval (`payload` must be a positive integer) | Construct |
| 1000000+ | High-frequency Lua telemetry ingest | Any |

## Lua Example

```lua
local telemetry = json.encode({
    t = system.getTime(),
    speed = construct.getSpeed(),
    altitude = construct.getAltitude(),
    heading = construct.getHeading(),
    mass = construct.getMass(),
    pos = construct.getPosition(),
    vel = construct.getWorldVelocity(),
    throttle = unit.getThrottle(),
    brakeCmd = unit.getBrake()
})

system.modAction("NQ.FlightLogger", 1000000, construct.getId(), 0, 0, telemetry)
```

If your seat API does not expose `unit.getBrake()`, keep `brakeCmd` out; the logger will still compute the non-commanded metrics.

Set summary interval to 50:

```lua
system.modAction("NQ.FlightLogger", 4, construct.getId(), 0, 0, "50")
```

## Troubleshooting

1. Build errors for `Backend` or `Interfaces` usually mean `DUExternalLibDir` is wrong.
2. If mod actions do not appear, verify the DLL is in `D:\MyDUserver\wincs\all\Mods` and Orleans was restarted.
3. If no log files are created, check Orleans logs for payload parse warnings and construct resolution warnings.
4. If chat summaries are too noisy, increase interval with action `4`.
