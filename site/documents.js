(() => {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[c]);
  // Parse only documented inline marks. Raw HTML is always escaped.
  function inline(text) {
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\s)]+\))/g;
    let result = "", cursor = 0;
    for (const match of String(text).matchAll(pattern)) {
      result += esc(text.slice(cursor, match.index));
      const token = match[0];
      if (token.startsWith("`")) result += `<code>${esc(token.slice(1, -1))}</code>`;
      else if (token.startsWith("**")) result += `<strong>${esc(token.slice(2, -2))}</strong>`;
      else if (token.startsWith("*")) result += `<em>${esc(token.slice(1, -1))}</em>`;
      else {
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        result += /^(https?:\/\/|#\/)/.test(link[2]) && text[match.index - 1] !== "!"
          ? `<a href="${esc(link[2])}">${esc(link[1])}</a>` : esc(token);
      }
      cursor = match.index + token.length;
    }
    return result + esc(text.slice(cursor));
  }
  function render(blocks) {
    return blocks.map(block => {
      switch (block.type) {
        case "heading": { const level = Math.min(4, Math.max(2, block.level)); return `<h${level}>${inline(block.text)}</h${level}>`; }
        case "paragraph": return `<p>${inline(block.text)}</p>`;
        case "quote": return `<blockquote><p>${inline(block.text)}</p></blockquote>`;
        case "code": return `<pre><code>${esc(block.text)}</code></pre>`;
        case "list": { const tag = block.ordered ? "ol" : "ul"; return `<${tag}>${block.items.map(item => `<li>${inline(item)}</li>`).join("")}</${tag}>`; }
        case "table": return `<div class="document-table" role="region" tabindex="0" aria-label="资料表格，可横向滚动"><table><thead><tr>${block.headers.map(cell => `<th scope="col">${inline(cell)}</th>`).join("")}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
        default: return "";
      }
    }).join("");
  }
  window.MIRROR_DOCUMENTS = { render };
})();
