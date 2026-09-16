"""Exercise the folder UI in Chromium and retain desktop/mobile screenshots."""
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
records = json.loads((ROOT / "dist/data/chronology.json").read_text())["records"]
server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(SimpleHTTPRequestHandler, directory=str(ROOT / "dist")))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/"

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            page.goto(url + "#/chronology")
            expect(page.locator("#selected-year")).to_have_text(str(records[0]["year"]))
            expect(page.locator("[data-folder]")).to_have_count(len(records))
            page.locator("#folder-stage").hover()
            page.mouse.wheel(0, 120)
            expect(page.locator("#selected-year")).to_have_text(str(records[1]["year"]))
            page.locator("#year-jump").select_option("5")
            expect(page.locator("#selected-year")).to_have_text(str(records[5]["year"]))
            page.screenshot(path=str(ARTIFACTS / "chronology-desktop.png"), full_page=True)
            page.locator(".year-folder.is-selected").click()
            expect(page.locator("#chronicle-dialog")).to_be_visible()
            expect(page.locator("#year-document-title")).to_have_text(records[5]["summary"])
            expect(page.locator(".year-document-copy p")).to_have_count(len(records[5]["paragraphs"]))
            page.screenshot(path=str(ARTIFACTS / "chronology-reading.png"))
            page.locator("#chronicle-paper").hover()
            page.mouse.wheel(0, 600)
            expect(page.locator("#selected-year")).to_have_text(str(records[5]["year"]))
            page.keyboard.press("Escape")
            expect(page.locator("#chronicle-dialog")).not_to_be_visible()
            expect(page).to_have_url(url + "#/chronology")
            page.locator(".year-folder.is-selected").focus()
            page.keyboard.press("End")
            expect(page.locator("#selected-year")).to_have_text(str(records[-1]["year"]))
            expect(page.locator('[data-year-step="1"]')).to_be_disabled()
            page.keyboard.press("Home")
            expect(page.locator("#selected-year")).to_have_text(str(records[0]["year"]))
            page.goto(url + f"#/chronology/{records[2]['year']}")
            expect(page.locator("#chronicle-dialog")).to_be_visible()
            page.locator('[data-read-step="1"]').click()
            expect(page.locator("#year-document-title")).to_have_text(records[3]["summary"])
            page.go_back()
            expect(page.locator("#year-document-title")).to_have_text(records[2]["summary"])
            page.goto(url + "#/news")
            expect(page.locator(".records-grid")).to_be_visible()
            assert not page.locator("body").evaluate("el => el.classList.contains('chronicle-reading')")
            page.goto(url + "#/chronology/9999")
            expect(page.locator("h1")).to_have_text("未找到这项记录")
            assert not errors, errors

            mobile = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, reduced_motion="reduce")
            mobile.on("pageerror", lambda error: errors.append(str(error)))
            mobile.goto(url + "#/chronology")
            mobile.locator("#year-jump").select_option("5")
            expect(mobile.locator("#selected-year")).to_have_text(str(records[5]["year"]))
            assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Mobile page overflows horizontally"
            mobile.screenshot(path=str(ARTIFACTS / "chronology-mobile.png"), full_page=True)
            mobile.locator("#open-year").tap()
            expect(mobile.locator("#chronicle-dialog")).to_be_visible()
            mobile.screenshot(path=str(ARTIFACTS / "chronology-mobile-reading.png"))
            mobile.locator("#close-year").tap()
            expect(mobile.locator("#chronicle-dialog")).not_to_be_visible()
            mobile.locator('[data-year-step="1"]').tap()
            expect(mobile.locator("#selected-year")).to_have_text(str(records[6]["year"]))
            assert not errors, errors
            print("Desktop and mobile chronology checks passed.")
        except Exception:
            page.screenshot(path=str(ARTIFACTS / "chronology-failure.png"), full_page=True)
            raise
        finally:
            browser.close()
finally:
    server.shutdown()
