# Watermark

Add a repeating text watermark to a JPG, JPEG or PDF. Process one file at a time in your browser and save a separate copy.

**[Open Watermark](https://kinoward.github.io/offline-watermark/)** · **[Download the offline HTML](https://github.com/kinoward/offline-watermark/releases/latest/download/Watermark.html)** · **[Read the implementation](docs/en/architecture.md)** · [简体中文](README.zh-CN.md)

![Watermark desktop interface with a watermarked JPEG, preview on the left and controls on the right](docs/assets/desktop.jpg)

## Watermark a file

1. Open the web app, or download `Watermark.html` and open it in a recent browser. The downloaded file runs offline on its own.
2. Add a JPG, JPEG or PDF. Enter one or several lines of text and adjust size, density and opacity while watching the preview.
3. Choose an output name, select **Apply watermark**, then **Download**. Where the browser supports directory access, **Save to folder** lets you choose a destination.

The default filename is `original_水印版_01.ext`. The source extension keeps its original case. On a phone, tap the thumbnail to enlarge it. On a tablet, use the page controls to browse a PDF while editing. [Phone preview](docs/assets/phone.jpg) · [Tablet preview](docs/assets/tablet.jpg)

| Input | What the export does |
| --- | --- |
| JPG or JPEG | Re-encodes at the chosen quality and checks image dimensions, color profile, sampling and coding mode. **Remove EXIF** applies the recorded orientation to the pixels before removing the metadata. JPEG file size and compression can change. |
| PDF | Adds a tiled overlay to each page. Original text stays selectable and searchable. Use a decrypted, unsigned copy for protected or digitally signed PDFs. |

Watermark processes your files in the browser. Refreshing clears the task and settings. The online page is hosted by GitHub Pages, which logs visitor IP addresses. Use the downloaded HTML when you want to work fully offline. The interface follows your browser language and supports simplified and traditional Chinese, English, Japanese, Korean, Spanish, French and Russian. [GitHub Pages data collection](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)

## Build and explore

Install Node.js **22.18 or later** in a release line supported by Vite. GitHub Actions uses Node.js 24.

```sh
npm ci
npm test
npm run build:offline -- dist-offline/Watermark.html
```

Open `dist-offline/Watermark.html` directly in your browser. [Architecture and decisions](docs/en/architecture.md) · [Build and verification](docs/en/verification.md)

## License

Watermark’s original code and documentation use the MIT License. The HTML includes ImageMagick WASM with LGPL libraries and other separately licensed components. Each Release includes the matching ImageMagick source archive and rebuild instructions. [MIT License](LICENSE) · [Third-party notices](THIRD_PARTY.md) · [Releases](https://github.com/kinoward/offline-watermark/releases)
