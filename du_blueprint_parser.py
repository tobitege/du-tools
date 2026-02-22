"""
Dual Universe blueprint voxel parser.

What this script does:
- Loads a blueprint JSON export and reads the `VoxelData` chunks.
- Decodes Mongo-style `$binary` base64 payloads for each chunk.
- Decompresses NQ-prefixed payloads (LZ4, zlib, or uncompressed).
- Parses `VoxelCellData` binary structures and material run-length data.
- Aggregates voxel block counts by material and prints a summary.

How the parsing pipeline is organized:
1. `process_blueprint()` drives chunk iteration and global aggregation.
2. `decode_base64_field()` + `decompress_nq()` normalize raw chunk bytes.
3. `parse_voxel_cell_data()` validates magic/version fields and extracts
   material runs plus local-id-to-material mapping metadata.
4. `aggregate_material_runs()` converts RLE runs into per-material counts.
5. Results are printed as total blocks and liter volume per material.

Error handling notes:
- Binary format issues raise `DeserializeError` and are reported per chunk.
- Missing optional decompression dependency (`lz4`) raises `RuntimeError`
  and aborts immediately so the user can install the dependency.
"""

from __future__ import annotations

import argparse
import base64
import binascii
import json
import struct
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any

# NQ compressed format magic numbers.
MAGIC_LZ4 = 0xFB14B6F9
MAGIC_ZLIB = 0x124F0359
MAGIC_UNCOMPRESSED = 0x8C488FE9

# Voxel payload magic numbers.
MAGIC_VOXEL_CELL_DATA = 0x27B8A013
MAGIC_VERTEX_GRID = 0xE881339E

# In Dual Universe, each voxel block is 0.25m^3 = 15.625 liters.
LITERS_PER_VOXEL_BLOCK = 15.625


class DeserializeError(Exception):
    """Raised when a binary chunk cannot be parsed correctly."""


class Reader:
    """Minimal little-endian binary reader with strict EOF checks."""

    def __init__(self, data: bytes) -> None:
        self._io = BytesIO(data)

    def read_u8(self) -> int:
        data = self._io.read(1)
        if len(data) != 1:
            raise DeserializeError("Unexpected EOF while reading u8.")
        return data[0]

    def read_u32(self) -> int:
        data = self._io.read(4)
        if len(data) != 4:
            raise DeserializeError("Unexpected EOF while reading u32.")
        return struct.unpack("<I", data)[0]

    def read_u64(self) -> int:
        data = self._io.read(8)
        if len(data) != 8:
            raise DeserializeError("Unexpected EOF while reading u64.")
        return struct.unpack("<Q", data)[0]

    def read_i32(self) -> int:
        data = self._io.read(4)
        if len(data) != 4:
            raise DeserializeError("Unexpected EOF while reading i32.")
        return struct.unpack("<i", data)[0]

    def read_exact(self, length: int) -> bytes:
        data = self._io.read(length)
        if len(data) != length:
            raise DeserializeError(
                f"Unexpected EOF while reading {length} bytes."
            )
        return data


@dataclass(frozen=True)
class MaterialDefinition:
    """Mapping entry from local material ID -> DU game material metadata."""

    game_material_id: int
    short_name: str


@dataclass(frozen=True)
class ParsedVoxelCellData:
    """Parsed subset of voxel data needed for material accounting."""

    range_origin: tuple[int, int, int]
    range_size: tuple[int, int, int]
    material_runs: list[tuple[int | None, int]]
    material_mapping: dict[int, MaterialDefinition]


def parse_int64_field(value: Any) -> int:
    """Parse either plain int values or Mongo `$numberLong` wrappers."""
    if isinstance(value, dict) and "$numberLong" in value:
        return int(value["$numberLong"])
    return int(value)


def decode_base64_field(value: Any) -> bytes:
    """Decode Mongo-extended JSON binary fields in string or object form."""
    encoded: str
    if isinstance(value, str):
        encoded = value
    elif isinstance(value, dict):
        if "base64" in value and isinstance(value["base64"], str):
            encoded = value["base64"]
        elif "$binary" in value:
            return decode_base64_field(value["$binary"])
        else:
            raise DeserializeError("Unsupported $binary object shape.")
    else:
        raise DeserializeError("Unsupported $binary value type.")

    try:
        return base64.b64decode(encoded)
    except (binascii.Error, ValueError) as exc:
        raise DeserializeError("Invalid base64 payload.") from exc


