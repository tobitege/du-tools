# HashCheck — Item Name-to-ID Resolver

This tool computes deterministic hash IDs from item names and cross-references
them against a set of known numeric target IDs to find matching entries.

## How it works

1. Reads an item bounding-box catalogue from `items-boxes.json`,
   which maps item names to their spatial data.
2. For each item name, computes a 32-bit hash using a case-insensitive,
   alphanumeric-only hash function (based on a modified golden-ratio mixer:
   `id ^= c + 0x9e3779b9 + (id << 6) + (id >> 2)`).
3. Checks whether the computed hash matches any of a hard-coded set of
   target IDs and prints matching item names.
4. Additionally prints the computed hash IDs for a selection of known
   industry unit names (Assembly, Smelter, 3DPrinter, Metalwork, Refinery)
   for quick reference / verification.

## Data Source

The file `items-boxes.json` is located in the same folder and originates from
the official Dual Universe repository
[mydu-server-mods](https://github.com/dual-universe/mydu-server-mods),
specifically from the **RecastServer** demo.

## Usage

Run from the repository root so the relative path to `items-boxes.json`
resolves correctly.
