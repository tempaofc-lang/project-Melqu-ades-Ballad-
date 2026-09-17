(() => {
  "use strict";
  const catalogue = window.MIRROR_CONTENT;
  const main = document.querySelector("#main");
  const nav = document.querySelector("#primary-nav");
  const crumb = document.querySelector("#crumb");
  const wipe = document.querySelector("#screen-wipe");
  const menu = document.querySelector("#menu-button");
  const sidebar = document.querySelector("#sidebar");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let chapters = [];
  let renderToken = 0;
  let firstRender = true;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function routeParts() {
    const raw = location.hash.replace(/^#\/?/, "");
    return raw.split("/").filter(Boolean).map(part => decodeURIComponent(part));
  }

  function sectionById(id) {
    return catalogue.sections.find(section => section.id === id);
  }

  async function chapterManifest() {
    const response = await fetch("./data/manifest.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("目录暂时不可用");
    return response.json();
  }

  function closeMenu() {
    sidebar.classList.remove("is-open");
    menu.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-label", "打开栏目菜单");
  }

  function updateNav(active) {
    const navLabel = (zh, en) => `<span class="nav-label"><span>${esc(zh)}</span><small lang="en">${esc(en)}</small></span>`;
    nav.innerHTML = `
      <a href="#/" class="nav-link ${active === "home" ? "active" : ""}" ${active === "home" ? 'aria-current="page"' : ""}><span class="nav-index">00</span>${navLabel("总览", "OVERVIEW")}<span class="nav-arrow" aria-hidden="true">↗</span></a>
      <a href="#/read" class="nav-link ${active === "read" ? "active" : ""}" ${active === "read" ? 'aria-current="page"' : ""}><span class="nav-index">↳</span>${navLabel("章节阅读", "CHAPTERS")}<span class="nav-arrow" aria-hidden="true">↗</span></a>
      <span class="nav-divider"></span>
      ${catalogue.sections.map(section => `<a href="#/${esc(section.id)}" class="nav-link ${active === section.id ? "active" : ""}" ${active === section.id ? 'aria-current="page"' : ""}><span class="nav-index">${esc(section.number)}</span>${navLabel(section.title, section.en)}<span class="nav-arrow" aria-hidden="true">↗</span></a>`).join("")}
    `;
  }

  function media(media, kind = "small") {
    const alt = esc(media?.alt || "档案图像预留位置");
    if (media?.src && /^assets\/[^?#<>"']+$/u.test(media.src) && !media.src.includes("..")) {
      return `<figure class="media-frame ${kind}"><img src="./${esc(media.src)}" alt="${alt}" loading="lazy"><figcaption>${alt}</figcaption></figure>`;
    }
    return `<div class="media-frame ${kind} media-empty" role="img" aria-label="${alt}"><div class="media-grid"></div><div class="media-target"><i></i><i></i></div><span class="media-label">IMAGE SLOT / 影像待接入</span><small>${alt}</small></div>`;
  }

  function heading(eyebrow, title, subtitle) {
    return `<div class="page-heading"><div class="eyebrow"><span class="eyebrow-line"></span>${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>`;
  }

  function chapterLinks(records) {
    return records.map(record => `<a href="#/read/${record.number}" class="chapter-link" aria-label="阅读${esc(record.label)}"><span class="chapter-no">${String(record.number).padStart(3, "0")}</span><span>${esc(record.label)}</span><span class="chapter-link-arrow" aria-hidden="true">↗</span></a>`).join("");
  }

  function home() {
    return `<section class="home-intro"><div class="eyebrow"><span class="eyebrow-line"></span>GUANGHAN / PUBLIC ARCHIVE 2087</div><div class="home-intro-line"><h1>人类的记录，<br><em>仍在这里。</em></h1><p>欢迎访问镜的广寒宫本地节点。我们保存收到的资料，也标明它们在何时、何处出现分歧。这里提供查阅路径，判断留给每位读者。</p></div><div class="system-strip"><span><i class="pulse"></i> 本地档案可用</span><span>资料版本 / 并行接收</span><span>公众访问 / 开放</span></div></section>
    <section class="feature-panel" aria-labelledby="feature-title"><div class="feature-cover"><span class="frame-index">CULTURAL RECORD / 001</span><img src="./assets/cover.png" alt="《梅尔基亚德斯的歌谣》封面" fetchpriority="high"><span class="cover-bottom">已归档封面 · 原始图像</span></div><div class="feature-content"><div class="feature-topline"><span class="tag">文化文献</span><span>${chapters.length} CHAPTERS / TEXT</span></div><h2 id="feature-title">梅尔基亚德斯<br>的歌谣</h2><p class="feature-lead">一部关于记忆、公共生活与记录责任的长篇作品。镜保留其当前接收版本，供公众从任意章节开始阅读。</p><div class="feature-meta"><span>载体<br><strong>文字 / 原稿</strong></span><span>目录<br><strong>${chapters.length} 章</strong></span><span>状态<br><strong>持续更新</strong></span></div><a class="primary-action" href="#/read/${chapters[0].number}">从首章开始 <span aria-hidden="true">↗</span></a><div class="feature-chapters"><div class="section-mini-title"><span>章节入口</span><a href="#/read">浏览全部 <span aria-hidden="true">↗</span></a></div><div class="feature-chapter-list">${chapterLinks(chapters.slice(0, 6))}</div></div></div></section>
    <section class="home-catalogue"><div class="section-bar"><div><span class="eyebrow">INDEX / PUBLIC RECORDS</span><h2>浏览公共档案</h2></div><p>按对象进入，沿关联记录继续检索。</p></div><div class="section-card-grid">${catalogue.sections.map(section => `<a class="section-card" href="#/${esc(section.id)}"><span>${esc(section.number)} / ${esc(section.en)}</span><h3>${esc(section.title)}</h3><p>${esc(section.intro)}</p><b aria-hidden="true">↗</b></a>`).join("")}</div></section>`;
  }

  function readerIndex() {
    return `${heading("COLLECTION / LITERARY RECORD", "章节阅读", "《梅尔基亚德斯的歌谣》当前接收版本。选择章节，直接进入正文。")}
      <nav class="chapter-jump" aria-label="全部章节快速跳转"><div class="section-mini-title"><span>全部章节</span><span>${chapters.length} CHAPTERS</span></div><div class="chapter-grid">${chapterLinks(chapters)}</div></nav>`;
  }

  async function chapterPage(number, token) {
    if (!Number.isSafeInteger(number) || number < 1) return notFound();
    const index = chapters.findIndex(item => item.number === number);
    const record = chapters[index];
    const previous = chapters[index - 1];
    const next = chapters[index + 1];
    if (!record) return notFound();
    const response = await fetch(`./${record.file}`, { cache: "no-cache" });
    if (!response.ok) throw new Error("章节暂时无法读取");
    const chapter = await response.json();
    if (token !== renderToken) return null;
    const fontSize = Number(localStorage.getItem("mirror-reader-size") || 0);
    const paragraphs = chapter.paragraphs.map(item => item.kind === "scene" ? `<h2 class="scene-heading">${esc(item.text)}</h2>` : `<p>${esc(item.text)}</p>`).join("");
    return `<article class="reader-page"><div class="reader-bar"><a href="#/read" class="text-link">← 全部章节</a><span>镜 / 文献阅读</span><div class="reader-tools"><button type="button" data-reader-size="-1" aria-label="缩小正文字号">A−</button><button type="button" data-reader-size="1" aria-label="放大正文字号">A＋</button></div></div><div class="reading-progress"><span id="reading-progress"></span></div><header class="reader-header"><div class="eyebrow"><span class="eyebrow-line"></span>ARCHIVED TEXT / ${String(number).padStart(3, "0")}</div><h1>${esc(record.label)}</h1><p>梅尔基亚德斯的歌谣 · 当前接收版本</p></header><div class="reader-copy" style="--reader-step:${Math.max(-2, Math.min(3, fontSize))}">${paragraphs}</div><nav class="reader-end" aria-label="章节导航">${previous ? `<a href="#/read/${previous.number}"><small>上一章</small><span>${esc(previous.label)} ←</span></a>` : `<span></span>`}${next ? `<a href="#/read/${next.number}"><small>下一章</small><span>${esc(next.label)} →</span></a>` : `<a href="#/read"><small>返回</small><span>章节目录 →</span></a>`}</nav></article>`;
  }

  function card(section, entry) {
    const hasMedia = section.mediaEnabled !== false && Boolean(entry.media);
    return `<a href="#/${esc(section.id)}/${esc(entry.id)}" class="record-card ${hasMedia ? "" : "text-only"}">${hasMedia ? `<div class="card-media">${media(entry.media)}</div>` : ""}<div class="record-card-body"><div class="card-top"><span>${esc(entry.kicker)}</span><span class="status-mark"></span></div><h2>${esc(entry.title)}</h2><p>${esc(entry.summary)}</p><div class="card-foot"><span>${esc(entry.status)}</span><span aria-hidden="true">↗</span></div></div></a>`;
  }

  function sectionPage(section) {
    if (section.id === "about") return aboutPage(section);
    const entries = catalogue.entries[section.id] || [];
    return `${heading(`${section.number} / ${section.en}`, section.title, section.intro)}<div class="listing-tools"><span>已收录 ${entries.length} 条公开索引</span><label class="search"><span aria-hidden="true">⌕</span><span class="sr-only">搜索${esc(section.title)}</span><input id="record-filter" type="search" placeholder="筛选当前栏目" autocomplete="off"></label></div><div class="records-grid" id="records-grid">${entries.map(entry => card(section, entry)).join("")}</div><p id="empty-result" class="empty-result" ${entries.length ? "hidden" : ""}>${entries.length ? "当前栏目没有匹配的条目。" : "当前栏目尚无公开条目。"}</p>`;
  }

  function detailPage(section, entry) {
    const list = catalogue.entries[section.id] || [];
    const related = list.filter(item => item.id !== entry.id).slice(0, 3);
    const hasMedia = section.mediaEnabled !== false && Boolean(entry.media);
    return `<div class="detail-page"><a href="#/${esc(section.id)}" class="text-link">← 返回${esc(section.title)}</a><div class="detail-heading"><div>${heading(`${section.number} / ${section.en} / RECORD`, entry.title, entry.summary)}<span class="detail-status"><span class="status-mark"></span>${esc(entry.status)}</span></div><span class="detail-index">${esc(section.number)} — ${String(list.indexOf(entry) + 1).padStart(2, "0")}</span></div><div class="detail-layout ${hasMedia ? "" : "text-only"} ${entry.facts.length ? "" : "no-facts"}"><div class="detail-primary">${hasMedia ? media(entry.media, "large") : ""}<div class="detail-copy markdown-body"><div class="eyebrow">PUBLIC SUMMARY / 公众说明</div>${window.MIRROR_DOCUMENTS.render(entry.blocks)}</div></div>${entry.facts.length ? `<aside class="detail-aside"><h2>档案字段</h2><dl>${entry.facts.map(fact => { const [name, ...value] = fact.split(" / "); return `<div><dt>${esc(name)}</dt><dd>${esc(value.join(" / "))}</dd></div>`; }).join("")}</dl><p class="aside-note">本页依据本地已接收资料编写。记录出现分歧时，以来源与状态字段为准。</p></aside>` : ""}</div><div class="related"><div class="section-mini-title"><span>同栏目继续查阅</span><a href="#/${esc(section.id)}">全部条目 ↗</a></div><div class="related-grid">${related.map(item => `<a href="#/${esc(section.id)}/${esc(item.id)}"><small>${esc(item.kicker)}</small><strong>${esc(item.title)}</strong><span aria-hidden="true">↗</span></a>`).join("")}</div></div></div>`;
  }

  function aboutPage(section) {
    return `<article class="about-document">${heading(`${section.number} / ${section.en}`, catalogue.about.title, "广寒宫数据中心 · Mirror 项目") }<div class="markdown-body">${window.MIRROR_DOCUMENTS.render(catalogue.about.blocks)}</div></article>`;
  }

  function notFound() {
    return `${heading("INDEX / UNAVAILABLE", "未找到这项记录", "该地址没有对应的公开条目。你可以返回总览，或从侧栏选择其他栏目。") }<a class="primary-action compact" href="#/">返回总览 <span aria-hidden="true">↗</span></a>`;
  }

  function setDocumentMeta(title, sectionId) {
    document.title = `${title} · 镜公共档案`;
    crumb.textContent = `镜 / ${title}`;
    updateNav(sectionId);
    closeMenu();
  }

  async function render() {
    const token = ++renderToken;
    const parts = routeParts();
    const section = sectionById(parts[0]);
    const active = parts[0] === "read" ? "read" : section?.id || "home";
    const title = parts[0] === "read" ? (parts[1] ? `第${Number(parts[1]) || "?"}章` : "章节阅读") : section ? section.title : "公共档案";
    setDocumentMeta(title, active);
    const isChronology = section?.id === "chronology" && parts.length <= 2;
    if (isChronology && window.MIRROR_CHRONOLOGY.isMounted() && window.MIRROR_CHRONOLOGY.navigate(parts[1])) return;
    window.MIRROR_CHRONOLOGY.destroy();
    if (!firstRender && !reducedMotion.matches) {
      wipe.classList.add("enter");
      await new Promise(resolve => setTimeout(resolve, 190));
    }
    if (token !== renderToken) return;
    try {
      let html;
      if (!parts.length || parts[0] === "read") {
        const manifest = await chapterManifest();
        if (token !== renderToken) return;
        chapters = manifest.chapters;
        const record = chapters.find(item => item.number === Number(parts[1]));
        if (parts[0] === "read" && record) setDocumentMeta(record.label, "read");
      }
      if (section && (section.sourceDir || section.id === "about")) {
        const response = await fetch("./data/catalogue.json", { cache: "no-cache" });
        if (!response.ok) throw new Error("栏目资料暂时不可用");
        const data = await response.json();
        if (token !== renderToken) return;
        catalogue.entries = data.entries;
        catalogue.about = data.about;
      }
      if (!parts.length) html = home();
      else if (isChronology) html = await window.MIRROR_CHRONOLOGY.page(parts[1]) || notFound();
      else if (parts[0] === "read" && !parts[1]) html = readerIndex();
      else if (parts[0] === "read" && parts.length === 2) html = await chapterPage(Number(parts[1]), token);
      else if (section && parts.length === 1) html = sectionPage(section);
      else if (section && parts.length === 2 && section.id !== "about") {
        const entry = (catalogue.entries[section.id] || []).find(item => item.id === parts[1]);
        html = entry ? detailPage(section, entry) : notFound();
      } else html = notFound();
      if (token !== renderToken || html === null) return;
      main.innerHTML = html;
      if (isChronology) window.MIRROR_CHRONOLOGY.mount(parts[1]);
      window.scrollTo({ top: 0, behavior: "instant" });
      updateProgress();
    } catch (error) {
      if (token === renderToken) main.innerHTML = `${heading("SYSTEM / UNAVAILABLE", "资料暂时无法读取", "请稍后重试，或返回其他栏目。")}<a class="text-link" href="#/">返回总览 →</a>`;
      console.error(error);
    } finally {
      if (token === renderToken) {
        firstRender = false;
        wipe.classList.remove("enter");
      }
    }
  }

  function updateProgress() {
    const progress = document.querySelector("#reading-progress");
    if (!progress) return;
    const range = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = `${range > 0 ? Math.min(100, Math.max(0, window.scrollY / range * 100)) : 0}%`;
  }

  menu.addEventListener("click", () => {
    const open = sidebar.classList.toggle("is-open");
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "关闭栏目菜单" : "打开栏目菜单");
  });
  main.addEventListener("input", event => {
    if (event.target.id !== "record-filter") return;
    const query = event.target.value.trim().toLocaleLowerCase();
    let visible = 0;
    document.querySelectorAll(".record-card").forEach(card => {
      const match = card.textContent.toLocaleLowerCase().includes(query);
      card.hidden = !match;
      if (match) visible++;
    });
    document.querySelector("#empty-result").hidden = visible !== 0;
  });
  main.addEventListener("click", event => {
    const button = event.target.closest("[data-reader-size]");
    if (!button) return;
    const copy = document.querySelector(".reader-copy");
    const next = Math.max(-2, Math.min(3, Number(localStorage.getItem("mirror-reader-size") || 0) + Number(button.dataset.readerSize)));
    localStorage.setItem("mirror-reader-size", String(next));
    copy.style.setProperty("--reader-step", next);
  });
  window.addEventListener("hashchange", render);
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });
  render();
})();
