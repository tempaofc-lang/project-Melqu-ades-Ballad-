"""Validate the author-facing year / summary / body format."""
import unittest

from build_site import chronology_from_markdown


class ChronologyTests(unittest.TestCase):
    def test_plain_and_markdown_headings(self):
        records = chronology_from_markdown(
            "# 联邦纪年（2040—2087）\n---\n2040 · 起点\n\n第一段。\n第二行。\n\n"
            "第二段。\n---\n## 2042年 · 后续\n\n保留**强调**。\n---\n"
        )
        self.assertEqual([item["year"] for item in records], [2040, 2042])
        self.assertEqual(records[0]["paragraphs"], ["第一段。\n第二行。", "第二段。"])
        self.assertEqual(records[1]["summary"], "后续")
        self.assertEqual(records[1]["paragraphs"], ["保留**强调**。"])

    def test_orders_years(self):
        records = chronology_from_markdown("2050年 · 后\n正文\n---\n2040年 · 前\n正文")
        self.assertEqual([item["year"] for item in records], [2040, 2050])

    def test_rejects_duplicate_year(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            chronology_from_markdown("2040 · 一\n正文\n---\n2040 · 二\n正文")

    def test_rejects_missing_body(self):
        with self.assertRaises(ValueError):
            chronology_from_markdown("2040 · 一\n正文\n---\n2042 · 二\n---")

    def test_rejects_no_records(self):
        with self.assertRaises(ValueError):
            chronology_from_markdown("# 联邦纪年\n---")


if __name__ == "__main__":
    unittest.main()
