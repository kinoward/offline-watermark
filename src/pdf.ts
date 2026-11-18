import { messageError } from './messages.ts';
import {
  clip,
  concatTransformationMatrix,
  drawObject,
  EncryptedPDFError,
  endPath,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFInvalidObject,
  PDFName,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
} from 'pdf-lib';
import type { PDFImage, PDFPage } from 'pdf-lib';
import { createTile, tilePositions } from './layout.ts';
import type { MarkOptions, Tile } from './layout.ts';

const sigType = PDFName.of('Sig');
const timestampType = PDFName.of('DocTimeStamp');
const byteRange = PDFName.of('ByteRange');
const fieldType = PDFName.of('FT');
const fieldValue = PDFName.of('V');
const signatureFilter = PDFName.of('Filter');

function hasDigitalSignature(document: PDFDocument) {
  const permissions = document.catalog.lookup(PDFName.of('Perms'));
  if (permissions instanceof PDFDict && permissions.has(PDFName.of('DocMDP'))) return true;

  // Inspect dictionaries without opening the form, which can remove XFA data.
  // Include direct dictionaries and signature timestamps as well as form fields.
  const pending = document.context.enumerateIndirectObjects().map(([, object]) => object);
  if (pending.some((object) => object instanceof PDFInvalidObject)) {
    throw messageError('corruptPdf');
  }
  const visited = new Set<PDFDict | PDFArray>();
  while (pending.length) {
    const object = pending.pop();
    if (!(object instanceof PDFDict || object instanceof PDFArray) || visited.has(object)) continue;
    visited.add(object);
    if (object instanceof PDFArray) {
      for (const child of object.asArray()) pending.push(child);
      continue;
    }

    const type = object.lookup(PDFName.Type);
    if (type === sigType || type === timestampType) return true;
    if (object.lookup(fieldType) === sigType && object.lookup(fieldValue) instanceof PDFDict) return true;
    if (object.lookup(byteRange) instanceof PDFArray &&
        object.has(PDFName.Contents) && object.has(signatureFilter)) return true;

    for (const child of object.values()) pending.push(child);
  }
  return false;
}

function pageGeometry(page: PDFPage) {
  const media = page.getMediaBox();
  const crop = page.getCropBox();
  const x = Math.max(Math.min(media.x, media.x + media.width), Math.min(crop.x, crop.x + crop.width));
  const y = Math.max(Math.min(media.y, media.y + media.height), Math.min(crop.y, crop.y + crop.height));
  const right = Math.min(Math.max(media.x, media.x + media.width), Math.max(crop.x, crop.x + crop.width));
  const top = Math.min(Math.max(media.y, media.y + media.height), Math.max(crop.y, crop.y + crop.height));
  const width = right - x;
  const height = top - y;
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0 || rotation % 90 !== 0) {
    throw messageError('pdfGeometry');
  }

  // Counter the viewer's rotation by mapping display-space coordinates into
  // the unrotated page, taking the effective CropBox origin into account.
  const transform = rotation === 90 ? concatTransformationMatrix(0, 1, -1, 0, right, y)
    : rotation === 180 ? concatTransformationMatrix(-1, 0, 0, -1, right, top)
    : rotation === 270 ? concatTransformationMatrix(0, -1, 1, 0, x, top)
    : concatTransformationMatrix(1, 0, 0, 1, x, y);
  const swap = rotation === 90 || rotation === 270;
  return { x, y, width, height, transform, displayWidth: swap ? height : width, displayHeight: swap ? width : height };
}

function overlay(page: PDFPage, tile: Tile, image: PDFImage, geometry: ReturnType<typeof pageGeometry>, density: number) {
  const { x, y, width, height, transform, displayWidth, displayHeight } = geometry;

  // PDF pages can share an indirect Contents array or inherited resources.
  // Copy these containers before appending; their existing streams stay intact.
  const contents = page.node.Contents();
  if (contents instanceof PDFArray) page.node.set(PDFName.Contents, contents.clone());
  const resources = page.node.Resources()?.clone();
  if (resources) {
    const xObjects = resources.lookupMaybe(PDFName.XObject, PDFDict);
    if (xObjects) resources.set(PDFName.XObject, xObjects.clone());
    page.node.set(PDFName.Resources, resources);
  }
  const imageName = page.node.newXObject('TextWatermark', image.ref);
  page.pushOperators(pushGraphicsState(), rectangle(x, y, width, height), clip(), endPath(), transform);
  for (const position of tilePositions(displayWidth, displayHeight, tile, density)) {
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(tile.width, 0, 0, tile.height, position.x, displayHeight - position.y - tile.height),
      drawObject(imageName),
      popGraphicsState(),
    );
  }
  page.pushOperators(popGraphicsState());
}

export async function watermarkPdf(input: ArrayBuffer, options: MarkOptions): Promise<ArrayBuffer> {
  let document: PDFDocument;
  try {
    // Let the parser reach the trailer even if an encrypted object stream
    // cannot be parsed; reject unrecoverable objects in unencrypted PDFs below.
    document = await PDFDocument.load(input, { updateMetadata: false });
  } catch (error) {
    // pdf-lib 1.17 transpiles this Error subclass to ES5, losing instanceof.
    if (error instanceof Error && error.message === new EncryptedPDFError().message) {
      throw messageError('encryptedPdf');
    }
    throw messageError('corruptPdf', undefined, { cause: error });
  }
  if (!document.catalog) throw messageError('corruptPdf');
  if (hasDigitalSignature(document)) throw messageError('signedPdf');

  const pages = document.getPages();
  if (!pages.length) throw messageError('emptyPdf');
  if (!options.text.trim()) return input;

  const tiles = new Map<number, { tile: Tile; image: PDFImage }>();
  for (const page of pages) {
    const geometry = pageGeometry(page);
    const shortSide = Math.min(geometry.displayWidth, geometry.displayHeight);
    let cached = tiles.get(shortSide);
    if (!cached) {
      const tile = await createTile(options, shortSide, Math.min(300 / 72, 2048 / shortSide));
      cached = { tile, image: await document.embedPng(tile.png) };
      tiles.set(shortSide, cached);
    }
    overlay(page, cached.tile, cached.image, geometry, options.density);
  }

  const saved = await document.save({ addDefaultPage: false, updateFieldAppearances: false });
  return new Uint8Array(saved).buffer;
}
