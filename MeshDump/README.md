# MeshDump

Extracts axis-aligned bounding boxes (AABB) from Dual Universe game client collision `.mesh` files (`*_col.mesh`) and writes the results to a single JSON file.

## How it works

1. Resolves the Dual Universe install folder from registry first:
   - `HKEY_LOCAL_MACHINE\SOFTWARE\Novaquark\DualUniverse\Settings-MYDU`
   - Value name: `InstallFolder`
2. Falls back to hardcoded install path (`D:\MyDualUniverse`) if registry lookup is unavailable or fails.
3. Recursively scans `<InstallFolder>\Game\data\resources_generated\elements` for `.mesh` files.
4. Filters to collision meshes only (`*_col.mesh`), skipping visual meshes.
5. Reads each file's raw bytes and checks for the Unigine mesh magic header (`ms__`, e.g. `ms11`).
6. Extracts six IEEE-754 floats immediately after the 4-byte magic: `minX`, `minY`, `minZ`, `maxX`, `maxY`, `maxZ`.
7. Rounds coordinates to 5 decimal places and stores them keyed by mesh filename (without extension).
8. Serializes to pretty-printed JSON via `Newtonsoft.Json`.

## Output format

```json
{
  "element_name_col": {
    "box": {
      "min": [ x, y, z ],
      "max": [ x, y, z ]
    }
  }
}
```

The output file `all-mesh-boxes.json` in the repository root is a copy of this output.

## Configuration

`fallbackInstallFolder` and `outPath` are currently hardcoded in `MeshDump.cs`. Adjust them before running:

- `fallbackInstallFolder`: fallback DU install path if registry lookup fails
- `outPath`: where to write the JSON output

## Usage

```bash
cd MeshDump
dotnet run
```

## Technical details

- Target framework: `net8.0`
- Dependency: `Newtonsoft.Json 13.0.4`
- The output JSON is consumed by [mydu-server-mods](https://github.com/dual-universe/mydu-server-mods) for physics and placement calculations that need element dimensions.
