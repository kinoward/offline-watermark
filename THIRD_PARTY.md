# Third-party software and samples / 第三方组件与样本

The [MIT License](LICENSE) applies to Watermark’s original code and documentation. The following notices apply to code and assets shipped in the app. The standalone HTML carries these notices in its source under `id="third-party-licenses"`. Its header identifies the release that supplies the corresponding ImageMagick source archive.

[MIT 许可证](LICENSE)适用于 Watermark 原创代码和文档。下表列出随应用分发的代码与素材。单文件 HTML 的源码中，`id="third-party-licenses"` 下包含这些声明，文件顶部标明可下载对应 ImageMagick 源码包的发行版本。

| Component / 组件 | Version / 版本 | Use and notice / 用途与声明 |
| --- | --- | --- |
| [ImageMagick WASM](https://github.com/dlemstra/magick-wasm/tree/137a421b5d5f87747fb2d411c6c7d6db95e6065f) | 0.0.46 | JPEG 编解码 / JPEG codec. [Apache-2.0](public/licenses/ImageMagick-WASM.txt) · [ImageMagick 7.1.2-35 and native library notices](public/licenses/ImageMagick-NOTICE.txt) · [Emscripten](public/licenses/ImageMagick-emscripten.txt) · [Source and rebuild](third-party/imagemagick/README.md) |
| [PDFium wrapper](https://github.com/hyzyla/pdfium/tree/c60c75d08051454f0deadf093ffdb948aa179888) | 3.0.0, PDFium build [8046d](https://github.com/paulocoutinhox/pdfium-lib/releases/tag/8046d) | PDF 页面预览 / Page rendering. [Wrapper MIT](public/licenses/pdfium-wrapper.txt) · [Native notices](public/licenses/pdfium-third-party.txt) |
| [pdf-lib](https://github.com/Hopding/pdf-lib) and [standard fonts](https://github.com/Hopding/standard-fonts) | 1.17.1 and 1.0.0 | PDF 写入 / PDF writing. [pdf-lib MIT](public/licenses/pdf-lib.txt) · [Standard fonts MIT](public/licenses/pdf-lib-standard-fonts.txt) |
| [UPNG](https://github.com/Hopding/upng) | 1.0.1 | PNG 编码兼容路径 / PNG encoding fallback. [MIT](public/licenses/pdf-lib-upng.txt) |
| [pako](https://github.com/nodeca/pako/tree/1.0.11) | 1.0.11 | PDF 与内部 PNG 的压缩 / Compression in PDF and internal PNG code. [MIT](public/licenses/pako.txt) · [Zlib port](public/licenses/pako-zlib.txt) |
| [tslib](https://github.com/microsoft/tslib) | 1.14.1 | TypeScript 辅助代码 / TypeScript helpers. [Notice](public/licenses/tslib.txt) |

The sample artwork is original. The [proof of enrollment](docs/assets/enrollment-sample.jpg) shown in the README uses a fictional school, student and record number. The JPEG test photos use generated pixels. The progressive test image embeds the CC0 sRGB-v4 ICC profile from [Compact ICC Profiles](https://github.com/saucecontrol/Compact-ICC-Profiles). The PDF samples use generated content, including a test-only self-signed certificate for the signed fixture. [Sample provenance](tests/fixtures/README.md)

样张美术为项目原创。README 展示的[在读证明](docs/assets/enrollment-sample.jpg)使用虚构的院校、学生和学籍编号。JPEG 夹具中的像素由程序生成，渐进式测试图内含 [Compact ICC Profiles](https://github.com/saucecontrol/Compact-ICC-Profiles) 的 CC0 sRGB-v4 配置。PDF 样本内容由程序生成，签名样本使用测试用途的自签名证书。[样本来源](tests/fixtures/README.md)
