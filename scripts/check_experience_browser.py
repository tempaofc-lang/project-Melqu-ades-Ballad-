"""Validate search, semantic reading bookmarks, entry motion and mobile keyboard paths."""
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT / "dist")))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/"
chapter = json.loads((ROOT / "dist/data/chapters/001.json").read_text(encoding="utf-8"))
index = json.loads((ROOT / "dist/data/search.json").read_text(encoding="utf-8"))
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        errors, requests = [], []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("request", lambda r: requests.append(r.url))
        page.goto(url)
        expect(page.locator(".home-entry")).to_be_visible()
        assert not any("search.json" in r for r in requests), "Search must load on demand"
        page.locator("#open-search").click()
        expect(page.locator("#global-query")).to_be_focused()
        # Every public category is searchable, including table/list content.
        for category in {r["category"] for r in index["records"]}:
            record = next(r for r in index["records"] if r["category"] == category)
            page.locator("#global-query").fill(record["title"])
            expect(page.locator(".search-result").first).to_contain_text(record["title"])
        page.locator("#global-query").fill("NO_MATCH_zz9301")
        expect(page.locator("#search-status")).to_contain_text("没有找到")
        page.locator("#global-query").fill(chapter["paragraphs"][3]["text"][:18])
        expect(page.locator('.search-result[href="#/read/1?p=3"]')).to_be_visible()
        page.locator("#global-query").press("ArrowDown")
        page.keyboard.press("Enter")
        expect(page.locator("#paragraph-3")).to_be_focused()
        expect(page.locator("#reader-notice")).to_contain_text("匹配段落")
        page.locator("#paragraph-7").evaluate("el => el.scrollIntoView({block:'start'})")
        page.wait_for_function("JSON.parse(localStorage.getItem('mirror-reading-position')).paragraph === 7")
        saved = page.evaluate("JSON.parse(localStorage.getItem('mirror-reading-position'))")
        page.evaluate("location.hash = '#/'")
        expect(page.locator(".resume-reading")).to_contain_text("第一章")
        page.locator(".resume-reading").click()
        expect(page.locator("#paragraph-7")).to_be_focused()
        # A paragraph inserted before the bookmark must not shift its meaning.
        revised = {**chapter, "paragraphs": [{"kind": "text", "text": "新插入的一段"}, *chapter["paragraphs"]]}
        page.route("**/data/chapters/001.json", lambda route: route.fulfill(json=revised))
        page.evaluate("location.hash = '#/'")
        expect(page.locator(".resume-reading")).to_be_visible()
        page.locator(".resume-reading").click()
        expect(page.locator("#paragraph-8")).to_be_focused()
        expect(page.locator("#paragraph-8")).to_have_text(saved["text"])
        revised["paragraphs"][8] = {"kind": "text", "text": "该段已彻底改写"}
        page.evaluate("location.hash = '#/'")
        expect(page.locator(".resume-reading")).to_be_visible()
        page.locator(".resume-reading").click()
        expect(page.locator("#reader-notice")).to_contain_text("已有更新")
        assert page.evaluate("scrollY") == 0
        # Network failure is recoverable without closing the search interface.
        page.route("**/data/search.json", lambda route: route.fulfill(status=503, body="unavailable"))
        page.locator("#open-search").click()
        expect(page.locator("#retry-search")).to_be_visible()
        page.unroute("**/data/search.json")
        page.locator("#retry-search").click()
        expect(page.locator("#retry-search")).to_be_hidden()
        page.locator("#global-query").fill("广寒宫")
        expect(page.locator(".search-result").first).to_be_visible()
        page.screenshot(path=str(ROOT / "preview-experience-search-desktop.png"))
        page.keyboard.press("Escape")
        expect(page.locator("#open-search")).to_be_focused()
        for width, height, name in [(768, 1024, "tablet"), (390, 844, "mobile")]:
            page.set_viewport_size({"width": width, "height": height})
            page.goto(url)
            expect(page.locator(".resume-reading")).to_be_visible()
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            page.screenshot(path=str(ROOT / f"preview-experience-home-{name}.png"))
            page.locator("#open-search").click()
            page.locator("#global-query").fill("广寒宫")
            expect(page.locator(".search-result").first).to_be_visible()
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            page.screenshot(path=str(ROOT / f"preview-experience-search-{name}.png"))
            page.keyboard.press("Escape")
        assert page.locator("#sidebar").evaluate("el => el.inert")
        page.locator("#menu-button").click()
        expect(page.locator("#sidebar-close")).to_be_focused()
        page.keyboard.press("Shift+Tab")
        expect(page.locator("#primary-nav a").last).to_be_focused()
        page.keyboard.press("Tab")
        expect(page.locator("#sidebar-close")).to_be_focused()
        page.keyboard.press("Escape")
        expect(page.locator("#menu-button")).to_be_focused()
        assert page.locator("#sidebar").evaluate("el => el.inert")
        # Storage denied: chapters, font controls and home still render.
        denied = browser.new_page(reduced_motion="reduce")
        denied.add_init_script("Storage.prototype.getItem = Storage.prototype.setItem = () => {throw new Error('denied')}")
        denied.on("pageerror", lambda e: errors.append(str(e)))
        denied.goto(url + "#/read/1")
        expect(denied.locator(".reader-copy")).to_be_visible()
        denied.locator('[data-reader-size="1"]').click()
        # Entrance: once per session; deep links and reduced-motion bypass it.
        fresh = browser.new_page()
        fresh.goto(url, wait_until="domcontentloaded")
        expect(fresh.locator("#archive-intro")).to_be_visible()
        fresh.wait_for_timeout(400)  # Sample the authored entrance, not a loading wait.
        fresh.screenshot(path=str(ROOT / "preview-experience-intro.png"))
        fresh.locator("#skip-intro").click()
        expect(fresh.locator("#archive-intro")).to_be_hidden()
        fresh.reload()
        expect(fresh.locator("#archive-intro")).to_be_hidden()
        direct = browser.new_page()
        direct.goto(url + "#/read/1")
        expect(direct.locator("#archive-intro")).to_be_hidden()
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
print("Experience checks passed")
