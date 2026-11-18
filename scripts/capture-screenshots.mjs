import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { proofPdf } from '../tests/fixtures/proof.mjs';

const target = pathToFileURL(resolve(process.argv[2] ?? 'dist-offline/Watermark.html'));
const directory = resolve(process.argv[3] ?? 'docs/assets');
const coast = new URL('../src/comparison-sample.jpg', import.meta.url);
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
      if (name === 'desktop') {
        await page.locator('#file-input').setInputFiles({
          name: 'Coastal contours.jpg', mimeType: 'image/jpeg', buffer: await readFile(coast),
        });
        await page.waitForFunction(() => !document.getElementById('image-preview').hidden);
      } else if (name === 'tablet') {
        await page.locator('#file-input').setInputFiles({
          name: 'Tidal shelf — sample.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await proofPdf()),
        });
        await page.locator('#pdf-page-canvas').waitFor();
      }
      const preview = page.locator({
        desktop: '#image-preview', tablet: '#pdf-page-canvas', phone: '#preview-canvas',
      }[name]);
      const before = await preview.evaluate((canvas) => canvas.toDataURL());
      await page.locator('#watermark-text').fill('Review copy\nWatermark');
      await page.waitForFunction(({ selector, previous }) =>
        document.querySelector(selector).toDataURL() !== previous,
      { selector: '#' + await preview.getAttribute('id'), previous: before });
      await page.screenshot({ path: resolve(directory, name + '.jpg'), type: 'jpeg', quality: 87 });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
