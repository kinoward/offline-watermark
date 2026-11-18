import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright';

const target = pathToFileURL(resolve(process.argv[2] ?? 'dist-offline/Watermark.html'));
const directory = resolve(process.argv[3] ?? 'docs/assets');
const examples = [
  { lang: 'en', file: 'passport-us-sample.jpg', mark: 'Harbor Hotel\nBooking verification only',
    original: 'Original', copy: 'Watermarked copy' },
  { lang: 'zh-CN', file: 'passport-cn-sample.jpg', mark: '海湾酒店\n仅供预订核验',
    original: '原件', copy: '水印副本' },
];
const screens = [
  { name: 'watermark-workbench', width: 1080, height: 706, scale: 1.5, touch: false },
  { name: 'desktop', width: 1440, height: 960, scale: 1, touch: false },
  { name: 'tablet', width: 834, height: 1194, scale: 1, touch: true },
  { name: 'phone', width: 390, height: 844, scale: 1, touch: true },
];
const jpeg = (name, lang) => ({ path: resolve(directory, `${name}-${lang}.jpg`), type: 'jpeg', quality: 90 });
const dataUrl = (format, bytes) => `data:image/${format};base64,${bytes.toString('base64')}`;

// Embed the same scan in a one-page PDF to show the tablet's actual PDF reader.
async function pdfOfScan(sample) {
  const pdf = await PDFDocument.create();
  const image = await pdf.embedJpg(sample);
  const page = pdf.addPage([720, 720 * image.height / image.width]);
  page.drawImage(image, { x: 0, y: 0, ...page.getSize() });
  return Buffer.from(await pdf.save());
}

async function captureExport(page, example, sample, screen) {
  await page.locator('#generate').click();
  const button = page.locator('#download');
  await button.waitFor();
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0, 0);
  const ui = await page.screenshot();
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  const exported = await readFile(await download.path());

  // Frame the real workbench capture, then compare the input with the downloaded JPEG.
  await page.setViewportSize({ width: screen.width + 42, height: screen.height + 42 });
  await page.setContent(`<style>
    body { margin: 21px; background: linear-gradient(125deg, #b6b3a7, #dad6c9 44%, #a39f92) }
    img { display: block; width: 100%; border-radius: 10px; box-shadow: 0 4px 10px #23241f45, 0 0 0 1px #191b1744 }
    </style><img src="${dataUrl('png', ui)}">`);
  await page.locator('img').evaluate(image => image.decode());
  await page.screenshot(jpeg(screen.name, example.lang));

  await page.setViewportSize({ width: 1280, height: 850 });
  await page.setContent(`<html lang="${example.lang}"><style>
    * { box-sizing: border-box } body, figure { margin: 0 }
    main { padding: 20px 24px 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; background: #242522; color: #eeeae1 }
    figcaption { margin-bottom: 12px; font: 600 20px -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif }
    img { display: block; width: 100%; border: 1px solid #64645c }
    </style><main>
      <figure><figcaption>${example.original}</figcaption><img src="${dataUrl('jpeg', sample)}"></figure>
      <figure><figcaption>${example.copy}</figcaption><img src="${dataUrl('jpeg', exported)}"></figure>
    </main></html>`);
  const [before, after] = await page.locator('img').evaluateAll(async images => {
    await Promise.all(images.map(image => image.decode()));
    return images.map(image => [image.naturalWidth, image.naturalHeight]);
  });
  if (before[0] !== after[0] || before[1] !== after[1] || sample.equals(exported)) {
    throw new Error(`Expected a new, same-size JPEG for ${example.file}.`);
  }
  await page.locator('main').screenshot(jpeg('watermark-comparison', example.lang));
}

await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  for (const example of examples) {
    const sample = await readFile(new URL(`../docs/assets/${example.file}`, import.meta.url));
    const pdf = await pdfOfScan(sample);
    for (const screen of screens) {
      const context = await browser.newContext({
        locale: example.lang, viewport: { width: screen.width, height: screen.height },
        deviceScaleFactor: screen.scale, hasTouch: screen.touch, isMobile: screen.touch, reducedMotion: 'reduce',
      });
      try {
        await context.route(/^https?:/, route => route.abort());
        const page = await context.newPage();
        await page.goto(target.href);
        await page.locator('#watermark-text').fill(example.mark);
        for (const [id, value] of [['size-value', '95'], ['opacity-value', '31']]) {
          const field = page.locator(`#${id}`);
          await field.fill(value);
          await field.press('Enter');
          await field.blur();
        }
        const isPdf = screen.name === 'tablet';
        await page.locator('#file-input').setInputFiles(isPdf
          ? { name: example.file.replace(/\.jpg$/, '.pdf'), mimeType: 'application/pdf', buffer: pdf }
          : { name: example.file, mimeType: 'image/jpeg', buffer: sample });
        const preview = isPdf ? '#pdf-page-canvas' : '#image-preview';
        await page.locator(preview).waitFor();
        await page.waitForFunction(selector => {
          const canvas = document.querySelector(selector);
          return canvas.width > 1 && canvas.getContext('2d').getImageData(0, 0, 1, 1).data[3] === 255;
        }, preview);
        await page.evaluate(() => window.scrollTo(0, 0));
        if (screen.name === 'watermark-workbench') await captureExport(page, example, sample, screen);
        else await page.screenshot(jpeg(screen.name, example.lang));
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