def decompress_nq(data: bytes) -> bytes:
    """Decompress NQ's prefixed binary format if needed."""
    if len(data) < 12:
        return data

    magic, expected_size = struct.unpack("<IQ", data[:12])
    payload = data[12:]

    if magic == MAGIC_LZ4:
        try:
            import lz4.block
        except ImportError as exc:
            raise RuntimeError(
                "LZ4 compressed data found but `lz4` is not installed. "
                "Install it with: pip install lz4"
            ) from exc

        try:
            return lz4.block.decompress(
                payload, uncompressed_size=int(expected_size)
            )
        except Exception:
            # Some producers omit/alter the expected-size hint.
            try:
                return lz4.block.decompress(payload)
            except Exception as exc:
                raise DeserializeError(
                    "Failed to decompress LZ4 payload."
                ) from exc

    if magic == MAGIC_ZLIB:
        import zlib

        try:
            decompressed = zlib.decompress(payload)
        except zlib.error as exc:
            raise DeserializeError(
                "Failed to decompress zlib payload."
            ) from exc

        if expected_size and len(decompressed) != expected_size:
            raise DeserializeError(
                "Zlib size mismatch: "
                f"expected {expected_size}, got {len(decompressed)}."
            )
        return decompressed

    if magic == MAGIC_UNCOMPRESSED:
        return payload

    # Unknown magic: treat as already-raw payload.
    return data


def read_i32_vec3(reader: Reader) -> tuple[int, int, int]:
    """Read a 3D signed int32 vector."""
    return (reader.read_i32(), reader.read_i32(), reader.read_i32())


def parse_voxel_cell_data(data: bytes) -> ParsedVoxelCellData:
    """Parse a VoxelCellData payload and extract material runs + mapper."""
    reader = Reader(data)

    magic = reader.read_u32()
    if magic != MAGIC_VOXEL_CELL_DATA:
        raise DeserializeError(f"Bad VoxelCellData magic: {hex(magic)}")
    _ = reader.read_u32()  # version

    grid_magic = reader.read_u32()
    if grid_magic != MAGIC_VERTEX_GRID:
        raise DeserializeError(f"Bad VertexGrid magic: {hex(grid_magic)}")
    _ = reader.read_u32()  # grid version

    range_origin = read_i32_vec3(reader)
    range_size = read_i32_vec3(reader)
    _ = read_i32_vec3(reader)  # inner_range_origin
    _ = read_i32_vec3(reader)  # inner_range_size

    voxel_count = range_size[0] * range_size[1] * range_size[2]
    if voxel_count < 0:
        raise DeserializeError(
            f"Invalid range size {range_size}, produced negative voxel count."
        )

    material_runs: list[tuple[int | None, int]] = []
    covered = 0
    while covered < voxel_count:
        has_material = reader.read_u8()
        material_id = reader.read_u8() if has_material != 0 else None
        run_length = reader.read_u8() + 1
        covered += run_length
        if covered > voxel_count:
            raise DeserializeError(
                "Sparse material runs exceed expected voxel count."
            )
        material_runs.append((material_id, run_length))

    covered = 0
    while covered < voxel_count:
        flags = reader.read_u8()
        run_length = reader.read_u8() + 1
        covered += run_length
        if covered > voxel_count:
            raise DeserializeError(
                "Sparse vertex runs exceed expected voxel count."
            )

        if (flags & 1) == 0:
            continue

        inner_covered = 0
        while inner_covered < run_length:
            _ = reader.read_exact(3)
            inner_run_length = reader.read_u8() + 1
            inner_covered += inner_run_length
            if inner_covered > run_length:
                raise DeserializeError(
                    "Sparse vertex inner runs exceed parent run length."
                )

    mapping_count = reader.read_u32()
    if mapping_count > 256:
        raise DeserializeError(
            "Material mapping count exceeds local ID space (0-255)."
        )

    material_mapping: dict[int, MaterialDefinition] = {}
    for _ in range(mapping_count):
        game_material_id = reader.read_u64()
        raw_name = reader.read_exact(8)
        short_name = (
            raw_name.split(b"\x00", maxsplit=1)[0]
            .decode("utf-8", errors="replace")
            .strip()
        )
        local_id = reader.read_u8()
        material_mapping[local_id] = MaterialDefinition(
            game_material_id=game_material_id,
            short_name=short_name or "Unknown",
        )

    _ = reader.read_u8()  # is_diff

    return ParsedVoxelCellData(
        range_origin=range_origin,
        range_size=range_size,
        material_runs=material_runs,
        material_mapping=material_mapping,
    )


