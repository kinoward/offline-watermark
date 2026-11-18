import { messageError } from './messages.ts';
const corrupt = () => messageError('corruptJpeg');
const unsupported = () => messageError('unsupportedJpeg');

type Segment = { start: number; end: number; marker: number; payload: Uint8Array<ArrayBuffer> };

export type JpegMetadata = {
  width: number;
  height: number;
  progressive: boolean;
  componentCount: number;
  sampling: string;
  orientation: number;
  jfif: Segment | undefined;
  exif: Segment | undefined;
  icc: Segment[];
  segments: Segment[];
};

function beginsWith(bytes: Uint8Array, signature: string): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature.charCodeAt(i)) return false;
  }
  return true;
}

function exifTiff(payload: Uint8Array) {
  if (payload.length < 14) throw corrupt();
  const tiff = new DataView(payload.buffer, payload.byteOffset + 6, payload.byteLength - 6);
  const byteOrder = tiff.getUint16(0);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) throw corrupt();
  const le = byteOrder === 0x4949;
  if (tiff.getUint16(2, le) !== 42) throw corrupt();
  return { tiff, le, root: tiff.getUint32(4, le) };
}

function exifEntries(tiff: DataView, ifd: number, le: boolean) {
  if (ifd < 8 || ifd + 2 > tiff.byteLength) throw corrupt();
  const count = tiff.getUint16(ifd, le);
  const start = ifd + 2;
  const end = start + count * 12;
  if (end + 4 > tiff.byteLength) throw corrupt();
  return { start, end };
}

function orientationFromExif(payload: Uint8Array): number {
  const { tiff, le, root } = exifTiff(payload);
  if (root === 0) return 1;
  const { start, end } = exifEntries(tiff, root, le);
  for (let offset = start; offset < end; offset += 12) {
    if (tiff.getUint16(offset, le) !== 0x0112) continue;
    if (tiff.getUint16(offset + 2, le) !== 3 || tiff.getUint32(offset + 4, le) !== 1) throw corrupt();
    const orientation = tiff.getUint16(offset + 8, le);
    if (orientation < 1 || orientation > 8) throw corrupt();
    return orientation;
  }
  return 1;
}

// IFD1 can contain a copy of the unwatermarked photograph. Clear the usual
// JPEG thumbnail and detach IFD1, without shifting any IFD0 or MakerNote offsets.
function exifWithoutPreview(payload: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const { tiff, le, root } = exifTiff(payload);
  if (!root) return payload;
  const link = exifEntries(tiff, root, le).end;
  const preview = tiff.getUint32(link, le);
  if (!preview) return payload;
  const { start, end } = exifEntries(tiff, preview, le);
  let offset = 0;
  let size = 0;
  for (let entry = start; entry < end; entry += 12) {
    const tag = tiff.getUint16(entry, le);
    if (tag === 0x0111 || tag === 0x0144) {
      throw messageError('exifThumbnail');
    }
    if (tag !== 0x0201 && tag !== 0x0202) continue;
    const type = tiff.getUint16(entry + 2, le);
    if (tiff.getUint32(entry + 4, le) !== 1 || (type !== 3 && type !== 4)) throw corrupt();
    const value = type === 4 ? tiff.getUint32(entry + 8, le) : tiff.getUint16(entry + 8, le);
    if (tag === 0x0201) offset = value;
    else size = value;
  }

  const data = payload.slice();
  if (offset || size) {
    if (offset < end + 4 || !size || offset + size > tiff.byteLength) throw corrupt();
    data.fill(0, offset + 6, offset + 6 + size);
  }
  new DataView(data.buffer).setUint32(link + 6, 0, le);
  return data;
}

const isJfif = (marker: number, bytes: Uint8Array) => marker === 0xe0 && beginsWith(bytes, 'JFIF\0');
const isExif = (marker: number, bytes: Uint8Array) => marker === 0xe1 && beginsWith(bytes, 'Exif\0\0');
const isIcc = (marker: number, bytes: Uint8Array) => marker === 0xe2 && beginsWith(bytes, 'ICC_PROFILE\0');

