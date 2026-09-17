import json
import tempfile
import unittest
from pathlib import Path

from catalogue import catalogue_from_folders, entry_from_markdown, markdown_blocks


class CatalogueTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.directory = self.root / "设定集/人物"
        self.directory.mkdir(parents=True)
        about = self.root / "设定集/关于我们"
        about.mkdir()
        (about / "about_us.md").write_text("# 关于镜\n\n规范介绍", encoding="utf-8")
        (self.root / "设定集/about_us.md").write_text("错误来源", encoding="utf-8")
        self.section = {"id": "people", "title": "人物", "prefix": "personnel", "sourceDir": "设定集/人物"}

    def write(self, name, text="# 测试人物\n\n公开介绍。"):
        (self.directory / name).write_text(text, encoding="utf-8")

    def build(self):
        return catalogue_from_folders(self.root, [self.section])

    def test_minimal_defaults_and_canonical_about(self):
        self.write("personnel_01.md")
        data = self.build()
        entry = data["entries"]["people"][0]
        self.assertEqual(entry["id"], "personnel_01")
        self.assertEqual(entry["summary"], "公开介绍。")
        self.assertEqual(entry["facts"], [])
        self.assertNotIn("media", entry)
        self.assertEqual(data["about"]["blocks"][0]["text"], "规范介绍")

    def test_numeric_sort_drafts_and_deletion(self):
        for name in ("personnel_10.md", "personnel_02.md", "personnel_01.md"):
            self.write(name)
        self.write("personnel_03.md", "---\ndraft: true\n---")
        self.write("_template.md", "not published")
        self.write("README.md", "not published")
        self.assertEqual([e["id"] for e in self.build()["entries"]["people"]], ["personnel_01", "personnel_02", "personnel_10"])
        (self.directory / "personnel_02.md").unlink()
        self.assertEqual(len(self.build()["entries"]["people"]), 2)

    def test_invalid_name_and_duplicate_number(self):
        self.write("person_01.md")
        with self.assertRaisesRegex(ValueError, "person_01.md"):
            self.build()
        (self.directory / "person_01.md").unlink()
        self.write("personnel_01.md")
        self.write("personnel_001.md")
        with self.assertRaisesRegex(ValueError, "编号"):
            self.build()

    def test_metadata_and_duplicate_permalink(self):
        text = '---\nid: stable-link\nsummary: "手写摘要"\nstatus: 持续更新\n---\n# 人物\n\n## 档案字段\n- 身份 / 研究员\n\n## 正文\n说明。'
        self.write("personnel_01.md", text)
        entry = self.build()["entries"]["people"][0]
        self.assertEqual(entry["facts"], ["身份 / 研究员"])
        self.assertEqual(entry["summary"], "手写摘要")
        self.write("personnel_02.md", text)
        with self.assertRaisesRegex(ValueError, "重复 id"):
            self.build()

    def test_media_is_explicit_and_validated(self):
        text = '---\nimage_placeholder: true\n---\n# 人物\n\n说明。'
        self.assertIn("media", entry_from_markdown(text, "personnel_01", self.section, self.root / "site"))
        with self.assertRaisesRegex(ValueError, "关闭配图"):
            entry_from_markdown(text, "news_01", {**self.section, "mediaEnabled": False}, self.root / "site")
        for path in ("assets/../private.png", "https://example.com/a.png", "assets/missing.png"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                entry_from_markdown(text.replace("image_placeholder: true", "image: " + path), "personnel_01", self.section, self.root / "site")
        assets = self.root / "site/assets"
        assets.mkdir(parents=True)
        (assets / "test.png").write_bytes(b"test")
        entry = entry_from_markdown(text.replace("image_placeholder: true", "image: assets/test.png"), "personnel_01", self.section, self.root / "site")
        self.assertEqual(entry["media"]["src"], "assets/test.png")

    def test_markdown_and_invalid_documents(self):
        blocks = markdown_blocks('## 标题\n\n正文**强调**。\n\n| 项目 | 说明 |\n|---|---|\n| A | B |\n\n> 署名\n\n- 一\n- 二\n\n```\n<tag>\n```')
        self.assertEqual([b["type"] for b in blocks], ["heading", "paragraph", "table", "quote", "list", "code"])
        self.assertEqual(blocks[2]["rows"], [["A", "B"]])
        for text in ("# 空正文", "正文无标题", "---\nunknown: true\n---\n# 名称\n\n正文", "# 名称\n\n```\n未闭合"):
            with self.subTest(text=text), self.assertRaises(ValueError):
                entry_from_markdown(text, "personnel_01", self.section, self.root / "site")

    def test_miscellaneous_free_headings_and_discovery(self):
        self.section.update(id="miscellaneous", title="杂项", prefix="Miscellaneous", minNumberDigits=3, format="three-sections", mediaEnabled=False)
        text = "# 记录标题\n\n## 正文\n\n一。\n\n## 档案字段\n\n二。\n\n## 任意名称\n\n三。"
        self.write("Miscellaneous_010.md", text)
        self.write("Miscellaneous_001.md", text)
        entries = self.build()["entries"]["miscellaneous"]
        self.assertEqual([e["id"] for e in entries], ["miscellaneous_001", "miscellaneous_010"])
        self.assertEqual([b["text"] for b in entries[0]["blocks"] if b["type"] == "heading"], ["正文", "档案字段", "任意名称"])
        self.assertEqual(entries[0]["facts"], [])
        self.assertNotIn("media", entries[0])
        self.write("Miscellaneous_001.md", text.replace("一。", "修订正文。"))
        self.assertEqual(self.build()["entries"]["miscellaneous"][0]["summary"], "修订正文。")
        (self.directory / "Miscellaneous_010.md").unlink()
        self.assertEqual(len(self.build()["entries"]["miscellaneous"]), 1)
        for bad in ("Miscellaneous_01.md", "miscellaneous_002.md"):
            self.write(bad, text)
            with self.assertRaises(ValueError):
                self.build()
            (self.directory / bad).unlink()
        for bad in (text.replace("三。", ""), text.replace("## 任意名称\n\n三。", ""), "---\nimage_placeholder: true\n---\n" + text):
            self.write("Miscellaneous_001.md", bad)
            with self.assertRaises(ValueError):
                self.build()


if __name__ == "__main__":
    unittest.main()
