// ============================================================================
// MeshDump – Dual Universe Mesh Bounding-Box Extractor
// ============================================================================
//
// Purpose:
//   Scans the Dual Universe game client's generated element assets and extracts
//   the axis-aligned bounding box (AABB) from collision Unigine .mesh files
//   only (filenames ending with `_col`).
//   The results are written to a single JSON file that maps each collision mesh
//   name to its { min, max } bounding box coordinates.
//
// How it works:
//   1. Recursively walks the `resources_generated/elements` directory for all
//      .mesh files produced by the game client.
//   2. Filters to collision meshes only (`*_col.mesh`) and skips visual meshes.
//   3. Reads each file's raw bytes and checks for the Unigine mesh magic header
//      ("ms__", e.g. "ms11").
//   4. Extracts six IEEE-754 floats immediately after the 4-byte magic that
//      represent the mesh's AABB: minX, minY, minZ, maxX, maxY, maxZ.
//   5. Rounds coordinates to 5 decimal places and stores them keyed by the
//      mesh filename (without extension).
//   6. Serialises the dictionary to pretty-printed JSON via Newtonsoft.Json.
//
// Output format (all-mesh-boxes.json):
//   {
//     "element_name_col": {
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
//   Then run with `dotnet run`.
//   The output JSON is consumed by mydu-server-mods for physics / placement
//   calculations that need accurate element dimensions.
// ============================================================================

using System;
using System.IO;
using System.Collections.Generic;
using Microsoft.Win32;
using Newtonsoft.Json;

class Program
{
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

    static void Main(string[] args)
    {
        string fallbackInstallFolder = @"D:\MyDualUniverse";
        string installFolder = ResolveInstallFolder(fallbackInstallFolder);

        // Scan the elements folder and keep only collision meshes (`*_col.mesh`)
        string searchDir = Path.Combine(installFolder, "Game", "data", "resources_generated", "elements");
        string outPath = @"D:\github\du-tobi\all-mesh-boxes.json";

        var result = new Dictionary<string, object>();

        if (Directory.Exists(searchDir))
        {
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

                            result[key] = new {
                                box = new {
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
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error reading {f}: {ex.Message}");
                }
            }

            string json = JsonConvert.SerializeObject(result, Formatting.Indented);
            File.WriteAllText(outPath, json);
            Console.WriteLine($"Successfully wrote {result.Count} collision mesh bounds to {outPath}");
        }
        else
        {
            Console.WriteLine($"Directory not found: {searchDir}");
        }
    }
}
