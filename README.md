# 梅尔基亚德斯的歌谣 · 镜公共档案

本仓库保存主稿、设定与视觉企划，并构建以广寒宫「镜」为主题的 GitHub Pages 站点。

## 网站结构

- `site/`：页面、样式、路由和各栏目的公众文案。
- `site/content.js`：侧栏栏目与档案卡片的数据入口。为 `sections` 增加栏目、在 `entries` 添加同名数组即可出现列表与详情页；「关于我们」与「纪年」有单独版式。
- `设定集/联邦大事年纪.md`：纪年栏目的唯一数据源，按 `年份 · 简概` 与详细正文分块，可使用 `## 2040年 · 简概` 标题和 `---` 分隔。构建时按年份排序生成 `dist/data/chronology.json`，同一年重复或正文为空会停止构建。更新此文件会自动发布纪年页。
- `site/chronology.js`、`site/chronology.css`：倾斜文件夹堆叠与年度阅览窗口。滚轮、方向键、年份滑杆和下拉选择可切换年份；点击当前文件夹展开，Escape 关闭；`#/chronology/2050` 可直接访问对应年度。正文依源文件呈现，简介不再由旧的手写纪年卡片提供。
- `site/content.js` 中各条目默认只有文字，没有图片或图片占位。明确需要配图时增加 `media: { src: "assets/文件名", alt: "图像说明" }`，并将文件放入 `site/assets/`；若已规划图片但尚未制作，可只提供 `media: { alt: "图像说明" }` 以显示占位。纪年、新闻、技术三个栏目设置了 `mediaEnabled: false`，不会显示图片；如未来需要配图，须先调整栏目配置。
- `scripts/build_site.py`：从根目录主稿 Markdown 抽取三十章，生成 `dist/data/chapters/*.json` 与目录，并复制 `封面.png`。章节正文取自主稿，资料页介绍文案为独立撰写。
- `.github/workflows/pages.yml`：主分支相关文件更新时自动构建并发布；拉取请求只构建检查；也可手动运行。
- 发布前检查纪年格式及桌面、手机浏览器交互，截图保存在工作流的 `chronology-ui` 构件中。浏览器检查依赖仅在 CI 中安装，站点和本地构建仍无需安装依赖。

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
