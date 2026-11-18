import comparisonSample from './comparison-sample.jpg?inline';
import { decodeBase64 } from './base64.ts';
import './style.css';
import './desktop.css';
import './tablet.css';
import { bindDesktopFileDrop } from './desktop-file-drop.ts';
import { bindLanguageMenu } from './language-menu.ts';
import { applyLanguage, browserLanguage, describeError, formatMessage, t } from './i18n.ts';
import { errorFromMessage, messageError } from './messages.ts';
import type { MessageKey } from './locales/zh-CN.ts';
import './sample.ts';
import {
  defaultName, downloadFile, pickLocalFile, pickSaveDirectory, saveToDirectory, splitName,
  supportsDirectorySave, supportsNativeOpen, validateStem,
} from './file-io.ts';
import type { PickedFile, SourceFileHandle } from './file-io.ts';
import type { MarkOptions } from './layout.ts';
import { formatFor, mediaType } from './processing.ts';
import type { ProcessingJob, ProcessingResult } from './processing.ts';
import { createProcessorWorker } from './processor-client.ts';
import { createPreview } from './preview.ts';
import { createPreviewMotion } from './preview-motion.ts';
import type { PreviewItem } from './preview.ts';

type CurrentFile = PreviewItem & {
  source?: SourceFileHandle;
  stem: string;
  extension: string;
  downloadNumber: number;
};
type Busy = 'generating' | 'saving' | undefined;

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const initialLanguage = browserLanguage(navigator.languages.length ? navigator.languages : [navigator.language]);
applyLanguage(initialLanguage);
const workbench = el('workbench');
const editorPanes = workbench.querySelector<HTMLElement>('.editor-panes')!;
// A short phone in landscape uses the compact editor. A full-size touch tablet
// can keep its page reader and touch controls when rotated or used in split view.
const wideLayout = matchMedia('(width >= 1024px), (width >= 600px) and (height > 520px)');
const tabletLayout = matchMedia('(600px <= width < 1024px) and (height > 520px), (width >= 1024px) and (pointer: coarse), (1024px <= width <= 1100px) and (orientation: portrait)');
const pageReaderLayout = matchMedia('(width < 1024px), (pointer: coarse), (width <= 1100px) and (orientation: portrait)');
const settingsToggle = el<HTMLButtonElement>('mobile-settings');
const actionDock = el('settings-action');
const exportActions = actionDock.querySelector<HTMLElement>('.export-actions')!;
const toolRail = el('tool-rail');
const previewTools = workbench.querySelector<HTMLElement>('.preview-tools')!;
const patternLabel = previewTools.querySelector<HTMLElement>('.style-label')!;
const surface = el<HTMLDialogElement>('preview-surface');
const previewMotion = createPreviewMotion(surface);
const expandPreview = el<HTMLButtonElement>('expand-preview');
const quickPreview = el<HTMLButtonElement>('quick-preview');
const closePreview = el<HTMLButtonElement>('close-preview');
const exportField = el('export-name-field');
const dockInfo = el('dock-info');
const resultSize = el('desktop-result-size');
const exportHeading = resultSize.parentElement!;
const compactImportSlot = el('compact-import-slot');
const compactStartSlot = el('compact-start-slot');
const compactExportSlot = el('compact-export-slot');
const jpegSettings = el('jpeg-settings');
const textInput = el<HTMLTextAreaElement>('watermark-text');
const opacity = el<HTMLInputElement>('opacity');
const quality = el<HTMLInputElement>('quality');
const clearExif = el<HTMLInputElement>('clear-exif');
const size = el<HTMLInputElement>('watermark-size');
const density = el<HTMLInputElement>('watermark-density');
const numericSettings = [
  [size, el<HTMLInputElement>('size-value'), el<HTMLButtonElement>('size-reset')],
  [density, el<HTMLInputElement>('density-value'), el<HTMLButtonElement>('density-reset')],
  [opacity, el<HTMLInputElement>('opacity-value'), el<HTMLButtonElement>('opacity-reset')],
  [quality, el<HTMLInputElement>('quality-value'), el<HTMLButtonElement>('quality-reset')],
] as const;
const generate = el<HTMLButtonElement>('generate');
const downloadButton = el<HTMLButtonElement>('download');
const saveButton = el<HTMLButtonElement>('save-file');
const exportName = el<HTMLInputElement>('export-name');
const previewFilename = el('preview-filename');
const add = el<HTMLButtonElement>('add-files');
const importEntry = el('import-entry');
const startImportSlot = el('start-import-slot');
const fileInput = el<HTMLInputElement>('file-input');
const preview = createPreview(loadPdfPreview, pageReaderLayout, tabletLayout);
let currentFile: CurrentFile | undefined;
let busy: Busy;
let opening = false;
let worker: Worker | undefined;
let previewWorker: Worker | undefined;
let inspectorOpen = true;
let previewTrigger = expandPreview;
let editedText = false;
let currentNotice: MessageKey | (() => string) | undefined;

