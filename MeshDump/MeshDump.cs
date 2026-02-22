// ============================================================================
// MeshDump – Dual Universe Mesh Bounding-Box Extractor
// ============================================================================
//
// Purpose:
//   Scans the Dual Universe game client's generated element assets and extracts
//   the axis-aligned bounding box (AABB) from collision Unigine .mesh files
//   only (filenames ending with `_col`).
//   The results are written to a single JSON file that maps each collision mesh
//   name to its { min, max } bounding box coordinates and, when available,
//   the authoritative element name + deterministic element ID.
//
// How it works:
//   1. Recursively walks the `resources_generated/elements` directory for all
//      .mesh files produced by the game client.
//   2. Filters to collision meshes only (`*_col.mesh`) and skips visual meshes.
//   3. Builds an authoritative mapping from collision mesh to element name by:
//      - parsing `defs/*.nqdef` (JSON) for `elements -> <ElementName> -> node`
//      - parsing referenced `.node` files for `<mesh_name>..._col.mesh</mesh_name>`
//   4. Optionally loads ItemBank export (`itembank.json`) from ItemExport2Json
//      and validates element names against that DB-backed catalogue.
//   5. Reads each mesh file's raw bytes and checks for the Unigine mesh magic header
//      ("ms__", e.g. "ms11").
//   6. Extracts six IEEE-754 floats immediately after the 4-byte magic that
//      represent the mesh's AABB: minX, minY, minZ, maxX, maxY, maxZ.
//   7. Rounds coordinates to 5 decimal places and stores them keyed by the
//      mesh filename (without extension).
//   8. Enriches each mesh entry with:
//      - elementName (from nqdef/node mapping)
//      - elementId (stable hash of elementName)
//      - token-based candidate lookup for otherwise unmapped `env_*` meshes
//   9. Serialises the dictionary to pretty-printed JSON via Newtonsoft.Json.
//
// Output format (all-mesh-boxes.json):
//   {
//     "element_name_col": {
//       "elementName": "BasicECU",
//       "elementId": 1234567890,
//       "box": {
//         "min": [ x, y, z ],
//         "max": [ x, y, z ]
//       }
//     },
//     ...
//   }
//
// Usage:
//   The install folder is resolved from registry first:
//   HKLM\SOFTWARE\Novaquark\DualUniverse\Settings-MYDU\InstallFolder
//   If unavailable, it falls back to the hardcoded install folder below.
//   The ItemBank JSON path is taken from ITEMBANK_JSON env var, else falls back
//   to a hardcoded path in this file.
//   Then run with `dotnet run`.
//   The output JSON is consumed by mydu-server-mods for physics / placement
//   calculations that need accurate element dimensions.
// ============================================================================

using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

class Program
{
    class ItemBankElementLookup
    {
        public HashSet<string> AllNames { get; } = new(StringComparer.Ordinal);
        public HashSet<string> VisibleNames { get; } = new(StringComparer.Ordinal);
        public HashSet<string> HiddenNames { get; } = new(StringComparer.Ordinal);
        public Dictionary<string, JObject> ElementProps { get; } = new(StringComparer.Ordinal);
    }

    static readonly Regex NodeMeshRegex = new(
        "<mesh_name>\\s*([^<]+?)\\s*</mesh_name>",
        RegexOptions.Compiled | RegexOptions.IgnoreCase
    );
    static readonly Dictionary<string, string> ManualMeshElementOverrides = new(StringComparer.OrdinalIgnoreCase)
    {
        ["env_elevator_001_xs_col"] = "ElevatorXSmall",
        ["env_hologram-arkship-base_001_col"] = "ProjectorHologramSpaceshipLarge_Arkship"
    };

