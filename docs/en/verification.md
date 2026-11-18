# Build and distribution

[Home](../../README.md) · [简体中文](../zh-CN/verification.md) · [Architecture](architecture.md) · [Test guide](../../tests/README.md)

## Build from a clean checkout

Use Node.js 22.18 or later in a Vite-supported release line. From the repository root, install the locked dependencies and build the offline file.

```sh
npm ci
npm run build:offline -- dist-offline/Watermark.html
```

The build type-checks the application, assembles the inline page and workers, and checks that all required assets are embedded. Open `dist-offline/Watermark.html` directly in a browser. [Offline builder](../../scripts/build-offline.mjs) · [How the single file works](architecture.md#package-the-app-for-file)

## What is checked

The test guide covers the checks for day-to-day changes, the release browser matrix and the v1.0.0 results. [Testing Watermark](../../tests/README.md)

## Check the public release

Pushing a `v*` tag for a commit on `main` starts the release workflow. It checks the package version, builds and tests the HTML, then packages the matching ImageMagick sources. GitHub Releases serves the tested file as `Watermark.html`, and the Pages deployment serves a copy of the same bytes as `index.html`. The Pages environment accepts release tags. [Release workflow](../../.github/workflows/release.yml) · [ImageMagick source and rebuild](../../third-party/imagemagick/README.md) · [Verify a published download](../../tests/README.md#verify-a-published-download)
