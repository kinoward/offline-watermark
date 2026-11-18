export function createProcessorWorker() {
  return new Worker(new URL('./processor.ts', import.meta.url), { type: 'module' });
}

export function createPdfPageWorker() {
  return new Worker(new URL('./pdf-page-worker.ts', import.meta.url), { type: 'module' });
}
