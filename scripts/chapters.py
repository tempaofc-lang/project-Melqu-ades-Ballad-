"""Discover independent manuscript chapters without a fixed chapter count."""
import re
from pathlib import Path


def chapters_from_folder(directory: Path) -> list[dict]:
    chapters = []
    numbers = set()
    if not directory.is_dir():
        raise ValueError(f"章节目录不存在：{directory}")
    for path in directory.glob("*.md"):
        if path.name.lower() == "readme.md" or path.name.startswith("_"):
            continue
        match = re.fullmatch(r"Melquiades-Ballad_([0-9]{3,})\.md", path.name)
        if not match or int(match[1]) < 1:
            raise ValueError(f"{path}：应命名为 Melquiades-Ballad_001.md，正整数编号至少三位")
        number = int(match[1])
        if number in numbers:
            raise ValueError(f"{path}：章节编号重复")
        numbers.add(number)
        lines = path.read_text(encoding="utf-8-sig").strip().splitlines()
        label = f"第{number}章"
        if lines and lines[0].startswith("# "):
            label = lines.pop(0)[2:].strip()
            if not label:
                raise ValueError(f"{path}：章节标题不能为空")
        paragraphs = [{"kind": "scene" if line.strip().startswith("【") and line.strip().endswith("】") else "text", "text": line.strip()}
                      for line in lines if line.strip()]
        if not paragraphs:
            raise ValueError(f"{path}：章节正文不能为空")
        chapters.append({"number": number, "label": label, "paragraphs": paragraphs})
    if not chapters:
        raise ValueError("至少需要一个非空的 Markdown 章节")
    return sorted(chapters, key=lambda chapter: chapter["number"])
