import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright';

const target = pathToFileURL(resolve(process.argv[2] ?? 'dist-offline/Watermark.html'));
const directory = resolve(process.argv[3] ?? 'docs/assets');
const sample = await readFile(new URL('../docs/assets/enrollment-sample.jpg', import.meta.url));
// Use the same fictional document in the tablet's PDF reader and the photo editor.
const pdf = await PDFDocument.create();
const image = await pdf.embedJpg(sample);
const pdfPage = pdf.addPage([720, 720 * image.height / image.width]);
pdfPage.drawImage(image, { x: 0, y: 0, ...pdfPage.getSize() });
const pdfSample = Buffer.from(await pdf.save());
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();

try {
  for (const { name, width, height, touch } of [
    { name: 'desktop', width: 1440, height: 960, touch: false },
    { name: 'tablet', width: 834, height: 1194, touch: true },
    { name: 'phone', width: 390, height: 844, touch: true },
  ]) {
    const context = await browser.newContext({
      locale: 'en-US', viewport: { width, height }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce',
    });
    try {
      await context.route(/^https?:/, (route) => route.abort());
      const page = await context.newPage();
      await page.goto(target.href);
      await page.locator('#add-files').waitFor();
      await page.locator('#watermark-text').fill('Alder Housing\nRental review only');
      const opacity = page.locator('#opacity-value');
      await opacity.fill('32');
      await opacity.press('Enter');
      const isPdf = name === 'tablet';
      await page.locator('#file-input').setInputFiles(isPdf
        ? { name: 'Proof of enrollment.pdf', mimeType: 'application/pdf', buffer: pdfSample }
        : { name: 'Proof of enrollment.jpg', mimeType: 'image/jpeg', buffer: sample });
      const preview = isPdf ? '#pdf-page-canvas' : '#image-preview';
      await page.locator(preview).waitFor();
      await page.waitForFunction((selector) => {
        const canvas = document.querySelector(selector);
        return canvas.width > 1 && canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3] === 255;
      }, preview);
      await opacity.blur();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: resolve(directory, name + '.jpg'), type: 'jpeg', quality: 87 });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