def aggregate_material_runs(
    material_runs: list[tuple[int | None, int]]
) -> dict[int, int]:
    """Convert local material RLE runs to local material total counts."""
    counts: dict[int, int] = {}
    for material_id, run_length in material_runs:
        if material_id is None:
            continue
        counts[material_id] = counts.get(material_id, 0) + run_length
    return counts


def process_blueprint(json_file_path: Path) -> None:
    """Load a DU blueprint JSON file and print voxel honeycomb totals."""
    with json_file_path.open("r", encoding="utf-8") as file:
        blueprint = json.load(file)

    voxel_data = blueprint.get("VoxelData")
    if not isinstance(voxel_data, list):
        print("No VoxelData found in this blueprint.")
        return

    total_voxel_blocks = 0
    global_materials: dict[tuple[str, str], int] = {}
    failed_chunks = 0

    for voxel_chunk in voxel_data:
        chunk_coords: tuple[int, int, int] | None = None
        try:
            chunk_coords = (
                parse_int64_field(voxel_chunk["x"]),
                parse_int64_field(voxel_chunk["y"]),
                parse_int64_field(voxel_chunk["z"]),
            )

            payload_field = voxel_chunk["records"]["voxel"]["data"]["$binary"]
            voxel_raw = decode_base64_field(payload_field)
            voxel_decoded = decompress_nq(voxel_raw)
            parsed = parse_voxel_cell_data(voxel_decoded)

            chunk_material_counts = aggregate_material_runs(
                parsed.material_runs
            )
            for local_id, count in chunk_material_counts.items():
                material_info = parsed.material_mapping.get(local_id)
                if material_info is None:
                    material_id = f"local:{local_id}"
                    material_name = "Unknown"
                else:
                    material_id = str(material_info.game_material_id)
                    material_name = material_info.short_name

                material_key = (material_id, material_name)
                global_materials[material_key] = (
                    global_materials.get(material_key, 0) + count
                )
                total_voxel_blocks += count

        except RuntimeError:
            # Missing dependencies (for example `lz4`) should abort
            # immediately.
            raise
        except (DeserializeError, KeyError, TypeError, ValueError) as exc:
            failed_chunks += 1
            if chunk_coords is None:
                print(f"Error parsing chunk (unknown coords): {exc}")
            else:
                print(f"Error parsing chunk at {chunk_coords}: {exc}")

    print("=== Blueprint Voxel Material Summary ===")
    print(f"Total Voxel Blocks: {total_voxel_blocks}")
    print("\nMaterials Required:")

    sorted_materials = sorted(
        global_materials.items(), key=lambda item: item[1], reverse=True
    )
    for (material_id, material_name), count in sorted_materials:
        volume_liters = count * LITERS_PER_VOXEL_BLOCK
        print(
            f"  - {material_name:<12} (ID {material_id:<12}): "
            f"{count:<8} blocks ({volume_liters:,.2f} L)"
        )

    if failed_chunks:
        print(f"\nWarning: Failed to parse {failed_chunks} voxel chunks.")


def build_arg_parser() -> argparse.ArgumentParser:
    """Build the CLI parser."""
    parser = argparse.ArgumentParser(
        description=(
            "Parse Dual Universe blueprint voxel data and print honeycomb "
            "material totals."
        )
    )
    parser.add_argument(
        "blueprint",
        nargs="?",
        default="FactorySample.json",
        help="Path to a blueprint JSON file (default: FactorySample.json).",
    )
    return parser


def main() -> None:
    """CLI entry point."""
    args = build_arg_parser().parse_args()
    process_blueprint(Path(args.blueprint))


if __name__ == "__main__":
    main()
