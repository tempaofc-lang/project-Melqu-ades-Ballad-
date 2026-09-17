"""Build public records from a small, documented Markdown format (stdlib only)."""
from __future__ import annotations

import json
import re
from pathlib import Path


def metadata(text: str) -> tuple[dict, str]:
    lines = text.lstrip("\ufeff").splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text
    end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if end is None:
        raise ValueError("顶部元数据缺少结束的 ---")
    values = {}
    allowed = {"title", "id", "summary", "kicker", "status", "draft", "image", "image_alt", "image_placeholder"}
    for line in lines[1:end]:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        match = re.fullmatch(r"([a-z_]+):\s*(.*)", line.strip())
        if not match or match[1] not in allowed:
            raise ValueError(f"不支持的元数据行：{line}")
        key, value = match.groups()
        if key in values:
            raise ValueError(f"重复的元数据字段：{key}")
        if key in {"draft", "image_placeholder"}:
            if value not in {"true", "false"}:
                raise ValueError(f"{key} 请填写 true 或 false")
            values[key] = value == "true"
        elif value.startswith('"'):
            values[key] = json.loads(value)
            if not isinstance(values[key], str):
                raise ValueError(f"{key} 必须是文本")
        elif value.startswith("'") and value.endswith("'"):
            values[key] = value[1:-1].replace("''", "'")
        else:
            values[key] = value
    return values, "\n".join(lines[end + 1:])


def markdown_blocks(text: str) -> list[dict]:
    lines = text.strip().splitlines()
    blocks = []
    index = 0

    def cells(line):
        return [cell.strip() for cell in line.strip().strip("|").split("|")]

    def table_start(i):
        return i + 1 < len(lines) and "|" in lines[i] and all(
            re.fullmatch(r":?-{3,}:?", cell) for cell in cells(lines[i + 1])
        )

    def special(i):
        return bool(re.match(r"^(#{1,6}\s|[-*]\s|\d+\.\s|>\s?|```|---+$)", lines[i].strip())) or table_start(i)

    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if re.fullmatch(r"-{3,}", line):
            index += 1
            continue
        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            blocks.append({"type": "heading", "level": min(4, max(2, len(heading[1]))), "text": heading[2]})
            index += 1
        elif line.startswith("```"):
            index += 1
            code = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code.append(lines[index]); index += 1
            if index == len(lines):
                raise ValueError("代码块缺少结束的 ```")
            blocks.append({"type": "code", "text": "\n".join(code)})
            index += 1
        elif table_start(index):
            headers = cells(lines[index]); rows = []; index += 2
            while index < len(lines) and "|" in lines[index] and lines[index].strip():
                row = cells(lines[index])
                if len(row) != len(headers):
                    raise ValueError("表格各行的列数须与表头一致")
                rows.append(row); index += 1
            blocks.append({"type": "table", "headers": headers, "rows": rows})
        elif re.match(r"^([-*]|\d+\.)\s+", line):
            ordered = bool(re.match(r"^\d+\.", line)); items = []
            pattern = r"^\d+\.\s+(.+)$" if ordered else r"^[-*]\s+(.+)$"
            while index < len(lines) and (item := re.match(pattern, lines[index].strip())):
                items.append(item[1]); index += 1
            blocks.append({"type": "list", "ordered": ordered, "items": items})
        elif line.startswith(">"):
            quote = []
            while index < len(lines) and lines[index].strip().startswith(">"):
                quote.append(re.sub(r"^>\s?", "", lines[index].strip())); index += 1
            blocks.append({"type": "quote", "text": "\n".join(quote)})
        else:
            paragraph = [line]; index += 1
            while index < len(lines) and lines[index].strip() and not special(index):
                paragraph.append(lines[index].strip()); index += 1
            blocks.append({"type": "paragraph", "text": "\n".join(paragraph)})
    return blocks


def document(text: str, fallback_title: str = "") -> dict:
    lines = text.strip().splitlines()
    title = fallback_title
    for index, line in enumerate(lines):
        if line.strip() and not re.fullmatch(r"-{3,}", line.strip()):
            match = re.fullmatch(r"#\s+(.+)", line.strip())
            if match:
                title = match[1]
                del lines[index]
            break
    if not title:
        raise ValueError("请添加 # 标题，或填写 title 元数据")
    blocks = markdown_blocks("\n".join(lines))
    if not blocks:
        raise ValueError("正文不能为空")
    return {"title": title, "blocks": blocks}


