import simplifiedChinese from './locales/zh-CN.ts';
import { messageError } from './messages.ts';

export type SourceFileHandle = FileSystemFileHandle;
export type DestinationDirectory = FileSystemDirectoryHandle;

export interface PickedFile {
  file: File;
  handle?: SourceFileHandle;
}

interface LocalPickerWindow extends Window {
  showOpenFilePicker?(options: {
    multiple: boolean;
    types: { description: string; accept: Record<string, string[]> }[];
    excludeAcceptAllOption: boolean;
  }): Promise<SourceFileHandle[]>;
  showDirectoryPicker?(options: {
    mode: 'readwrite';
    startIn?: SourceFileHandle;
  }): Promise<DestinationDirectory>;
}

function unsupportedPicker(key: 'noPicker' | 'noDirectory') {
  return Object.assign(new DOMException(simplifiedChinese[key], 'NotSupportedError'), { uiMessage: { key } });
}

export function supportsNativeOpen(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext &&
    typeof (window as LocalPickerWindow).showOpenFilePicker === 'function';
}

export function supportsDirectorySave(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext &&
    typeof (window as LocalPickerWindow).showDirectoryPicker === 'function';
}

export async function pickLocalFile(description = simplifiedChinese.pickerFormats): Promise<PickedFile | undefined> {
  const picker = window as LocalPickerWindow;
  if (!supportsNativeOpen() || !picker.showOpenFilePicker) {
    throw unsupportedPicker('noPicker');
  }

  const [handle] = await picker.showOpenFilePicker({
    multiple: false,
    excludeAcceptAllOption: true,
    types: [{
      description,
      accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'application/pdf': ['.pdf'] },
    }],
  });
  if (handle) return { file: await handle.getFile(), handle };
}

export async function pickSaveDirectory(source?: SourceFileHandle): Promise<DestinationDirectory> {
  const picker = window as LocalPickerWindow;
  if (!supportsDirectorySave() || !picker.showDirectoryPicker) {
    throw unsupportedPicker('noDirectory');
  }

  return picker.showDirectoryPicker({ mode: 'readwrite', startIn: source });
}

export function splitName(original: string): { stem: string; extension: string } {
  const dot = original.lastIndexOf('.');
  return dot > 0 ? { stem: original.slice(0, dot), extension: original.slice(dot) } : { stem: original, extension: '' };
}

export function defaultName(stem: string, extension: string, sequence = 1): string {
  return `${stem}_水印版_${String(sequence).padStart(2, '0')}${extension}`;
}

export function validateStem(stem: string): string {
  const name = stem.trim();
  if (!name || name.endsWith('.') || /[<>:"/\\|?*\u0000-\u001f]/u.test(name)) {
    throw messageError('invalidName');
  }
  if (/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(name)) {
    throw messageError('reservedName');
  }
  return name;
}

async function nameIsTaken(directory: DestinationDirectory, name: string): Promise<boolean> {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return false;
    if (error instanceof DOMException && error.name === 'TypeMismatchError') return true;
    throw error;
  }
}

export async function saveToDirectory(
  directory: DestinationDirectory,
  result: Blob,
  naming: { stem: string; extension: string; customStem?: string },
): Promise<string> {
  let name: string;
  if (naming.customStem !== undefined) {
    name = validateStem(naming.customStem) + naming.extension;
    if (await nameIsTaken(directory, name)) throw messageError('nameTaken', { name });
  } else {
    let sequence = 1;
    do {
      name = defaultName(naming.stem, naming.extension, sequence++);
    } while (await nameIsTaken(directory, name));
  }

  const handle = await directory.getFileHandle(name, { create: true });
  // There is no atomic exclusive-create API. Recheck immediately before opening a writer.
  if ((await handle.getFile()).size !== 0) throw messageError('nameJustTaken', { name });

  try {
    await result.stream().pipeTo(await handle.createWritable());
  } catch (writeError) {
    try {
      const current = await directory.getFileHandle(name);
      if (await current.isSameEntry(handle) && (await current.getFile()).size === 0) {
        await directory.removeEntry(name);
      }
    } catch (cleanupError) {
      if (!(cleanupError instanceof DOMException && cleanupError.name === 'NotFoundError')) {
        throw messageError('writeFailed', { name }, { cause: writeError });
      }
    }
    throw writeError;
  }
  return name;
}

export function downloadFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // The browser may start a download after the click returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
