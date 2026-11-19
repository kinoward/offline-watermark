import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { PDFArray, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { PDFiumLibrary } from '@hyzyla/pdfium';
import { inspectJpeg } from '../../src/jpeg-metadata.ts';
import { createSamplePdf } from '../../scripts/sample-pdf.mjs';

const [input = 'dist-offline/Watermark.html', ...requestedBrowsers] = process.argv.slice(2);
const target = /^https?:\/\//.test(input) ? new URL(input) : pathToFileURL(resolve(input));
const engines = { chromium, firefox, webkit };
const browsers = requestedBrowsers.length ? requestedBrowsers : Object.keys(engines);
const fixturePath = fileURLToPath(new URL('../fixtures/progressive-422-exif.jpg', import.meta.url));
const originalJpeg = await readFile(fixturePath);
const originalPdf = Buffer.from(await createSamplePdf());
const arrayBuffer = (bytes) => Uint8Array.from(bytes).buffer;
const originalDetails = inspectJpeg(arrayBuffer(originalJpeg));
const pdfium = await PDFiumLibrary.init();

const id = (page, key) => page.locator('#' + key);

async function visit(browser, options, run) {
  const context = await browser.newContext({
    locale: 'en-US', reducedMotion: 'reduce', serviceWorkers: 'block', ...options,
  });
  const unexpected = [];
  try {
    const page = await context.newPage();
    await context.route(/^https?:/, (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && request.url() === target.href &&
          request.frame() === page.mainFrame()) return route.continue();
      unexpected.push(request.url());
      return route.abort();
    });
    await context.routeWebSocket(/^wss?:/, (socket) => {
      unexpected.push(socket.url());
      return socket.close();
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.setDefaultTimeout(15_000);
    await page.goto(target.href);
    await id(page, 'add-files').waitFor();
    await run(page);
    assert.deepEqual(errors, [], 'Browser errors');
    assert.deepEqual(unexpected, [], 'Requests other than initial document navigation');
  } finally {
    await context.close();
  }
}

async function chooseFile(page, name, mimeType, buffer) {
  await id(page, 'file-input').setInputFiles({ name, mimeType, buffer });
}

async function openField(page, key) {
  const field = id(page, key);
  if (await field.isVisible()) return field;
  for (const summary of await field.locator('xpath=ancestor::details[not(@open)]/summary').all()) {
    await summary.click();
  }
  assert.ok(await field.isVisible(), key + ' is reachable');
  return field;
}

async function exportFile(page, name) {
  await id(page, 'generate').click();
  await id(page, 'download').waitFor();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    id(page, 'download').click(),
  ]);
  assert.equal(download.suggestedFilename(), name);
  return readFile(await download.path());
}

async function fitsWidth(page) {
  await page.waitForFunction(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  );
}

function quantizationTables(jpeg) {
  const tables = [];
  // DQT segments precede the first Start of Scan in these test outputs.
  for (let at = 2; at + 4 < jpeg.length && jpeg[at] === 0xff; ) {
    const marker = jpeg[at + 1];
    if (marker === 0xda) break;
    const end = at + 2 + jpeg.readUInt16BE(at + 2);
    if (marker === 0xdb) tables.push(jpeg.subarray(at + 4, end));
    at = end;
  }
  assert.ok(tables.length);
  return Buffer.concat(tables);
}

function checkJpeg(bytes, exifCleared) {
  const result = inspectJpeg(arrayBuffer(bytes));
  assert.deepEqual(result.icc.map((entry) => entry.payload), originalDetails.icc.map((entry) => entry.payload));
  assert.equal(result.sampling, originalDetails.sampling);
  assert.equal(result.progressive, originalDetails.progressive);
  assert.deepEqual(result.jfif.payload.subarray(7, 12), originalDetails.jfif.payload.subarray(7, 12));
  assert.equal(result.orientation, exifCleared ? 1 : originalDetails.orientation);
  assert.deepEqual([result.width, result.height], exifCleared
    ? [originalDetails.height, originalDetails.width]
    : [originalDetails.width, originalDetails.height]);
  assert.deepEqual(result.exif?.payload, exifCleared ? undefined : originalDetails.exif.payload);
}

