import { createPdfReader } from './pdf-reader.ts';
import { paintPattern } from './layout.ts';
import { describeError, formatMessage, t } from './i18n.ts';
import type { UiMessage } from './messages.ts';
import type { MarkOptions } from './layout.ts';
import type { FileKind } from './processing.ts';

export type PreviewItem = { file: File; kind: FileKind; result?: Blob };

const CANVAS_PREVIEW_INTERVAL = 50;
const PDF_PREVIEW_DELAY = 300;
// A native PDF reader can fire load before it paints its first page.
const PDF_READER_SETTLE_DELAY = 320;

function layoutChanged(previous: MarkOptions | undefined, next: MarkOptions) {
  return !previous || previous.text !== next.text || previous.opacity !== next.opacity ||
    previous.size !== next.size || previous.density !== next.density;
}

export function createPreview(
  loadPdf: (file: PreviewItem, options: MarkOptions) => Promise<Blob>,
  usePageReader: MediaQueryList,
  tabletLayout: MediaQueryList,
) {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const sample = el('preview-paper');
  const sampleCanvas = el<HTMLCanvasElement>('preview-canvas');
  const imageCanvas = el<HTMLCanvasElement>('image-preview');
  const placeholder = el('preview-placeholder');
  const message = el('preview-message');
  const pdfViewport = el('pdf-viewport');
  let pdfFrame = el<HTMLIFrameElement>('pdf-preview');
  const pdfStatus = el('pdf-preview-status');
  const openPdf = el<HTMLAnchorElement>('open-pdf-preview');
  const viewerLink = el<HTMLAnchorElement>('viewer-open-pdf');
  const caption = el('preview-caption');
  const embeddedPdf = navigator.pdfViewerEnabled;
  const reader = createPdfReader(refresh, tabletLayout);
  openPdf.target = '_blank';
  openPdf.rel = 'noopener noreferrer';
  let selected: PreviewItem | undefined;
  let options: MarkOptions | undefined;
  let busy = false;
  let revision = 0;
  let canvasFrame: number | undefined;
  let canvasTimer: number | undefined;
  let lastCanvasPaint = -Infinity;
  let photo: OffscreenCanvas | undefined;
  let photoFailed = false;
  let pdfUrl: string | undefined;
  let pdfBlob: Blob | undefined;
  let pdfTimer: number | undefined;
  let pdfPending = false;
  let pdfRunning = false;
  let stagedPdf: { frame: HTMLIFrameElement; url: string; blob: Blob; settleTimer?: number } | undefined;
  let pdfError: UiMessage | undefined;

  function refresh() {
    const isPhoto = selected?.kind === 'jpeg';
    const isPdf = selected?.kind === 'pdf';
    const hasImage = isPhoto && !!photo;
    const hasPdf = isPdf && !!pdfUrl;
    sample.hidden = !!selected;
    imageCanvas.hidden = !hasImage;
    const native = !usePageReader.matches && embeddedPdf;
    const hasPage = native ? hasPdf : usePageReader.matches && reader.painted;
    pdfViewport.hidden = !hasPdf || !native;
    openPdf.hidden = !hasPdf;
    const fallback = hasPdf && usePageReader.matches && (!!reader.error || reader.deviceFonts);
    openPdf.dataset.fallback = String(fallback);
    viewerLink.hidden = !fallback;
    placeholder.hidden = !selected || hasImage || hasPage;
    caption.textContent = t(selected ? (isPhoto ? 'imagePreview' : 'pdfPreview') : 'sample');
    caption.title = selected?.file.name ?? '';

    const renderError = pdfError ?? reader.error;
    pdfStatus.textContent = renderError ? t('usingPrevious', { error: formatMessage(renderError) })
      : t(pdfPending || reader.pending ? 'updatingPdf' : 'deviceFonts');
    pdfStatus.hidden = !hasPage || (!pdfPending && !reader.pending && !renderError && !reader.deviceFonts);
    message.textContent = isPhoto
      ? t(photoFailed ? 'photoFailed' : 'readingImage')
      : renderError ? formatMessage(renderError) : t(hasPdf && !usePageReader.matches ? 'nativePdfUnavailable' : 'preparingPdf');
  }

  function updateDownloadName() {
    if (!embeddedPdf && pdfUrl && selected) {
      const stem = selected.file.name.replace(/\.pdf$/i, '');
      openPdf.download = viewerLink.download = stem + '_' + t('previewSuffix') + '.pdf';
    }
  }

  function refreshLanguage() {
    openPdf.textContent = t(embeddedPdf ? 'openPdfTab' : 'downloadPreview');
    viewerLink.textContent = t(embeddedPdf ? 'openPreview' : 'downloadPreview');
    pdfFrame.title = t('pdfEffect');
    if (stagedPdf) stagedPdf.frame.title = pdfFrame.title;
    updateDownloadName();
    reader.refreshLanguage();
    refresh();
  }

  function paint() {
    if ((selected && !photo) || canvasFrame !== undefined || canvasTimer !== undefined) return;
    const scheduleFrame = () => {
      canvasTimer = undefined;
      canvasFrame = requestAnimationFrame(() => {
        canvasFrame = undefined;
        const canvas = photo ? imageCanvas : sampleCanvas;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (photo) ctx.drawImage(photo, 0, 0);
        if (options?.text.trim()) paintPattern(ctx, canvas.width, canvas.height, options);
        lastCanvasPaint = performance.now();
      });
    };
    const delay = CANVAS_PREVIEW_INTERVAL - (performance.now() - lastCanvasPaint);
    if (delay > 0) canvasTimer = window.setTimeout(scheduleFrame, delay);
    else scheduleFrame();
  }

  function resetCanvasPaint() {
    if (canvasFrame !== undefined) cancelAnimationFrame(canvasFrame);
    window.clearTimeout(canvasTimer);
    canvasFrame = canvasTimer = undefined;
    lastCanvasPaint = -Infinity;
  }

  function clearStagedPdf() {
    if (!stagedPdf) return;
    window.clearTimeout(stagedPdf.settleTimer);
    stagedPdf.frame.remove();
    URL.revokeObjectURL(stagedPdf.url);
    stagedPdf = undefined;
  }

  function releasePdf() {
    window.clearTimeout(pdfTimer);
    pdfTimer = undefined;
    pdfPending = false;
    pdfError = undefined;
    clearStagedPdf();
    pdfFrame.removeAttribute('src');
    openPdf.removeAttribute('href');
    viewerLink.removeAttribute('href');
    openPdf.removeAttribute('download');
    viewerLink.removeAttribute('download');
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = undefined;
    pdfBlob = undefined;
    reader.clear();
  }

  function publishPdf(url: string, blob: Blob) {
    const previous = pdfUrl;
    pdfUrl = url;
    pdfBlob = blob;
    openPdf.href = viewerLink.href = url;
    updateDownloadName();
    if (previous) URL.revokeObjectURL(previous);
    pdfPending = false;
    if (usePageReader.matches) reader.setDocument(blob);
    refresh();
  }

  function showPdf(output: Blob, expected: number) {
    const url = URL.createObjectURL(output);
    if (usePageReader.matches || !embeddedPdf || !pdfUrl) {
      if (!usePageReader.matches && embeddedPdf) pdfFrame.src = url;
      publishPdf(url, output);
      return;
    }

    // Keep the visible reader in place until the next reader has loaded.
    const next = document.createElement('iframe');
    next.className = 'pdf-preview pdf-preview-staged';
    next.title = pdfFrame.title;
    next.setAttribute('aria-hidden', 'true');
    next.tabIndex = -1;
    stagedPdf = { frame: next, url, blob: output };
    next.addEventListener('load', () => {
      if (stagedPdf?.frame !== next) return;
      stagedPdf.settleTimer = window.setTimeout(() => {
        if (expected !== revision || stagedPdf?.frame !== next) return;
        pdfFrame.remove();
        pdfFrame = next;
        next.id = 'pdf-preview';
        next.classList.remove('pdf-preview-staged');
        next.removeAttribute('aria-hidden');
        next.removeAttribute('tabindex');
        stagedPdf = undefined;
        publishPdf(url, output);
      }, PDF_READER_SETTLE_DELAY);
    }, { once: true });
    next.src = url;
    pdfViewport.append(next);
  }

  async function updatePdf() {
    if (!pdfPending || pdfRunning || stagedPdf || pdfTimer !== undefined ||
        selected?.kind !== 'pdf' || !options || (busy && !selected.result)) return;
    const item = selected;
    const expected = revision;
    pdfRunning = true;
    try {
      const output = await loadPdf(item, options);
      if (expected === revision) showPdf(output, expected);
    } catch (error) {
      if (expected === revision) {
        pdfPending = false;
        pdfError = describeError(error, 'previewFailed');
        refresh();
      }
    } finally {
      pdfRunning = false;
      if (expected !== revision) void updatePdf();
    }
  }

  function queuePdf(delay: number) {
    const alreadyPending = pdfPending && !pdfError;
    window.clearTimeout(pdfTimer);
    clearStagedPdf();
    pdfPending = true;
    pdfError = undefined;
    pdfTimer = window.setTimeout(() => {
      pdfTimer = undefined;
      void updatePdf();
    }, delay);
    if (!alreadyPending) refresh();
  }

  async function readPhoto(item: PreviewItem, expected: number) {
    try {
      const bitmap = await createImageBitmap(item.file, { imageOrientation: 'from-image' });
      try {
        if (expected !== revision) return;
        const longSide = Math.max(bitmap.width, bitmap.height);
        const scale = Math.min(1200, Math.max(480, longSide)) / longSide;
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const background = new OffscreenCanvas(width, height);
        background.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
        imageCanvas.width = width;
        imageCanvas.height = height;
        photo = background;
      } finally {
        bitmap.close();
      }
    } catch {
      if (expected !== revision) return;
      photoFailed = true;
    }
    refresh();
    paint();
  }

  function showFile(item: PreviewItem | undefined) {
    revision++;
    resetCanvasPaint();
    selected = item;
    photo = undefined;
    imageCanvas.width = imageCanvas.height = 1;
    photoFailed = false;
    releasePdf();
    refresh();
    paint();
    if (item?.kind === 'jpeg') void readPhoto(item, revision);
    if (item?.kind === 'pdf') queuePdf(0);
  }

  usePageReader.addEventListener('change', () => {
    if (usePageReader.matches) {
      pdfFrame.removeAttribute('src');
      if (stagedPdf && selected) {
        const { frame, url, blob, settleTimer } = stagedPdf;
        window.clearTimeout(settleTimer);
        frame.remove();
        stagedPdf = undefined;
        publishPdf(url, blob);
      } else if (pdfBlob) {
        reader.setDocument(pdfBlob);
      }
    } else {
      reader.clear({ keepPage: true });
      if (pdfUrl && embeddedPdf) pdfFrame.src = pdfUrl;
    }
    refresh();
  });

  refreshLanguage();
  return {
    refreshLanguage,
    setExpanded(value: boolean) { reader.setExpanded(value); },
    setFile(item: PreviewItem | undefined, working: boolean) {
      busy = working;
      if (item !== selected) showFile(item);
      else {
        refresh();
        void updatePdf();
      }
    },
    setOptions(next: MarkOptions) {
      const changed = layoutChanged(options, next);
      options = next;
      if (changed) {
        if (selected?.kind === 'pdf') {
          revision++;
          queuePdf(PDF_PREVIEW_DELAY);
        } else {
          paint();
        }
      }
    },
  };
}
