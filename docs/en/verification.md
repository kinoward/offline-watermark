# Build and verification

[Home](../../README.md) · [简体中文](../zh-CN/verification.md) · [Architecture](architecture.md)

## Build from a clean checkout

Use Node.js 22.18 or later in a Vite-supported release line. The project installs the exact versions recorded in its npm lockfile. GitHub Actions runs these checks on Ubuntu 24.04 with Node.js 24.

```sh
npm ci
npm test
npm run build:offline -- dist-offline/Watermark.html
npx playwright install chromium firefox webkit
npm run test:browser
```

On a fresh Linux runner, use `npx playwright install --with-deps chromium firefox webkit` to install the browser system dependencies as well. Once the browsers and HTML are available, the smoke tests can run without the network. The HTML can be opened directly in a browser.

Use `npm run test:browser -- dist-offline/Watermark.html firefox` for a single browser. The same test accepts a full HTTPS URL. The test context permits navigation to that document and blocks further HTTP and HTTPS requests.

## What is checked

| Check | Evidence |
| --- | --- |
| JPEG metadata | The unit suite covers baseline, progressive and grayscale images, sampled components, ICC, both DPI declarations, orientation, EXIF removal, embedded thumbnails and corrupt input. The browser test exports at quality 100 and 72, compares quantization tables, inspects EXIF-preserved and EXIF-free outputs and reopens the generated photo. |
| PDF content | The unit suite checks page boxes, rotation, original compressed streams, clipping, tile density, encryption markers and signature fields. It uses a canvas stand-in. The browser test draws actual text, exports a mixed-page PDF, checks its original streams and reads the original text with PDFium. The rejection checks use an AES-256 encrypted PDF and a cryptographically signed PDF with a test-only certificate. |
| Preview and interaction | The browser test checks instant photo preview changes, automatic PDF updates with the previous page visible, page retention from tablet portrait to landscape and phone width, Escape and backdrop dismissal, and Chromium file drop. |
| Saving and privacy | File-handling tests simulate native picker and directory handles to check the source-directory hint, name collisions and failed writes. The browser smoke run checks real downloads, output names, network requests and clearing edits on refresh. |
| Internationalization | Unit tests check the browser's locale preference order, Chinese scripts, English fallback, dictionary keys, parameters and transfer of worker error messages. |

The launch run used Chromium **149.0.7827.55**, Firefox **151.0** and Playwright WebKit **26.5** on macOS. Responsive checks used 1440×900 desktop, 834×1194 tablet portrait, 1194×834 tablet landscape and 390×844 phone viewports. The tests use browser simulation. Playwright WebKit is a separate test browser from the Safari app. [Smoke tests](../../tests/browser-smoke.mjs) · [Fixture provenance](../../tests/fixtures/README.md) · [CI results](https://github.com/kinoward/offline-watermark/actions/workflows/ci.yml)

## Check the public release

A version tag on `main` runs the release workflow. The workflow builds one HTML file, tests it, packages matching ImageMagick sources, uploads the release assets and deploys a byte-for-byte copy to the project's Pages URL. An environment rule allows release tags to deploy. The source for Pages is GitHub Actions.

```sh
curl -fLO https://github.com/kinoward/offline-watermark/releases/latest/download/Watermark.html
curl -fLO https://github.com/kinoward/offline-watermark/releases/latest/download/SHA256SUMS
curl -fsSL https://kinoward.github.io/offline-watermark/ -o Pages.html
shasum -a 256 Watermark.html Pages.html
```

Both HTML hashes should equal the `Watermark.html` entry in `SHA256SUMS` for the deployed release. To check the rest of the release, download `ImageMagick-WASM-source.tar.gz` to the same directory and run `shasum -a 256 -c SHA256SUMS`. Disconnect from the network, open `Watermark.html`, and apply and download a watermark on a JPEG and a multipage PDF. Verify the Pages URL in a signed-out browser. [Release workflow](../../.github/workflows/release.yml) · [ImageMagick native source and rebuild](../../third-party/imagemagick/README.md)
