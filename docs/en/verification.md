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

Push an annotated `vX.Y.Z` tag for a commit on `main` after CI passes. The tag, npm version and bilingual release notes must agree. The workflow builds one HTML, runs the browser checks from disk and over local HTTP, and publishes the versioned Release with its matching ImageMagick sources and checksums. It deploys the same HTML to Pages and verifies the public files before marking the Release as Latest. [Release workflow](../../.github/workflows/release.yml) · [Verify a published download](../../tests/README.md#verify-a-published-download)

Use **Re-run failed jobs** to resume with the verified artifacts, which are retained for seven days. A published version and its verified assets are reused. If the artifacts have expired and the versioned Release is already public, re-run all jobs to restore and verify that Release's files before deploying them again. [ImageMagick source and rebuild](../../third-party/imagemagick/README.md)
