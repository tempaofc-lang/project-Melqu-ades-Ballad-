"""Create a public-only, paragraph-addressable search index from build inputs."""


def block_text(block):
    if block["type"] == "list":
        return "\n".join(block["items"])
    if block["type"] == "table":
        return "\n".join(" · ".join(row) for row in [block["headers"], *block["rows"]])
    return block.get("text", "")


def search_index(chapters, catalogue, chronology, sections):
    records = []
    for chapter in chapters:
        records.append({"title": chapter["label"], "category": "章节", "url": f"#/read/{chapter['number']}",
                        "paragraphs": [p["text"] for p in chapter["paragraphs"]], "chapter": True})
    labels = {s["id"]: s["title"] for s in sections}
    for section, entries in catalogue["entries"].items():
        for entry in entries:
            records.append({"title": entry["title"], "category": labels[section],
                            "url": f"#/{section}/{entry['id']}",
                            "paragraphs": [entry["summary"], *entry["facts"], *[block_text(b) for b in entry["blocks"]]]})
    for record in chronology:
        records.append({"title": f"{record['year']} · {record['summary']}", "category": "纪年",
                        "url": f"#/chronology/{record['year']}", "paragraphs": record["paragraphs"]})
    records.append({"title": catalogue["about"]["title"], "category": "关于我们", "url": "#/about",
                    "paragraphs": [block_text(b) for b in catalogue["about"]["blocks"]]})
    return {"records": records}