async function dropPhoto(page) {
  // Exercise real desktop file dragging in Chromium. The other engines use
  // the same input path via the file chooser.
  const cdp = await page.context().newCDPSession(page);
  const box = await page.locator('.preview-board').boundingBox();
  const position = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  const data = { files: [fixturePath], items: [], dragOperationsMask: 1 };
  for (const type of ['dragEnter', 'dragOver', 'drop']) {
    await cdp.send('Input.dispatchDragEvent', { type, ...position, data });
  }
  await cdp.detach();
}

async function jpegFlow(page, engine) {
  await fitsWidth(page);
  const watermark = id(page, 'watermark-text');
  const initialText = await watermark.inputValue();
  if (engine === 'chromium') await dropPhoto(page);
  else await chooseFile(page, 'progressive-422-exif.jpg', 'image/jpeg', originalJpeg);
  const canvas = id(page, 'image-preview');
  await canvas.waitFor();
  const before = await canvas.evaluate((node) => node.toDataURL());
  await watermark.fill('Proof copy\nPrivate review');
  await page.waitForFunction((original) =>
    document.getElementById('image-preview').toDataURL() !== original, before
  );
  const originalQuality = await exportFile(page, 'progressive-422-exif_水印版_01.jpg');
  checkJpeg(originalQuality, false);
  assert.notDeepEqual(originalQuality, originalJpeg);

  const quality = await openField(page, 'quality-value');
  await quality.fill('72');
  await quality.press('Tab');
  const lowQuality = await exportFile(page, 'progressive-422-exif_水印版_02.jpg');
  checkJpeg(lowQuality, false);
  assert.notDeepEqual(quantizationTables(originalQuality), quantizationTables(lowQuality));

  await (await openField(page, 'clear-exif')).check();
  await id(page, 'export-name').fill('redacted-photo');
  const redacted = await exportFile(page, 'redacted-photo.jpg');
  checkJpeg(redacted, true);
  await chooseFile(page, 'redacted-photo.jpg', 'image/jpeg', redacted);
  await canvas.waitFor();
  await page.reload();
  await id(page, 'add-files').waitFor();
  assert.equal(await watermark.inputValue(), initialText);
  assert.equal(await id(page, 'quality-value').inputValue(), '100');
  assert.equal(await id(page, 'download').isVisible(), false);
  assert.equal(await id(page, 'workbench').getAttribute('data-has-file'), 'false');
}

function pdfBoxes(page) {
  return [
    page.getMediaBox(), page.getCropBox(), page.getTrimBox(), page.getBleedBox(), page.getArtBox(),
    page.getRotation().angle, page.node.get(PDFName.of('UserUnit'))?.toString(),
  ];
}

async function checkPdf(bytes) {
  const original = await PDFDocument.load(originalPdf, { updateMetadata: false });
  const result = await PDFDocument.load(bytes, { updateMetadata: false });
  assert.equal(result.getTitle(), original.getTitle());
  assert.deepEqual(result.getPages().map(pdfBoxes), original.getPages().map(pdfBoxes));
  for (const [ref, object] of original.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream) {
      const newObject = result.context.lookup(ref, PDFRawStream);
      assert.deepEqual(newObject.getContents(), object.getContents());
      assert.equal(newObject.dict.get(PDFName.Filter)?.toString(), object.dict.get(PDFName.Filter)?.toString());
    }
  }
  for (const page of result.getPages()) {
    const contents = page.node.Contents();
    assert.ok(contents instanceof PDFArray && contents.size() >= 2, 'Each page has a watermark content stream');
  }
  for (const buffer of [originalPdf, bytes]) {
    const doc = await pdfium.loadDocument(Uint8Array.from(buffer));
    try {
      const page = doc.getPage(0);
      try {
        assert.match(page.getText(), /Low tide reveals bands of sandstone/);
      } finally {
        page.close();
      }
    } finally {
      doc.destroy();
    }
  }
}

async function counter(page, text) {
  await page.waitForFunction((value) =>
    document.getElementById('pdf-page-count').textContent.trim() === value, text
  );
}

