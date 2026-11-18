# 构建与验证

[首页](../../README.zh-CN.md) · [English](../en/verification.md) · [技术选型](architecture.md)

## 从干净的克隆构建

使用 Vite 支持的 Node.js 发行线，最低版本为 22.18。npm 根据锁文件安装指定版本。GitHub Actions 使用固定版本的 Playwright Ubuntu 24.04 镜像，其中包含 Node.js 24 和匹配版本的浏览器。

```sh
npm ci
npm test
npm run build:offline -- dist-offline/Watermark.html
npx playwright install chromium firefox webkit
npm run test:browser
```

干净的 Linux 环境可用 `npx playwright install --with-deps chromium firefox webkit` 同时安装浏览器的系统依赖。浏览器和 HTML 准备好之后，冒烟测试可断网运行。也可以直接用浏览器打开构建出的 HTML。

用 `npm run test:browser -- dist-offline/Watermark.html firefox` 单测一个浏览器。相同脚本也接受完整的 HTTPS 网址。测试环境允许网页文件本身的导航，并阻断其余 HTTP 和 HTTPS 请求。

## 验证覆盖范围

| 检查 | 验证方式 |
| --- | --- |
| JPEG 元数据 | 单测覆盖基线、渐进式和灰度图片，以及色度采样、ICC、两种 DPI 声明、方向、清除 EXIF、内嵌缩略图、损坏输入。浏览器实验分别用质量 100 和 72 导出并比较量化表，检查保留或清除 EXIF 后的参数，再重新打开导出的照片。 |
| PDF 内容 | 单测验证页面边界、旋转、原始压缩流、裁切、水印密度、加密标记和签名字段，绘图部分用画布替身。浏览器实验实际绘制文字，导出混合页面 PDF，比对原始流，并用 PDFium 读取原有文本。拒绝实验使用真实 AES-256 加密和包含测试自签名的 PDF。 |
| 预览和操作 | 浏览器测试检查照片预览随输入改变、PDF 自动更新且旧页保持可见。验证从平板竖屏切到横屏和手机宽度后的页码、按 Esc 和点空白关闭放大预览，以及 Chromium 的文件拖入。 |
| 保存和隐私 | 文件操作单测模拟原生选择器和目录句柄，检查源目录提示、命名冲突和写入失败。浏览器测试验证真实下载、结果名称、处理过程中的网络请求，以及刷新时清空编辑。 |
| 多语言 | 单测覆盖浏览器首选语言顺序、中文简繁匹配、英语兜底、字典键与占位符对齐，以及 Worker 错误的跨线程翻译。 |

首发本机验证使用 macOS 上的 Chromium **149.0.7827.55**、Firefox **151.0** 和 Playwright WebKit **26.5**。视口为 1440×900 电脑、834×1194 平板竖屏、1194×834 平板横屏及 390×844 手机。这些是浏览器模拟窗口。Playwright WebKit 测试浏览器与 Safari 应用分别运行。[冒烟测试源码](../../tests/browser-smoke.mjs) · [样本来源](../../tests/fixtures/README.md) · [CI 结果](https://github.com/kinoward/offline-watermark/actions/workflows/ci.yml)

## 核对公开版本

给 `main` 上的发布提交打版本标签后启动发行流程。工作流构建和检查一个 HTML，打包对应的 ImageMagick 源码，上传发行附件，再复制同一份 HTML 部署到项目 Pages 地址。Pages 来源选用 GitHub Actions，其环境规则允许发行标签部署。

```sh
curl -fLO https://github.com/kinoward/offline-watermark/releases/latest/download/Watermark.html
curl -fLO https://github.com/kinoward/offline-watermark/releases/latest/download/SHA256SUMS
curl -fsSL https://kinoward.github.io/offline-watermark/ -o Pages.html
shasum -a 256 Watermark.html Pages.html
```

两份 HTML 的哈希应与当前部署版本的 `SHA256SUMS` 中 `Watermark.html` 项一致。下载 `ImageMagick-WASM-source.tar.gz` 到同一目录后，可用 `shasum -a 256 -c SHA256SUMS` 核对完整附件。断开网络后打开 `Watermark.html`，分别给 JPEG 和多页 PDF 加水印并下载，再用未登录浏览器打开 Pages 地址。[发布工作流](../../.github/workflows/release.yml) · [ImageMagick 原生源码与重建](../../third-party/imagemagick/README.md)
