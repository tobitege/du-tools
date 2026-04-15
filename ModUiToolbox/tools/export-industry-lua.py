from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_CONFIG_PATH = Path(r"D:\MyDUserver\config\dual.yaml")
DEFAULT_PSQL_PATH = Path(r"D:\MyDUserver\pgsql\bin\psql.exe")
DEFAULT_OUTPUT_BATCH_SIZE = 100


@dataclass(frozen=True)
class DbConfig:
    host: str
    port: int
    database: str
    user: str
    password: str | None


@dataclass(frozen=True)
class ExportRow:
    local_id: int
    name: str | None
    recipe_id: int | None
    mode: str
    maintain_rate: int | float | None


def parse_simple_yaml_sections(config_path: Path) -> dict[str, dict[str, str]]:
    sections: dict[str, dict[str, str]] = {}
    current_section: str | None = None

    for raw_line in config_path.read_text(encoding="utf-8").splitlines():
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        if not raw_line.startswith(" "):
            key, _, remainder = raw_line.partition(":")
            current_section = key.strip()
            sections.setdefault(current_section, {})
            if remainder.strip():
                current_section = None
            continue
        if current_section is None:
            continue
        line = raw_line.strip()
        key, _, value = line.partition(":")
        if not _:
            continue
        sections[current_section][key.strip()] = value.strip().strip("'\"")

    return sections


def load_db_config(config_path: Path, section_name: str) -> DbConfig:
    sections = parse_simple_yaml_sections(config_path)
    section = sections.get(section_name)
    if not section:
        raise RuntimeError(f"Section {section_name!r} not found in {config_path}")

    host = section.get("host")
    port_text = section.get("port")
    database = section.get("database")
    user = section.get("user")
    password = section.get("password")
    if not host or not port_text or not database or not user:
        raise RuntimeError(f"Section {section_name!r} is missing required database keys in {config_path}")

    try:
        port = int(port_text)
    except ValueError as exc:
        raise RuntimeError(f"Invalid port {port_text!r} in {config_path}") from exc

    return DbConfig(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password or None,
    )


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return int(float(text))
        except ValueError:
            return None
    return None


def read_json_lines_with_psql(
    psql_path: Path,
    db_config: DbConfig,
    sql: str,
) -> list[dict[str, Any]]:
    env = os.environ.copy()
    if db_config.password:
        env["PGPASSWORD"] = db_config.password

    copy_sql = f"COPY ({sql}) TO STDOUT"
    command = [
        str(psql_path),
        "-X",
        "-h",
        db_config.host,
        "-p",
        str(db_config.port),
        "-U",
        db_config.user,
        "-d",
        db_config.database,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        copy_sql,
    ]

    completed = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
    )
    if completed.returncode != 0:
        error_text = completed.stderr.strip() or completed.stdout.strip() or "psql failed"
        raise RuntimeError(error_text)

    rows: list[dict[str, Any]] = []
    for raw_line in completed.stdout.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        parsed = json.loads(line)
        if isinstance(parsed, dict):
            rows.append(parsed)
    return rows


def load_element_info(psql_path: Path, db_config: DbConfig, construct_id: int) -> dict[int, tuple[int, str | None]]:
    sql = f"""
        SELECT json_build_object(
            'element_id', id,
            'local_id', local_id,
            'name', (
                SELECT convert_from(p.value, 'UTF8')
                FROM public.element_property p
                WHERE p.element_id = public.element.id
                  AND p.name = 'name'
                LIMIT 1
            )
        )::text
        FROM public.element
        WHERE construct_id = {construct_id}
          AND local_id IS NOT NULL
    """
    rows = read_json_lines_with_psql(psql_path, db_config, sql)
    element_info: dict[int, tuple[int, str | None]] = {}
    for row in rows:
        element_id = as_int(row.get("element_id"))
        local_id = as_int(row.get("local_id"))
        if element_id is None or local_id is None:
            continue
        name_value = row.get("name")
        name = str(name_value).strip() if isinstance(name_value, str) and str(name_value).strip() else None
        element_info[element_id] = (local_id, name)
    return element_info


def load_industry_payloads(psql_path: Path, db_config: DbConfig, construct_id: int) -> list[dict[str, Any]]:
    sql = f"""
        SELECT json_build_object(
            'element_id', grainidextensionstring,
            'payload', payloadjson
        )::text
        FROM public.storage
        WHERE graintypestring = 'IndustryUnitGrain'
          AND payloadjson->'stats'->>'parentConstruct' = '{construct_id}'
    """
    return read_json_lines_with_psql(psql_path, db_config, sql)


def pick_recipe_id(payload: dict[str, Any]) -> int | None:
    recipe_id = as_int(payload.get("nextRecipeId"))
    if recipe_id is not None:
        return recipe_id

    recipe_id = as_int(payload.get("recipeId"))
    if recipe_id is not None:
        return recipe_id

    current_recipe = as_dict(payload.get("currentRecipe"))
    return as_int(current_recipe.get("id"))


def build_export_rows(element_info: dict[int, tuple[int, str | None]], payload_rows: list[dict[str, Any]]) -> list[ExportRow]:
    rows: list[ExportRow] = []

    for payload_row in payload_rows:
        element_id = as_int(payload_row.get("element_id"))
        payload = as_dict(payload_row.get("payload"))
        stats = as_dict(payload.get("stats"))
        if element_id is None:
            element_id = as_int(stats.get("elementId"))
        if element_id is None:
            continue

        element_entry = element_info.get(element_id)
        if element_entry is None:
            continue
        local_id, name = element_entry

        maintain_rate = as_int(payload.get("maintainProductAmount"))
        mode = "m" if maintain_rate is not None and maintain_rate > 0 else "r"

        rows.append(
            ExportRow(
                local_id=local_id,
                name=name,
                recipe_id=pick_recipe_id(payload),
                mode=mode,
                maintain_rate=maintain_rate if mode == "m" else None,
            )
        )

    rows.sort(key=lambda row: row.local_id)
    return rows