def entry_from_markdown(text: str, stem: str, section: dict, site: Path) -> dict | None:
    meta, body = metadata(text)
    if meta.get("draft"):
        return None
    facts = []
    cleaned = []
    in_facts = False
    for line in ([] if section.get("format") == "three-subtitles" else body.splitlines()):
        if re.fullmatch(r"##\s+档案字段\s*", line):
            in_facts = True
            continue
        if line.startswith("## "):
            in_facts = False
            if line.strip() == "## 正文":
                continue
        if in_facts:
            if line.strip():
                item = re.fullmatch(r"\s*[-*]\s+(.+)", line)
                if not item:
                    raise ValueError("档案字段请使用 - 字段 / 内容")
                facts.append(item[1])
        else:
            cleaned.append(line)
    if section.get("format") == "three-subtitles":
        if not re.match(r"^#\s+\S", body.strip()):
            raise ValueError("杂项请以 # 大标题 开始")
        # Heading names are ordinary text, including 正文 and 档案字段.
        doc = document(body)
        blocks = doc["blocks"]
        if len(blocks) < 4 or any(block["type"] != "heading" or block["level"] != 2 for block in blocks[:3]):
            raise ValueError("杂项需要连续三个 ## 小标题，然后填写统一正文")
        if blocks[3]["type"] == "heading":
            raise ValueError("三个小标题后须直接填写非空正文")
        doc["subtitles"] = [block["text"] for block in blocks[:3]]
        doc["blocks"] = blocks[3:]
    else:
        doc = document("\n".join(cleaned), meta.get("title", ""))
    identifier = meta.get("id") or stem.lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", identifier):
        raise ValueError("id 仅允许小写英文字母、数字、下划线和连字符")
    first = next((block["text"] for block in doc["blocks"] if block["type"] == "paragraph"), "")
    plain = re.sub(r"[*`\n]", "", first)
    entry = {"id": identifier, "title": doc["title"], "summary": meta.get("summary") or plain[:100] + ("…" if len(plain) > 100 else ""),
             "kicker": meta.get("kicker") or section["title"] + " · 公开档案", "status": meta.get("status") or "已收录",
             "facts": facts, "blocks": doc["blocks"]}
    if "subtitles" in doc:
        entry["subtitles"] = doc["subtitles"]
    image = meta.get("image")
    placeholder = meta.get("image_placeholder", False)
    if image or placeholder:
        if section.get("mediaEnabled") is False:
            raise ValueError(f"{section['title']}栏目已关闭配图，请移除 image 和 image_placeholder")
        media = {"alt": meta.get("image_alt") or doc["title"]}
        if image:
            path = Path(image)
            if not image.startswith("assets/") or ".." in path.parts or re.search(r"[?#<>\"'\\%]", image):
                raise ValueError("image 必须是 assets/ 下的安全相对路径")
            if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"} or not (site / path).is_file():
                raise ValueError(f"配图文件不存在或格式不支持：{image}")
            media["src"] = image
        entry["media"] = media
    return entry


def catalogue_from_folders(root: Path, sections: list[dict]) -> dict:
    entries = {}
    for section in sections:
        if not section.get("sourceDir"):
            continue
        directory = (root / section["sourceDir"]).resolve()
        if not directory.is_relative_to((root / "设定集").resolve()):
            raise ValueError("sourceDir 必须位于设定集目录内")
        if not directory.is_dir():
            raise ValueError(f"找不到栏目文件夹：{section['sourceDir']}")
        digits = int(section.get("minNumberDigits", 1))
        pattern = re.compile(re.escape(section["prefix"]) + rf"_([0-9]{{{digits},}})\.md")
        files = []
        numbers = set()
        for path in directory.glob("*.md"):
            if path.name.lower() == "readme.md" or path.name.startswith("_"):
                continue
            match = pattern.fullmatch(path.name)
            if not match:
                raise ValueError(f"{path.relative_to(root)}：文件名应为 {section['prefix']}_编号.md")
            number = int(match[1])
            if number < 1 or number in numbers:
                raise ValueError(f"{path.relative_to(root)}：编号须为正整数且不得重复")
            numbers.add(number); files.append((number, path))
        collection = []; identifiers = set()
        for number, path in sorted(files):
            try:
                entry = entry_from_markdown(path.read_text(encoding="utf-8-sig"), path.stem, section, root / "site")
                if entry is None:
                    continue
                if entry["id"] in identifiers:
                    raise ValueError(f"重复 id：{entry['id']}")
                identifiers.add(entry["id"]); collection.append(entry)
            except (ValueError, KeyError) as error:
                raise ValueError(f"{path.relative_to(root)}：{error}") from error
        entries[section["id"]] = collection
    about_path = root / "设定集" / "关于我们" / "about_us.md"
    return {"entries": entries, "about": document(about_path.read_text(encoding="utf-8-sig"))}
