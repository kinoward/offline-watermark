import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  defaultName,
  pickLocalFile,
  pickSaveDirectory,
  saveToDirectory,
  splitName,
  supportsDirectorySave,
  supportsNativeOpen,
  validateStem,
} from '../../src/file-io.ts';

const result = new Blob(['水印内容']);

function fakeDirectory(initial = {}, writeError) {
  const entries = new Map(Object.entries(initial).map(([name, entry]) => [name.toLowerCase(), entry]));
  return {
    entries,
    async getFileHandle(name, { create = false } = {}) {
      const key = name.toLowerCase();
      if (!entries.has(key)) {
        if (!create) throw new DOMException('No entry', 'NotFoundError');
        entries.set(key, { content: new Blob() });
      }
      const entry = entries.get(key);
      if (entry === 'directory') throw new DOMException('Not a file', 'TypeMismatchError');
      return {
        entry,
        async getFile() { return entry.content; },
        async isSameEntry(other) { return other.entry === entry; },
        async createWritable() {
          const parts = [];
          return new WritableStream({
            write(chunk) {
              if (writeError) throw writeError;
              parts.push(chunk);
            },
            close() { entry.content = new Blob(parts); },
          });
        },
      };
    },
    async removeEntry(name) { entries.delete(name.toLowerCase()); },
  };
}

test('names preserve the source extension and reject path and device names', () => {
  assert.deepEqual(splitName('扫描件.凭据.JPEG'), { stem: '扫描件.凭据', extension: '.JPEG' });
  assert.equal(defaultName('合同', '.PDF'), '合同_水印版_01.PDF');
  assert.equal(defaultName('合同', '.PDF', 100), '合同_水印版_100.PDF');
  assert.equal(validateStem('  合同 2026  '), '合同 2026');
  for (const invalid of ['', '..', '子目录/文件', '子目录\\文件', 'NUL', 'LPT1.backup', '名称.']) {
    assert.throws(() => validateStem(invalid));
  }
});

test('native picker opens one file and saving starts in its source directory', async () => {
  const source = { async getFile() { return new File([], '合同.PDF'); } };
  const destination = {};
  globalThis.window = {
    isSecureContext: false,
    async showOpenFilePicker(options) {
      assert.equal(options.multiple, false);
      assert.deepEqual(options.types[0].accept, { 'image/jpeg': ['.jpg', '.jpeg'], 'application/pdf': ['.pdf'] });
      return [source];
    },
    async showDirectoryPicker(options) {
      assert.deepEqual(options, { mode: 'readwrite', startIn: source });
      return destination;
    },
  };
  try {
    assert.equal(supportsNativeOpen(), false);
    assert.equal(supportsDirectorySave(), false);
    window.isSecureContext = true;
    assert.equal(supportsNativeOpen(), true);
    assert.equal(supportsDirectorySave(), true);
    const picked = await pickLocalFile();
    assert.equal(picked.file.name, '合同.PDF');
    assert.equal(picked.handle, source);
    assert.equal(await pickSaveDirectory(picked.handle), destination);
    window.showOpenFilePicker = async () => [];
    assert.equal(await pickLocalFile(), undefined);
    window.showOpenFilePicker = async () => { throw new DOMException('Cancelled', 'AbortError'); };
    await assert.rejects(pickLocalFile(), { name: 'AbortError' });
    window.showDirectoryPicker = async () => { throw new DOMException('Cancelled', 'AbortError'); };
    await assert.rejects(pickSaveDirectory(picked.handle), { name: 'AbortError' });
  } finally {
    delete globalThis.window;
  }
});

test('default exports skip colliding files and directories and keep incrementing', async () => {
  const original = { content: new Blob(['源文件']) };
  const prior = { content: new Blob(['此前版本']) };
  const dir = fakeDirectory({ '合同.PDF': original, '合同_水印版_01.pdf': prior, '合同_水印版_02.PDF': 'directory' });
  const naming = splitName('合同.PDF');
  assert.equal(await saveToDirectory(dir, result, naming), '合同_水印版_03.PDF');
  assert.equal(await saveToDirectory(dir, result, naming), '合同_水印版_04.PDF');
  assert.equal(await dir.entries.get('合同.pdf').content.text(), '源文件');
  assert.equal(await dir.entries.get('合同_水印版_01.pdf').content.text(), '此前版本');
  assert.equal(await dir.entries.get('合同_水印版_03.pdf').content.text(), '水印内容');
});

test('a custom name preserves the extension and cannot overwrite the original', async () => {
  const dir = fakeDirectory({ '原图.JPEG': { content: new Blob() } });
  const naming = splitName('原图.JPEG');
  await assert.rejects(saveToDirectory(dir, result, { ...naming, customStem: '原图' }), /已存在/);
  assert.equal(dir.entries.get('原图.jpeg').content.size, 0);
  assert.equal(await saveToDirectory(dir, result, { ...naming, customStem: '  已加水印  ' }), '已加水印.JPEG');
});

test('a failed write cleans up only the new empty entry and reports the failure', async () => {
  const writeError = new DOMException('Disk full', 'QuotaExceededError');
  const dir = fakeDirectory({ '原图.jpg': { content: new Blob(['原图']) } }, writeError);
  await assert.rejects(saveToDirectory(dir, result, splitName('原图.jpg')), { name: 'QuotaExceededError' });
  assert.equal(dir.entries.has('原图_水印版_01.jpg'), false);
  assert.equal(await dir.entries.get('原图.jpg').content.text(), '原图');
});
