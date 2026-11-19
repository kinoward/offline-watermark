# Packaging one HTML file and loading WASM on demand

**Summary date** 2026-11-19

[Engineering notes](../../../../README.md#engineering-notes) · [简体中文](../../../zh-CN/technical-notes/single-html-wasm/README.md)

## Project problem

Watermark serves the same HTML online and offline. Its workers and codecs have to start when the browser opens that file over `file://`. In v1.0.0, each WASM binary became a Base64 data URL inside its worker script. The build then gzipped and Base64-encoded each complete script. This put the binaries through two layers of text encoding and made loading either worker unpack the script with its embedded binary. [v1.0.0 build script](https://github.com/kinoward/offline-watermark/blob/v1.0.0/scripts/build-offline.mjs)

## Implementation decisions

- **Compress four assets separately.** The build script inlines the page JavaScript and CSS emitted by Vite. It gzips and then Base64-encodes each of the two worker scripts, ImageMagick WASM and PDFium WASM as separate data blocks in the HTML. The offline build removes PDFium’s WASM URL fallback before Vite can inline a duplicate. It also decodes and decompresses each WASM payload to compare it with the original bytes and checks the build output for external dependencies. [Offline build script](../../../../scripts/build-offline.mjs)
- **Start workers and send bytes on demand.** The page unpacks a script when needed and starts a classic worker from a Blob URL. The first JPEG request transfers compressed ImageMagick WASM to the processing worker. The first canvas preview request transfers PDFium WASM to the page-rendering worker. PDF writing uses pdf-lib and can happen before either WASM module loads. The processing worker keeps the compressed JPEG payload until input validation passes and codec initialization begins. [Worker loader](../../../../src/processor-client-offline.ts) · [Processing worker](../../../../src/processor.ts)
- **Feed the decompressor a byte stream.** WebKit hit a Blob stream read failure inside a worker started from a local file. The project now feeds the compressed bytes through a `ReadableStream` into `DecompressionStream('gzip')`. [Unpacking code](../../../../src/offline-gzip.ts) · [Compression Standard](https://compression.spec.whatwg.org/)

## Verification and limits

The browser regression removes the ImageMagick data block and completes PDF preview and export to confirm that those operations can run without it. It restores the block, sends an invalid JPEG to the same export worker and checks for an error. A valid export on the next request confirms that the compressed payload survives the failed first JPEG job. [Regression test commit](https://github.com/kinoward/offline-watermark/commit/0cac5ce)

The published `Watermark.html` fell from **15,372,733 bytes** to **12,080,093 bytes**, a **21.42%** reduction. The comparison uses the raw release attachment sizes. HTTP transfer size also depends on server content encoding, and time to first processing depends on the browser, device and input. [v1.0.0 assets](https://github.com/kinoward/offline-watermark/releases/tag/v1.0.0) · [v1.0.3 assets](https://github.com/kinoward/offline-watermark/releases/tag/v1.0.3)
