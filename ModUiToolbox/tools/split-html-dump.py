#!/usr/bin/env python3
"""
Split a DU UI dump html file into separate html files by direct <body> children.

Default output folder:
  <input_html_folder>/html

Default output format:
  raw html fragments without the original document head/body wrapper
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup


def slugify(value: str, fallback: str = "part") -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9_-]+", "-", value)
    value = value.strip("-_")
    return value or fallback


def safe_name(index: int, tag: str, element_id: str, classes: list[str]) -> str:
    if element_id:
        base = slugify(element_id)
    elif classes:
        base = slugify(classes[0])
    else:
        base = slugify(tag, fallback=f"part-{index:03d}")
    return f"{index:03d}-{base}.html"


def render_document(lang: str, head_html: str, body_class: str, node_html: str) -> str:
    body_class_attr = f' class="{body_class}"' if body_class else ""
    return (
        "<!doctype html>\n"
        f'<html lang="{lang}">\n'
        f"{head_html}\n"
        f"<body{body_class_attr}>\n"
        f"{node_html}\n"
        "</body>\n"
        "</html>\n"
    )


def split_html(input_path: Path, output_dir: Path, wrap_document: bool = False) -> dict:
    source_text = input_path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(source_text, "lxml")

    html_node = soup.html
    if html_node is None:
        raise ValueError("Input is missing <html> root.")
    head_node = soup.head
    body_node = soup.body
    if body_node is None:
        raise ValueError("Input is missing <body>.")

    lang = html_node.get("lang") or "en"
    head_html = str(head_node) if head_node is not None else "<head></head>"
    body_class = " ".join(body_node.get("class", []))

    roots = [child for child in body_node.children if getattr(child, "name", None)]
    if not roots:
        raise ValueError("No element children found under <body>.")

    output_dir.mkdir(parents=True, exist_ok=True)

    index_rows = []
    for i, node in enumerate(roots):
        tag = node.name or "node"
        element_id = (node.get("id") or "").strip()
        classes = [c for c in (node.get("class") or []) if str(c).strip()]
        file_name = safe_name(i, tag, element_id, classes)
        out_path = output_dir / file_name

        node_html = str(node)
        if wrap_document:
            out_text = render_document(lang, head_html, body_class, node_html)
        else:
            out_text = node_html + "\n"
        out_path.write_text(out_text, encoding="utf-8", newline="\n")

        descendants = len(list(node.find_all(True)))
        index_rows.append(
            {
                "index": i,
                "file": file_name,
                "tag": tag,
                "id": element_id,
                "classes": classes,
                "descendants": descendants,
                "htmlChars": len(node_html),
            }
        )

    (output_dir / "index.json").write_text(
        json.dumps(
            {
                "source": str(input_path),
                "outputDir": str(output_dir),
                "outputMode": "wrapped-document" if wrap_document else "raw-fragment",
                "rootCount": len(index_rows),
                "items": index_rows,
            },
            indent=2,
        ),
        encoding="utf-8",
        newline="\n",
    )

    md_lines = [
        "# HTML Split Index",
        "",
        f"- Source: `{input_path}`",
        f"- Output: `{output_dir}`",
        f"- Output mode: **{'wrapped-document' if wrap_document else 'raw-fragment'}**",
        f"- Root files: **{len(index_rows)}**",
        "",
        "| index | file | tag | id | classes | descendants | htmlChars |",
        "|---:|---|---|---|---|---:|---:|",
    ]
    for row in index_rows:
        classes = " ".join(row["classes"]).replace("|", "\\|")
        row_id = (row["id"] or "").replace("|", "\\|")
        md_lines.append(
            f"| {row['index']} | `{row['file']}` | `{row['tag']}` | `{row_id}` | `{classes}` | {row['descendants']} | {row['htmlChars']} |"
        )
    (output_dir / "index.md").write_text("\n".join(md_lines) + "\n", encoding="utf-8", newline="\n")

    return {
        "source": str(input_path),
        "outputDir": str(output_dir),
        "outputMode": "wrapped-document" if wrap_document else "raw-fragment",
        "rootCount": len(index_rows),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Split a DU UI dump html by direct <body> children.")
    parser.add_argument("--input", required=True, help="Path to html file (e.g. html.html)")
    parser.add_argument(
        "--out-dir",
        default="",
        help='Output folder (default: "<input_folder>/html")',
    )
    parser.add_argument(
        "--wrap-document",
        action="store_true",
        help="Wrap each extracted root in a full html/head/body document instead of writing the raw fragment only.",
    )
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input not found: {input_path}")

    if args.out_dir.strip():
        output_dir = Path(args.out_dir).expanduser().resolve()
    else:
        output_dir = input_path.parent / "html"

    result = split_html(
        input_path=input_path,
        output_dir=output_dir,
        wrap_document=args.wrap_document,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