export function inspectJpeg(input: ArrayBuffer): JpegMetadata {
  const bytes = new Uint8Array(input);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw messageError('invalidJpeg');

  const segments: Segment[] = [];
  const icc: Segment[] = [];
  let jfif: Segment | undefined;
  let exif: Segment | undefined;
  let frame: Segment | undefined;
  let isAdobeRgb = false;
  let offset = 2;
  let inScan = false;
  let hadScan = false;
  let ended = false;

  while (offset < bytes.length) {
    if (inScan) {
      offset = bytes.indexOf(0xff, offset);
      if (offset === -1) throw corrupt();
    }
    const start = offset;
    if (bytes[offset++] !== 0xff) throw corrupt();
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (inScan && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7))) continue;
    inScan = false;
    if (marker === 0xd9) {
      ended = true;
      break;
    }
    if (marker == null || marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) throw corrupt();
    if (marker === 1) continue; // TEM has no segment length.
    if (offset + 2 > bytes.length) throw corrupt();
    const len = bytes[offset] * 256 + bytes[offset + 1];
    const end = offset + len;
    if (len < 2 || end > bytes.length) throw corrupt();
    const payload = bytes.subarray(offset + 2, end);
    const segment = { start, end, marker, payload };
    offset = end;

    if (marker === 0xda) {
      inScan = true;
      hadScan = true;
    } else if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (frame || ![0xc0, 0xc2].includes(marker)) throw unsupported();
      frame = segment;
    } else if (isJfif(marker, payload)) {
      if (jfif || payload.length < 14 || payload[7] > 2 ||
        payload.length !== 14 + 3 * payload[12] * payload[13]) throw corrupt();
      jfif = segment;
      segments.push(segment);
    } else if (isExif(marker, payload)) {
      if (exif) throw unsupported();
      exif = segment;
      segments.push(segment);
    } else if (isIcc(marker, payload)) {
      if (payload.length < 14) throw corrupt();
      icc.push(segment);
      segments.push(segment);
    } else if (marker === 0xe0 && beginsWith(payload, 'JFXX\0')) {
      segments.push(segment); // A JFXX preview would still show the source pixels.
    } else if (marker === 0xe2 && beginsWith(payload, 'MPF\0')) {
      throw messageError('compositeJpeg');
    } else if (marker === 0xee && payload.length >= 12 && beginsWith(payload, 'Adobe')) {
      isAdobeRgb = payload[11] === 0;
    }
  }

  if (!ended || !hadScan || !frame || frame.payload.length < 6) throw corrupt();
  // Do not silently discard data such as a second JPEG or a Motion Photo.
  // Padding made solely of zero/FF bytes is harmless.
  if (bytes.subarray(offset).some((b) => b !== 0 && b !== 0xff)) throw unsupported();

  const { payload } = frame;
  const height = payload[1] * 256 + payload[2];
  const width = payload[3] * 256 + payload[4];
  const componentCount = payload[5];
  if (!width || !height || payload.length !== 6 + componentCount * 3) throw corrupt();
  if (payload[0] !== 8 || (componentCount !== 1 && componentCount !== 3) ||
    (componentCount === 3 && (isAdobeRgb || (payload[6] === 82 && payload[9] === 71 && payload[12] === 66)))) {
    throw unsupported();
  }

  const samplingParts: string[] = [];
  for (let i = 0; i < componentCount; i++) {
    const factor = payload[7 + i * 3];
    const x = factor >> 4;
    const y = factor & 0xf;
    if (x < 1 || x > 4 || y < 1 || y > 4) throw corrupt();
    samplingParts.push(`${x}x${y}`);
  }
  if (icc.length) {
    icc.sort((a, b) => a.payload[12] - b.payload[12]);
    if (icc.some(({ payload }, i) => payload[12] !== i + 1 || payload[13] !== icc.length)) throw corrupt();
  }

  return {
    width,
    height,
    progressive: frame.marker === 0xc2,
    componentCount,
    sampling: samplingParts.join(','),
    orientation: exif ? orientationFromExif(exif.payload) : 1,
    jfif,
    exif,
    icc,
    segments,
  };
}

function sameBytes(a: Uint8Array | undefined, b: Uint8Array | undefined): boolean {
  if (!a || !b) return a === b;
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

// Reattach the source JFIF/EXIF/ICC packets. In particular, ImageMagick
// computes a single density, but an input can declare different EXIF and JFIF densities.
export function restoreJpegMetadata(encoded: ArrayBuffer, source: JpegMetadata, clearExif: boolean): ArrayBuffer {
  const bytes = new Uint8Array(encoded);
  const result = inspectJpeg(encoded);
  const swapped = clearExif && source.orientation >= 5;
  const width = swapped ? source.height : source.width;
  const height = swapped ? source.width : source.height;
  if (result.width !== width || result.height !== height ||
    result.componentCount !== source.componentCount || result.sampling !== source.sampling ||
    result.progressive !== source.progressive) {
    throw messageError('jpegParams');
  }

  const parts: Uint8Array<ArrayBuffer>[] = [bytes.subarray(0, 2)];
  // When the source only declares density in EXIF, keep the encoder's JFIF density.
  const encodedDensity = clearExif && source.exif && result.jfif?.payload[7] ? result.jfif : undefined;
  const jfif = (source.jfif ?? encodedDensity)?.payload.slice(0, 14);
  if (jfif) { // Discard the optional JFIF thumbnail without changing density.
    jfif[12] = 0;
    jfif[13] = 0;
    parts.push(appSegment(0xe0, jfif));
  }
  const exif = !clearExif && source.exif ? exifWithoutPreview(source.exif.payload) : undefined;
  if (exif) parts.push(appSegment(0xe1, exif));
  for (const entry of source.icc) parts.push(appSegment(0xe2, entry.payload));

  let offset = 2;
  for (const segment of result.segments) {
    parts.push(bytes.subarray(offset, segment.start));
    offset = segment.end;
  }
  parts.push(bytes.subarray(offset));

  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  const restored = inspectJpeg(output.buffer);
  if (restored.orientation !== (clearExif ? 1 : source.orientation) ||
    !sameBytes(restored.jfif?.payload, jfif) ||
    !sameBytes(restored.exif?.payload, exif) ||
    restored.icc.length !== source.icc.length ||
    restored.icc.some(({ payload }, index) => !sameBytes(payload, source.icc[index].payload))) {
    throw messageError('jpegProfiles');
  }
  return output.buffer;
}

function appSegment(marker: number, payload: Uint8Array): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(4 + payload.length);
  data[0] = 0xff;
  data[1] = marker;
  new DataView(data.buffer).setUint16(2, payload.length + 2);
  data.set(payload, 4);
  return data;
}
