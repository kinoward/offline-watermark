import { describeError } from './messages.ts';
import type { UiMessage } from './messages.ts';
import { PDFiumLibrary } from '@hyzyla/pdfium';
import type { PDFiumDocument } from '@hyzyla/pdfium';
import { pagesWithDeviceCjkFonts } from './pdf-fonts.ts';

export type PageRequest = { source?: ArrayBuffer; page: number; longSide: number };
export type PageResult = { pixels: Uint8ClampedArray<ArrayBuffer>; width: number; height: number; count: number; deviceFonts: boolean } | { error: UiMessage };

const worker = self as unknown as {
  onmessage: (event: MessageEvent<PageRequest>) => void;
  postMessage: (result: PageResult, transfer?: Transferable[]) => void;
};
let library: PDFiumLibrary | undefined;
let pdf: PDFiumDocument | undefined;
let cjkFonts: boolean[] | undefined;

worker.onmessage = async ({ data }) => {
  try {
    // Vite resolves PDFium's module-relative WASM asset, inlining it in the offline worker.
    library ??= await PDFiumLibrary.init();
    if (data.source) {
      pdf?.destroy();
      pdf = undefined;
      pdf = await library.loadDocument(new Uint8Array(data.source));
      // A worker lives for one input file. Watermark-only changes do not alter
      // its source font resources, so inspect them only on the first version.
      cjkFonts ??= await pagesWithDeviceCjkFonts(data.source);
    }
    const page = pdf!.getPage(data.page - 1);
    try {
      const { originalWidth, originalHeight } = page.getOriginalSize();
      const scale = data.longSide / Math.max(originalWidth, originalHeight);
      const image = await page.render({
        width: Math.max(1, Math.round(originalWidth * scale)),
        height: Math.max(1, Math.round(originalHeight * scale)),
        renderFormFields: true,
      });
      const pixels = new Uint8ClampedArray(image.data.buffer as ArrayBuffer, image.data.byteOffset, image.data.byteLength);
      const deviceFonts = !!cjkFonts?.[data.page - 1] &&
        /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(page.getText());
      worker.postMessage({ pixels, width: image.width, height: image.height, count: pdf!.getPageCount(), deviceFonts }, [pixels.buffer]);
    } finally {
      page.close();
    }
  } catch (error) {
    worker.postMessage({ error: describeError(error, 'rasterFailed') });
  }
};
