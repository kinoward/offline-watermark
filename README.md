<h1 align="center"><img src="docs/assets/watermark.svg" width="32" height="32" alt=""> Watermark</h1>

<p align="center">Add a repeating text watermark to a JPEG or PDF.<br>
One HTML file runs offline. Your files stay on your device.</p>

<p align="center"><strong>English</strong> · <a href="README.zh-CN.md" lang="zh-CN">简体中文</a></p>

<p align="center">
  <a href="#contributors"><img src="https://img.shields.io/badge/Author-Kino%20Ward-6B50A1?style=flat&amp;labelColor=293747&amp;logo=github&amp;logoColor=white" height="22" alt="Author: Kino Ward"></a>
  <a href="#star-history"><img src="https://img.shields.io/github/stars/kinoward/offline-watermark?style=flat&amp;labelColor=293747&amp;label=Stars&amp;color=00749D" height="22" alt="Current GitHub star count. View star history."></a>
</p>

<p align="center">
  <a href="https://github.com/kinoward/offline-watermark/releases/latest"><img src="https://img.shields.io/github/v/release/kinoward/offline-watermark?style=flat&amp;labelColor=293747&amp;label=Release&amp;color=186594&amp;logo=semver&amp;logoColor=white" height="22" alt="Latest release"></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/Offline-HTML-A44926?style=flat&amp;labelColor=293747&amp;logo=html5&amp;logoColor=white" height="22" alt="Runs offline as one HTML file"></a>
  <a href="#license"><img src="https://img.shields.io/github/license/kinoward/offline-watermark?style=flat&amp;labelColor=293747&amp;label=License&amp;color=157460" height="22" alt="Original code and documentation: MIT"></a>
  <br>
  <a href="#export-details"><img src="https://img.shields.io/badge/Files-JPG%20%2F%20PDF-92415B?style=flat&amp;labelColor=293747" height="22" alt="Supported formats: JPG, JPEG and PDF"></a>
  <a href="docs/en/architecture.md"><img src="https://img.shields.io/badge/TypeScript-WASM-4655A0?style=flat&amp;labelColor=293747&amp;logo=typescript&amp;logoColor=white" height="22" alt="Built with TypeScript and WebAssembly"></a>
  <a href="#privacy-and-languages"><img src="https://img.shields.io/badge/Languages-8-106F78?style=flat&amp;labelColor=293747" height="22" alt="Eight interface languages"></a>
</p>

<p align="center">
  <a href="https://kinoward.github.io/offline-watermark/">Open app</a> ·
  <a href="https://github.com/kinoward/offline-watermark/releases/latest/download/Watermark.html">Download HTML</a> ·
  <a href="docs/en/architecture.md">Internals</a>
</p>

![The same detail from a coastal map, first as the original JPEG and then exported with a diagonal REVIEW COPY watermark](docs/assets/watermark-comparison.jpg)

<p align="center"><em>Original JPEG (left) · Watermarked export (right)</em></p>

<p align="center">
  <a href="#quick-start">Quick start</a> · <a href="#export-details">Export</a> · <a href="#build-from-source">Build</a> · <a href="#contributors">Contributors</a> · <a href="#license">License</a>
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

## How it works

**One HTML file contains the editor and its processing engines.** The browser unpacks them as needed. A Web Worker handles the export while you use the interface. Preview and export share the same layout rules. Every other row shifts by half a tile to create the brick pattern.

### Export details

| File | How Watermark adds the text | What carries over |
| --- | --- | --- |
| **JPEG** | ImageMagick runs in WebAssembly, draws the watermark at the photo’s resolution and re-encodes it at the selected quality. | Watermark checks dimensions, color profile, resolution, chroma sampling and baseline or progressive encoding. File size can change even at quality 100. |
| **PDF** | pdf-lib adds the transparent tile to each page. The browser or PDFium renders the preview. | Page sizes, rotations, original image streams and existing searchable text are preserved. |

**Remove EXIF data** applies a JPEG’s stored orientation to its pixels before stripping EXIF. For an encrypted or digitally signed PDF, open a decrypted, unsigned copy.

[Architecture and design decisions](docs/en/architecture.md) · [Build from source](#build-from-source) · [Verification and tests](tests/README.md)

### Privacy and languages

Files and settings stay in page memory. Refreshing clears the session. Opening the hosted app loads it from GitHub Pages, which logs visitor IP addresses. For a fully offline session, download the HTML first and then open it from disk. [GitHub Pages privacy information](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)

The interface starts in your browser’s preferred supported language. You can switch between English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français and Русский.

## Build from source

Use Node.js **22.18 or later** on a Vite-supported release line. Run these commands from the repository root.

```sh
npm ci
npm run build:offline -- dist-offline/Watermark.html
```

Open `dist-offline/Watermark.html` directly in your browser. [Source code](src/) · [Build and distribution](docs/en/verification.md)

<a name="contributors-and-license"></a>

## Contributors

<p>
  <img src="https://github.com/kinoward.png?size=96" width="40" height="40" align="middle" alt="">
  &nbsp; <strong>Kino Ward</strong> · <a href="https://github.com/kinoward">@kinoward</a>
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

The badge at the top shows the current count. A trend line appears once the project has received stars on different dates. [Explore the interactive chart](https://www.star-history.com/?repos=kinoward%2Foffline-watermark&type=date)

## License

**Original code and documentation.** The MIT License permits personal and commercial use. You can modify Watermark, distribute it and sell copies. Keep the copyright notice (© 2026 Watermark contributors) and the permission notice in all copies or substantial portions. The software comes without warranty. The license also limits the liability of the authors and copyright holders. [Full MIT license](LICENSE)

**Redistributing the offline HTML.** The JPEG and PDF libraries have their own terms. `Watermark.html` includes their notices in its source under `third-party-licenses`. ImageMagick WASM statically links several LGPL libraries. The release identified at the top of the HTML provides the matching `ImageMagick-WASM-source.tar.gz` archive with the sources and instructions to rebuild and replace the module. [Third-party notices](THIRD_PARTY.md) · [Rebuild instructions](third-party/imagemagick/README.md) · [Release archives](https://github.com/kinoward/offline-watermark/releases)
