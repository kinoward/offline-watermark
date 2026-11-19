# Scheduling asynchronous previews across layouts

**Summary date** 2026-11-19

[Engineering notes](../../../../README.md#engineering-notes) · [简体中文](../../../zh-CN/technical-notes/async-preview/README.md)

## Project problem

During typing or slider movement, a JPEG preview can repaint on a reduced canvas. PDF previews need asynchronous document generation or page rendering. Starting heavy work on every input can build up requests, and an older request might finish after a newer one. Page and input state also need to survive layout changes.

## Implementation decisions

- **Schedule according to rendering cost.** JPEG canvas repaints run on animation frames at least 50 ms apart. PDF waits for 300 ms without a layout-setting change and runs one generation job at a time. Changing the selected file or PDF layout settings increments a revision counter, so only the current revision can replace the preview. [Preview scheduling](../../../../src/preview.ts)
- **Keep the previous preview until its replacement is ready.** The PDFium canvas keeps the last image until the current request returns pixels. For the browser’s native viewer, another iframe loads the next version. The app waits briefly after `load` before swapping because that event can precede the first paint. The delay is a heuristic used in this project. [Preview replacement](../../../../src/preview.ts) · [Canvas reader](../../../../src/pdf-reader.ts)
- **Reuse the document for paging and the controls for layout.** PDFium receives the document bytes on the first render. Later requests for that document send only the page number and target size. A smaller view can reuse the existing image, and a larger one can request a sharper render. The editor moves existing input controls when switching layouts and restores focus when needed. [PDF page worker](../../../../src/pdf-page-worker.ts) · [Reader scheduling](../../../../src/pdf-reader.ts) · [Editor layout](../../../../src/main.ts)

## Verification and limits

The browser smoke test checks JPEG repainting after a text edit at 1440×900. The PDF flow opens a document at a simulated 834×1194 touch viewport and goes to page 2. It checks that the previous canvas is still visible while editing and repaints later, then switches to landscape and phone sizes. It verifies the page number and entered text across expanding and dismissing the preview. These assertions exercise the canvas path in simulated viewports. The browser controls when its native PDF viewer paints. [Browser preview scenarios](../../../../tests/browser/smoke.mjs)
