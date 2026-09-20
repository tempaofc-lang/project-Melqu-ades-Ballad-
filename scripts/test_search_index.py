import unittest

from search_index import search_index


class SearchIndexTests(unittest.TestCase):
    def test_paragraph_addresses_and_public_document_blocks(self):
        chapters = [{"number": 1031, "label": "新章", "paragraphs": [
            {"kind": "scene", "text": "【月面】"}, {"kind": "text", "text": "正文关键词"}]}]
        catalogue = {"entries": {"people": [{"id": "stable-id", "title": "人物", "summary": "摘要", "facts": ["身份 / 研究员"],
            "blocks": [{"type": "list", "items": ["列表关键词"]}, {"type": "table", "headers": ["字段"], "rows": [["表格关键词"]]}]}]},
            "about": {"title": "关于镜", "blocks": [{"type": "paragraph", "text": "介绍"}]}}
        data = search_index(chapters, catalogue, [{"year": 2085, "summary": "投用", "paragraphs": ["纪年正文"]}], [{"id": "people", "title": "人物"}])["records"]
        self.assertEqual(data[0]["url"], "#/read/1031")
        self.assertEqual(data[0]["paragraphs"], ["【月面】", "正文关键词"])
        self.assertEqual(data[1]["url"], "#/people/stable-id")
        self.assertIn("列表关键词", data[1]["paragraphs"])
        self.assertIn("字段\n表格关键词", data[1]["paragraphs"])
        self.assertEqual(data[2]["url"], "#/chronology/2085")
        self.assertEqual(data[3]["url"], "#/about")


if __name__ == "__main__":
    unittest.main()
