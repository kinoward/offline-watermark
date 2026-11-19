# JPEG re-encoding and metadata fidelity

**Summary date** 2026-11-19

[Engineering notes](../../../../README.md#engineering-notes) · [简体中文](../../../zh-CN/technical-notes/jpeg-reencoding/README.md)

## Project problem

Canvas can draw the overlay, but the browser’s JPEG export interface offers limited control over chroma sampling, progressive encoding and metadata. Watermark needs to composite at the source resolution and keep the photo’s display orientation whether EXIF is kept or removed.

## Implementation decisions

1. **Inspect the source first.** Parse JPEG markers for stored dimensions, orientation, sampling and encoding mode. Lay out the overlay in display coordinates, then map it back to stored pixels with the inverse EXIF transform. Composite and re-encode with ImageMagick WASM, setting quality, sampling and interlacing explicitly. [JPEG marker parsing](../../../../src/jpeg-metadata.ts) · [Coordinate transforms](../../../../src/layout.ts) · [Encoder](../../../../src/jpeg.ts)
2. **Apply orientation according to the export mode.** Keeping EXIF preserves the stored dimensions and orientation tag. Removing EXIF first applies the rotation or reflection to the composited pixels and then drops the tag. Orientations that transpose the image can swap the stored width and height. [Orientation handling](../../../../src/jpeg.ts)
3. **Reattach supported metadata.** Restore ICC and JFIF after encoding and restore supported EXIF data when requested. The source can declare different JFIF and EXIF densities, so retain each declaration independently. Strip JFIF, JFXX and supported EXIF thumbnails so the unwatermarked preview is left out. For a standard EXIF JPEG thumbnail, zero its bytes and unlink IFD1 while keeping other metadata offsets intact. [Metadata restoration and checks](../../../../src/jpeg-metadata.ts)

## Verification and limits

Before returning the result, parse it again to check dimensions, sampling, progressive mode, orientation and restored metadata. Unit tests use progressive 4:2:2, baseline 4:2:0 and grayscale fixtures. They check both density declarations, EXIF removal, thumbnails, damaged input and decoded composited pixels. The browser test downloads exports at quality 100 and 72 and compares their quantization tables. Quality 100 still re-encodes, so file size and compressed data can change. [JPEG unit tests](../../../../tests/unit/jpeg.test.mjs) · [Download checks](../../../../tests/browser/smoke.mjs)

These checks cover supported JPEG markers and encodings. The parser and encoder reject inputs such as MPF composite JPEGs, CMYK and images over the pixel limit. [Format checks](../../../../src/jpeg-metadata.ts) · [Pixel limit](../../../../src/jpeg.ts)
