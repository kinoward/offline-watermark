<h1 align="center"><img src="docs/assets/watermark.svg" width="32" height="32" alt=""> Watermark</h1>

<p align="center">分享照片或 PDF 前，给副本加上平铺文字水印。<br>
一个 HTML 文件，本地处理，断网可用。</p>

<p align="center">
  <strong><a href="https://kinoward.github.io/offline-watermark/">在线使用</a></strong> &nbsp;·&nbsp;
  <strong><a href="https://github.com/kinoward/offline-watermark/releases/latest/download/Watermark.html">下载离线 HTML</a></strong> &nbsp;·&nbsp;
  <a href="docs/zh-CN/architecture.md">阅读技术实现</a>
</p>

<p align="center"><a href="README.md" lang="en">English</a> · <strong>简体中文</strong></p>

<p align="center">
  <a href="#贡献者"><img src="https://img.shields.io/badge/%E4%BD%9C%E8%80%85-Kino%20Ward-725981?style=flat&amp;labelColor=34332f&amp;logo=github&amp;logoColor=white" height="20" alt="作者 Kino Ward"></a>
  <a href="#star-历史"><img src="https://img.shields.io/github/stars/kinoward/offline-watermark?style=flat&amp;labelColor=34332f&amp;label=Stars&amp;color=946019" height="20" alt="当前 GitHub Star 数量，点击查看历史趋势"></a>
</p>

<p align="center">
  <a href="https://github.com/kinoward/offline-watermark/releases/latest"><img src="https://img.shields.io/github/v/release/kinoward/offline-watermark?style=flat&amp;labelColor=34332f&amp;label=%E7%89%88%E6%9C%AC&amp;color=3d6758" height="20" alt="最新发行版本"></a>
  <a href="#快速上手"><img src="https://img.shields.io/badge/%E7%A6%BB%E7%BA%BF-%E5%8D%95%E4%B8%AA%20HTML-795725?style=flat&amp;labelColor=34332f" height="20" alt="单 HTML 文件，断网可用"></a>
  <a href="#开源许可"><img src="https://img.shields.io/github/license/kinoward/offline-watermark?style=flat&amp;labelColor=34332f&amp;label=%E8%AE%B8%E5%8F%AF&amp;color=53616c" height="20" alt="原创代码与文档采用 MIT 许可证"></a>
  <br>
  <a href="#导出细节"><img src="https://img.shields.io/badge/%E6%A0%BC%E5%BC%8F-JPEG%20%2B%20PDF-88512f?style=flat&amp;labelColor=34332f" height="20" alt="支持 JPG、JPEG、PDF"></a>
  <a href="docs/zh-CN/architecture.md"><img src="https://img.shields.io/badge/TypeScript-WASM-325e85?style=flat&amp;labelColor=34332f&amp;logo=typescript&amp;logoColor=white" height="20" alt="使用 TypeScript 和 WebAssembly 构建"></a>
  <a href="#隐私与语言"><img src="https://img.shields.io/badge/%E7%95%8C%E9%9D%A2-8%20%E7%A7%8D%E8%AF%AD%E8%A8%80-426266?style=flat&amp;labelColor=34332f" height="20" alt="八种界面语言"></a>
</p>

![同一幅海岸等高线图的局部，左侧为原始 JPEG，右侧是叠加斜向 REVIEW COPY 水印的导出副本](docs/assets/watermark-comparison.jpg)

<p align="center"><em>左为 JPEG 原图，右为加水印后的同一处细节。</em></p>

<p align="center">
  <a href="#快速上手">快速上手</a> · <a href="#导出细节">导出细节</a> · <a href="#从源码构建">从源码构建</a> · <a href="#贡献者">贡献者</a> · <a href="#开源许可">开源许可</a>
</p>

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

<a name="贡献者与许可"></a>

## 贡献者

<p>
  <img src="https://github.com/kinoward.png?size=96" width="40" height="40" align="middle" alt="">
  &nbsp; <strong>Kino Ward</strong> · <a href="https://github.com/kinoward">@kinoward</a> · Watermark 作者
</p>

[全部贡献者](https://github.com/kinoward/offline-watermark/graphs/contributors) · [反馈问题](https://github.com/kinoward/offline-watermark/issues)

## Star 历史

<p align="center">
  <a href="https://www.star-history.com/?repos=kinoward%2Foffline-watermark&amp;type=date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=kinoward/offline-watermark&amp;type=date&amp;legend=top-left&amp;theme=dark">
      <img src="https://api.star-history.com/chart?repos=kinoward/offline-watermark&amp;type=date&amp;legend=top-left" width="680" alt="Watermark 在 GitHub 上的 Star 数量随时间的变化">
    </picture>
  </a>
</p>

只有一个日期有 Star 记录时，图中只显示一个点。随着更多日期有了记录，就能看到趋势线。[查看交互图表](https://www.star-history.com/?repos=kinoward%2Foffline-watermark&type=date)

## 开源许可

**原创代码与文档。** MIT 许可证允许个人使用和商业使用，也允许修改、分发和销售 Watermark。分发本软件的副本或其中的实质性部分时，须保留版权声明（© 2026 Watermark contributors）和许可声明。软件按现状提供，不附带担保。许可证也载明了作者和版权持有人的责任限制。[MIT 许可证全文](LICENSE)

**分发离线 HTML。** JPEG 和 PDF 处理库各有自己的许可条款。打开 `Watermark.html` 的源码并搜索 `third-party-licenses`，即可查看随附声明。ImageMagick WASM 静态链接了多个 LGPL 库。HTML 文件顶部标有对应的发行版本，可从该版本下载 `ImageMagick-WASM-source.tar.gz`，取得匹配的源码以及重建、替换模块的说明。[第三方许可清单](THIRD_PARTY.md) · [重建说明](third-party/imagemagick/README.md) · [各版本发行附件](https://github.com/kinoward/offline-watermark/releases)
