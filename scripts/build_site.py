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


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "梅尔基亚德斯的歌谣_主稿.md"
CHRONOLOGY_SOURCE = ROOT / "设定集" / "联邦大事年纪.md"
SITE = ROOT / "site"
OUTPUT = ROOT / "dist"
CHAPTER_HEADING = re.compile(r"^([一二三四五六七八九十]+)．$")
NUMERALS = [
    "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
    "二十一", "二十二", "二十三", "二十四", "二十五", "二十六", "二十七", "二十八", "二十九", "三十",
]


def chapters_from_manuscript(text: str) -> list[dict]:
    chapters: list[dict] = []
    current: dict | None = None

    for line in text.splitlines():
        stripped = line.strip()
        match = CHAPTER_HEADING.fullmatch(stripped)
        if match:
            expected = NUMERALS[len(chapters)] if len(chapters) < len(NUMERALS) else None
            if match.group(1) != expected:
                raise ValueError(f"Unexpected chapter heading: {stripped}; expected {expected}．")
            current = {"number": len(chapters) + 1, "label": stripped, "paragraphs": []}
            chapters.append(current)
        elif current and stripped:
            current["paragraphs"].append({
                "kind": "scene" if stripped.startswith("【") and stripped.endswith("】") else "text",
                "text": stripped,
            })

    if len(chapters) != 30 or any(not chapter["paragraphs"] for chapter in chapters):
        raise ValueError("The manuscript must contain 30 nonempty chapters in order.")
    return chapters


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
    chapters = chapters_from_manuscript(SOURCE.read_text(encoding="utf-8-sig"))
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
        filename = f"{number:02d}.json"
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
