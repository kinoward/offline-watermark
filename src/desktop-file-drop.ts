import type { PickedFile } from './file-io.ts';

interface DropOptions {
  zone: HTMLElement;
  layout: MediaQueryList;
  enabled: () => boolean;
  open: (picked: PickedFile) => void;
  multiple: () => void;
}

interface FileItem extends DataTransferItem {
  getAsFileSystemHandle?(): Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null>;
}

export function bindDesktopFileDrop({ zone, layout, enabled, open, multiple }: DropOptions) {
  let depth = 0;
  let lastDrop = 0;

  function resetDrag() {
    depth = 0;
    zone.removeAttribute('data-file-drag');
    zone.removeAttribute('data-file-over');
  }

  function accepts(event: DragEvent) {
    return enabled() && event.target instanceof Node && zone.contains(event.target);
  }

  function updateDrag(event: DragEvent) {
    const transfer = event.dataTransfer;
    if (!layout.matches || !transfer?.types.includes('Files')) return;
    event.preventDefault();
    if (event.type === 'dragenter') depth++;
    const over = accepts(event);
    zone.toggleAttribute('data-file-drag', enabled());
    zone.toggleAttribute('data-file-over', over);
    transfer.dropEffect = over ? 'copy' : 'none';
  }

  window.addEventListener('dragenter', updateDrag, true);
  window.addEventListener('dragover', updateDrag, true);
  window.addEventListener('dragleave', (event) => {
    if (layout.matches && event.dataTransfer?.types.includes('Files') && --depth <= 0) resetDrag();
  }, true);
  window.addEventListener('drop', async (event) => {
    const transfer = event.dataTransfer;
    if (!layout.matches || !transfer?.types.includes('Files')) return;
    event.preventDefault();
    resetDrag();
    if (!accepts(event)) return;
    const drop = ++lastDrop;
    const item = Array.from(transfer.items).find((entry) => entry.kind === 'file') as FileItem | undefined;
    const file = transfer.files[0];
    if (transfer.files.length !== 1 || item?.webkitGetAsEntry?.()?.isDirectory) {
      multiple();
      return;
    }
    // Capture both values during the drop event, before the drag data store closes.
    // Some browsers expose the file but decline the optional directory hint.
    const handle = await item?.getAsFileSystemHandle?.().catch(() => null);
    if (drop !== lastDrop || !layout.matches || !enabled()) return;
    if (handle?.kind === 'directory') multiple();
    else open({ file, handle: handle ?? undefined });
  }, true);
  window.addEventListener('blur', resetDrag);
  window.addEventListener('dragend', resetDrag, true);
  layout.addEventListener('change', resetDrag);
}