const options = (): MarkOptions => ({
  text: textInput.value, opacity: Number(opacity.value) / 100, quality: Number(quality.value),
  clearExif: clearExif.checked,
  size: Number(size.value) / 100, density: Number(density.value) / 100,
});
const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';
const errorText = (error: unknown) => formatMessage(describeError(error));

function refreshNotice() {
  el('notice-text').textContent = typeof currentNotice === 'function'
    ? currentNotice() : currentNotice ? t(currentNotice) : '';
}

function notice(message?: MessageKey | (() => string), tone: 'info' | 'success' | 'error' = 'info') {
  const region = el('file-notice');
  currentNotice = message;
  refreshNotice();
  region.dataset.tone = tone;
  region.hidden = !message;
}

function placeImport() {
  const atStart = !currentFile;
  const slot = wideLayout.matches
    ? (atStart ? startImportSlot : el('desktop-import-slot'))
    : (atStart ? compactStartSlot : compactImportSlot);
  workbench.dataset.importView = atStart ? 'start' : 'toolbar';
  if (importEntry.parentElement !== slot) {
    const hadFocus = document.activeElement === add;
    slot.append(importEntry);
    if (hadFocus) add.focus({ preventScroll: true });
  }
}

function finishNumericEdit() {
  const focused = document.activeElement;
  if (focused instanceof HTMLInputElement && focused.type === 'number') focused.blur();
}

function returnToEditor() {
  surface.close();
  surface.setAttribute('role', 'region');
  surface.setAttribute('aria-labelledby', 'preview-title');
  // Opening inline via the attribute avoids dialog.show() autofocus.
  surface.open = true;
  preview.setExpanded(false);
  const restoredFocus = document.activeElement;
  // A close during an animation callback takes a second paint in WebKit
  // before the inline trigger is focusable again.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const focus = document.activeElement;
    if (!surface.matches(':modal') && (focus === restoredFocus || focus === document.body || surface.contains(focus))) {
      const trigger = previewTrigger.getClientRects().length ? previewTrigger : expandPreview;
      (pageReaderLayout.matches ? trigger : settingsToggle).focus({ preventScroll: true });
    }
  }));
}

function presentPreview(expanded: boolean, trigger = expandPreview) {
  if (surface.matches(':modal') === expanded) return;
  if (!expanded) {
    previewMotion.play(false, returnToEditor);
    return;
  }
  previewTrigger = trigger;
  previewMotion.rememberThumbnail(trigger);
  // Touch and programmatic activation don't always focus the invoking button.
  trigger.focus({ preventScroll: true });
  surface.close();
  surface.setAttribute('role', 'dialog');
  surface.setAttribute('aria-labelledby', 'viewer-title');
  surface.showModal();
  closePreview.focus({ preventScroll: true });
  preview.setExpanded(true);
  previewMotion.play(true);
}

