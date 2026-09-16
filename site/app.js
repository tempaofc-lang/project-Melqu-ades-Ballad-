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
  const chapterNames = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十", "二十一", "二十二", "二十三", "二十四", "二十五", "二十六", "二十七", "二十八", "二十九", "三十"];
  const chapterGroups = [
    { name: "地面初报", range: [1, 13], note: "从第一批病例到耶路撒冷" },
    { name: "后续记录", range: [14, 22], note: "地面社会与一条远距离链路" },
    { name: "月背接收", range: [23, 30], note: "第谷与广寒宫的并行时间" },
  ];
  let manifestPromise;
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

  function chapterManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch("./data/manifest.json").then(response => {
        if (!response.ok) throw new Error("目录暂时不可用");
        return response.json();
      });
    }
    return manifestPromise;
  }

  function closeMenu() {
    sidebar.classList.remove("is-open");
    menu.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-label", "打开栏目菜单");
  }

  function updateNav(active) {
    nav.innerHTML = `
      <a href="#/" class="nav-link ${active === "home" ? "active" : ""}" ${active === "home" ? 'aria-current="page"' : ""}><span class="nav-index">00</span><span>总览</span><span class="nav-arrow">↗</span></a>
      <a href="#/read" class="nav-link ${active === "read" ? "active" : ""}" ${active === "read" ? 'aria-current="page"' : ""}><span class="nav-index">↳</span><span>章节阅读</span><span class="nav-arrow">↗</span></a>
      <span class="nav-divider"></span>
      ${catalogue.sections.map(section => `<a href="#/${esc(section.id)}" class="nav-link ${active === section.id ? "active" : ""}" ${active === section.id ? 'aria-current="page"' : ""}><span class="nav-index">${esc(section.number)}</span><span>${esc(section.title)}</span><span class="nav-arrow">↗</span></a>`).join("")}
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

  function chapterLinks(start, end) {
    return Array.from({ length: end - start + 1 }, (_, index) => {
      const number = start + index;
      return `<a href="#/read/${number}" class="chapter-link" aria-label="阅读第${chapterNames[number - 1]}章"><span class="chapter-no">${String(number).padStart(2, "0")}</span><span>第${chapterNames[number - 1]}章</span><span class="chapter-link-arrow" aria-hidden="true">↗</span></a>`;
    }).join("");
  }

  function chapterPanels() {
    return chapterGroups.map(group => `<section class="chapter-group"><div class="chapter-group-heading"><div><small>SECTION / ${String(group.range[0]).padStart(2, "0")}—${String(group.range[1]).padStart(2, "0")}</small><h3>${esc(group.name)}</h3></div><span>${esc(group.note)}</span></div><div class="chapter-grid">${chapterLinks(...group.range)}</div></section>`).join("");
  }

  function home() {
    return `<section class="home-intro"><div class="eyebrow"><span class="eyebrow-line"></span>GUANGHAN / PUBLIC ARCHIVE 2087</div><div class="home-intro-line"><h1>人类的记录，<br><em>仍在这里。</em></h1><p>欢迎访问镜的广寒宫本地节点。我们保存收到的资料，也标明它们在何时、何处出现分歧。这里提供查阅路径，判断留给每位读者。</p></div><div class="system-strip"><span><i class="pulse"></i> 本地档案可用</span><span>资料版本 / 并行接收</span><span>公众访问 / 开放</span></div></section>
    <section class="feature-panel" aria-labelledby="feature-title"><div class="feature-cover"><span class="frame-index">CULTURAL RECORD / 001</span><img src="./assets/cover.png" alt="《梅尔基亚德斯的歌谣》封面" fetchpriority="high"><span class="cover-bottom">已归档封面 · 原始图像</span></div><div class="feature-content"><div class="feature-topline"><span class="tag">文化文献</span><span>30 CHAPTERS / TEXT</span></div><h2 id="feature-title">梅尔基亚德斯<br>的歌谣</h2><p class="feature-lead">一部关于记忆、公共生活与记录责任的长篇作品。镜保留其当前接收版本，供公众从任意章节开始阅读。</p><div class="feature-meta"><span>载体<br><strong>文字 / 原稿</strong></span><span>目录<br><strong>三十章</strong></span><span>状态<br><strong>持续更新</strong></span></div><a class="primary-action" href="#/read/1">从第一章开始 <span aria-hidden="true">↗</span></a><div class="feature-chapters"><div class="section-mini-title"><span>章节入口</span><a href="#/read">浏览全部 <span aria-hidden="true">↗</span></a></div><div class="feature-chapter-list">${chapterLinks(1, 6)}</div></div></div></section>
    <section class="home-catalogue"><div class="section-bar"><div><span class="eyebrow">INDEX / PUBLIC RECORDS</span><h2>浏览公共档案</h2></div><p>按对象进入，沿关联记录继续检索。</p></div><div class="section-card-grid">${catalogue.sections.map(section => `<a class="section-card" href="#/${esc(section.id)}"><span>${esc(section.number)} / ${esc(section.en)}</span><h3>${esc(section.title)}</h3><p>${esc(section.intro)}</p><b aria-hidden="true">↗</b></a>`).join("")}</div></section>`;
  }

  function readerIndex() {
    return `${heading("COLLECTION / LITERARY RECORD", "章节阅读", "《梅尔基亚德斯的歌谣》当前接收版本。章节顺序依原稿排列，时间顺序可在纪年栏目交叉查阅。")}
      <div class="note-banner"><span>文献说明</span><p>阅读页呈现原稿正文。文献仍在更新；档案条目的介绍文字由镜公共端独立编写。</p></div>
      <div class="all-chapters">${chapterPanels()}</div>`;
  }

  async function chapterPage(number, token) {
    if (!Number.isInteger(number) || number < 1 || number > 30) return notFound();
    const manifest = await chapterManifest();
    const record = manifest.chapters.find(item => item.number === number);
    if (!record) return notFound();
    const response = await fetch(`./${record.file}`);
    if (!response.ok) throw new Error("章节暂时无法读取");
    const chapter = await response.json();
    if (token !== renderToken) return null;
    const fontSize = Number(localStorage.getItem("mirror-reader-size") || 0);
    const paragraphs = chapter.paragraphs.map(item => item.kind === "scene" ? `<h2 class="scene-heading">${esc(item.text)}</h2>` : `<p>${esc(item.text)}</p>`).join("");
    return `<article class="reader-page"><div class="reader-bar"><a href="#/read" class="text-link">← 全部章节</a><span>镜 / 文献阅读</span><div class="reader-tools"><button type="button" data-reader-size="-1" aria-label="缩小正文字号">A−</button><button type="button" data-reader-size="1" aria-label="放大正文字号">A＋</button></div></div><div class="reading-progress"><span id="reading-progress"></span></div><header class="reader-header"><div class="eyebrow"><span class="eyebrow-line"></span>ARCHIVED TEXT / ${String(number).padStart(2, "0")}</div><h1>第${chapterNames[number - 1]}章<span>．</span></h1><p>梅尔基亚德斯的歌谣 · 当前接收版本</p></header><div class="reader-copy" style="--reader-step:${Math.max(-2, Math.min(3, fontSize))}">${paragraphs}</div><nav class="reader-end" aria-label="章节导航">${number > 1 ? `<a href="#/read/${number - 1}"><small>上一章</small><span>第${chapterNames[number - 2]}章 ←</span></a>` : `<span></span>`}${number < 30 ? `<a href="#/read/${number + 1}"><small>下一章</small><span>第${chapterNames[number]}章 →</span></a>` : `<a href="#/read"><small>返回</small><span>章节目录 →</span></a>`}</nav></article>`;
  }

  function card(section, entry) {
    return `<a href="#/${esc(section.id)}/${esc(entry.id)}" class="record-card"><div class="card-media">${media(entry.media)}</div><div class="record-card-body"><div class="card-top"><span>${esc(entry.kicker)}</span><span class="status-mark"></span></div><h2>${esc(entry.title)}</h2><p>${esc(entry.summary)}</p><div class="card-foot"><span>${esc(entry.status)}</span><span aria-hidden="true">↗</span></div></div></a>`;
  }

  function sectionPage(section) {
    if (section.id === "about") return aboutPage(section);
    const entries = catalogue.entries[section.id] || [];
    return `${heading(`${section.number} / ${section.en}`, section.title, section.intro)}<div class="listing-tools"><span>已收录 ${entries.length} 条公开索引</span><label class="search"><span aria-hidden="true">⌕</span><span class="sr-only">搜索${esc(section.title)}</span><input id="record-filter" type="search" placeholder="筛选当前栏目" autocomplete="off"></label></div><div class="records-grid" id="records-grid">${entries.map(entry => card(section, entry)).join("")}</div><p id="empty-result" class="empty-result" hidden>当前栏目没有匹配的条目。</p>`;
  }

  function detailPage(section, entry) {
    const list = catalogue.entries[section.id] || [];
    const related = list.filter(item => item.id !== entry.id).slice(0, 3);
    return `<div class="detail-page"><a href="#/${esc(section.id)}" class="text-link">← 返回${esc(section.title)}</a><div class="detail-heading"><div>${heading(`${section.number} / ${section.en} / RECORD`, entry.title, entry.summary)}<span class="detail-status"><span class="status-mark"></span>${esc(entry.status)}</span></div><span class="detail-index">${esc(section.number)} — ${String(list.indexOf(entry) + 1).padStart(2, "0")}</span></div><div class="detail-layout"><div class="detail-primary">${media(entry.media, "large")}<div class="detail-copy"><div class="eyebrow">PUBLIC SUMMARY / 公众说明</div>${entry.body.map(paragraph => `<p>${esc(paragraph)}</p>`).join("")}</div></div><aside class="detail-aside"><h2>档案字段</h2><dl>${entry.facts.map(fact => { const [name, ...value] = fact.split(" / "); return `<div><dt>${esc(name)}</dt><dd>${esc(value.join(" / "))}</dd></div>`; }).join("")}</dl><p class="aside-note">本页依据本地已接收资料编写。记录出现分歧时，以来源与状态字段为准。</p></aside></div><div class="related"><div class="section-mini-title"><span>同栏目继续查阅</span><a href="#/${esc(section.id)}">全部条目 ↗</a></div><div class="related-grid">${related.map(item => `<a href="#/${esc(section.id)}/${esc(item.id)}"><small>${esc(item.kicker)}</small><strong>${esc(item.title)}</strong><span aria-hidden="true">↗</span></a>`).join("")}</div></div></div>`;
  }

  function aboutPage(section) {
    return `${heading(`${section.number} / ${section.en}`, "关于镜", section.intro)}<div class="about-hero"><div class="about-symbol" aria-hidden="true"><i></i><i></i><i></i></div><div><span>GUANGHAN / LOCAL ARCHIVE</span><h2>让每一份记录<br>有可追溯的位置。</h2><p>${esc(catalogue.about.lead)}</p></div></div><div class="about-grid">${catalogue.about.blocks.map((block, index) => `<section><span>${String(index + 1).padStart(2, "0")}</span><h3>${esc(block.title)}</h3><p>${esc(block.text)}</p></section>`).join("")}</div><div class="note-banner about-note"><span>公共访问说明</span><p>本站为广寒宫本地节点的公开查阅界面。涉个人隐私、未授权机构资料与控制凭据不在此端提供。</p></div>`;
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
    const title = parts[0] === "read" ? (parts[1] ? `第${chapterNames[Number(parts[1]) - 1] || "?"}章` : "章节阅读") : section ? section.title : "公共档案";
    setDocumentMeta(title, active);
    if (!firstRender && !reducedMotion.matches) {
      wipe.classList.add("enter");
      await new Promise(resolve => setTimeout(resolve, 190));
    }
    if (token !== renderToken) return;
    try {
      let html;
      if (!parts.length) html = home();
      else if (parts[0] === "read" && !parts[1]) html = readerIndex();
      else if (parts[0] === "read" && parts.length === 2) html = await chapterPage(Number(parts[1]), token);
      else if (section && parts.length === 1) html = sectionPage(section);
      else if (section && parts.length === 2 && section.id !== "about") {
        const entry = (catalogue.entries[section.id] || []).find(item => item.id === parts[1]);
        html = entry ? detailPage(section, entry) : notFound();
      } else html = notFound();
      if (token !== renderToken || html === null) return;
      main.innerHTML = html;
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
