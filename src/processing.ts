import type { UiMessage } from './messages.ts';
import type { MarkOptions } from './layout.ts';

export type FileKind = 'jpeg' | 'pdf';
export type ProcessingJob = { bytes: ArrayBuffer; kind: FileKind; options: MarkOptions; wasmGzip?: ArrayBuffer };
export type ProcessingResult = { data: ArrayBuffer } | { error: UiMessage };

export function formatFor(filename: string): FileKind | undefined {
  if (/\.jpe?g$/i.test(filename)) return 'jpeg';
  if (/\.pdf$/i.test(filename)) return 'pdf';
}

export function mediaType(kind: FileKind) {
  return kind === 'jpeg' ? 'image/jpeg' : 'application/pdf';
}
