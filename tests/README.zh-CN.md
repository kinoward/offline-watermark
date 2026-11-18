# Watermark 测试指南

[English](README.md) · [首页](../README.zh-CN.md) · [构建说明](../docs/zh-CN/verification.md)

## 为什么保留测试

有些导出问题很难从水印预览中发现。JPEG 可能看起来正常，却仍带有用户要求清除的 EXIF。把 PDF 页面转成图片也能保留版面，但会使原有正文失去可搜索性。因此，测试会读取导出文件，检查 EXIF 是否已清除、照片方向是否正确，以及 PDF 原有正文能否提取。浏览器测试还会在阻断 HTTP 和 HTTPS 请求后打开本地 HTML，实际导出 JPEG 和 PDF，验证用户下载的成品可以离线使用。

新增测试时，优先覆盖已修复且可能复发的问题，或文件保真、隐私和离线使用中容易被忽略的要求。只调整间距、配色或普通文案时，直接预览即可。

## 按改动选择检查

| 改动 | 检查内容 |
| --- | --- |
| 仅修改文档或截图 | 跳过应用 CI。 |
| 修改应用代码、测试或构建输入 | 运行 Node 单测并构建离线 HTML。构建命令包含 TypeScript 类型检查。 |
| 改动影响浏览器行为 | 用同一份 HTML 加跑 Chromium 冒烟测试，实际导出 JPEG 和 PDF。 |
| 推送发行标签（`v*`） | 运行 Node 单测，构建一次，再用 Chromium、Firefox 和 WebKit 检查这份文件，通过后发布。 |

推送到 `main` 或发起拉取请求时，CI 使用 Ubuntu 24.04 和 Node.js 24。修改应用、浏览器测试或样本、离线打包脚本、npm 清单或锁文件、TypeScript 或 Vite 配置、工作流时，加跑 Chromium。仅修改单测时，运行 Node 单测并构建 HTML。发版使用内含三个浏览器的固定版本 Playwright 镜像。[日常 CI 配置](../.github/workflows/ci.yml) · [发行流程](../.github/workflows/release.yml)

## 本地运行

在仓库根目录运行以下命令。使用 Vite 支持的 Node.js 发行线，最低版本为 22.18。单测使用 Node 内置测试运行器，可以在构建 HTML 前执行。

```sh
npm ci
npm test
npm run build:offline -- dist-offline/Watermark.html
```

平时验证浏览器行为时，先安装一次 Chromium 的无界面版本，然后测试刚构建的文件。

```sh
npx playwright install --only-shell chromium
npm run test:browser -- dist-offline/Watermark.html chromium
```

复现发行检查时，一次性安装三个浏览器，再对同一份 HTML 运行完整测试。

```sh
npx playwright install chromium firefox webkit
npm run test:browser
```

初次配置 Linux 时，可在安装命令中加入 `--with-deps` 来安装浏览器所需的系统库。把单浏览器命令末尾的 `chromium` 换成 `firefox` 或 `webkit` 可单独验证对应引擎。本地 HTML 通过 `file://` 打开，测试会阻断 HTTP 和 HTTPS 请求。也可用完整 HTTPS 网址替换文件路径，此时仅允许导航到该页面，并检查是否产生额外网络请求。

## 覆盖范围

| 范围 | Node 单测 | 浏览器冒烟测试 |
| --- | --- | --- |
| JPEG | 验证基线、渐进及灰度图片、采样、ICC、JFIF 与 EXIF 中的密度、方向、缩略图和损坏输入。[JPEG 测试](unit/jpeg.test.mjs) | 比较质量 100 和 72 的量化表，检查保留与清除 EXIF 后的元数据，实际下载并重新导入照片。 |
| PDF | 用画布替身检查页面边界、旋转、原始压缩流、裁切、图块密度、加密和签名。[PDF 测试](unit/pdf.test.mjs) | 实际绘制文字、导出混合尺寸 PDF，比对原始流，用 PDFium 提取可搜索正文，并检查加密与签名提示。 |
| 预览与布局 | | 修改多行文字后检查图片和 PDF 预览，改变视口方向后核对页码，用 Esc 或点击背景关闭移动端弹窗，并在 Chromium 检查拖入文件。 |
| 文件保存与隐私 | 模拟文件选择器和目录句柄，检查源目录提示、命名冲突和写入失败。[文件操作测试](unit/file-io.test.mjs) | 实际下载成品，核对文件名，检查运行中的网络请求，并验证刷新会清空任务。 |
| 多语言 | 检查浏览器语言顺序、中文简繁匹配、英语回退、翻译键及参数，以及 Worker 错误消息。[语言测试](unit/i18n.test.mjs) | |

浏览器测试在同一份 HTML 上跑桌面 JPEG 流程和触屏布局的 PDF 流程。PDF 样本包含一份 AES-256 加密文件和一份使用测试证书签名的文件。[浏览器测试代码](browser/smoke.mjs) · [样本来源](fixtures/README.md)

## 首发验证记录

v1.0.0 首发时在 macOS 上验证了 Chromium **149.0.7827.55**、Firefox **151.0** 和 Playwright WebKit **26.5**。模拟视口为 1440×900（桌面）、834×1194 和 1194×834（平板）、390×844（手机）。这组数据来自浏览器模拟，真机和 Safari 应用需要单独验证。[v1.0.0 发行记录](https://github.com/kinoward/offline-watermark/actions/runs/44333307055)

## 校验公开下载

在空目录中下载 Release 与 Pages 的 HTML。两者的哈希值都应与已部署版本的 `SHA256SUMS` 中 `Watermark.html` 一项相同。

```sh
curl -fLO https://github.com/kinoward/offline-watermark/releases/latest/download/Watermark.html
curl -fLO https://github.com/kinoward/offline-watermark/releases/latest/download/SHA256SUMS
curl -fsSL https://kinoward.github.io/offline-watermark/ -o Pages.html
shasum -a 256 Watermark.html Pages.html
cat SHA256SUMS
```

下载 `ImageMagick-WASM-source.tar.gz` 到同一目录后，运行 `shasum -a 256 -c SHA256SUMS` 可核对完整附件。手工检查离线行为时，断网打开已下载的 HTML，分别导出 JPEG 和多页 PDF。用未登录的浏览器打开 Pages 网址，可确认公开访问正常。
