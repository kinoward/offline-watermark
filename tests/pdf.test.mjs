import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  decodePDFRawStream,
  degrees,
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
} from 'pdf-lib';
import { watermarkPdf } from '../src/pdf.ts';

const pixels = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAICAYAAADwdn+XAAAAL0lEQVR4nGM0MjKKYkAC586dW8aAB6CrZ2KgEDASUkDIhUxUd4ERiWFCuQsGPBYAtqAR7Vz0i4gAAAAASUVORK5CYII=',
  'base64',
);
const options = { text: '内部资料\n仅供审核', opacity: 0.2, quality: 100, size: 1, density: 1 };
const originalCanvas = globalThis.OffscreenCanvas;

// Node does not have a Canvas renderer. Supply a transparent image so the
// actual layout and PDF encoder can run; browser QA covers the text raster.
before(() => {
  globalThis.OffscreenCanvas = class {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }
    getContext() {
      return {
        measureText(text) { return { width: text.length * Number(this.font.match(/[\d.]+px/)[0].slice(0, -2)) }; },
        scale() {},
        translate() {},
        rotate() {},
        fillText() {},
      };
    }
    async convertToBlob() { return new Blob([pixels], { type: 'image/png' }); }
  };
});
after(() => {
  if (originalCanvas) globalThis.OffscreenCanvas = originalCanvas;
  else delete globalThis.OffscreenCanvas;
});

function buffer(bytes) {
  return new Uint8Array(bytes).buffer;
}

function boxes(page) {
  return [
    page.getMediaBox(), page.getCropBox(), page.getBleedBox(), page.getTrimBox(),
    page.getArtBox(), page.getRotation().angle, page.node.get(PDFName.of('UserUnit'))?.toString(),
  ];
}

function compressedObjects(doc) {
  return new Map(
    doc.context.enumerateIndirectObjects()
      .filter(([, object]) => object instanceof PDFRawStream)
      .map(([ref, stream]) => [
        ref.toString(),
        { filter: stream.dict.get(PDFName.Filter)?.toString(), bytes: Buffer.from(stream.getContents()) },
      ]),
  );
}

test('overlays every page while preserving boxes, rotation, metadata, and original compressed streams', async () => {
  const original = await PDFDocument.create();
  original.setTitle('Original pages');
  const image = await original.embedPng(pixels);
  for (const angle of [0, 90, 180, 270]) {
    const page = original.addPage(angle % 180 === 0 ? [420, 645] : [645, 420]);
    page.setRotation(degrees(angle));
    page.setCropBox(20, 35, page.getWidth() - 45, page.getHeight() - 70);
    page.setTrimBox(25, 40, page.getWidth() - 55, page.getHeight() - 80);
    page.setBleedBox(23, 37, page.getWidth() - 50, page.getHeight() - 75);
    page.setArtBox(28, 44, page.getWidth() - 60, page.getHeight() - 88);
    page.node.set(PDFName.of('UserUnit'), PDFNumber.of(1.25));
    page.drawText('Original searchable text', { x: 65, y: 100 });
    page.drawImage(image, { x: 77, y: 125, width: 22, height: 11 });
  }

  const input = buffer(await original.save());
  const before = await PDFDocument.load(input, { updateMetadata: false });
  const after = await PDFDocument.load(await watermarkPdf(input, options), { updateMetadata: false });
  assert.equal(after.getTitle(), before.getTitle());
  assert.deepEqual(after.getModificationDate(), before.getModificationDate());
  assert.deepEqual(after.getPages().map(boxes), before.getPages().map(boxes));

  const inputStreams = compressedObjects(before);
  const outputStreams = compressedObjects(after);
  assert.ok(inputStreams.size >= 6);
  for (const [ref, originalStream] of inputStreams) {
    assert.deepEqual(outputStreams.get(ref), originalStream, `raw stream ${ref}`);
  }

  for (const page of after.getPages()) {
    const content = page.node.Contents();
    assert.ok(content instanceof PDFArray);
    const added = content.lookup(content.size() - 1, PDFRawStream);
    const operators = new TextDecoder().decode(decodePDFRawStream(added).decode());
    assert.match(operators, /20 35 .* re\nW\nn\n/);
    assert.ok((operators.match(/ Do\n/g)?.length ?? 0) > 10);
  }
});

test('rejects the encryption marker, existing signatures, and corrupt PDF data with distinct messages', async () => {
  const encrypted = await PDFDocument.create();
  encrypted.addPage();
  encrypted.context.trailerInfo.Encrypt = encrypted.context.register(
    encrypted.context.obj({ Filter: 'Standard' }),
  );
  await assert.rejects(watermarkPdf(buffer(await encrypted.save()), options), /请解密后再导入/);

  const signed = await PDFDocument.create();
  signed.addPage();
  const value = signed.context.obj({
    Type: 'Sig', Filter: 'Adobe.PPKLite', Contents: PDFHexString.of('ABCD'), ByteRange: [0, 10, 14, 20],
  });
  const field = signed.context.register(signed.context.obj({ FT: 'Sig', V: signed.context.register(value) }));
  signed.catalog.set(PDFName.of('AcroForm'), signed.context.obj({ Fields: [field] }));
  await assert.rejects(watermarkPdf(buffer(await signed.save()), options), /请使用未签名副本/);
  await assert.rejects(watermarkPdf(new ArrayBuffer(64), options), /无法读取 PDF/);
  const missingCatalog = new TextEncoder().encode('%PDF-1.7\ncorrupt\n%%EOF').buffer;
  await assert.rejects(watermarkPdf(missingCatalog, options), /无法读取 PDF/);
});

test('exports larger marks and independently changes their spacing', async () => {
  const original = await PDFDocument.create();
  original.addPage([420, 645]);
  const input = buffer(await original.save());
  const readTiles = async (overrides) => {
    const output = await PDFDocument.load(await watermarkPdf(input, { ...options, ...overrides }));
    const content = output.getPage(0).node.Contents();
    const stream = content.lookup(content.size() - 1, PDFRawStream);
    const operators = new TextDecoder().decode(decodePDFRawStream(stream).decode());
    return [...operators.matchAll(/^([\d.]+) 0 0 ([\d.]+) [-\d.]+ [-\d.]+ cm\n\/TextWatermark-\d+ Do$/gm)]
      .map(([, width, height]) => [Number(width), Number(height)]);
  };
  const normal = await readTiles({});
  const large = await readTiles({ size: 2 });
  const sparse = await readTiles({ density: 0.5 });
  const dense = await readTiles({ density: 2 });

  assert.ok(large[0][0] > normal[0][0] && large[0][1] > normal[0][1]);
  assert.deepEqual(sparse[0], dense[0]);
  assert.ok(sparse.length < normal.length && normal.length < dense.length);
});

test('an empty signature field does not prevent processing', async () => {
  const unsigned = await PDFDocument.create();
  unsigned.addPage([290, 430]);
  unsigned.catalog.set(PDFName.of('AcroForm'), unsigned.context.obj({
    Fields: [unsigned.context.register(unsigned.context.obj({ FT: 'Sig' }))],
  }));
  const result = await PDFDocument.load(await watermarkPdf(buffer(await unsigned.save()), options));
  assert.equal(result.getPageCount(), 1);
});
