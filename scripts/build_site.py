"""Build the public Mirror archive from the current manuscript.

The site is intentionally dependency-free. Chapter text is copied from the
author's Markdown export; public catalogue descriptions are discovered in the setting folders.
"""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

from catalogue import catalogue_from_folders
from chapters import chapters_from_folder


ROOT = Path(__file__).resolve().parents[1]
CHAPTER_SOURCE = ROOT / "各章节"
CHRONOLOGY_SOURCE = ROOT / "设定集" / "联邦大事年纪.md"
SITE = ROOT / "site"
OUTPUT = ROOT / "dist"

def chronology_from_markdown(text: str) -> list[dict]:
    """Read year · summary blocks, with or without Markdown heading marks."""
    records: list[dict] = []
    current: dict | None = None
    paragraph: list[str] = []
    heading = re.compile(r"^(?:#{1,6}\s+)?(\d{4})\s*年?\s*[·•]\s*(.+)$")

    def flush() -> None:
        if current is not None and paragraph:
            current["paragraphs"].append("\n".join(paragraph))
        paragraph.clear()

    for line in text.splitlines():
        stripped = line.strip()
        match = heading.fullmatch(stripped)
        if match:
            flush()
            current = {"year": int(match.group(1)), "summary": match.group(2).strip(), "paragraphs": []}
            records.append(current)
        elif not stripped or re.fullmatch(r"-{3,}", stripped):
            flush()
        elif current is not None:
            paragraph.append(stripped)
    flush()
    if not records or any(not record["paragraphs"] for record in records):
        raise ValueError("Chronology needs nonempty year · summary records.")
    if len({record["year"] for record in records}) != len(records):
        raise ValueError("Chronology contains duplicate year headings.")
    return sorted(records, key=lambda record: record["year"])


def build() -> None:
    chapters = chapters_from_folder(CHAPTER_SOURCE)
    chronology = chronology_from_markdown(CHRONOLOGY_SOURCE.read_text(encoding="utf-8-sig"))
    sections = json.loads((SITE / "sections.json").read_text(encoding="utf-8"))
    catalogue = catalogue_from_folders(ROOT, sections)
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    shutil.copytree(SITE, OUTPUT)
    assets = OUTPUT / "assets"
    assets.mkdir(exist_ok=True)
    shutil.copy2(ROOT / "封面.png", assets / "cover.png")
    chapter_dir = OUTPUT / "data" / "chapters"
    chapter_dir.mkdir(parents=True)

    (OUTPUT / "content.js").write_text("window.MIRROR_CONTENT = " + json.dumps({"sections": sections}, ensure_ascii=False) + ";\n", encoding="utf-8")
    (OUTPUT / "data" / "catalogue.json").write_text(json.dumps(catalogue, ensure_ascii=False, indent=2), encoding="utf-8")

    manifest = []
    for chapter in chapters:
        number = chapter["number"]
        filename = f"{number:03d}.json"
        (chapter_dir / filename).write_text(
            json.dumps(chapter, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        manifest.append({
            "number": number,
            "label": chapter["label"],
            "file": f"data/chapters/{filename}",
            "paragraphCount": len(chapter["paragraphs"]),
        })

    (OUTPUT / "data" / "manifest.json").write_text(
        json.dumps({"chapters": manifest}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUTPUT / ".nojekyll").touch()
    (OUTPUT / "data" / "chronology.json").write_text(
        json.dumps({"records": chronology}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Built {len(chapters)} chapters and {len(chronology)} year records in {OUTPUT}")


if __name__ == "__main__":
    build()
