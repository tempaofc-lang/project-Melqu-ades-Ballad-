# 梅尔基亚德斯的歌谣 · 镜公共档案

本仓库保存主稿、设定与视觉企划，并构建以广寒宫「镜」为主题的 GitHub Pages 站点。

## 网站结构

- `site/`：页面、样式与路由。`site/sections.json` 定义中英双语侧栏及各栏目的源目录、文件名前缀。
- `设定集/人物/`、`事件/`、`新闻/`、`技术/`、`地点/`、`组织/`：一条档案一个 Markdown 文件，构建时自动发现、按编号排序。新增、修改、删除无需编辑 JavaScript。
- [内容维护说明](设定集/内容维护说明.md)：命名规则、最简写法、可选档案字段、草稿、图片和扩展栏目接口；可复制 `设定集/条目模板/` 中对应模板。
- `设定集/关于我们/about_us.md`：关于我们唯一内容源，支持分节、强调、列表、引用和表格。
- `设定集/联邦大事年纪.md`：纪年唯一来源，按 `年份 · 简概` 与详细正文分块，可使用 `## 2040年 · 简概` 标题和 `---` 分隔。年份重复或正文为空会停止构建。
- `site/chronology.js`、`site/chronology.css`：倾斜文件夹与年度阅览窗口。滚轮、方向键、滑杆、下拉选择可切换年份；点击展开，Escape 关闭；`#/chronology/2050` 可直达年度。
- 条目默认纯文字。配图须在 Markdown 中明确填写图片元数据；纪年、新闻、技术继续关闭图片。
- `scripts/build_site.py`、`scripts/catalogue.py`：抽取三十章、解析年度与六栏档案，生成 `dist/` 中的内容数据与站点。`content.js` 是构建生成文件，不再手工维护。
- `.github/workflows/pages.yml`：`main` 上设定集、主稿、站点、脚本或封面更新后自动检查、构建、部署；拉取请求只检查，也可手动运行。失败时线上保留原版本。
- 等对应提交的 build 与 deploy 均成功后，刷新或切换栏目再返回以读取最新数据。阅读途中不会自动替换正文。
- CI 检查解析规则与桌面、手机交互；截图位于 `chronology-ui` 构件。浏览器依赖仅在 CI 安装，本地构建只用 Python 标准库。

## 本地预览

```bash
python scripts/build_site.py
cd dist
python -m http.server 8000
```

访问 `http://localhost:8000/`。站点只用原生 HTML、CSS、JavaScript 与 Python 标准库，无需安装依赖。导航采用 hash 路由，因此可以放在 GitHub Pages 的仓库子路径下。

## 发布设置

仓库管理员须在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。首次启用后，在 **Actions → Publish Mirror archive** 重新运行工作流；此后主稿与站点文件更新时会从 `main` 自动发布 `dist/`。工作流成功时的地址通常是 `https://tempaofc-lang.github.io/project-Melqu-ades-Ballad-/`，以 Pages 页面给出的实际地址为准。

视觉资产制作规则见 `视觉企划/00_视觉总纲.md` 与 `视觉企划/01_视觉策划书.md`。
