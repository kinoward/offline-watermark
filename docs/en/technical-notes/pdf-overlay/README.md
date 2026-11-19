# Appending PDF overlays while preserving page content

**Summary date** 2026-11-19

[Engineering notes](../../../../README.md#engineering-notes) · [简体中文](../../../zh-CN/technical-notes/pdf-overlay/README.md)

## Project problem

Rendering each PDF page to a bitmap and writing it back can preserve its appearance, but loses existing searchable text and re-encodes embedded images. Watermark only needs to draw over the existing page. A page can be rotated, have an offset crop area or share resource dictionaries with other pages.

## Implementation decisions

1. **Use the visible area to establish coordinates.** Intersect `CropBox` with `MediaBox` and clip to the intersection. Lay out tiles in display orientation, then map them into page coordinates using the existing rotation and offset. Preserve the original page boxes and rotation value. [Page geometry and clipping](../../../../src/pdf.ts)
2. **Append drawing operators.** Use pdf-lib to embed the transparent tile as an image XObject and append a content stream to each page. Clone the potentially shared `Contents` array, `Resources` and `XObject` dictionary containers before changing them. Keeping the original streams and resource references lets the page gain an overlay without adding it to other pages. [Overlay implementation](../../../../src/pdf.ts)
3. **Detect inputs that should not be rewritten.** Distinguish encrypted files from damaged files on load, then check for existing signatures, signature timestamps and certification structures before saving. An empty signature field can remain. Signature detection decides whether to write the document. Cryptographic verification belongs to a signature verifier. [Signature and encryption handling](../../../../src/pdf.ts)

## Verification and limits

Unit tests use documents with all four right-angle rotations, offset crop boxes and `UserUnit`. They check page geometry, bytes of existing compressed streams, appended clipping operators and tile draws. The browser test downloads an actual export and extracts existing text from its first page with PDFium. It also checks rejection with encrypted and signed fixtures. [Structural tests](../../../../tests/unit/pdf.test.mjs) · [Export and text extraction](../../../../tests/browser/smoke.mjs)

The PDF container is reserialized. The fidelity checks cover the existing page content streams, embedded image streams and text in the tested samples. The watermark is a transparent image tile, and the existing page text remains the source of searchability.
