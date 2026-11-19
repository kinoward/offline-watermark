import type { PageRequest } from './pdf-page-worker.ts';
import type { ProcessingJob } from './processing.ts';

export function createProcessorWorker() {
  return new Worker(new URL('./processor.ts', import.meta.url), { type: 'module' });
}

export function createPdfPageWorker() {
  return new Worker(new URL('./pdf-page-worker.ts', import.meta.url), { type: 'module' });
}

export function postProcessingJob(worker: Worker, job: ProcessingJob) {
  worker.postMessage(job, [job.bytes]);
}

export function postPdfPageRequest(worker: Worker, request: PageRequest) {
  worker.postMessage(request, request.source ? [request.source] : []);
}
