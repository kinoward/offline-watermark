import { messageError } from './messages.ts';
import { decodeBase64 } from './base64.ts';

async function createEmbeddedWorker(id: string) {
  if (typeof DecompressionStream !== 'function') {
    throw messageError('offlineUnavailable');
  }
  const payload = document.getElementById(id)!.textContent!;
  const compressed = decodeBase64(payload);
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const source = await new Response(stream).blob();
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const release = () => URL.revokeObjectURL(url);
  try {
    const worker = new Worker(url);
    worker.addEventListener('message', release, { once: true });
    worker.addEventListener('error', release, { once: true });
    return worker;
  } catch (error) {
    release();
    throw error;
  }
}

export const createProcessorWorker = () => createEmbeddedWorker('processor-data');
export const createPdfPageWorker = () => createEmbeddedWorker('pdf-page-data');
