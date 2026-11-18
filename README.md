<h1 align="center"><img src="docs/assets/watermark.svg" width="32" height="32" alt=""> Watermark</h1>

<p align="center">Add a repeating text watermark to a JPEG or PDF.<br>
One HTML file runs offline. Your files stay on your device.</p>

<p align="center">
  <strong><a href="https://kinoward.github.io/offline-watermark/">Open app</a></strong> &nbsp;·&nbsp;
  <strong><a href="https://github.com/kinoward/offline-watermark/releases/latest/download/Watermark.html">Download HTML</a></strong> &nbsp;·&nbsp;
  <a href="docs/en/architecture.md">How it works</a>
</p>

<p align="center"><strong>English</strong> · <a href="README.zh-CN.md" lang="zh-CN">简体中文</a></p>

<p align="center">
  <a href="#contributors"><img src="https://img.shields.io/badge/Author-Kino%20Ward-725981?style=flat&amp;labelColor=34332f&amp;logo=github&amp;logoColor=white" height="20" alt="Author: Kino Ward"></a>
  <a href="#star-history"><img src="https://img.shields.io/github/stars/kinoward/offline-watermark?style=flat&amp;labelColor=34332f&amp;label=Stars&amp;color=946019" height="20" alt="Current GitHub star count. View star history."></a>
</p>

<p align="center">
  <a href="https://github.com/kinoward/offline-watermark/releases/latest"><img src="https://img.shields.io/github/v/release/kinoward/offline-watermark?style=flat&amp;labelColor=34332f&amp;label=Release&amp;color=3d6758" height="20" alt="Latest release"></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/Offline-Single%20HTML-795725?style=flat&amp;labelColor=34332f" height="20" alt="Runs offline as one HTML file"></a>
  <a href="#license"><img src="https://img.shields.io/github/license/kinoward/offline-watermark?style=flat&amp;labelColor=34332f&amp;label=License&amp;color=53616c" height="20" alt="Original code and documentation: MIT"></a>
  <br>
  <a href="#export-details"><img src="https://img.shields.io/badge/Files-JPEG%20%2B%20PDF-88512f?style=flat&amp;labelColor=34332f" height="20" alt="Supported formats: JPG, JPEG and PDF"></a>
  <a href="docs/en/architecture.md"><img src="https://img.shields.io/badge/TypeScript-WASM-325e85?style=flat&amp;labelColor=34332f&amp;logo=typescript&amp;logoColor=white" height="20" alt="Built with TypeScript and WebAssembly"></a>
  <a href="#privacy-and-languages"><img src="https://img.shields.io/badge/UI-8%20languages-426266?style=flat&amp;labelColor=34332f" height="20" alt="Eight interface languages"></a>
</p>

![The same detail from a coastal map, first as the original JPEG and then exported with a diagonal REVIEW COPY watermark](docs/assets/watermark-comparison.jpg)

<p align="center"><em>Original JPEG (left) · Watermarked export (right)</em></p>

<p align="center">
  <a href="#quick-start">Quick start</a> · <a href="#export-details">Export details</a> · <a href="#build-from-source">Build</a> · <a href="#contributors">Contributors</a> · <a href="#license">License</a>
</p>

## Quick start

1. **Open a file.** Launch the web app or double-click the downloaded `Watermark.html` in a recent browser. Choose one JPG, JPEG or PDF.
2. **Set the watermark.** Type one or more lines of text. Adjust size, density and opacity to see the brick pattern update in the preview. On a phone, tap the thumbnail for a closer look.
3. **Save a copy.** Choose a filename, select **Apply watermark**, then **Download**. Browsers with directory access also offer **Save to folder**. The copy keeps the original extension and defaults to a name such as `coast_水印版_01.jpg`.

<details>
<summary>See the editor on desktop, tablet and phone</summary>

![Desktop editor with the watermarked coastal map on the left and text and export settings on the right](docs/assets/desktop.jpg)

On desktop, drag a file onto the workbench. On tablet, turn PDF pages while editing. On phones, the settings sit below a compact preview. [Tablet screenshot](docs/assets/tablet.jpg) · [Phone screenshot](docs/assets/phone.jpg)

</details>

## Export details

- **JPG and JPEG** are re-encoded at the quality you choose. Watermark checks dimensions, color profile, resolution, chroma sampling and baseline or progressive mode. File size and compression ratio can change, even at quality 100. **Remove EXIF data** applies the photo’s orientation to its pixels before clearing EXIF.
- **PDF** gets a tiled watermark on every page. Page sizes, rotations and existing searchable text are preserved. For an encrypted or digitally signed PDF, open a decrypted, unsigned copy.

### Privacy and languages

Files and settings stay in page memory. Refreshing clears the session. Opening the hosted app loads it from GitHub Pages, which logs visitor IP addresses. For a fully offline session, download the HTML first and then open it from disk. [GitHub Pages privacy information](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)

The interface starts in your browser’s preferred supported language. You can switch between English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français and Русский.

## Build from source

Use Node.js **22.18 or later** on a Vite-supported release line. Run these commands from the repository root.

```sh
npm ci
npm run build:offline -- dist-offline/Watermark.html
```

Open `dist-offline/Watermark.html` directly in your browser. The architecture guide explains how TypeScript, Web Workers, ImageMagick WASM, pdf-lib and PDFium fit into one file. [Source code](src/) · [Architecture](docs/en/architecture.md) · [Build and distribution](docs/en/verification.md) · [Testing](tests/README.md)

<a name="contributors-and-license"></a>

## Contributors

<p>
  <img src="https://github.com/kinoward.png?size=96" width="40" height="40" align="middle" alt="">
  &nbsp; <strong>Kino Ward</strong> · <a href="https://github.com/kinoward">@kinoward</a> · Creator of Watermark
</p>

[All contributors](https://github.com/kinoward/offline-watermark/graphs/contributors) · [Report an issue](https://github.com/kinoward/offline-watermark/issues)

## Star history

<p align="center">
  <a href="https://www.star-history.com/?repos=kinoward%2Foffline-watermark&amp;type=date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=kinoward/offline-watermark&amp;type=date&amp;legend=top-left&amp;theme=dark">
      <img src="https://api.star-history.com/chart?repos=kinoward/offline-watermark&amp;type=date&amp;legend=top-left" width="680" alt="GitHub stars for Watermark over time">
    </picture>
  </a>
</p>

With stars on only one date, the chart shows a point. Stars on later dates give it a trend line. [Explore the interactive chart](https://www.star-history.com/?repos=kinoward%2Foffline-watermark&type=date)

## License

**Original code and documentation.** The MIT License permits personal and commercial use. You can modify Watermark, distribute it and sell copies. Keep the copyright notice (© 2026 Watermark contributors) and the permission notice in all copies or substantial portions. The software comes without warranty. The license also limits the liability of the authors and copyright holders. [Full MIT license](LICENSE)

**Redistributing the offline HTML.** The JPEG and PDF libraries have their own terms. `Watermark.html` includes their notices in its source under `third-party-licenses`. ImageMagick WASM statically links several LGPL libraries. The release identified at the top of the HTML provides the matching `ImageMagick-WASM-source.tar.gz` archive with the sources and instructions to rebuild and replace the module. [Third-party notices](THIRD_PARTY.md) · [Rebuild instructions](third-party/imagemagick/README.md) · [Release archives](https://github.com/kinoward/offline-watermark/releases)
