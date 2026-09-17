"""Verify flat chapter navigation and live source updates in Chromium."""
import copy
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
manifest = json.loads((ROOT / "dist/data/manifest.json").read_text(encoding="utf-8"))
records = manifest["chapters"]
server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT / "dist")))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/"

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        for width, height, name in ((1440, 1000, "desktop"), (390, 844, "mobile")):
            page.set_viewport_size({"width": width, "height": height})
            page.goto(url + "#/read")
            expect(page.locator(".chapter-jump .chapter-link")).to_have_count(len(records))
            expect(page.locator(".chapter-group")).to_have_count(0)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            page.screenshot(path=str(ARTIFACTS / f"chapters-{name}.png"), full_page=True)
        page.locator(".chapter-jump .chapter-link").first.click()
        expect(page.locator("h1")).to_have_text(records[0]["label"])
        chapter = json.loads((ROOT / "dist" / records[0]["file"]).read_text(encoding="utf-8"))
        expect(page.locator(".reader-copy > *")).to_have_count(len(chapter["paragraphs"]))
        expect(page.locator(".reader-copy > *").first).to_have_text(chapter["paragraphs"][0]["text"])
        page.goto(url + "#/read/" + str(records[-1]["number"]))
        expect(page.locator("h1")).to_have_text(records[-1]["label"])
        expect(page.locator(".reader-end a").last).to_have_attribute("href", "#/read")

        # Simulate a deployment with sparse chapter numbers beyond the old limit.
        changed = {"chapters": [copy.deepcopy(records[0]), {"number": 1031, "label": "新增章节", "file": "data/chapters/1031.json", "paragraphCount": 1}]}
        page.route("**/data/manifest.json", lambda route: route.fulfill(json=changed))
        page.route("**/data/chapters/1031.json", lambda route: route.fulfill(json={"number": 1031, "label": "新增章节", "paragraphs": [{"kind": "text", "text": "更新后的章节正文"}]}))
        page.evaluate("location.hash = '#/read'")
        expect(page.locator(".chapter-jump .chapter-link")).to_have_count(2)
        page.locator(".chapter-jump .chapter-link").first.click()
        expect(page.locator(".reader-end a").last).to_have_attribute("href", "#/read/1031")
        page.locator(".reader-end a").last.click()
        expect(page.locator(".reader-copy")).to_have_text("更新后的章节正文")
        expect(page.locator(".reader-end a").first).to_have_attribute("href", "#/read/" + str(records[0]["number"]))
        page.unroute("**/data/chapters/1031.json")
        page.route("**/data/chapters/1031.json", lambda route: route.fulfill(json={"number": 1031, "label": "新增章节", "paragraphs": [{"kind": "text", "text": "同一章节的修订正文"}]}))
        page.evaluate("location.hash = '#/read'")
        expect(page.locator(".chapter-jump")).to_be_visible()
        page.locator(".chapter-jump .chapter-link").last.click()
        expect(page.locator(".reader-copy")).to_have_text("同一章节的修订正文")
        page.evaluate("location.hash = '#/'")
        expect(page.locator(".feature-topline")).to_contain_text("2 CHAPTERS")
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
