import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as codec from '@imagemagick/magick-wasm';
import { applyJpegOverlay } from '../../src/jpeg.ts';
import { inspectJpeg } from '../../src/jpeg-metadata.ts';

const { ImageMagick, MagickColor, MagickFormat } = codec;
const asBuffer = (value) => Uint8Array.from(value).buffer;
const fixture = (name) => asBuffer(readFileSync(new URL(`../fixtures/${name}.jpg`, import.meta.url)));
await codec.initializeImageMagick(readFileSync(new URL(import.meta.resolve('@imagemagick/magick-wasm/magick.wasm'))));
const overlay = ImageMagick.read(new MagickColor('#37373abf'), 54, 26,
  (image) => image.write(MagickFormat.Png, asBuffer));

// Generated cjpeg fixtures use synthetic pixel data. The progressive sample
// embeds the CC0 sRGB-v4 profile from saucecontrol/Compact-ICC-Profiles.
test('preserves progressive 4:2:2 JPEG, ICC, orientation and both declared densities', () => {
  const input = fixture('progressive-422-exif');
  const source = inspectJpeg(input);
  const high = applyJpegOverlay(codec, input, overlay, 100, source);
  const low = applyJpegOverlay(codec, input, overlay, 45, source);

  for (const encoded of [high, low]) {
    const result = inspectJpeg(encoded);
    assert.deepEqual([result.width, result.height, result.orientation], [100, 72, 6]);
    assert.equal(result.progressive, true);
    assert.equal(result.sampling, '2x1,1x1,1x1');
    assert.deepEqual([...result.jfif.payload.slice(7, 12)], [1, 1, 44, 1, 43]); // JFIF: 300×299 pixels/inch
    assert.deepEqual(result.exif.payload, source.exif.payload); // EXIF: 120×119 pixels/cm
    assert.equal(result.icc[0].payload.length, 494);
    assert.deepEqual(result.icc[0].payload, source.icc[0].payload);
  }

  assert.ok(high.byteLength > low.byteLength);
});

test('clears EXIF while applying its orientation and keeping ICC and JPEG encoding settings', () => {
  const input = fixture('progressive-422-exif');
  const source = inspectJpeg(input);
  const result = inspectJpeg(applyJpegOverlay(codec, input, overlay, 100, source, true));

  assert.equal(result.exif, undefined);
  assert.deepEqual([result.width, result.height, result.orientation], [72, 100, 1]);
  assert.equal(result.sampling, source.sampling);
  assert.equal(result.progressive, source.progressive);
  assert.deepEqual(result.icc.map(({ payload }) => payload), source.icc.map(({ payload }) => payload));
  assert.deepEqual(result.jfif.payload, source.jfif.payload);

  const bytes = new Uint8Array(input);
  const exifOnly = asBuffer([...bytes.subarray(0, source.jfif.start), ...bytes.subarray(source.jfif.end)]);
  const exifOnlyResult = inspectJpeg(applyJpegOverlay(codec, exifOnly, overlay, 100, inspectJpeg(exifOnly), true));
  assert.equal(exifOnlyResult.exif, undefined);
  assert.deepEqual([...exifOnlyResult.jfif.payload.slice(7, 12)], [2, 0, 120, 0, 119]);
});

test('preserves baseline 4:2:0 and grayscale JPEG and actually changes the painted pixels', () => {
  for (const [name, expectedSampling] of [['baseline-420', '2x2,1x1,1x1'], ['gray', '1x1']]) {
    const input = fixture(name);
    const result = applyJpegOverlay(codec, input, overlay, 100, inspectJpeg(input));
    const info = inspectJpeg(result);
    assert.equal(info.progressive, false);
    assert.equal(info.sampling, expectedSampling);
    assert.deepEqual([info.width, info.height], [100, 72]);
    const readRedAtOrigin = (bytes) => ImageMagick.read(new Uint8Array(bytes), MagickFormat.Jpeg, (image) =>
      image.getPixels((pixels) => pixels.getArea(0, 0, 1, 1)[0]));
    assert.ok(readRedAtOrigin(result) > readRedAtOrigin(input) + 20);
  }
});

test('rejects a truncated image instead of exporting a partly decoded JPEG', () => {
  assert.throws(() => inspectJpeg(fixture('baseline-420').slice(0, -2)), /损坏|不完整/);
});

test('the original EXIF thumbnail is not carried into the watermarked file', () => {
  const original = fixture('progressive-422-exif');
  const originalExif = inspectJpeg(original).exif;
  const thumbnail = new Uint8Array(fixture('gray'));
  const directoryLength = 2 + 12 * 2 + 4;
  const header = new Uint8Array(4 + originalExif.payload.length + directoryLength);
  const view = new DataView(header.buffer);
  header.set([0xff, 0xe1]);
  view.setUint16(2, header.length + thumbnail.length - 2);
  header.set(originalExif.payload, 4);
  const tiffStart = 4 + 6;
  const rootLink = tiffStart + 8 + 2 + 4 * 12;
  view.setUint32(rootLink, header.length - directoryLength - tiffStart, true);
  const ifd = header.length - directoryLength;
  view.setUint16(ifd, 2, true);
  for (const [entry, tag, value] of [
    [ifd + 2, 0x0201, header.length - tiffStart],
    [ifd + 14, 0x0202, thumbnail.length],
  ]) {
    view.setUint16(entry, tag, true);
    view.setUint16(entry + 2, 4, true);
    view.setUint32(entry + 4, 1, true);
    view.setUint32(entry + 8, value, true);
  }
  const input = Uint8Array.from([
    ...new Uint8Array(original).subarray(0, originalExif.start),
    ...header, ...thumbnail,
    ...new Uint8Array(original).subarray(originalExif.end),
  ]).buffer;
  const result = inspectJpeg(applyJpegOverlay(codec, input, overlay, 100, inspectJpeg(input)));
  assert.equal(result.orientation, 6);
  const exif = result.exif.payload;
  assert.equal(new DataView(exif.buffer, exif.byteOffset).getUint32(rootLink - 4, true), 0);
  assert.ok(exif.subarray(exif.length - thumbnail.length).every((byte) => byte === 0));
});