def chunk_rows(rows: list[ExportRow], batch_size: int) -> list[list[ExportRow]]:
    return [rows[index:index + batch_size] for index in range(0, len(rows), batch_size)]


def lua_number(value: int | float | None) -> str:
    if value is None:
        return "nil"
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return format(value, ".15g")
    return str(value)


def lua_string(value: str | None) -> str:
    if value is None:
        return "nil"
    return json.dumps(value, ensure_ascii=False)


def build_batch_lua_text(rows: list[ExportRow]) -> str:
    lines: list[str] = ["return {"]
    for row in rows:
        fields = [
            f"local_id = {row.local_id}",
            f"name = {lua_string(row.name)}",
            f"recipe_id = {lua_number(row.recipe_id)}",
            f'mode = "{row.mode}"',
        ]
        if row.mode == "m":
            fields.append(f"maintain_rate = {lua_number(row.maintain_rate)}")
        lines.append("    { " + ", ".join(fields) + " },")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def build_index_lua_text(construct_id: int, output_batch_size: int, batch_names: list[str], total_count: int) -> str:
    generated_at_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    lines: list[str] = [
        f"-- Generated by export-industry-lua.py on {generated_at_utc}",
        "return {",
        f"    construct_id = {construct_id},",
        f'    generated_at_utc = "{generated_at_utc}",',
        f"    total_count = {total_count},",
        f"    batch_size = {output_batch_size},",
        f"    batch_count = {len(batch_names)},",
    ]
    if batch_names:
        lines.append("    batch_names = {")
        for batch_name in batch_names:
            lines.append(f'        "{batch_name}",')
        lines.append("    },")
    else:
        lines.append("    batch_names = {},")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def default_output_dir(construct_id: int) -> Path:
    return Path.cwd() / f"industry-export-{construct_id}"


def write_output_directory(output_dir: Path, construct_id: int, output_batch_size: int, rows: list[ExportRow]) -> None:
    if output_dir.exists() and not output_dir.is_dir():
        raise RuntimeError(f"Output path exists and is not a directory: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    for existing_path in output_dir.glob("batch_*.lua"):
        existing_path.unlink()
    index_path = output_dir / "index.lua"
    if index_path.exists():
        index_path.unlink()

    chunks = chunk_rows(rows, output_batch_size)
    batch_names: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        batch_name = f"batch_{index:03d}"
        batch_names.append(batch_name)
        batch_path = output_dir / f"{batch_name}.lua"
        batch_path.write_text(build_batch_lua_text(chunk), encoding="utf-8", newline="\n")

    index_path.write_text(
        build_index_lua_text(construct_id, output_batch_size, batch_names, len(rows)),
        encoding="utf-8",
        newline="\n",
    )


def export_lua(args: argparse.Namespace) -> int:
    if not args.psql_path.is_file():
        raise RuntimeError(f"psql not found: {args.psql_path}")
    if not args.config_path.is_file():
        raise RuntimeError(f"Config not found: {args.config_path}")

    dual_db = load_db_config(args.config_path, "postgres")
    orleans_db = load_db_config(args.config_path, "orleanspostgres")

    element_info = load_element_info(args.psql_path, dual_db, args.construct_id)
    payload_rows = load_industry_payloads(args.psql_path, orleans_db, args.construct_id)
    rows = build_export_rows(element_info, payload_rows)

    if args.limit and args.limit > 0:
        rows = rows[:args.limit]
    if not rows:
        raise RuntimeError(f"No industry rows found for construct {args.construct_id}")

    write_output_directory(args.output_dir, args.construct_id, args.output_batch_size, rows)

    missing_recipe_count = sum(1 for row in rows if row.recipe_id is None)
    maintain_count = sum(1 for row in rows if row.mode == "m")
    print(
        f"Exported {len(rows)} industry rows to {args.output_dir} "
        f"(maintain={maintain_count}, run={len(rows) - maintain_count}, missing_recipe={missing_recipe_count})",
        flush=True,
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Export all persisted industry rows for a construct directly from Postgres into a Lua file. "
            "Rows contain local_id, custom name, recipe_id, mode ('r' or 'm'), and maintain_rate for maintain rows."
        )
    )
    parser.add_argument("--construct-id", type=int, required=True, help="Construct ID to export.")
    parser.add_argument("--config-path", type=Path, default=DEFAULT_CONFIG_PATH, help="Path to dual.yaml.")
    parser.add_argument("--psql-path", type=Path, default=DEFAULT_PSQL_PATH, help="Path to psql.exe.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Output directory. Defaults to ./industry-export-<construct-id>",
    )
    parser.add_argument(
        "--output-batch-size",
        type=int,
        default=DEFAULT_OUTPUT_BATCH_SIZE,
        help="Number of rows per Lua batch variable.",
    )
    parser.add_argument("--limit", type=int, default=0, help="Optional maximum number of industry rows to export.")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if args.output_dir is None:
        args.output_dir = default_output_dir(args.construct_id)
    try:
        return export_lua(args)
    except KeyboardInterrupt:
        print("\nStopped.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
