# MeshDump

Extracts axis-aligned bounding boxes (AABB) from Dual Universe game client `.mesh` files and writes the results to a single JSON file.

## How it works

1. Recursively scans the game client's `resources_generated/elements` directory for `.mesh` files.
2. Reads each file's raw bytes and checks for the Unigine mesh magic header (`ms__`, e.g. `ms11`).
3. Extracts six IEEE-754 floats immediately after the 4-byte magic: `minX`, `minY`, `minZ`, `maxX`, `maxY`, `maxZ`.
4. Rounds coordinates to 5 decimal places and stores them keyed by mesh filename (without extension).
5. Serializes to pretty-printed JSON via `Newtonsoft.Json`.

## Output format

```json
{
  "element_name": {
    "box": {
      "min": [ x, y, z ],
      "max": [ x, y, z ]
    }
  }
}
```

The output file `all-mesh-boxes.json` in the repository root is a copy of this output.

## Configuration

`searchDir` and `outPath` are currently hardcoded in `MeshDump.cs`. Adjust them before running:

- `searchDir`: path to the game client's `data\resources_generated\elements` directory
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