function syncLayout(animateInspector = false) {
  const wide = wideLayout.matches;
  const tablet = tabletLayout.matches;
  const layout = tablet ? 'tablet' : wide ? 'desktop' : 'compact';
  const changed = document.documentElement.dataset.layout !== layout;
  const active = document.activeElement;
  const editing = changed && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) ? active : null;
  if (editing && wide && toolRail.contains(editing)) inspectorOpen = true;
  document.documentElement.dataset.layout = layout;
  if (!pageReaderLayout.matches && surface.matches(':modal')) {
    previewMotion.interrupt();
    if (surface.matches(':modal')) returnToEditor();
  }
  workbench.toggleAttribute('data-inspector-motion', animateInspector && wide && !tablet);
  workbench.dataset.inspector = !wide || inspectorOpen ? 'open' : 'closed';
  toolRail.inert = wide && !inspectorOpen;
  settingsToggle.setAttribute('aria-expanded', String(inspectorOpen));
  el('toggle-label').textContent = t(inspectorOpen ? 'collapse' : 'expand');
  const dockHost = wide && !tablet ? (inspectorOpen ? toolRail : el('desktop-focus-actions')) : workbench;
  if (actionDock.parentElement !== dockHost) dockHost.append(actionDock);
  const toggleHost = wide ? el('desktop-toggle-slot') : exportActions;
  if (settingsToggle.parentElement !== toggleHost) toggleHost.insertBefore(settingsToggle, wide ? null : generate);
  const patternHost = wide ? el('desktop-pattern-slot') : previewTools;
  if (patternLabel.parentElement !== patternHost) patternHost.prepend(patternLabel);
  const sizeHost = tablet ? el('file-notice') : exportHeading;
  if (resultSize.parentElement !== sizeHost) sizeHost.append(resultSize);
  const target = tablet ? dockInfo : wide ? el('desktop-name-slot') : compactExportSlot;
  const jpegTarget = wide ? el('desktop-codec-slot') : compactExportSlot;
  for (const [group, host] of [[exportField, target], [jpegSettings, jpegTarget]] as const) {
    if (group.parentElement === host) continue;
    const before = group === exportField ? host.firstElementChild : null;
    if (editing && group.contains(editing)) {
      // Opening the keyboard can also cross the compact breakpoint. Keep the
      // active field visible and connected as its controls change position.
      const disclosure = host.closest('details');
      if (disclosure) disclosure.open = true;
      const parent = host as HTMLElement & { moveBefore?(node: Node, before: Node | null): void };
      if (parent.moveBefore) {
        parent.moveBefore(group, before);
        continue;
      }
    }
    host.insertBefore(group, before);
  }
  placeImport();
  if (editing) {
    if (document.activeElement !== editing) editing.focus({ preventScroll: true });
    editing.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function setInspector(open: boolean) {
  finishNumericEdit();
  inspectorOpen = open;
  syncLayout(true);
  (open ? el('settings-title') : settingsToggle).focus({ preventScroll: true });
}

function fitEditorViewport() {
  const viewport = window.visualViewport;
  if (pageReaderLayout.matches && viewport?.scale === 1) {
    workbench.style.setProperty('--editor-viewport', viewport.height + 'px');
  } else {
    workbench.style.removeProperty('--editor-viewport');
  }
}
function refreshLayout() {
  syncLayout();
  fitEditorViewport();
}
wideLayout.addEventListener('change', refreshLayout);
tabletLayout.addEventListener('change', refreshLayout);
window.visualViewport?.addEventListener('resize', fitEditorViewport);
syncLayout();
fitEditorViewport();

function paint() {
  const current = options();
  for (const [range] of numericSettings) {
    const fraction = (Number(range.value) - Number(range.min)) / (Number(range.max) - Number(range.min));
    range.style.setProperty('--position', fraction * 100 + '%');
  }
  el('preview-opacity').textContent = t('opacityCaption', { value: opacity.value });
  preview.setOptions(current);
}

function fileSize(bytes: number) {
  const [unit, divisor] = bytes >= 1e6 ? ['megabyte', 1e6] as const :
    bytes >= 1e3 ? ['kilobyte', 1e3] as const : ['byte', 1] as const;
  return new Intl.NumberFormat(document.documentElement.lang, {
    style: 'unit', unit, maximumFractionDigits: 1,
  }).format(bytes / divisor);
}

function updateControls() {
  const item = currentFile;
  const hasResult = !!item?.result;
  workbench.dataset.hasFile = String(!!item);
  el('add-label').textContent = t(item ? 'replaceFile' : 'addFile');
  placeImport();
  previewFilename.hidden = !item;
  previewFilename.textContent = item?.file.name ?? '';
  previewFilename.title = item?.file.name ?? '';
  el('desktop-file-size').textContent = item ? fileSize(item.file.size) : '';
  resultSize.textContent = item?.result ? fileSize(item.result.size) : '';
  el('desktop-codec').hidden = item?.kind !== 'jpeg';
  el('viewer-title').textContent = item?.file.name || t('sampleTitle');
  jpegSettings.hidden = item?.kind !== 'jpeg';
  el('export-name-field').hidden = !item;
  exportName.placeholder = item ? defaultName(item.stem, '', item.downloadNumber) : '';
  el('export-extension').textContent = item?.extension ?? '';

  for (const [range, field, reset] of numericSettings) range.disabled = field.disabled = reset.disabled = !!busy;
  [textInput, clearExif, add, exportName, downloadButton, saveButton].forEach((control) => { control.disabled = !!busy; });
  generate.hidden = hasResult;
  generate.disabled = !!busy || !item || !textInput.value.trim();
  generate.setAttribute('aria-busy', String(busy === 'generating'));
  saveButton.setAttribute('aria-busy', String(busy === 'saving'));
  saveButton.textContent = t(busy === 'saving' ? 'saving' : 'saveFolder');
  el('generate-label').textContent = t(busy === 'generating' ? 'generating' : 'generate');
  downloadButton.hidden = !hasResult;
  saveButton.hidden = !hasResult || !supportsDirectorySave();
}

function render() {
  updateControls();
  preview.setFile(currentFile, !!busy);
}

function openFile(picked: PickedFile | undefined) {
  if (!picked || busy) return;
  const kind = formatFor(picked.file.name);
  if (!kind) {
    notice('unsupportedFile', 'error');
    return;
  }
  currentFile = {
    file: picked.file,
    source: picked.handle,
    kind,
    ...splitName(picked.file.name),
    downloadNumber: 1,
  };
  exportName.value = '';
  notice();
  render();
  if (pageReaderLayout.matches) editorPanes.scrollTop = 0;
}

async function process(job: ProcessingJob, previewOnly = false): Promise<ArrayBuffer> {
  const active = previewOnly
    ? (previewWorker ??= await createProcessorWorker())
    : (worker ??= await createProcessorWorker());
  return new Promise((resolve, reject) => {
    function cleanup() {
      active.removeEventListener('message', receive);
      active.removeEventListener('error', fail);
      active.removeEventListener('messageerror', fail);
    }
    function receive({ data }: MessageEvent<ProcessingResult>) {
      cleanup();
      if ('error' in data) reject(errorFromMessage(data.error));
      else resolve(data.data);
    }
    function fail() {
      cleanup();
      active.terminate();
      if (previewOnly) previewWorker = undefined;
      else worker = undefined;
      reject(messageError('workerFailed'));
    }
    active.addEventListener('message', receive);
    active.addEventListener('error', fail);
    active.addEventListener('messageerror', fail);
    try { active.postMessage(job, [job.bytes]); }
    catch { fail(); }
  });
}

async function loadPdfPreview(item: PreviewItem, current: MarkOptions): Promise<Blob> {
  if (item.result) return item.result;
  const data = await process({ bytes: await item.file.arrayBuffer(), kind: 'pdf', options: current }, true);
  return new Blob([data], { type: 'application/pdf' });
}

async function generateWatermark() {
  const item = currentFile;
  const current = options();
  if (!item || busy || !current.text.trim()) return;
  busy = 'generating';
  notice();
  render();
  try {
    // Read the file before transferring bytes to the offline worker.
    const data = await process({ bytes: await item.file.arrayBuffer(), kind: item.kind, options: current });
    item.result = new Blob([data], { type: mediaType(item.kind) });
    notice('generated', 'success');
  } catch (error) {
    notice(() => errorText(error), 'error');
  } finally {
    busy = undefined;
    render();
  }
}

function downloadCurrent() {
  const item = currentFile;
  if (busy || !item?.result) return;
  try {
    const name = exportName.value
      ? validateStem(exportName.value) + item.extension
      : defaultName(item.stem, item.extension, item.downloadNumber);
    downloadFile(item.result, name);
    if (!exportName.value) item.downloadNumber++;
    updateControls();
    notice('downloaded', 'success');
  } catch (error) {
    notice(() => errorText(error), 'error');
  }
}

async function saveCurrent() {
  const item = currentFile;
  if (busy || !item?.result) return;
  busy = 'saving';
  render();
  try {
    const directory = await pickSaveDirectory(item.source);
    const filename = await saveToDirectory(directory, item.result, {
      stem: item.stem,
      extension: item.extension,
      customStem: exportName.value || undefined,
    });
    notice(() => t('saved', { name: filename }), 'success');
  } catch (error) {
    if (isAbort(error)) notice('cancelled');
    else notice(() => t('saveFailed', { error: errorText(error) }), 'error');
  } finally {
    busy = undefined;
    render();
  }
}

add.addEventListener('click', async () => {
  if (busy || opening) return;
  if (!supportsNativeOpen()) {
    fileInput.click();
    return;
  }
  opening = true;
  try {
    openFile(await pickLocalFile(t('pickerFormats')));
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'SecurityError' || error.name === 'NotAllowedError')) {
      fileInput.click();
    } else if (!isAbort(error)) notice(() => t('openFailed', { error: errorText(error) }), 'error');
  } finally {
    opening = false;
  }
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) openFile({ file });
  fileInput.value = '';
});

