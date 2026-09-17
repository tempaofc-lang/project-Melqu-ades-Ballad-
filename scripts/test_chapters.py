import tempfile
import unittest
from pathlib import Path

from chapters import chapters_from_folder


class ChapterTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def write(self, name, text="# 章节标题\n\n第一段。\n\n【场景】\n第二段。"):
        (self.root / name).write_text(text, encoding="utf-8")

    def test_numeric_order_gaps_and_beyond_thirty(self):
        for number in (101, 31, 1):
            self.write(f"Melquiades-Ballad_{number:03d}.md")
        records = chapters_from_folder(self.root)
        self.assertEqual([c["number"] for c in records], [1, 31, 101])
        self.assertEqual(records[0]["label"], "章节标题")
        self.assertEqual(records[0]["paragraphs"][1], {"kind": "scene", "text": "【场景】"})

    def test_update_delete_and_ignored_files(self):
        self.write("Melquiades-Ballad_001.md", "正文。")
        self.write("Melquiades-Ballad_002.md")
        self.write("README.md", "说明")
        self.write("_draft.md", "草稿")
        self.write("legacy.docx", "不参与构建")
        self.assertEqual(chapters_from_folder(self.root)[0]["label"], "第1章")
        self.write("Melquiades-Ballad_001.md", "更新正文。")
        (self.root / "Melquiades-Ballad_002.md").unlink()
        records = chapters_from_folder(self.root)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["paragraphs"][0]["text"], "更新正文。")

    def test_invalid_names_duplicates_and_empty_body(self):
        for name in ("Melquiades-Ballad_01.md", "Melquiades-Ballad_000.md", "chapter_001.md"):
            self.write(name)
            with self.assertRaisesRegex(ValueError, "命名"):
                chapters_from_folder(self.root)
            (self.root / name).unlink()
        self.write("Melquiades-Ballad_001.md")
        self.write("Melquiades-Ballad_0001.md")
        with self.assertRaisesRegex(ValueError, "重复"):
            chapters_from_folder(self.root)
        (self.root / "Melquiades-Ballad_0001.md").unlink()
        self.write("Melquiades-Ballad_001.md", "# 无正文")
        with self.assertRaisesRegex(ValueError, "正文"):
            chapters_from_folder(self.root)

    def test_missing_or_empty_directory(self):
        with self.assertRaises(ValueError):
            chapters_from_folder(self.root)
        with self.assertRaises(ValueError):
            chapters_from_folder(self.root / "missing")


if __name__ == "__main__":
    unittest.main()
