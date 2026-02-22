// ============================================================================
// HashCheck — Item Name-to-ID Resolver
// ============================================================================
//
// This tool computes deterministic hash IDs from item names and cross-references
// them against a set of known numeric target IDs to find matching entries.
//
// How it works:
//   1. Reads an item bounding-box catalogue from "items-boxes.json",
//      which maps item names to their spatial data.
//   2. For each item name, computes a 32-bit hash using a case-insensitive,
//      alphanumeric-only hash function (based on a modified golden-ratio mixer:
//      id ^= c + 0x9e3779b9 + (id << 6) + (id >> 2)).
//   3. Checks whether the computed hash matches any of a hard-coded set of
//      target IDs and prints matching item names.
//   4. Additionally prints the computed hash IDs for a selection of known
//      industry unit names (Assembly, Smelter, 3DPrinter, Metalwork, Refinery)
//      for quick reference / verification.
//
// Usage:
//   Run from the repository root so the relative path to items-boxes.json
//   resolves correctly.
// ============================================================================

using System;
using System.IO;
using System.Collections.Generic;
using Newtonsoft.Json;

public class DtoItem {
    public DtoBox box;
}
public class DtoBox {
    public List<float> min;
    public List<float> max;
}

public class App {
    public static ulong IdFor(string name) {
        uint id = 0;
        if (name != "InvalidItem") {
            foreach (char c in name) {
                IdHash(ref id, c);
            }
        }
        return id;
    }
    private static void IdHash(ref uint id, char c) {
        if (c >= 'A' && c <= 'Z') c += (char)32;
        if ((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z')) {
            id ^= c + 0x9e3779b9 + (id << 6) + (id >> 2);
        }
    }
    public static void Main() {
        var boxs = File.ReadAllText("items-boxes.json");
        var boxes = JsonConvert.DeserializeObject<Dictionary<string, DtoItem>>(boxs);
        var targetIds = new HashSet<ulong> { 2738359893, 2702446443, 2022563937, 1215026169, 584577125, 584577124, 4139262245, 2556123438, 409410678, 3857150880, 983225818, 983225808, 983225811 };
        
        foreach(var kv in boxes) {
            var id = IdFor(kv.Key);
            if (targetIds.Contains(id)) {
                Console.WriteLine($"Found match: {kv.Key} -> {id}");
            }
        }
        
        Console.WriteLine($"IndustryAssemblyS: {IdFor("IndustryAssemblyS")}");
        Console.WriteLine($"IndustryAssemblyM: {IdFor("IndustryAssemblyM")}");
        Console.WriteLine($"IndustryAssemblyL: {IdFor("IndustryAssemblyL")}");
        Console.WriteLine($"IndustrySmelterS: {IdFor("IndustrySmelterS")}");
        Console.WriteLine($"IndustrySmelterM: {IdFor("IndustrySmelterM")}");
        Console.WriteLine($"IndustrySmelterL: {IdFor("IndustrySmelterL")}");
        Console.WriteLine($"Industry3DPrinterS: {IdFor("Industry3DPrinterS")}");
        Console.WriteLine($"Industry3DPrinterM: {IdFor("Industry3DPrinterM")}");
        Console.WriteLine($"IndustryMetalworkS: {IdFor("IndustryMetalworkS")}");
        Console.WriteLine($"IndustryRefineryS: {IdFor("IndustryRefineryS")}");
    }
}