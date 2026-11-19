import { createPdfPageWorker, postPdfPageRequest } from './processor-client.ts';
import type { PageRequest, PageResult } from './pdf-page-worker.ts';
import { describeError, t } from './i18n.ts';
import type { UiMessage } from './messages.ts';

// Rasterize the already watermarked PDF, one visible page at a time. Changing
// pages or opening the larger view reuses the document in the same worker.
export function createPdfReader(onChange: () => void, tabletLayout: MediaQueryList) {
  const canvas = document.querySelector<HTMLCanvasElement>('#pdf-page-canvas')!;
  const board = canvas.closest<HTMLElement>('.preview-board')!;
  const tools = document.querySelector<HTMLElement>('#pdf-page-tools')!;
  const previous = document.querySelector<HTMLButtonElement>('#pdf-page-prev')!;
  const next = document.querySelector<HTMLButtonElement>('#pdf-page-next')!;
  const counter = document.querySelector<HTMLElement>('#pdf-page-count')!;
  let expanded = false;
  let page = 1, count = 0;
  let paintedPage = 0;
  let deviceFonts = false;
  let error: UiMessage | undefined;
  let source: Blob | undefined, loaded: Blob | undefined;
  let worker: Worker | undefined;
  let generation = 0, revision = 0;
  let running = false;
  let renderSize = 0;
  let resizeTimer: number | undefined;

  function updateControls() {
    canvas.hidden = !paintedPage;
    tools.hidden = !count || (!expanded && !tabletLayout.matches);
    previous.disabled = page <= 1;
    next.disabled = page >= count;
    counter.textContent = count ? page + ' / ' + count : '';
    onChange();
  }

  function refreshLanguage() {
    canvas.setAttribute('aria-label', paintedPage
      ? t('pageOf', { page: paintedPage, count })
      : t('pdfPagePreview'));
  }

  function clear({ keepPage = false } = {}) {
    generation++;
    revision++;
    worker?.terminate();
    worker = undefined;
    source = loaded = undefined;
    if (!keepPage) page = 1;
    count = 0;
    error = undefined;
    running = deviceFonts = false;
    paintedPage = 0;
    renderSize = 0;
    window.clearTimeout(resizeTimer);
    canvas.width = canvas.height = 1;
    refreshLanguage();
    updateControls();
  }

  function preferredSize() {
    if (expanded) return Math.min(2200, Math.ceil(Math.max(innerWidth, innerHeight) * devicePixelRatio));
    if (!tabletLayout.matches) return 560;
    const pixels = Math.max(board.clientWidth, board.clientHeight) * devicePixelRatio;
    return Math.min(2048, Math.max(560, Math.ceil(pixels / 128) * 128));
  }

  async function render() {
    if (running || !source) return;
    running = true;
    const session = generation, requested = revision, document = source;
    const currentPage = page;
    const longSide = preferredSize();
    renderSize = longSide;
    try {
      if (!worker) {
        const created = await createPdfPageWorker();
        if (session !== generation) { created.terminate(); return; }
        worker = created;
      }
      const bytes = loaded === document ? undefined : await document.arrayBuffer();
      if (session !== generation || requested !== revision) return;
      const reply = await new Promise<PageResult>((resolve, reject) => {
        worker!.onmessage = (event: MessageEvent<PageResult>) => resolve(event.data);
        worker!.onerror = () => reject({ key: 'readerFailed' } satisfies UiMessage);
        const request: PageRequest = { source: bytes, page: currentPage, longSide };
        postPdfPageRequest(worker!, request);
      });
      if (session !== generation) return;
      if ('error' in reply) throw reply.error;
      loaded = document;
      if (requested !== revision) return;
      canvas.width = reply.width;
      canvas.height = reply.height;
      canvas.getContext('2d')!.putImageData(new ImageData(reply.pixels, reply.width, reply.height), 0, 0);
      count = reply.count;
      deviceFonts = reply.deviceFonts;
      paintedPage = currentPage;
      refreshLanguage();
      error = undefined;
    } catch (cause) {
      if (session !== generation) return;
      loaded = undefined;
      worker?.terminate();
      worker = undefined;
      if (requested === revision) error = describeError(cause, 'pageFailed');
    } finally {
      if (session === generation) {
        running = false;
        if (requested !== revision) void render();
        updateControls();
      }
    }
  }
  function schedule() {
    revision++;
    error = undefined;
    void render();
    updateControls();
  }
  function growIfNeeded() {
    if (source && preferredSize() > renderSize) schedule();
    else updateControls();
  }
  // A smaller view can use the existing raster. Coalesce rotation, split-view
  // resizing and inspector movement before requesting a sharper one.
  new ResizeObserver(() => {
    if (!source || (!expanded && !tabletLayout.matches)) return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(growIfNeeded, 140);
  }).observe(board);
  tabletLayout.addEventListener('change', growIfNeeded);
  previous.addEventListener('click', () => { if (page > 1) { page--; schedule(); } });
  next.addEventListener('click', () => { if (page < count) { page++; schedule(); } });
  return {
    clear,
    refreshLanguage,
    get painted() { return paintedPage > 0; },
    get pending() { return running; },
    get error() { return error; },
    get deviceFonts() { return deviceFonts; },
    setDocument(value: Blob) {
      if (source === value) return;
      source = value;
      schedule();
    },
    setExpanded(value: boolean) {
      if (expanded === value) return;
      expanded = value;
      growIfNeeded();
    },
  };
}
