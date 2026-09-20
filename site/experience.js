/* Search, reading continuity and a bounded first-entry identity sequence. */
(() => {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[c]);
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Reading works without storage. */ } };
  const bookmarkKey = "mirror-reading-position";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let activeChapter = null;
  let saveTimer;
  function bookmark() {
    const value = read(bookmarkKey);
    return value && Number.isSafeInteger(value.number) && value.number > 0 && Number.isSafeInteger(value.paragraph) && value.paragraph >= 0 && typeof value.text === "string" ? value : null;
  }
  function resumeLink(chapters) {
    const saved = bookmark();
    const record = saved && chapters.find(c => c.number === saved.number);
    if (!record) return "";
    return `<a class="resume-reading" href="#/read/${record.number}?resume=1"><span class="resume-label">上次读到</span><strong>${esc(record.label)}</strong><span>继续阅读 <span aria-hidden="true">↗</span></span></a>`;
  }
  function savePosition() {
    clearTimeout(saveTimer);
    if (!activeChapter) return;
    const nodes = [...document.querySelectorAll(".reader-copy [data-paragraph]")];
    if (!nodes.length) return;
    // Keep the paragraph crossing the top reading margin; no pixel offset is persisted.
    let index = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].getBoundingClientRect().top <= 100) index = i;
      else break;
    }
    write(bookmarkKey, {number: activeChapter.number, paragraph: index, text: activeChapter.paragraphs[index].text});
  }
  function leaveChapter() { savePosition(); activeChapter = null; }
  async function mountChapter(chapter, query) {
    const saved = bookmark();
    let target = null;
    let notice = "";
    if (query.get("resume") === "1" && saved?.number === chapter.number) {
      if (chapter.paragraphs[saved.paragraph]?.text === saved.text) target = saved.paragraph;
      else {
        const matches = chapter.paragraphs.map((p, i) => p.text === saved.text ? i : -1).filter(i => i >= 0);
        if (matches.length === 1) target = matches[0];
        else notice = "本章内容已有更新，已回到章节开头。";
      }
    } else if (/^\d+$/.test(query.get("p") || "")) {
      const index = Number(query.get("p"));
      if (index < chapter.paragraphs.length) target = index;
    }
    activeChapter = chapter;
    // Font readiness prevents a restored paragraph from drifting after layout.
    await document.fonts.ready;
    if (activeChapter !== chapter) return;
    if (target !== null) {
      const node = document.getElementById(`paragraph-${target}`);
      node?.scrollIntoView({block: "start", behavior: "instant"});
      node?.focus({preventScroll: true});
      node?.classList.add("reading-anchor");
      notice = query.has("resume") ? "已回到上次阅读的位置。" : "已定位到匹配段落。";
    }
    if (notice) {
      const status = document.querySelector("#reader-notice");
      if (status) { status.hidden = false; status.textContent = notice; }
      document.querySelector("#page-status").textContent = notice;
    }
    savePosition();
  }
  addEventListener("scroll", () => { if (activeChapter) { clearTimeout(saveTimer); saveTimer = setTimeout(savePosition, 180); } }, {passive: true});
  addEventListener("pagehide", savePosition);
  document.addEventListener("visibilitychange", () => { if (document.hidden) savePosition(); });

  const dialog = document.querySelector("#archive-search");
  const input = document.querySelector("#global-query");
  const results = document.querySelector("#search-results");
  const status = document.querySelector("#search-status");
  const retry = document.querySelector("#retry-search");
  let records = null, request = null, queryTimer;
  let searchReturnFocus = null, searchNavigating = false;
  const normalize = value => value.normalize("NFKC").toLocaleLowerCase();
  function highlighted(text, terms) {
    // Work on original text offsets; normalization is only used for matching/ranking.
    const lower = text.toLocaleLowerCase();
    const spans = [];
    for (const term of terms) {
      let at = lower.indexOf(term);
      while (at >= 0) { spans.push([at, at + term.length]); at = lower.indexOf(term, at + term.length); }
    }
    spans.sort((a, b) => a[0] - b[0]);
    let cursor = 0, html = "";
    for (const [start, end] of spans) {
      if (start < cursor) continue;
      html += esc(text.slice(cursor, start)) + `<mark>${esc(text.slice(start, end))}</mark>`;
      cursor = end;
    }
    return html + esc(text.slice(cursor));
  }
  function search() {
    if (!records) return;
    const terms = normalize(input.value.trim()).split(/\s+/).filter(Boolean);
    results.innerHTML = "";
    if (!terms.length) { status.textContent = "输入关键词，查阅章节正文与公共档案。"; return; }
    const matches = [];
    for (const record of records) {
      const title = normalize(record.title);
      const paragraphs = record.paragraphs.map(normalize);
      const all = title + "\n" + paragraphs.join("\n");
      if (!terms.every(term => all.includes(term))) continue;
      let paragraph = 0, best = -1;
      paragraphs.forEach((text, i) => {
        const score = terms.filter(term => text.includes(term)).length;
        if (score > best) { best = score; paragraph = i; }
      });
      const text = record.paragraphs[paragraph] || "";
      const first = Math.min(...terms.map(t => normalize(text).indexOf(t)).filter(i => i >= 0));
      const start = Number.isFinite(first) ? Math.max(0, first - 28) : 0;
      const snippet = (start ? "…" : "") + text.slice(start, start + 150) + (text.length > start + 150 ? "…" : "");
      const url = record.url + (record.chapter && best > 0 ? `?p=${paragraph}` : "");
      const score = terms.reduce((n, term) => n + (title === term ? 100 : title.includes(term) ? 20 : 0), 0) + best;
      matches.push({record, snippet, url, score});
    }
    matches.sort((a, b) => b.score - a.score);
    status.textContent = matches.length ? `找到 ${matches.length} 条记录${matches.length > 60 ? "，显示前 60 条；可增加关键词缩小范围" : ""}` : "没有找到相关记录，试试较短的关键词。";
    results.innerHTML = matches.slice(0, 60).map(({record, snippet, url}, i) => `<a class="search-result" href="${esc(url)}" style="--result-order:${Math.min(i, 4)}"><span class="result-category">${esc(record.category)}</span><div><h3>${highlighted(record.title, terms)}</h3><p>${highlighted(snippet, terms)}</p></div><span aria-hidden="true">↗</span></a>`).join("");
    results.scrollTop = 0;
  }
  async function loadSearch() {
    retry.hidden = true;
    status.textContent = "正在调取公共索引…";
    records = null;
    results.innerHTML = "";
    if (!request) request = fetch("./data/search.json", {cache: "no-cache"}).then(r => {
      if (!r.ok) throw new Error("index");
      return r.json();
    }).then(data => { if (!Array.isArray(data.records)) throw new Error("index"); records = data.records; }).finally(() => { request = null; });
    try { await request; search(); }
    catch { status.textContent = "索引暂时无法读取，请重试。"; retry.hidden = false; }
  }
  function openSearch() {
    if (document.querySelector("#chronicle-dialog[open], #archive-intro[open]")) return;
    if (!dialog.open) {
      if (document.querySelector(".sidebar.is-open")) document.querySelector("#sidebar-close").click();
      searchReturnFocus = document.activeElement;
      searchNavigating = false;
      dialog.showModal();
    }
    input.focus();
    loadSearch();
  }
  document.querySelector("#open-search").addEventListener("click", openSearch);
  document.querySelector("#close-search").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (!searchNavigating && searchReturnFocus?.isConnected) searchReturnFocus.focus({preventScroll: true}); });
  retry.addEventListener("click", loadSearch);
  input.addEventListener("input", () => { clearTimeout(queryTimer); queryTimer = setTimeout(search, 100); });
  dialog.addEventListener("click", event => {
    if (event.target.closest(".search-result")) {
      searchNavigating = true;
      dialog.close();
      if (event.target.closest("a").hash === location.hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dialog.close(); return; }
    if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key) || event.isComposing) return;
    const links = [...results.querySelectorAll("a")];
    if (!links.length) return;
    const current = links.indexOf(document.activeElement);
    if (event.key === "Enter") { if (document.activeElement === input) { event.preventDefault(); links[0].click(); } return; }
    event.preventDefault();
    if (event.key === "ArrowUp" && current <= 0) input.focus();
    else links[Math.max(0, Math.min(links.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)))].focus();
  });
  addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(); }
  });
  if (/Mac|iPhone|iPad/.test(navigator.platform)) document.querySelector("#open-search kbd").textContent = "⌘ K";

  const intro = document.querySelector("#archive-intro");
  let introTimer;
  function closeIntro(animate = false) {
    clearTimeout(introTimer);
    if (!intro.open) return;
    if (animate === true && !motion.matches) {
      intro.classList.add("is-leaving");
      introTimer = setTimeout(() => closeIntro(), 140);
      return;
    }
    intro.close();
    intro.classList.remove("is-leaving");
    document.querySelector("#main").focus({preventScroll: true});
  }
  try {
    if ((!location.hash || location.hash === "#/" || location.hash === "#") && !motion.matches && !sessionStorage.getItem("mirror-intro-seen")) {
      sessionStorage.setItem("mirror-intro-seen", "1");
      intro.showModal();
      introTimer = setTimeout(() => closeIntro(true), 760);
    }
  } catch { /* An unavailable session store simply omits the entrance. */ }
  document.querySelector("#skip-intro").addEventListener("click", closeIntro);
  motion.addEventListener("change", event => { if (event.matches) closeIntro(); });
  addEventListener("hashchange", closeIntro);
  window.MIRROR_EXPERIENCE = {read, write, resumeLink, leaveChapter, mountChapter};
})();
