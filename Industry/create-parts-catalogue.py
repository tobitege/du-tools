#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from dataclasses import dataclass, field
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve()
REPO_ROOT = SCRIPT_PATH.parent.parent
DEFAULT_INPUT_PATH = REPO_ROOT / "ModUiToolbox" / "industry-data" / "RecipesGroups.json"
DEFAULT_OUTPUT_PATH = SCRIPT_PATH.parent / "industry-parts.md"

PART_GROUPS = {
    "Intermediary parts",
    "Structural parts",
    "Functional parts",
    "Complex parts",
    "Exceptional parts",
}

LEVEL_TO_TIER = {
    1: "Basic",
    2: "Uncommon",
    3: "Advanced",
    4: "Rare",
    5: "Exotic",
}

OUTPUT_TIERS = ("Basic", "Uncommon", "Advanced", "Rare")

INDUSTRY_KIND_MAP = (
    ("3d printer", "3D Printer"),
    ("assembly line", "Assembly Line"),
    ("chemical", "Chemical"),
    ("electronics", "Electronics"),
    ("glass furnace", "Glass Furnace"),
    ("honeycomb refinery", "Honeycomb Refinery"),
    ("metalwork", "Metalwork"),
    ("recycler", "Recycler"),
    ("refiner", "Refiner"),
    ("smelter", "Smelter"),
)


@dataclass
class PartEntry:
    name: str
    internal_key: str
    internal_key_level: int
    industry: str
    recipe_ids: dict[str, str] = field(default_factory=lambda: {tier: "" for tier in OUTPUT_TIERS})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a flat Markdown catalogue of Dual Universe part recipe IDs."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_PATH,
        help=f"Input JSON file (default: {DEFAULT_INPUT_PATH})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help=f"Output Markdown file (default: {DEFAULT_OUTPUT_PATH})",
    )
    parser.add_argument(
        "--preview",
        type=int,
        default=20,
        help="How many alphabetical entries to print after writing the file (default: 20).",
    )
    return parser.parse_args()


def normalize_industry_kind(industry_name: str) -> str:
    industry_name_lower = (industry_name or "").strip().lower()

    for needle, label in INDUSTRY_KIND_MAP:
        if needle in industry_name_lower:
            return label

    raise ValueError(f"Unknown industry name: {industry_name!r}")


def normalize_part_name(name: str, level: int) -> str:
    tier_name = LEVEL_TO_TIER.get(level)

    if tier_name and name.startswith(tier_name + " "):
        return name[len(tier_name) + 1 :]

    return name


def load_recipes(input_path: Path) -> dict:
    with input_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def build_part_entries(recipes: dict) -> list[PartEntry]:
    entries_by_name: dict[str, PartEntry] = {}

    for recipe_key, recipe in recipes.items():
        parent_group_name = recipe.get("ParentGroupName")
        if parent_group_name not in PART_GROUPS:
            continue

        level = recipe.get("Level")
        tier_name = LEVEL_TO_TIER.get(level)
        if tier_name is None:
            raise ValueError(f"Unknown recipe level: {level!r} for {recipe.get('Name')!r}")

        part_name = normalize_part_name(recipe["Name"], level)
        industry_kind = normalize_industry_kind(recipe.get("Industry", ""))

        entry = entries_by_name.get(part_name)
        if entry is None:
            entry = PartEntry(
                name=part_name,
                internal_key=recipe_key,
                internal_key_level=level,
                industry=industry_kind,
            )
            entries_by_name[part_name] = entry
        else:
            if entry.industry != industry_kind:
                raise ValueError(
                    f"Conflicting industry kinds for {part_name!r}: {entry.industry!r} vs {industry_kind!r}"
                )
            if level < entry.internal_key_level:
                entry.internal_key = recipe_key
                entry.internal_key_level = level

        if tier_name in OUTPUT_TIERS:
            recipe_id = str(recipe["Id"])
            existing_id = entry.recipe_ids[tier_name]
            if existing_id and existing_id != recipe_id:
                raise ValueError(
                    f"Conflicting recipe IDs for {part_name!r} / {tier_name!r}: {existing_id!r} vs {recipe_id!r}"
                )
            entry.recipe_ids[tier_name] = recipe_id

    return sorted(entries_by_name.values(), key=lambda entry: entry.name.casefold())


def write_markdown(output_path: Path, entries: list[PartEntry]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        handle.write("# Parts\r\n\r\n")
        handle.write("Each row is: `Component, Internal Key, Industry type, Basic Recipe ID, Uncommon Recipe ID, Advanced Recipe ID, Rare Recipe ID`. `Internal Key` is the lowest available tier key for that part.\r\n\r\n")

        writer = csv.writer(handle, lineterminator="\r\n")
        writer.writerow(
            [
                "Component",
                "Internal Key",
                "Industry type",
                "Basic Recipe ID",
                "Uncommon Recipe ID",
                "Advanced Recipe ID",
                "Rare Recipe ID",
            ]
        )

        for entry in entries:
            writer.writerow(
                [
                    entry.name,
                    entry.internal_key,
                    entry.industry,
                    entry.recipe_ids["Basic"],
                    entry.recipe_ids["Uncommon"],
                    entry.recipe_ids["Advanced"],
                    entry.recipe_ids["Rare"],
                ]
            )


def print_preview(entries: list[PartEntry], preview_count: int) -> None:
    if preview_count <= 0:
        return

    print(f"Preview: first {min(preview_count, len(entries))} part entries")

    for entry in entries[:preview_count]:
        print(
            ",".join(
                [
                    entry.name,
                    entry.internal_key,
                    entry.industry,
                    entry.recipe_ids["Basic"],
                    entry.recipe_ids["Uncommon"],
                    entry.recipe_ids["Advanced"],
                    entry.recipe_ids["Rare"],
                ]
            )
        )


def main() -> int:
    args = parse_args()
    recipes = load_recipes(args.input)
    entries = build_part_entries(recipes)
    write_markdown(args.output, entries)
    print(f"Wrote {len(entries)} part rows to {args.output}")
    print_preview(entries, args.preview)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
