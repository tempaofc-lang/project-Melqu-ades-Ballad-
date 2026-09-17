"""Check Markdown-driven public pages, revalidation and responsive documents."""
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
data = json.loads((ROOT / "dist/data/catalogue.json").read_text(encoding="utf-8"))
sections = json.loads((ROOT / "site/sections.json").read_text(encoding="utf-8"))
server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT / "dist")))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/"

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        for section in sections:
            if not section.get("sourceDir"):
                continue
            entries = data["entries"][section["id"]]
            page.goto(url + "#/" + section["id"])
            expect(page.locator("#record-filter")).to_be_visible()
            expect(page.locator(".record-card")).to_have_count(len(entries))
            if section.get("mediaEnabled") is False:
                expect(page.locator("#main .media-frame")).to_have_count(0)
            if not entries:
                expect(page.locator("#empty-result")).to_be_visible()
                continue
            page.locator("#record-filter").fill("__NO_MATCH_937502__")
            expect(page.locator(".record-card:visible")).to_have_count(0)
            expect(page.locator("#empty-result")).to_be_visible()
            page.locator("#record-filter").fill("")
            page.locator(".record-card").first.click()
            expect(page.locator("h1")).to_have_text(entries[0]["title"])
            expect(page.locator(".detail-copy")).to_be_visible()

        for width, height, label in ((1440, 1000, "desktop"), (390, 844, "mobile")):
            page.set_viewport_size({"width": width, "height": height})
            page.goto(url + "#/about")
            expect(page.locator("h1")).to_have_text(data["about"]["title"])
            expect(page.locator(".markdown-body h2")).to_have_count(sum(b["type"] == "heading" and b["level"] == 2 for b in data["about"]["blocks"]))
            expect(page.locator(".document-table tbody tr")).to_have_count(sum(len(b["rows"]) for b in data["about"]["blocks"] if b["type"] == "table"))
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            page.screenshot(path=str(ARTIFACTS / f"about-{label}.png"), full_page=True)

        # A new deployment must become visible after leaving and returning.
        updated = copy.deepcopy(data)
        updated["entries"]["news"] = [{"id": "refresh-test", "title": "更新后的公开记录", "summary": "同步测试", "kicker": "新闻", "status": "已收录", "facts": [], "blocks": [{"type": "paragraph", "text": "<img src=x onerror=alert(1)> **正文强调**"}]}]
        updated["about"]["title"] = "更新后的项目介绍"
        page.route("**/data/catalogue.json", lambda route: route.fulfill(json=updated))
        page.evaluate("location.hash = '#/news'")
        expect(page.locator(".record-card h2")).to_have_text("更新后的公开记录")
        page.locator(".record-card").click()
        expect(page.locator(".detail-copy strong")).to_have_text("正文强调")
        expect(page.locator(".detail-copy img, .detail-aside, .media-frame")).to_have_count(0)
        expect(page.locator(".detail-copy")).to_contain_text("<img src=x onerror=alert(1)>")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
        page.screenshot(path=str(ARTIFACTS / "record-mobile.png"), full_page=True)
        page.evaluate("location.hash = '#/about'")
        expect(page.locator("h1")).to_have_text("更新后的项目介绍")
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