    static string ResolveInstallFolder(string fallbackInstallFolder)
    {
        const string subKeyPath = @"SOFTWARE\Novaquark\DualUniverse\Settings-MYDU";
        const string valueName = "InstallFolder";

        if (!OperatingSystem.IsWindows())
        {
            Console.WriteLine($"Registry lookup is only supported on Windows. Falling back to: {fallbackInstallFolder}");
            return fallbackInstallFolder;
        }

        foreach (var view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
        {
            try
            {
                using var baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, view);
                using var key = baseKey.OpenSubKey(subKeyPath, writable: false);
                string? installFolder = key?.GetValue(valueName) as string;
                if (!string.IsNullOrWhiteSpace(installFolder))
                {
                    string resolvedFolder = installFolder.Trim();
                    Console.WriteLine($"Using install folder from registry ({view}): {resolvedFolder}");
                    return resolvedFolder;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to read install folder from registry ({view}): {ex.Message}");
            }
        }

        Console.WriteLine($"Registry install folder unavailable. Falling back to hardcoded path: {fallbackInstallFolder}");
        return fallbackInstallFolder;
    }

    static string ResolveItemBankPath(string fallbackItemBankPath)
    {
        string? envPath = Environment.GetEnvironmentVariable("ITEMBANK_JSON");
        if (!string.IsNullOrWhiteSpace(envPath))
        {
            return envPath;
        }

        return fallbackItemBankPath;
    }

    static bool? ReadBoolFromToken(JToken? token)
    {
        if (token == null)
        {
            return null;
        }

        if (token.Type == JTokenType.Boolean)
        {
            return token.Value<bool>();
        }

        if (token.Type == JTokenType.String)
        {
            string? s = token.Value<string>();
            if (bool.TryParse(s, out bool parsed))
            {
                return parsed;
            }
        }

        return null;
    }

    static ItemBankElementLookup LoadItemBankElementLookup(string itemBankPath)
    {
        var lookup = new ItemBankElementLookup();
        if (!File.Exists(itemBankPath))
        {
            Console.WriteLine($"ItemBank JSON not found at {itemBankPath}. Continuing without DB-backed element validation.");
            return lookup;
        }

        try
        {
            var root = JToken.Parse(File.ReadAllText(itemBankPath));
            if (root is JArray docs)
            {
                foreach (var doc in docs.OfType<JObject>())
                {
                    foreach (var prop in doc.Properties())
                    {
                        if (prop.Value is JObject obj)
                        {
                            lookup.ElementProps[prop.Name] = obj;
                        }
                    }
                }
            }
            else if (root is JObject singleDoc)
            {
                foreach (var prop in singleDoc.Properties())
                {
                    if (prop.Value is JObject obj)
                    {
                        lookup.ElementProps[prop.Name] = obj;
                    }
                }
            }

            var hiddenCache = new Dictionary<string, bool?>(StringComparer.Ordinal);
            bool? ResolveHidden(string elementName, HashSet<string> visiting)
            {
                if (hiddenCache.TryGetValue(elementName, out var cached))
                {
                    return cached;
                }

                if (!lookup.ElementProps.TryGetValue(elementName, out var props))
                {
                    hiddenCache[elementName] = null;
                    return null;
                }

                if (!visiting.Add(elementName))
                {
                    hiddenCache[elementName] = null;
                    return null;
                }

                bool? hidden = null;
                if (props.TryGetValue("hidden", out var hiddenToken))
                {
                    hidden = ReadBoolFromToken(hiddenToken);
                }

                if (hidden == null && props.TryGetValue("parent", out var parentToken))
                {
                    string? parent = parentToken?.Value<string>();
                    if (!string.IsNullOrWhiteSpace(parent))
                    {
                        hidden = ResolveHidden(parent, visiting);
                    }
                }

                visiting.Remove(elementName);
                hiddenCache[elementName] = hidden;
                return hidden;
            }

            foreach (var name in lookup.ElementProps.Keys)
            {
                lookup.AllNames.Add(name);
                bool isHidden = ResolveHidden(name, new HashSet<string>(StringComparer.Ordinal)) == true;
                if (isHidden)
                {
                    lookup.HiddenNames.Add(name);
                }
                else
                {
                    lookup.VisibleNames.Add(name);
                }
            }

            Console.WriteLine(
                $"Loaded ItemBank lookup from {itemBankPath}: all={lookup.AllNames.Count}, visible={lookup.VisibleNames.Count}, hidden={lookup.HiddenNames.Count}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to parse ItemBank JSON '{itemBankPath}': {ex.Message}");
        }

        return lookup;
    }

    static bool TryParseIdLookupArgs(string[] args, out ulong id)
    {
        id = 0;
        if (args.Length == 1 && ulong.TryParse(args[0], out id))
        {
            return true;
        }

        if (args.Length >= 2 &&
            string.Equals(args[0], "id", StringComparison.OrdinalIgnoreCase) &&
            ulong.TryParse(args[1], out id))
        {
            return true;
        }

        return false;
    }

    static List<string> BuildInheritanceChainLeafToRoot(string elementName, Dictionary<string, JObject> elementProps)
    {
        var chain = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        string? current = elementName;

        while (!string.IsNullOrWhiteSpace(current) &&
               elementProps.TryGetValue(current, out var props) &&
               seen.Add(current))
        {
            chain.Add(current);
            current = props["parent"]?.Value<string>();
        }

        return chain;
    }

    static Dictionary<string, JToken> BuildEffectiveProperties(string elementName, Dictionary<string, JObject> elementProps)
    {
        var effective = new Dictionary<string, JToken>(StringComparer.Ordinal);
        var chain = BuildInheritanceChainLeafToRoot(elementName, elementProps);
        chain.Reverse();

        foreach (var name in chain)
        {
            if (!elementProps.TryGetValue(name, out var props))
            {
                continue;
            }

            foreach (var prop in props.Properties())
            {
                effective[prop.Name] = prop.Value;
            }
        }

        return effective;
    }

    static string ToSingleLineValue(JToken token)
    {
        return token.Type switch
        {
            JTokenType.Object => token.ToString(Formatting.None),
            JTokenType.Array => token.ToString(Formatting.None),
            _ => token.ToString()
        };
    }

    static bool TryRunIdLookupMode(string[] args, string itemBankPath)
    {
        if (!TryParseIdLookupArgs(args, out var lookupId))
        {
            return false;
        }

        var lookup = LoadItemBankElementLookup(itemBankPath);
        if (lookup.AllNames.Count == 0)
        {
            Console.WriteLine($"No ItemBank data available at '{itemBankPath}'.");
            return true;
        }

        var matches = lookup.AllNames
            .Where(name => IdFor(name) == lookupId)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList();

        if (matches.Count == 0)
        {
            Console.WriteLine($"No ItemBank element found for id={lookupId}");
            return true;
        }

        foreach (var name in matches)
        {
            Console.WriteLine($"name={name}");
            var effectiveProps = BuildEffectiveProperties(name, lookup.ElementProps);
            foreach (var key in effectiveProps.Keys.OrderBy(k => k, StringComparer.Ordinal))
            {
                Console.WriteLine($"{key}={ToSingleLineValue(effectiveProps[key])}");
            }
            Console.WriteLine();
        }

        return true;
    }

    static string ResolveGameDataPath(string gameDataRoot, string relativePath)
    {
        string normalized = relativePath.Replace('/', Path.DirectorySeparatorChar).Replace('\\', Path.DirectorySeparatorChar);
        return Path.Combine(gameDataRoot, normalized);
    }

    static Dictionary<string, HashSet<string>> BuildMeshToElementMap(string elementsRoot, string gameDataRoot, out HashSet<string> knownElementNames)
    {
        knownElementNames = new HashSet<string>(StringComparer.Ordinal);
        var meshToElements = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        int multiMapCount = 0;

        var nqdefFiles = Directory.GetFiles(elementsRoot, "*.nqdef", SearchOption.AllDirectories);
        foreach (var nqdefPath in nqdefFiles)
        {
            try
            {
                var nqdefJson = JToken.Parse(File.ReadAllText(nqdefPath));
                var elementsObj = nqdefJson["elements"] as JObject;
                if (elementsObj == null)
                {
                    continue;
                }

                foreach (var elementProp in elementsObj.Properties())
                {
                    string elementName = elementProp.Name;
                    knownElementNames.Add(elementName);
                    string? nodeRelPath = elementProp.Value?["node"]?.Value<string>();
                    if (string.IsNullOrWhiteSpace(nodeRelPath))
                    {
                        continue;
                    }

                    string nodePath = ResolveGameDataPath(gameDataRoot, nodeRelPath);
                    if (!File.Exists(nodePath))
                    {
                        continue;
                    }

                    string nodeXml = File.ReadAllText(nodePath);
                    var matches = NodeMeshRegex.Matches(nodeXml);
                    foreach (Match match in matches)
                    {
                        if (!match.Success)
                        {
                            continue;
                        }

                        string meshRelPath = match.Groups[1].Value.Trim();
                        if (!meshRelPath.EndsWith("_col.mesh", StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }

                        string meshKey = Path.GetFileNameWithoutExtension(meshRelPath);
                        if (!meshToElements.TryGetValue(meshKey, out var names))
                        {
                            names = new HashSet<string>(StringComparer.Ordinal);
                            meshToElements[meshKey] = names;
                        }

                        names.Add(elementName);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error parsing nqdef '{nqdefPath}': {ex.Message}");
            }
        }

        foreach (var kv in meshToElements)
        {
            if (kv.Value.Count > 1)
            {
                multiMapCount++;
            }
        }

        Console.WriteLine($"Built mesh->element map with {meshToElements.Count} collision entries from nqdef/node files.");
        Console.WriteLine($"Detected {multiMapCount} mesh keys with multiple possible element mappings.");
        Console.WriteLine($"Collected {knownElementNames.Count} known element names from nqdef files.");

        return meshToElements;
    }

    static string NormalizeAlnum(string value)
    {
        var sb = new StringBuilder(value.Length);
        foreach (char c in value)
        {
            if (char.IsLetterOrDigit(c))
            {
                sb.Append(char.ToLowerInvariant(c));
            }
        }
        return sb.ToString();
    }

    static string? ExtractEnvLookupToken(string meshKey)
    {
        if (!meshKey.StartsWith("env_", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        string rest = meshKey.Substring(4);
        if (string.IsNullOrWhiteSpace(rest))
        {
            return null;
        }

        int dashIdx = rest.IndexOf('-');
        int underIdx = rest.IndexOf('_');
        int cutIdx = -1;

        if (dashIdx >= 0 && underIdx >= 0)
        {
            cutIdx = Math.Min(dashIdx, underIdx);
        }
        else if (dashIdx >= 0)
        {
            cutIdx = dashIdx;
        }
        else if (underIdx >= 0)
        {
            cutIdx = underIdx;
        }

        string token = cutIdx > 0 ? rest.Substring(0, cutIdx) : rest;
        return string.IsNullOrWhiteSpace(token) ? null : token;
    }

    static List<Dictionary<string, object>> BuildTokenLookupCandidates(
        string meshKey,
        IEnumerable<string> knownElementNames,
        HashSet<string> itemBankVisibleElementNames,
        HashSet<string> itemBankAllElementNames,
        bool hasItemBank,
        out string? lookupToken)
    {
        lookupToken = ExtractEnvLookupToken(meshKey);
        if (string.IsNullOrWhiteSpace(lookupToken))
        {
            return new List<Dictionary<string, object>>();
        }

        string tokenNorm = NormalizeAlnum(lookupToken);
        if (string.IsNullOrWhiteSpace(tokenNorm))
        {
            return new List<Dictionary<string, object>>();
        }

        var scored = new List<(string Name, int Score)>();
        foreach (var name in knownElementNames)
        {
            bool inItemBank = hasItemBank && itemBankAllElementNames.Contains(name);
            if (hasItemBank && !inItemBank)
            {
                // In strict ItemBank mode, drop non-ItemBank names from lookup.
                continue;
            }

            if (hasItemBank && !itemBankVisibleElementNames.Contains(name))
            {
                // Explicitly exclude hidden ItemBank elements from fallback lookup.
                continue;
            }

            string nameNorm = NormalizeAlnum(name);
            if (string.IsNullOrWhiteSpace(nameNorm))
            {
                continue;
            }

            int score = 0;
            if (nameNorm.StartsWith(tokenNorm, StringComparison.Ordinal))
            {
                score += 3;
            }
            if (nameNorm.Contains(tokenNorm, StringComparison.Ordinal))
            {
                score += 2;
            }
            if (name.StartsWith($"env_{lookupToken}-", StringComparison.OrdinalIgnoreCase))
            {
                score += 2;
            }
            if (name.Contains(lookupToken, StringComparison.OrdinalIgnoreCase))
            {
                score += 1;
            }

            if (score <= 0)
            {
                continue;
            }

            if (inItemBank)
            {
                score += 2;
            }

            scored.Add((name, score));
        }

        return scored
            .OrderByDescending(s => s.Score)
            .ThenBy(s => s.Name, StringComparer.Ordinal)
            .Take(20)
            .Select(s => new Dictionary<string, object> {
                ["name"] = s.Name,
                ["id"] = IdFor(s.Name),
                ["score"] = s.Score
            })
            .ToList();
    }

    static ulong IdFor(string name)
    {
        uint id = 0;
        if (!string.Equals(name, "InvalidItem", StringComparison.Ordinal))
        {
            foreach (char c in name)
            {
                IdHash(ref id, c);
            }
        }
        return id;
    }

    static void IdHash(ref uint id, char c)
    {
        if (c >= 'A' && c <= 'Z')
        {
            c = (char)(c + 32);
        }

        if ((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z'))
        {
            id ^= (uint)(c + 0x9e3779b9 + (id << 6) + (id >> 2));
        }
    }

    static void Main(string[] args)
    {
        string fallbackInstallFolder = @"D:\MyDualUniverse";
        string fallbackItemBankPath = @"D:\github\du-tobi\ItemExport2Json\itembank.json";
        string installFolder = ResolveInstallFolder(fallbackInstallFolder);
        string itemBankPath = ResolveItemBankPath(fallbackItemBankPath);

        if (TryRunIdLookupMode(args, itemBankPath))
        {
            return;
        }

        string gameDataRoot = Path.Combine(installFolder, "Game", "data");
        // Scan the elements folder and keep only collision meshes (`*_col.mesh`)
        string searchDir = Path.Combine(gameDataRoot, "resources_generated", "elements");
        string outPath = @"D:\github\du-tobi\all-mesh-boxes.json";

        var result = new Dictionary<string, object>();

        if (Directory.Exists(searchDir))
        {
            var itemBankLookup = LoadItemBankElementLookup(itemBankPath);
            bool hasItemBank = itemBankLookup.AllNames.Count > 0;
            var meshToElements = BuildMeshToElementMap(searchDir, gameDataRoot, out var knownElementNames);
            int uniqueMappedCount = 0;
            int ambiguousMappedCount = 0;
            int tokenLookupCount = 0;
            int unmatchedMappedCount = 0;
            int skippedHiddenCount = 0;
            int skippedNotInItemBankCount = 0;

            Console.WriteLine($"Scanning {searchDir} for .mesh files...");
            var files = Directory.GetFiles(searchDir, "*.mesh", SearchOption.AllDirectories);

            foreach(var f in files)
            {
                try
                {
                    string key = Path.GetFileNameWithoutExtension(f);
                    if (!key.EndsWith("_col", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    byte[] data = File.ReadAllBytes(f);
                    if (data.Length > 28)
                    {
                        // Unigine meshes start with a 4-byte magic string (e.g. "ms11")
                        string magic = System.Text.Encoding.ASCII.GetString(data, 0, 4);
                        if (magic.StartsWith("ms"))
                        {
                            float minX = BitConverter.ToSingle(data, 4);
                            float minY = BitConverter.ToSingle(data, 8);
                            float minZ = BitConverter.ToSingle(data, 12);
                            float maxX = BitConverter.ToSingle(data, 16);
                            float maxY = BitConverter.ToSingle(data, 20);
                            float maxZ = BitConverter.ToSingle(data, 24);

                            var entry = new Dictionary<string, object> {
                                ["box"] = new {
                                    min = new[] {
                                        Math.Round(minX, 5),
                                        Math.Round(minY, 5),
                                        Math.Round(minZ, 5)
                                    },
                                    max = new[] {
                                        Math.Round(maxX, 5),
                                        Math.Round(maxY, 5),
                                        Math.Round(maxZ, 5)
                                    }
                                }
                            };

                            bool shouldRunTokenLookup = false;
                            bool skipEntry = false;
                            if (ManualMeshElementOverrides.TryGetValue(key, out var overriddenElementName))
                            {
                                if (hasItemBank && itemBankLookup.HiddenNames.Contains(overriddenElementName))
                                {
                                    // Explicit hidden element: do not export this mesh entry at all.
                                    skipEntry = true;
                                }
                                else if (hasItemBank && !itemBankLookup.AllNames.Contains(overriddenElementName))
                                {
                                    // Explicit override not present in ItemBank: exclude in strict mode.
                                    skipEntry = true;
                                }

                                entry["elementMappingStatus"] = "manualOverride";
                                entry["elementName"] = overriddenElementName;
                                entry["elementId"] = IdFor(overriddenElementName);
                            }
                            else if (meshToElements.TryGetValue(key, out var elementNames))
                            {
                                var allCandidates = elementNames.OrderBy(n => n, StringComparer.Ordinal).ToList();
                                List<string> effectiveCandidates = allCandidates;
                                if (hasItemBank)
                                {
                                    // Strict ItemBank mode: keep only visible ItemBank entries.
                                    var visibleCandidates = allCandidates.Where(itemBankLookup.VisibleNames.Contains).ToList();
                                    var hiddenCandidates = allCandidates.Where(itemBankLookup.HiddenNames.Contains).ToList();
                                    var knownCandidates = allCandidates.Where(itemBankLookup.AllNames.Contains).ToList();
                                    effectiveCandidates = visibleCandidates;

                                    if (visibleCandidates.Count == 0 && hiddenCandidates.Count > 0)
                                    {
                                        // This mesh maps only to hidden elements; exclude it from output.
                                        skipEntry = true;
                                    }
                                    else if (visibleCandidates.Count == 0 && knownCandidates.Count == 0)
                                    {
                                        // No mapped candidates exist in ItemBank for this mesh key.
                                        skipEntry = true;
                                    }
                                }

                                if (effectiveCandidates.Count == 1)
                                {
                                    string elementName = effectiveCandidates[0];
                                    entry["elementName"] = elementName;
                                    entry["elementId"] = IdFor(elementName);
                                }
                                else if (effectiveCandidates.Count > 1)
                                {
                                    entry["elementMappingStatus"] = "ambiguous";
                                    entry["elementCandidates"] = effectiveCandidates.Select(name => new Dictionary<string, object> {
                                        ["name"] = name,
                                        ["id"] = IdFor(name),
                                    }).ToList();
                                }
                                else
                                {
                                    // No non-hidden candidates left from authoritative mapping.
                                    shouldRunTokenLookup = true;
                                }
                            }
                            else
                            {
                                shouldRunTokenLookup = true;
                            }

                            if (skipEntry)
                            {
                                if (hasItemBank && meshToElements.TryGetValue(key, out var skippedElementNames))
                                {
                                    bool hasHidden = skippedElementNames.Any(itemBankLookup.HiddenNames.Contains);
                                    bool hasKnown = skippedElementNames.Any(itemBankLookup.AllNames.Contains);
                                    if (hasHidden && !skippedElementNames.Any(itemBankLookup.VisibleNames.Contains))
                                    {
                                        skippedHiddenCount++;
                                    }
                                    else if (!hasKnown || skippedElementNames.All(name => !itemBankLookup.VisibleNames.Contains(name)))
                                    {
                                        skippedNotInItemBankCount++;
                                    }
                                    else
                                    {
                                        skippedNotInItemBankCount++;
                                    }
                                }
                                else
                                {
                                    skippedNotInItemBankCount++;
                                }
                                continue;
                            }

                            if (shouldRunTokenLookup)
                            {
                                var tokenCandidates = BuildTokenLookupCandidates(
                                    key,
                                    knownElementNames,
                                    itemBankLookup.VisibleNames,
                                    itemBankLookup.AllNames,
                                    hasItemBank,
                                    out var lookupToken);

                                if (tokenCandidates.Count > 0)
                                {
                                    entry["elementMappingStatus"] = "tokenLookup";
                                    entry["lookupToken"] = lookupToken ?? "";
                                    entry["elementCandidates"] = tokenCandidates;
                                }
                            }

                            result[key] = entry;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error reading {f}: {ex.Message}");
                }
            }

            foreach (var kv in result)
            {
                if (kv.Value is not Dictionary<string, object> entry)
                {
                    continue;
                }

                if (entry.ContainsKey("elementCandidates"))
                {
                    if (entry.TryGetValue("elementMappingStatus", out var statusObj) &&
                        statusObj is string status &&
                        string.Equals(status, "tokenLookup", StringComparison.Ordinal))
                    {
                        tokenLookupCount++;
                    }
                    else
                    {
                        ambiguousMappedCount++;
                    }
                    continue;
                }

                if (entry.ContainsKey("elementName"))
                {
                    uniqueMappedCount++;
                    continue;
                }

                unmatchedMappedCount++;
            }

            string json = JsonConvert.SerializeObject(result, Formatting.Indented);
            File.WriteAllText(outPath, json);
            Console.WriteLine($"Successfully wrote {result.Count} collision mesh bounds to {outPath}");
            Console.WriteLine($"Mapped {uniqueMappedCount} entries to a unique elementName/elementId.");
            Console.WriteLine($"Mapped {ambiguousMappedCount} entries to multiple possible element candidates.");
            Console.WriteLine($"Mapped {tokenLookupCount} entries via env-token lookup candidates.");
            Console.WriteLine($"No element mapping found for {unmatchedMappedCount} entries.");
            Console.WriteLine($"Skipped {skippedHiddenCount} entries mapped only to hidden elements.");
            Console.WriteLine($"Skipped {skippedNotInItemBankCount} entries not present as visible ItemBank elements.");
        }
        else
        {
            Console.WriteLine($"Directory not found: {searchDir}");
        }
    }
}
