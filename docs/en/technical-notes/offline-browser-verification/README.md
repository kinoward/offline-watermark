# Verifying one HTML file from disk and over HTTP

**Summary date** 2026-11-19

[Engineering notes](../../../../README.md#engineering-notes) · [简体中文](../../../zh-CN/technical-notes/offline-browser-verification/README.md)

## Project problem

Opening the page only checks initial loading. JPEG processing, PDF canvas rendering and downloads happen after interaction. A development server can also supply assets that were left out of the build. The test needs to use the shipping HTML and run through an actual export.

## Implementation decisions

- **Exercise two entry points with the same file.** Chromium, Firefox and WebKit each open the built file over `file://`. A local HTTP server serves those same bytes on loopback, returns 404 for other paths and runs the same scenarios in Chromium. [Local HTTP runner](../../../../tests/browser/hosted.mjs) · [Release workflow](../../../../.github/workflows/release.yml)
- **Fail on an attempted request.** Before navigation, Playwright registers HTTP(S) and WebSocket routes on the browser context. It records and blocks unexpected requests, then asserts that the record is empty. The context uses `serviceWorkers: 'block'` so service worker interception cannot bypass the routing check. HTTP mode permits main-frame navigation to the exact document URL, including a reload. [Routing and assertions](../../../../tests/browser/smoke.mjs) · [Playwright request routing](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)

## Verification and limits

The desktop flow downloads a JPEG, checks its metadata and opens the export again. The simulated touch flow downloads a multi-page PDF, checks its original streams and extracts text from the export with PDFium. The suite also checks for page errors. After installing the dependencies and browsers, run both checks against one build from the repository root. [Test setup and coverage](../../../../tests/README.md#run-locally)

```sh
npm run test:browser -- dist-offline/Watermark.html
node tests/browser/hosted.mjs dist-offline/Watermark.html
```

The results cover HTTP(S) and WebSocket requests observed in these scenarios. Playwright WebKit and simulated touch viewports provide engine and layout coverage. A separate public download check verifies the bytes served by the live deployment. [Single-artifact release and public byte checks](../verified-release/README.md)
