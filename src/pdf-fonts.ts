import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';

// A CID collection identifies the script even when a font uses Identity-H.
// PDFium's isolated WASM environment cannot substitute device CJK fonts.
function usesDeviceCjkFont(font: PDFDict) {
  const descendants = font.lookupMaybe(PDFName.of('DescendantFonts'), PDFArray);
  if (!descendants) return false;
  for (let i = 0; i < descendants.size(); i++) {
    const cid = descendants.lookupMaybe(i, PDFDict);
    const info = cid?.lookupMaybe(PDFName.of('CIDSystemInfo'), PDFDict);
    const ordering = info?.lookup(PDFName.of('Ordering'));
    if (!(ordering instanceof PDFString || ordering instanceof PDFHexString) ||
        !/^(GB1|CNS1|Japan1|Japan2|Korea1|KR)$/.test(ordering.decodeText())) continue;
    const descriptor = cid?.lookupMaybe(PDFName.of('FontDescriptor'), PDFDict);
    if (!['FontFile', 'FontFile2', 'FontFile3'].some(key => descriptor?.has(PDFName.of(key)))) return true;
  }
  return false;
}

export async function pagesWithDeviceCjkFonts(data: ArrayBuffer) {
  const pdf = await PDFDocument.load(data, { updateMetadata: false });
  function hasFont(resources: PDFDict | undefined, visited: Set<PDFDict>): boolean {
    if (!resources || visited.has(resources)) return false;
    visited.add(resources);
    const fonts = resources.lookupMaybe(PDFName.of('Font'), PDFDict);
    if (fonts?.keys().some(key => {
      const font = fonts.lookupMaybe(key, PDFDict);
      return font && usesDeviceCjkFont(font);
    })) return true;
    const objects = resources.lookupMaybe(PDFName.of('XObject'), PDFDict);
    return !!objects?.keys().some(key => {
      const object = objects.lookup(key);
      if (!object || !('dict' in object) || !(object.dict instanceof PDFDict) ||
          object.dict.get(PDFName.of('Subtype')) !== PDFName.of('Form')) return false;
      return hasFont(object.dict.lookupMaybe(PDFName.of('Resources'), PDFDict), visited);
    });
  }
  return pdf.getPages().map(page => hasFont(page.node.Resources(), new Set()));
}
