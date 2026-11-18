# Watermark

在浏览器里为 JPG、JPEG 或 PDF 平铺文字水印。每次处理一个文件，另存一份加好水印的副本。

**[在线使用](https://kinoward.github.io/offline-watermark/)** · **[下载离线 HTML](https://github.com/kinoward/offline-watermark/releases/latest/download/Watermark.html)** · **[阅读技术实现](docs/zh-CN/architecture.md)** · [English](README.md)

![Watermark 桌面界面，左侧是加好水印的 JPEG 图片，右侧是水印设置](docs/assets/desktop.jpg)

## 给文件加水印

1. 打开网页，或者下载 `Watermark.html` 后用较新版浏览器打开。下载的 HTML 可以独立断网运行。
2. 添加一个 JPG、JPEG 或 PDF。输入单行或多行文字，边预览边调节大小、密度和透明度。
3. 设置导出文件名，点击 **生成水印**，然后 **下载文件**。在支持目录访问的浏览器中，也可以选择 **保存到文件夹**。

默认文件名为 `原名_水印版_01.ext`，扩展名保留原大小写。手机上可点缩略图放大。平板可一边翻阅 PDF 一边编辑水印。[手机界面](docs/assets/phone.jpg) · [平板界面](docs/assets/tablet.jpg)

| 导入格式 | 导出行为 |
| --- | --- |
| JPG 或 JPEG | 按选定质量重新编码，核对像素尺寸、色彩配置、色度采样和编码模式。启用 **清除 EXIF 信息** 时，先把原方向应用到像素，再移除 EXIF。JPEG 文件大小和压缩率可能变化。 |
| PDF | 每页叠加平铺水印，原有文字仍可选择和搜索。加密或含数字签名的 PDF 请使用已解密的未签名副本。 |

Watermark 在浏览器里处理文件，刷新会清空任务与设置。在线版由 GitHub Pages 托管，GitHub 会记录访客 IP。全程断网使用时，打开已下载的 HTML 即可。界面根据浏览器语言初始化，支持简体中文、繁體中文、English、日本語、한국어、Español、Français 和 Русский。[GitHub Pages 数据收集说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)

## 构建和阅读源码

使用 Vite 支持的 Node.js 发行线，最低版本为 **22.18**。GitHub Actions 使用 Node.js 24。

```sh
npm ci
npm run build:offline -- dist-offline/Watermark.html
```

用浏览器直接打开 `dist-offline/Watermark.html`。

[应用源码](src/) · [架构与技术选型](docs/zh-CN/architecture.md) · [构建与分发](docs/zh-CN/verification.md) · [测试指南](tests/README.zh-CN.md)

## 许可证

Watermark 的原创代码和文档采用 MIT。HTML 内含带 LGPL 库的 ImageMagick WASM 和其他独立授权的组件。每个 Release 都附带对应的 ImageMagick 源码包及重建说明。[MIT 许可证](LICENSE) · [第三方声明](THIRD_PARTY.md) · [发行列表](https://github.com/kinoward/offline-watermark/releases)