async function pdfFlow(page) {
  const jpegWasm = await id(page, 'imagemagick-wasm-data').evaluateHandle((node) => {
    node.remove();
    return node;
  });
  await chooseFile(page, 'field-study.pdf', 'application/pdf', originalPdf);
  const canvas = id(page, 'pdf-page-canvas');
  await canvas.waitFor();
  assert.equal(await id(page, 'jpeg-settings').isVisible(), false);
  await counter(page, '1 / 3');
  await id(page, 'pdf-page-next').click();
  await counter(page, '2 / 3');
  await page.getByRole('img', { name: 'PDF page 2 of 3' }).waitFor();
  const preview = await canvas.evaluate((node) => node.toDataURL());
  const href = await id(page, 'open-pdf-preview').getAttribute('href');
  await id(page, 'watermark-text').fill('Temporary copy\nWatermark');
  await id(page, 'opacity-value').fill('55');
  await id(page, 'opacity-value').press('Tab');
  assert.equal(await canvas.isVisible(), true, 'Previous preview remains visible while typing');
  await page.waitForFunction((before) => {
    const next = document.getElementById('open-pdf-preview').href;
    return next.startsWith('blob:') && next !== before;
  }, href);
  await page.waitForFunction((before) =>
    document.getElementById('pdf-page-canvas').toDataURL() !== before, preview
  );
  await counter(page, '2 / 3');
  await page.setViewportSize({ width: 1194, height: 834 });
  await fitsWidth(page);
  await id(page, 'expand-preview').click();
  await page.waitForFunction(() => document.getElementById('preview-surface').matches(':modal'));
  await counter(page, '2 / 3');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('preview-surface').matches(':modal'));
  await page.setViewportSize({ width: 390, height: 844 });
  await fitsWidth(page);
  await id(page, 'expand-preview').click();
  await counter(page, '2 / 3');
  const dialog = await id(page, 'preview-surface').boundingBox();
  assert.ok(dialog.x > 4, 'Preview leaves a dismissible backdrop');
  await page.mouse.click(Math.round(dialog.x / 2), Math.round(dialog.y + dialog.height / 2));
  await page.waitForFunction(() => !document.getElementById('preview-surface').matches(':modal'));
  assert.equal(await id(page, 'watermark-text').inputValue(), 'Temporary copy\nWatermark');
  const result = await exportFile(page, 'field-study_水印版_01.pdf');
  await checkPdf(result);

  for (const [file, message] of [
    ['encrypted.pdf', 'This PDF is encrypted. Decrypt it before importing.'],
    ['signed.pdf', 'This PDF is digitally signed. Use an unsigned copy.'],
  ]) {
    const bytes = await readFile(new URL('../fixtures/' + file, import.meta.url));
    await chooseFile(page, file, 'application/pdf', bytes);
    await page.waitForFunction((text) =>
      document.getElementById('preview-message').textContent === text, message
    );
  }

  await chooseFile(page, 'replacement.pdf', 'application/pdf', originalPdf);
  await canvas.waitFor();
  await counter(page, '1 / 3');

  // Use the same export worker for PDF and then JPEG. Its JPEG WASM must
  // remain available after a failed first JPEG job.
  await jpegWasm.evaluate((node) => document.body.append(node));
  await jpegWasm.dispose();
  await page.setViewportSize({ width: 1440, height: 900 });
  await chooseFile(page, 'invalid.jpg', 'image/jpeg', Buffer.from('invalid JPG'));
  await id(page, 'generate').click();
  await page.waitForFunction(() =>
    document.getElementById('notice-text').textContent ===
      'The file contents don’t match JPEG. Check for damage or a changed extension.'
  );
  await chooseFile(page, 'replacement.jpg', 'image/jpeg', originalJpeg);
  const jpeg = await exportFile(page, 'replacement_水印版_01.jpg');
  checkJpeg(jpeg, false);
}

try {
  for (const name of browsers) {
    const browser = await engines[name].launch();
    try {
      await visit(browser, { viewport: { width: 1440, height: 900 } }, (page) => jpegFlow(page, name));
      await visit(browser, { viewport: { width: 834, height: 1194 }, hasTouch: true }, pdfFlow);
      console.log(`${name} ${browser.version()}: JPEG, PDF, downloads, responsive preview, network and refresh checks passed`);
    } finally {
      await browser.close();
    }
  }
} finally {
  pdfium.destroy();
}
