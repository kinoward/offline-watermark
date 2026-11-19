import { messageError } from './messages.ts';
import { decodeBase64 } from './base64.ts';
import { unpackGzip } from './offline-gzip.ts';
import type { PageRequest } from './pdf-page-worker.ts';
import type { ProcessingJob } from './processing.ts';

const workersWithWasm = new WeakSet<Worker>();

function readGzip(id: string): ArrayBuffer {
  const payload = document.getElementById(id)?.textContent;
  if (!payload) throw messageError('offlineUnavailable');
  try {
    return decodeBase64(payload).buffer;
  } catch (cause) {
    throw messageError('offlineUnavailable', undefined, { cause });
  }
}

async function createEmbeddedWorker(id: string) {
  const source = await unpackGzip(readGzip(id));
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

function postWithWasm(worker: Worker, request: ProcessingJob | PageRequest, buffers: ArrayBuffer[], id: string) {
  if (workersWithWasm.has(worker)) {
    worker.postMessage(request, buffers);
    return;
  }
  const wasmGzip = readGzip(id);
  worker.postMessage({ ...request, wasmGzip }, [...buffers, wasmGzip]);
  workersWithWasm.add(worker);
}

export function postProcessingJob(worker: Worker, job: ProcessingJob) {
  if (job.kind === 'jpeg') postWithWasm(worker, job, [job.bytes], 'imagemagick-wasm-data');
  else worker.postMessage(job, [job.bytes]);
}

export function postPdfPageRequest(worker: Worker, request: PageRequest) {
  postWithWasm(worker, request, request.source ? [request.source] : [], 'pdfium-wasm-data');
}
