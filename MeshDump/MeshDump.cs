// ============================================================================
// MeshDump – Dual Universe Mesh Bounding-Box Extractor
// ============================================================================
//
// Purpose:
//   Scans the Dual Universe game client's generated element assets and extracts
//   the axis-aligned bounding box (AABB) from every Unigine .mesh file it finds.
//   The results are written to a single JSON file that maps each element name to
//   its { min, max } bounding box coordinates.
//
// How it works:
//   1. Recursively walks the `resources_generated/elements` directory for all
//      .mesh files produced by the game client.
//   2. Reads each file's raw bytes and checks for the Unigine mesh magic header
//      ("ms__", e.g. "ms11").
//   3. Extracts six IEEE-754 floats immediately after the 4-byte magic that
//      represent the mesh's AABB: minX, minY, minZ, maxX, maxY, maxZ.
//   4. Rounds coordinates to 5 decimal places and stores them keyed by the
//      mesh filename (without extension).
//   5. Serialises the dictionary to pretty-printed JSON via Newtonsoft.Json.
//
// Output format (all-mesh-boxes.json):
//   {
//     "element_name": {
//       "box": {
//         "min": [ x, y, z ],
//         "max": [ x, y, z ]
//       }
//     },
//     ...
//   }
//
// Usage:
//   Adjust `searchDir` and `outPath` below, then run with `dotnet run`.
//   The output JSON is consumed by mydu-server-mods for physics / placement
//   calculations that need accurate element dimensions.
// ============================================================================

using System;
using System.IO;
using System.Collections.Generic;
using Newtonsoft.Json;

class Program
{
    static void Main(string[] args)
    {
        // Scanning the entire elements folder for all .mesh files
        string searchDir = @"D:\MyDualUniverse\Game\data\resources_generated\elements";
        string outPath = @"D:\github\mydu-server-mods\all-mesh-boxes.json";

        var result = new Dictionary<string, object>();

        if (Directory.Exists(searchDir))
        {
            Console.WriteLine($"Scanning {searchDir} for .mesh files...");
            var files = Directory.GetFiles(searchDir, "*.mesh", SearchOption.AllDirectories);

            foreach(var f in files)
            {
                try
                {
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

                            string key = Path.GetFileNameWithoutExtension(f);

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
            Console.WriteLine($"Successfully wrote {result.Count} mesh bounds to {outPath}");
        }
        else
        {
            Console.WriteLine($"Directory not found: {searchDir}");
        }
    }
}