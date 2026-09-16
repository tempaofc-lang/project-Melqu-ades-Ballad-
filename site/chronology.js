/* Year folders are generated from 设定集/联邦大事年纪.md at build time. */
(() => {
  "use strict";
  let records = [];
  let pending;
  let root;
  let controller;
  let selected = 0;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const inline = value => esc(value).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const indexOf = year => records.findIndex(record => String(record.year) === String(year));

  async function load() {
    // Share only requests in flight; revisiting the archive must revalidate data.
    if (!pending) pending = fetch("./data/chronology.json", { cache: "no-cache" }).then(response => {
      if (!response.ok) throw new Error("纪年资料暂时不可用");
      return response.json();
    }).then(data => {
      if (!Array.isArray(data.records) || !data.records.length) throw new Error("纪年资料为空");
      const selectedYear = records[selected]?.year;
      records = data.records;
      const preserved = indexOf(selectedYear);
      selected = preserved >= 0 ? preserved : Math.min(selected, records.length - 1);
    }).finally(() => { pending = null; });
    await pending;
  }

  async function page(year) {
    await load();
    if (year !== undefined && indexOf(year) < 0) return null;
    return `<section class="chronicle" id="chronicle">
      <header class="page-heading chronicle-heading"><div class="eyebrow"><span class="eyebrow-line"></span>03 / CHRONOLOGY</div><h1>纪年<span>联邦大事档案</span></h1><p>从地面危机到月背档案，逐年查阅公共生活、制度与技术的变化。每一个文件夹，保存一年的记录。</p></header>
      <div class="chronicle-register"><span><b>${records[0].year}—${records.at(-1).year}</b> / ${records.length} 份年度档案</span><span lang="en">FEDERAL CHRONICLE / PUBLIC EDITION</span></div>
      <div class="chronicle-workspace">
        <div class="folder-stage" id="folder-stage" role="group" aria-label="年度档案文件夹" aria-describedby="folder-help">
          <div class="folder-desk-label" aria-hidden="true">镜 / 年度卷宗<br><span>ARCHIVE SERIES 03</span></div>
          ${records.map((record, index) => `<button type="button" class="year-folder" data-folder="${index}" tabindex="-1" aria-label="${record.year}年：${esc(record.summary)}"><span class="folder-sheet"></span><span class="folder-tab"><b>${record.year}</b><small lang="en">YEAR</small></span><span class="folder-summary">${esc(record.summary)}</span><span class="folder-bottom"><span>联邦纪年 / ${String(index + 1).padStart(2, "0")}</span><span class="folder-open-label">展开记录 ↗</span></span></button>`).join("")}
          <p class="folder-help" id="folder-help">滚轮选择年份 · 点击选中文件夹展开<br><span>也可使用方向键，或下方年份控件</span></p>
        </div>
        <aside class="chronicle-selection" aria-label="当前选中年份"><span class="eyebrow">SELECTED YEAR / 当前年份</span><div class="selected-year" id="selected-year"></div><h2 id="selected-summary"></h2><p>此卷收录该年度主要事件的经过与背景。打开文件夹，查阅完整纪年。</p><button type="button" class="primary-action" id="open-year">展开年度记录 <span aria-hidden="true">↗</span></button><small id="year-position" role="status" aria-live="polite"></small></aside>
      </div>
      <div class="chronicle-controls"><button type="button" data-year-step="-1" aria-label="选择上一份年度档案">←</button><label for="year-range" class="sr-only">选择年份</label><span class="range-end">${records[0].year}</span><input type="range" id="year-range" min="0" max="${records.length - 1}" step="1" value="${selected}"><span class="range-end">${records.at(-1).year}</span><button type="button" data-year-step="1" aria-label="选择下一份年度档案">→</button><label class="year-jump">跳至年份<select id="year-jump">${records.map((record, index) => `<option value="${index}">${record.year} 年</option>`).join("")}</select></label></div>
      <dialog class="chronicle-dialog" id="chronicle-dialog" aria-labelledby="year-document-title"><div class="chronicle-dialog-bar"><span>镜 / 年度档案阅览</span><button type="button" id="close-year" aria-label="关闭年度档案">关闭 <span aria-hidden="true">×</span></button></div><div class="chronicle-paper" id="chronicle-paper" tabindex="0"><article id="year-document"></article></div><nav class="chronicle-dialog-nav" aria-label="年度档案翻阅"><button type="button" data-read-step="-1">← 上一份</button><span id="document-position"></span><button type="button" data-read-step="1">下一份 →</button></nav></dialog>
    </section>`;
  }

  function choose(index, focus = false) {
    selected = Math.max(0, Math.min(records.length - 1, index));
    const record = records[selected];
    root.querySelectorAll("[data-folder]").forEach(button => {
      const depth = Number(button.dataset.folder) - selected;
      const visible = depth >= 0 && depth <= 3;
      button.style.setProperty("--depth", Math.max(0, Math.min(4, depth)));
      button.classList.toggle("is-selected", depth === 0);
      button.classList.toggle("is-past", depth < 0);
      button.classList.toggle("is-hidden", !visible);
      button.style.zIndex = String(20 - Math.max(0, depth));
      button.setAttribute("aria-pressed", String(depth === 0));
      button.setAttribute("aria-hidden", String(!visible));
      button.tabIndex = depth === 0 ? 0 : -1;
    });
    root.querySelector("#selected-year").textContent = record.year;
    root.querySelector("#selected-summary").textContent = record.summary;
    root.querySelector("#year-position").textContent = `${record.year} 年 / 第 ${selected + 1} 份，共 ${records.length} 份`;
    const range = root.querySelector("#year-range");
    range.value = selected;
    range.setAttribute("aria-valuetext", `${record.year}年，${record.summary}`);
    root.querySelector("#year-jump").value = selected;
    root.querySelectorAll("[data-year-step], [data-read-step]").forEach(button => {
      const direction = Number(button.dataset.yearStep || button.dataset.readStep);
      button.disabled = direction < 0 ? selected === 0 : selected === records.length - 1;
    });
    if (focus) root.querySelector(`[data-folder="${selected}"]`).focus({ preventScroll: true });
  }

  function openYear() { location.hash = `#/chronology/${records[selected].year}`; }

  function navigate(year) {
    if (!root?.isConnected) return false;
    const dialog = root.querySelector("#chronicle-dialog");
    if (year === undefined) {
      if (dialog.open) dialog.close();
      return true;
    }
    const index = indexOf(year);
    if (index < 0) return false;
    choose(index);
    const record = records[selected];
    root.querySelector("#year-document").innerHTML = `<header class="year-document-heading"><div class="eyebrow">FEDERAL CHRONICLE / ${String(selected + 1).padStart(2, "0")}</div><div class="document-year">${record.year}<small>年</small></div><h2 id="year-document-title">${esc(record.summary)}</h2><p>联邦大事年纪 · 年度记录</p></header><div class="year-document-copy">${record.paragraphs.map(paragraph => `<p>${inline(paragraph).replace(/\n/g, "<br>")}</p>`).join("")}</div><p class="document-end">本年度记录结束 / END OF RECORD</p>`;
    root.querySelector("#document-position").textContent = `${record.year} / ${selected + 1} — ${records.length}`;
    root.querySelector("#chronicle-paper").scrollTop = 0;
    if (!dialog.open) {
      dialog.showModal();
      document.body.classList.add("chronicle-reading");
    }
    return true;
  }

  function destroy() {
    controller?.abort();
    const dialog = root?.querySelector("#chronicle-dialog");
    if (dialog?.open) dialog.close();
    document.body.classList.remove("chronicle-reading");
    root = null;
  }

  function mount(year) {
    root = document.querySelector("#chronicle");
    if (!root) return;
    controller = new AbortController();
    const options = { signal: controller.signal };
    const stage = root.querySelector("#folder-stage");
    const dialog = root.querySelector("#chronicle-dialog");
    let wheelTotal = 0;
    let lastWheel = 0;
    let lastTurn = -Infinity;
    stage.addEventListener("wheel", event => {
      if (event.ctrlKey || event.metaKey || !event.deltaY) return;
      const direction = Math.sign(event.deltaY);
      if ((direction < 0 && selected === 0) || (direction > 0 && selected === records.length - 1)) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheel > 180 || Math.sign(wheelTotal) !== direction) wheelTotal = 0;
      lastWheel = now;
      if (now - lastTurn < 240) return;
      wheelTotal += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
      if (Math.abs(wheelTotal) >= 48) {
        choose(selected + direction, stage.contains(document.activeElement));
        lastTurn = now;
        wheelTotal = 0;
      }
    }, { ...options, passive: false });
    stage.addEventListener("keydown", event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const shifts = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (event.key in shifts || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        choose(event.key === "Home" ? 0 : event.key === "End" ? records.length - 1 : selected + shifts[event.key], true);
      }
    }, options);
    root.addEventListener("click", event => {
      const folder = event.target.closest("[data-folder]");
      if (folder) {
        const index = Number(folder.dataset.folder);
        if (index === selected) openYear(); else choose(index, true);
      }
      const step = event.target.closest("[data-year-step]");
      if (step) choose(selected + Number(step.dataset.yearStep));
      const read = event.target.closest("[data-read-step]");
      if (read) { choose(selected + Number(read.dataset.readStep)); openYear(); }
    }, options);
    root.querySelector("#open-year").addEventListener("click", openYear, options);
    root.querySelector("#year-range").addEventListener("input", event => choose(Number(event.target.value)), options);
    root.querySelector("#year-jump").addEventListener("change", event => choose(Number(event.target.value)), options);
    root.querySelector("#close-year").addEventListener("click", () => dialog.close(), options);
    dialog.addEventListener("close", () => {
      document.body.classList.remove("chronicle-reading");
      if (/^#\/chronology\/[^/]+$/.test(location.hash)) location.hash = "#/chronology";
      root?.querySelector(`[data-folder="${selected}"]`)?.focus({ preventScroll: true });
    }, options);
    dialog.addEventListener("click", event => {
      const box = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
    }, options);
    choose(year === undefined ? selected : Math.max(0, indexOf(year)));
    navigate(year);
  }

  window.MIRROR_CHRONOLOGY = { page, mount, navigate, destroy, isMounted: () => Boolean(root?.isConnected) };
})();
