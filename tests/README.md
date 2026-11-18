# Testing Watermark

[简体中文](README.zh-CN.md) · [Home](../README.md) · [Build instructions](../docs/en/verification.md)

## Why keep these tests?

Some export problems are hard to spot in the watermark preview. A JPEG can look correct while still carrying EXIF data the user asked to remove. Rendering a PDF page as an image can preserve its appearance while losing its searchable text. The tests read the exported files to check EXIF removal, photo orientation and text extraction. The browser tests also open the local HTML with HTTP and HTTPS requests blocked and export both a JPEG and a PDF to check that the downloaded app works offline.

## Choose a check

| Change | Checks |
| --- | --- |
| Documentation or screenshots only | Skip application CI. |
| Application code, tests or build inputs | Run the Node tests and build the offline HTML. The build includes the TypeScript check. |
| Changes affecting browser behavior | Also run the Chromium smoke test on that HTML. It exercises real JPEG and PDF exports. |
| Release tag (`v*`) | Run the Node tests, build once, then test that file with Chromium, Firefox and WebKit before publication. |

On pushes to `main` and pull requests, CI uses Ubuntu 24.04 and Node.js 24. Changes to the app, browser tests or samples, offline bundler, package manifests, TypeScript or Vite settings, or workflows add a Chromium run. Unit-test-only changes run the Node tests and build. The release uses a pinned Playwright image with all three browsers. [CI workflow](../.github/workflows/ci.yml) · [Release workflow](../.github/workflows/release.yml)

## Run locally

Run these commands from the repository root with Node.js 22.18 or later in a Vite-supported release line. The Node tests use the built-in runner and can run before the HTML has been built.

```sh
npm ci
npm test
npm run build:offline -- dist-offline/Watermark.html
```

For an ordinary browser check, install Chromium’s headless shell once and test the built file.

```sh
npx playwright install --only-shell chromium
npm run test:browser -- dist-offline/Watermark.html chromium
```

To reproduce the release check, install all three browsers once, then run the smoke test against the same file.

```sh
npx playwright install chromium firefox webkit
npm run test:browser
```

On a fresh Linux machine, add `--with-deps` to the install command for browser system dependencies. To check one engine, replace `chromium` in the single-browser example with `firefox` or `webkit`. A local HTML target opens via `file://` with HTTP and HTTPS requests blocked. You can pass a full HTTPS URL in place of the file path to allow navigation to that page and check for additional requests.

## Coverage

| Area | Node tests | Browser smoke test |
| --- | --- | --- |
| JPEG | Baseline, progressive and grayscale images, sampling, ICC, JFIF and EXIF density, orientation, thumbnails and corrupt input. [JPEG tests](unit/jpeg.test.mjs) | Compare quantization tables at qualities 100 and 72, inspect metadata with EXIF retained and cleared, download and reopen the photo. |
| PDF | Check page boxes, rotation, original compressed streams, clipping, tile density, encryption and signatures using a canvas stand-in. [PDF tests](unit/pdf.test.mjs) | Draw actual text, export a mixed-page PDF, compare the original streams, extract searchable text with PDFium, and check rejection of encrypted and signed documents. |
| Preview and layout | | Change multiline text and observe the image and PDF previews. Keep the current page through a viewport rotation, dismiss the mobile dialog with Escape or a backdrop tap, and drop a file in Chromium. |
| Saving and privacy | Simulate picker and directory handles to check source-directory hints, name collisions and failed writes. [File handling tests](unit/file-io.test.mjs) | Download actual output files, check their names, detect network requests and verify that refreshing clears the task. |
| Languages | Check browser preference order, Chinese scripts, English fallback, translation keys, parameters and worker errors. [Locale tests](unit/i18n.test.mjs) | |

The browser suite runs a desktop JPEG workflow and a touch-layout PDF workflow against the same HTML. The PDF fixtures include an AES-256 encrypted document and a document signed with a test certificate. [Browser test](browser/smoke.mjs) · [Fixture provenance](fixtures/README.md)

## Release evidence

The v1.0.0 launch was tested locally on macOS with Chromium **149.0.7827.55**, Firefox **151.0** and Playwright WebKit **26.5**. The simulated viewports were 1440×900 (desktop), 834×1194 and 1194×834 (tablet), and 390×844 (phone). These figures describe browser simulations. Physical devices and the Safari application require separate checks. [v1.0.0 release run](https://github.com/kinoward/offline-watermark/actions/runs/44333307055)

## Verify a published download

Download the release and Pages HTML into an empty directory. Both hashes should match the `Watermark.html` entry in the deployed release’s `SHA256SUMS`.

```sh
curl -fLO https://github.com/kinoward/offline-watermark/releases/latest/download/Watermark.html
curl -fLO https://github.com/kinoward/offline-watermark/releases/latest/download/SHA256SUMS
curl -fsSL https://kinoward.github.io/offline-watermark/ -o Pages.html
shasum -a 256 Watermark.html Pages.html
cat SHA256SUMS
```

To verify all listed assets, also download `ImageMagick-WASM-source.tar.gz` into that directory and run `shasum -a 256 -c SHA256SUMS`. For a manual offline check, disconnect, open the downloaded HTML and export a JPEG and a multipage PDF. Open the Pages URL in a signed-out browser to check public access.