bindDesktopFileDrop({
  zone: workbench.querySelector<HTMLElement>('.preview-card')!,
  layout: wideLayout,
  enabled: () => !busy && !opening,
  open: openFile,
  multiple: () => notice('dropOne', 'error'),
});

settingsToggle.addEventListener('click', () => setInspector(!inspectorOpen));
el('close-inspector').addEventListener('click', () => setInspector(false));
expandPreview.addEventListener('click', () => presentPreview(true));
quickPreview.addEventListener('click', () => presentPreview(true, quickPreview));
// Offer the same preview from the dock once its thumbnail scrolls out of reach.
const previewCard = editorPanes.querySelector<HTMLElement>('.preview-card')!;
const cardObserver = new IntersectionObserver(([entry]) => {
  workbench.toggleAttribute('data-preview-away', entry.intersectionRatio < 0.4);
}, { root: editorPanes, threshold: 0.4 });
cardObserver.observe(previewCard);
closePreview.addEventListener('click', () => presentPreview(false));
surface.addEventListener('cancel', (event) => {
  event.preventDefault();
  presentPreview(false);
});
const previewBoard = surface.querySelector<HTMLElement>('.preview-board')!;
let blankPress: { x: number; y: number } | undefined;
surface.addEventListener('pointerdown', (event) => {
  const blank = event.target === surface || event.target === previewBoard;
  blankPress = surface.matches(':modal') && blank && event.isPrimary && event.button === 0
    ? { x: event.clientX, y: event.clientY } : undefined;
});
surface.addEventListener('pointercancel', () => { blankPress = undefined; });
surface.addEventListener('click', (event) => {
  const start = blankPress;
  blankPress = undefined;
  if (!start || !surface.matches(':modal') || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
  const end = document.elementFromPoint(event.clientX, event.clientY);
  if (end === previewBoard || end === surface || !surface.contains(end)) presentPreview(false);
});

generate.addEventListener('click', () => {
  finishNumericEdit();
  void generateWatermark();
});
downloadButton.addEventListener('click', downloadCurrent);
saveButton.addEventListener('click', () => { void saveCurrent(); });

function changeSetting(control: HTMLInputElement | HTMLTextAreaElement) {
  const jpegOnly = control === quality || control === clearExif;
  paint();
  if (currentFile?.result && (!jpegOnly || currentFile.kind === 'jpeg')) {
    currentFile.result = undefined;
    notice('settingsChanged');
    render();
  } else if (control === textInput) updateControls();
}

textInput.addEventListener('input', () => {
  editedText = true;
  changeSetting(textInput);
});
clearExif.addEventListener('change', () => changeSetting(clearExif));

for (const [range, field, reset] of numericSettings) {
  field.min = range.min;
  field.max = range.max;
  field.step = range.step || '1';
  field.value = range.value;
  function applyNumber(value: number) {
    const previous = range.value;
    range.valueAsNumber = value;
    if (range.value !== previous) changeSetting(range);
  }

  function commitNumber() {
    const value = field.valueAsNumber;
    if (Number.isFinite(value)) applyNumber(Math.round(value));
    field.value = range.value;
  }

  reset.addEventListener('click', () => {
    applyNumber(Number(range.defaultValue));
    field.value = range.value;
  });
  range.addEventListener('input', () => {
    field.value = range.value;
    changeSetting(range);
  });
  field.addEventListener('input', () => {
    const value = field.valueAsNumber;
    if (Number.isFinite(value) && field.validity.valid) applyNumber(value);
  });
  field.addEventListener('blur', commitNumber);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitNumber();
    }
  });
}

function refreshLanguage() {
  // Example text follows the interface only before a file or user edit exists.
  if (!currentFile && !editedText) textInput.value = t('defaultText');
  for (const [range, , reset] of numericSettings) {
    const label = range.labels![0].textContent!;
    const value = range.defaultValue + (range === quality ? '' : '%');
    const hint = t('resetTo', { label, value });
    reset.dataset.tooltip = hint;
    reset.setAttribute('aria-label', hint);
  }
  el('toggle-label').textContent = t(inspectorOpen ? 'collapse' : 'expand');
  paint();
  updateControls();
  preview.refreshLanguage();
  refreshNotice();
}

bindLanguageMenu(initialLanguage, (language) => {
  applyLanguage(language);
  refreshLanguage();
});
refreshLanguage();
render();

// The comparison page can start with the same local artwork in every edition.
if (location.hash === '#sample') {
  history.replaceState(history.state, '', location.href.split('#')[0]);
  const bytes = decodeBase64(comparisonSample.slice(comparisonSample.indexOf(',') + 1));
  openFile({ file: new File([bytes], '海岸等高线.jpg', { type: 'image/jpeg' }) });
}
