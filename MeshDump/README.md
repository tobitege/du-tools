# MeshDump

Extracts axis-aligned bounding boxes (AABB) from Dual Universe game client collision `.mesh` files (`*_col.mesh`) and writes the results to a single JSON file, enriched with element identity data from official DU asset definitions.

## How it works

1. Resolves the Dual Universe install folder from registry first:
   - `HKEY_LOCAL_MACHINE\SOFTWARE\Novaquark\DualUniverse\Settings-MYDU`
   - Value name: `InstallFolder`
2. Falls back to hardcoded install path (`D:\MyDualUniverse`) if registry lookup is unavailable or fails.
3. Resolves ItemBank JSON path from env var `ITEMBANK_JSON`, else falls back to `D:\github\du-tobi\ItemExport2Json\itembank.json`.
4. Loads ItemBank element names (DB export) for validation if that JSON exists.
   - Resolves inherited `hidden` flags through parent chains.
   - Hidden ItemBank elements are excluded from lookup candidates.
   - Strict mode: elements not present as visible ItemBank entries are excluded from the final JSON.
5. Builds an authoritative mesh-to-element map from DU client files:
   - parses `defs/*.nqdef` for `elements -> <ElementName> -> node`
   - parses referenced `.node` files for `<mesh_name>..._col.mesh</mesh_name>`
6. Recursively scans `<InstallFolder>\Game\data\resources_generated\elements` for `.mesh` files.
7. Filters to collision meshes only (`*_col.mesh`), skipping visual meshes.
8. Reads each file's raw bytes and checks for the Unigine mesh magic header (`ms__`, e.g. `ms11`).
9. Extracts six IEEE-754 floats immediately after the 4-byte magic: `minX`, `minY`, `minZ`, `maxX`, `maxY`, `maxZ`.
10. Enriches entries with:
    - unique `elementName` + `elementId` when mapping is unambiguous
    - `elementCandidates` when one collision mesh is reused by multiple elements
    - `elementMappingStatus: tokenLookup` for meshes not found directly, using a narrowed lookup based on the first token after `env_` (for example `env_stabilizer-*` -> token `stabilizer`)
11. Serializes to pretty-printed JSON via `Newtonsoft.Json`.

## Output format

```json
{
  "element_name_col": {
    "elementName": "BasicECU",
    "elementId": 286542481,
    "box": {
      "min": [ x, y, z ],
      "max": [ x, y, z ]
    }
  }
}
```

Ambiguous example:

```json
{
  "some_mesh_col": {
    "elementMappingStatus": "ambiguous",
    "elementCandidates": [
      { "name": "ElementA", "id": 123 },
      { "name": "ElementB", "id": 456 }
    ],
    "box": { "min": [0,0,0], "max": [1,1,1] }
  }
}
```

Token-lookup example:

```json
{
  "env_stabilizer-vertical_001_col": {
    "elementMappingStatus": "tokenLookup",
    "lookupToken": "stabilizer",
    "elementCandidates": [
      { "name": "StabilizerLarge", "id": 123, "score": 8 },
      { "name": "StabilizerMedium", "id": 456, "score": 8 }
    ],
    "box": { "min": [0,0,0], "max": [1,1,1] }
  }
}
```

The output file `all-mesh-boxes.json` in the repository root is a copy of this output.

## Configuration

`fallbackInstallFolder`, `fallbackItemBankPath`, and `outPath` are currently hardcoded in `MeshDump.cs`. Adjust them before running:

- `fallbackInstallFolder`: fallback DU install path if registry lookup fails
- `fallbackItemBankPath`: fallback path to ItemBank JSON export
- `outPath`: where to write the JSON output

## Usage

```powershell
cd MeshDump
# optional: override ItemBank export path
# $env:ITEMBANK_JSON = "D:\path\to\itembank.json"
dotnet run
```

Lookup ItemBank properties by hashed element id:

```powershell
cd MeshDump
dotnet run -- id 1261703398
# also supported:
# dotnet run -- 1261703398
```

This prints effective (inherited) properties as simple `key=value` lines.

To generate ItemBank JSON from DB first:

```powershell
cd ItemExport2Json
dotnet run ./dual.yaml
```

## Technical details

- Target framework: `net8.0`
- Dependency: `Newtonsoft.Json 13.0.4`
- The output JSON is consumed by [mydu-server-mods](https://github.com/dual-universe/mydu-server-mods) for physics and placement calculations that need element dimensions.
