<h1 align="center"><img src="docs/assets/watermark.svg" width="32" height="32" alt=""> Watermark</h1>

<p align="center">分享照片或 PDF 前，给副本加上平铺文字水印。<br>
一个 HTML 文件，本地处理，断网可用。</p>

<p align="center">
  <strong><a href="https://kinoward.github.io/offline-watermark/">在线使用</a></strong> &nbsp;·&nbsp;
  <strong><a href="https://github.com/kinoward/offline-watermark/releases/latest/download/Watermark.html">下载离线 HTML</a></strong> &nbsp;·&nbsp;
  <a href="docs/zh-CN/architecture.md">阅读技术实现</a>
</p>

<p align="center">
  <a href="https://github.com/kinoward/offline-watermark/releases/latest"><img src="https://img.shields.io/github/v/release/kinoward/offline-watermark?label=release&amp;labelColor=34332f&amp;color=80521e" alt="最新发行版本"></a>
  <a href="https://github.com/kinoward/offline-watermark"><img src="https://img.shields.io/github/stars/kinoward/offline-watermark?style=flat&amp;label=stars&amp;labelColor=34332f&amp;color=376658" alt="GitHub Star 数量"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kinoward/offline-watermark?label=license&amp;labelColor=34332f&amp;color=4b5966" alt="项目许可证 MIT"></a>
</p>

<p align="center"><a href="README.md" lang="en">English</a> · <strong>简体中文</strong></p>

![同一幅海岸等高线图的局部，左侧为原始 JPEG，右侧是叠加斜向 REVIEW COPY 水印的导出副本](docs/assets/watermark-comparison.jpg)

<p align="center"><em>左为 JPEG 原图，右为加水印后的同一处细节。</em></p>

## 快速上手

1. **打开文件。** 在线使用，或用浏览器打开已下载的 `Watermark.html`。每次选择一个 JPG、JPEG 或 PDF。
2. **调整水印。** 输入一行或多行文字，边看预览边调整大小、密度和透明度。文字会逐行错开，形成砖形平铺。手机上可轻点缩略图放大查看。
3. **保存副本。** 选好文件名，点击 **生成水印**，然后 **下载文件**。支持目录访问的浏览器还可选择 **保存到文件夹**。副本沿用原扩展名，默认名称类似 `海岸_水印版_01.jpg`。

<details>
<summary>查看桌面、平板和手机界面</summary>

![桌面编辑器左侧预览已加水印的海岸地图，右侧调整水印文字和导出设置](docs/assets/desktop.jpg)

桌面端支持拖入文件，平板上可以一边翻阅 PDF 一边调整水印，手机上则把设置放在小预览下方。[平板截图](docs/assets/tablet.jpg) · [手机截图](docs/assets/phone.jpg)

</details>

## 导出细节

- **JPG 和 JPEG** 会按所选质量重新编码。工具会核对像素尺寸、色彩配置、分辨率、色度采样，以及基线或渐进编码模式。即使质量设为 100，文件大小和压缩率也可能变化。启用 **清除 EXIF 信息** 时，工具先按照片的方向标记旋转或翻转像素，再移除 EXIF。
- **PDF** 的每一页都会加上平铺水印，保留原有纸张大小、旋转角度和可搜索的正文。处理加密或带数字签名的 PDF 时，请打开已解密、未签名的副本。

### 隐私与语言

文件和设置只保存在页面内存里，刷新即清空。在线版由 GitHub Pages 提供，GitHub 会记录访客 IP。如需全程断网使用，先下载 HTML，再从本地打开即可。[GitHub Pages 数据收集说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)

界面会根据浏览器语言偏好自动选择，也可手动切换简体中文、繁體中文、English、日本語、한국어、Español、Français 和 Русский。

## 从源码构建

使用 Vite 支持的 Node.js 发行线，最低版本为 **22.18**。在仓库根目录运行以下命令。

```sh
npm ci
npm run build:offline -- dist-offline/Watermark.html
```

用浏览器直接打开 `dist-offline/Watermark.html`。架构文档解释了 TypeScript、Web Worker、ImageMagick WASM、pdf-lib 和 PDFium 如何组合成这份单文件应用。[应用源码](src/) · [架构与技术选型](docs/zh-CN/architecture.md) · [构建与分发](docs/zh-CN/verification.md) · [测试指南](tests/README.zh-CN.md)

## 许可证

Watermark 的原创代码和文档采用 MIT。HTML 内含带 LGPL 库的 ImageMagick WASM 和其他独立授权的组件。每个 Release 都附带对应的 ImageMagick 源码包及重建说明。[MIT 许可证](LICENSE) · [第三方声明](THIRD_PARTY.md) · [发行列表](https://github.com/kinoward/offline-watermark/releases)
