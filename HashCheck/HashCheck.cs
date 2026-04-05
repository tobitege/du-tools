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
//   4. Additionally prints the computed hash IDs for a broader set of known
//      reference names, including static core units and industry unit names
//      such as assembly lines, Electronics, Chemical, Glass, Honeycomb,
//      Recycler, Refiner, Smelter, and more.
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
    public DtoBox box = new();
}
public class DtoBox {
    public List<float> min = new();
    public List<float> max = new();
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

    private static IEnumerable<(string Name, string Label)> GetIndustryReferenceNames() {
        string TierLabel(string tierSuffix) {
            return tierSuffix switch {
                "" => "Basic",
                "2" => "Uncommon",
                "3" => "Advanced",
                "4" => "Rare",
                _ => "Unknown"
            };
        }

        foreach (var assemblySize in new[] { "XS", "S", "M", "L", "XL" }) {
            foreach (var tierSuffix in new[] { "", "2", "3", "4" }) {
                var name = $"IndustryAssembly{assemblySize}{tierSuffix}";
                yield return (name, $"{TierLabel(tierSuffix)} Assembly Line {assemblySize}");
            }
        }

        foreach (var type in new[] { "3DPrinter", "Chemical", "Electronics", "Glass", "Honeycomber", "Metalwork", "Recycler", "Refiner", "Smelter" }) {
            foreach (var tierSuffix in new[] { "", "2", "3", "4" }) {
                var name = $"Industry{type}{tierSuffix}";
                var typeLabel = type switch {
                    "3DPrinter" => "3D Printer Industry",
                    "Honeycomber" => "Honeycomb Refinery",
                    "Refiner" => "Refiner Industry",
                    _ => $"{type} Industry"
                };
                yield return (name, $"{TierLabel(tierSuffix)} {typeLabel} M");
            }
        }
    }

    private static IEnumerable<(string Name, string Label)> GetStaticCoreReferenceNames() {
        yield return ("CoreUnitStatic32", "Static Core Unit XS");
        yield return ("CoreUnitStatic64", "Static Core Unit S");
        yield return ("CoreUnitStatic128", "Static Core Unit M");
        yield return ("CoreUnitStatic256", "Static Core Unit L");
        yield return ("CoreUnitStatic512", "Static Core Unit XL");
    }

    public static void Main() {
        var boxs = File.ReadAllText("items-boxes.json");
        var boxes = JsonConvert.DeserializeObject<Dictionary<string, DtoItem>>(boxs)
            ?? throw new InvalidOperationException("Failed to deserialize items-boxes.json.");
        var targetIds = new HashSet<ulong> { 2738359893, 2702446443, 2022563937, 1215026169, 584577125, 584577124, 4139262245, 2556123438, 409410678, 3857150880, 983225818, 983225808, 983225811 };
        var referenceNames = new HashSet<string>(StringComparer.Ordinal) {
            "InvalidItem"
        };
        foreach (var core in GetStaticCoreReferenceNames()) {
            referenceNames.Add(core.Name);
        }
        foreach (var industry in GetIndustryReferenceNames()) {
            referenceNames.Add(industry.Name);
        }

        foreach(var kv in boxes) {
            var id = IdFor(kv.Key);
            if (targetIds.Contains(id) && !referenceNames.Contains(kv.Key)) {
                Console.WriteLine($"Found match: {kv.Key} -> {id}");
            }
        }

        Console.WriteLine();
        Console.WriteLine("Static core reference hashes:");
        foreach (var core in GetStaticCoreReferenceNames()) {
            Console.WriteLine($"{core.Label} ({core.Name}): {IdFor(core.Name)}");
        }

        Console.WriteLine();
        Console.WriteLine("Industry reference hashes:");
        foreach (var industry in GetIndustryReferenceNames()) {
            Console.WriteLine($"{industry.Label} ({industry.Name}): {IdFor(industry.Name)}");
        }
    }
}
