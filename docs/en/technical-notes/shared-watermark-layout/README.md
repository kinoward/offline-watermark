# Sharing a tiled watermark layout across formats

**Summary date** 2026-11-19

[Engineering notes](../../../../README.md#engineering-notes) · [简体中文](../../../zh-CN/technical-notes/shared-watermark-layout/README.md)

## Project problem

The JPEG preview uses a smaller canvas, the JPEG export works in source pixels, and PDF uses page units. If each path chooses its own font size and spacing, identical settings can produce different proportions.

## Implementation decisions

- **Size the tile relative to the short side.** Measure the longest line and fit it within 58% of the short side when needed. Calculate the bounds after a −30° rotation, then apply the size multiplier and cap the tile’s longest edge. Fitting long text and applying the requested size are separate steps. [Tile calculation](../../../../src/layout.ts)
- **Control spacing and ink separately.** `tilePositions` derives a gap from the short side, reduces it as density increases and offsets alternate rows by half a step. Size controls tile dimensions, and opacity sets the text’s alpha when drawing the tile. JPEG preview and full-resolution export share drawing and placement logic. PDF reuses the tile and placement calculation, then maps the result to page coordinates. [Shared layout](../../../../src/layout.ts) · [PDF placement](../../../../src/pdf.ts)
- **Keep layout dimensions separate from raster dimensions.** PDF can render a higher-density PNG tile and place it at the same logical width and height. When WebKit raises `NotReadableError` on reading a canvas PNG Blob inside a `file://` worker, the fallback encodes the same canvas RGBA data with UPNG. [Rasterization and PNG fallback](../../../../src/layout.ts)

## Verification and limits

The PDF unit test reads the appended content stream. It checks that a larger size increases width and height in the drawing matrix, and that higher density increases the tile count while keeping tile dimensions fixed. The browser test checks that editing the text repaints the preview. The shared geometry gives consistent proportions. Fonts, rounding and raster resolution still affect the pixels. [Size and spacing test](../../../../tests/unit/pdf.test.mjs) · [Preview repaint check](../../../../tests/browser/smoke.mjs)
