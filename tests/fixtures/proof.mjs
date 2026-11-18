import { readFile } from 'node:fs/promises';
import { degrees, PDFDocument, PDFName, PDFNumber, rgb, StandardFonts } from 'pdf-lib';

const coastline = new URL('../../src/comparison-sample.jpg', import.meta.url);

export async function proofPdf() {
  const pdf = await PDFDocument.create();
  pdf.setTitle('The tidal shelf');
  pdf.setAuthor('Watermark sample');
  const image = await pdf.embedJpg(await readFile(coastline));
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const paper = rgb(0.96, 0.94, 0.89);
  const ink = rgb(0.11, 0.22, 0.21);
  const accent = rgb(0.57, 0.31, 0.19);
  const pages = [
    { width: 520, height: 666, rotation: 0, label: 'The tidal shelf', subhead: 'Coastal field study', note: 'Low tide reveals bands of sandstone and pools between ridges.' },
    { width: 590, height: 434, rotation: 90, label: 'Tide chart notes', subhead: 'Transect B', note: 'The sample transect runs parallel to the edge of the shelf.' },
    { width: 432, height: 586, rotation: 180, label: 'Survey checklist', subhead: 'Field reference', note: 'Record the light, waterline, wind and time of observation.' },
  ];

  for (const { width, height, rotation, label, subhead, note } of pages) {
    const page = pdf.addPage([width, height]);
    page.setCropBox(9, 14, width - 22, height - 36);
    page.setTrimBox(17, 21, width - 34, height - 48);
    page.setBleedBox(13, 19, width - 28, height - 44);
    page.setArtBox(23, 27, width - 44, height - 54);
    page.setRotation(degrees(rotation));
    page.node.set(PDFName.of('UserUnit'), PDFNumber.of(1));
    page.drawRectangle({ x: 0, y: 0, width, height, color: paper });
    page.drawText(subhead.toUpperCase(), { x: 39, y: height - 61, size: 11, font: bold, color: accent });
    page.drawText(label, { x: 38, y: height - 111, size: 33, font: bold, color: ink });
    page.drawText(note, { x: 39, y: height - 145, size: 11, font: sans, color: ink });
    const scale = Math.min((width - 80) / image.width, (height - 238) / image.height);
    page.drawImage(image, { x: 39, y: height - 180 - scale * image.height, ...image.scale(scale) });
    page.drawText('WATERMARK  /  SAMPLE DOCUMENT', { x: 39, y: 45, size: 9, font: bold, color: ink });
  }

  return pdf.save();
}
