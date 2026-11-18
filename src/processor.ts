import { describeError, messageError } from './messages.ts';
import type { ProcessingJob, ProcessingResult } from './processing.ts';

const worker = self as unknown as {
  onmessage: (event: MessageEvent<ProcessingJob>) => void;
  postMessage: (message: ProcessingResult, transfer?: Transferable[]) => void;
};

worker.onmessage = async ({ data: { bytes, kind, options } }) => {
  try {
    const header = new Uint8Array(bytes, 0, Math.min(1024, bytes.byteLength));
    if (kind === 'jpeg' && (header[0] !== 0xff || header[1] !== 0xd8 || header[2] !== 0xff)) {
      throw messageError('jpegMagic');
    }
    if (kind === 'pdf' && !new TextDecoder().decode(header).includes('%PDF-')) {
      throw messageError('pdfMagic');
    }
    const data = kind === 'jpeg'
      ? await (await import('./jpeg.ts')).watermarkJpeg(bytes, options)
      : await (await import('./pdf.ts')).watermarkPdf(bytes, options);
    worker.postMessage({ data }, [data]);
  } catch (error) {
    worker.postMessage({ error: describeError(error, 'processingFailed') });
  }
};
