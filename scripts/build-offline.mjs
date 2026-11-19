import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { build, normalizePath } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const destination = resolve(process.argv[2] ?? resolve(root, 'dist-offline/index.html'));
const pdfiumWasmPath = require.resolve('@hyzyla/pdfium/pdfium.wasm');
const base = {
  root, base: './', configFile: false, publicDir: false, logLevel: 'warn',
  define: { 'import.meta.env.WATERMARK_OFFLINE': 'true' },
};
const compactBuild = { write: false, minify: 'oxc', sourcemap: false, modulePreload: false };
const output = { codeSplitting: false };

async function bundle(config) {
  const result = await build(config);
  return (Array.isArray(result) ? result : [result]).flatMap((build) => build.output);
}

const workerBuild = await bundle({
  ...base,
  build: {
    ...compactBuild, target: 'es2022',
    lib: { entry: resolve(root, 'src/processor.ts'), formats: ['iife'], name: 'WatermarkProcessor' },
    rolldownOptions: { output },
  },
});
const [worker] = workerBuild;
if (workerBuild.length !== 1 || worker?.type !== 'chunk' || worker.imports.length ||
    worker.dynamicImports.some((name) => name !== worker.fileName) ||
    worker.code.includes('data:application/wasm')) {
  throw new Error('The offline processing module still depends on external assets.');
}

const pdfiumBrowserEntry = normalizePath(resolve(dirname(pdfiumWasmPath), 'index.esm.browser.js'));
const pdfiumUrlFallback = 'return new URL("pdfium.wasm", import.meta.url).href;';
let removedPdfiumUrlFallback = false;
const [pdfReader, ...readerAssets] = await bundle({
  ...base,
  plugins: [{
    name: 'watermark-offline-pdfium',
    enforce: 'pre',
    transform(code, id) {
      if (id !== pdfiumBrowserEntry) return;
      // PDFium receives bytes at runtime. Remove the unused fallback before
      // Vite would inline a second copy of the WASM in the library bundle.
      const parts = code.split(pdfiumUrlFallback);
      if (parts.length !== 2) throw new Error('Unexpected PDFium WASM URL fallback.');
      removedPdfiumUrlFallback = true;
      return parts.join('throw new Error("Missing embedded PDFium WASM.");');
    },
  }],
  build: {
    ...compactBuild, target: 'es2022',
    lib: { entry: resolve(root, 'src/pdf-page-worker.ts'), formats: ['es'] },
    rolldownOptions: { output },
  },
});
if (!removedPdfiumUrlFallback || readerAssets.length || pdfReader?.type !== 'chunk' ||
    pdfReader.imports.length || pdfReader.dynamicImports.length || pdfReader.code.includes('data:application/wasm')) {
  throw new Error('The offline PDF page reader still depends on external assets.');
}

const pageBuild = await bundle({
  ...base,
  resolve: { alias: { './processor-client.ts': resolve(root, 'src/processor-client-offline.ts') } },
  build: { ...compactBuild, cssMinify: 'lightningcss', rolldownOptions: { output } },
});
const entry = pageBuild.find((item) => item.type === 'chunk' && item.isEntry);
const index = pageBuild.find((item) => item.type === 'asset' && item.fileName === 'index.html');
const style = pageBuild.find((item) => item.type === 'asset' && item.fileName.endsWith('.css'));
if (pageBuild.length !== 3 || !entry || !index || !style || entry.imports.length ||
    entry.dynamicImports.length) {
  throw new Error('Unexpected page assets for the offline build.');
}

function inline(html, pattern, file, replacement) {
  // Match Vite's generated tag and verify it refers to the expected bundle file.
  if (html.match(pattern)?.[1] !== './' + file) throw new Error('Missing asset: ' + file);
  return html.replace(pattern, () => replacement);
}

const scriptText = (text) => text.replace(/<\/script/gi, '<\\/script');
let html = inline(
  String(index.source),
  /<script\b[^>]+src="([^"]+)"[^>]*><\/script>/,
  entry.fileName,
  '<script type="module">\n' + scriptText(entry.code) + '\n</script>',
);
html = inline(
  html,
  /<link\s+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/,
  style.fileName,
  '<style>\n' + String(style.source).replace(/<\/style/gi, '<\\/style') + '\n</style>',
);
const licensesDir = resolve(root, 'public/licenses');
const licenses = await Promise.all((await readdir(licensesDir)).sort().map(async (name) => (
  name + '\n\n' + await readFile(resolve(licensesDir, name), 'utf8')
)));
const license = await readFile(resolve(root, 'LICENSE'), 'utf8');
const release = 'https://github.com/kinoward/offline-watermark/releases/tag/v' + version;
const licenseNotice = 'Watermark v' + version + '\nRelease and corresponding source archives: ' + release;
html = html.replace('<!doctype html>', () => (
  '<!doctype html>\n<!--\n' + licenseNotice +
  '\nThis file includes ImageMagick WASM with LGPL libraries. See #third-party-licenses in this file.\n-->'
));
const gzipBase64 = (source) => gzipSync(source, { level: 9 }).toString('base64');
async function packWasm(path) {
  const original = await readFile(path);
  const encoded = gzipBase64(original);
  if (!gunzipSync(Buffer.from(encoded, 'base64')).equals(original)) {
    throw new Error('Embedded WASM differs from ' + path);
  }
  return encoded;
}

// A module Blob worker from file:// is blocked by some browsers. Resolve the
// Emscripten script location against this classic worker. Its WASM is embedded separately.
if (pdfReader.exports.length) throw new Error('PDF page worker contains module exports.');
const readerSource = pdfReader.code.replaceAll('import.meta.url', 'self.location.href');
const payloads = [
  ['pdf-page-data', gzipBase64(readerSource)],
  ['processor-data', gzipBase64(worker.code)],
  ['pdfium-wasm-data', await packWasm(pdfiumWasmPath)],
  ['imagemagick-wasm-data', await packWasm(require.resolve('@imagemagick/magick-wasm/magick.wasm'))],
];
const embeddedData = payloads.map(([id, payload]) =>
  '<script id="' + id + '" type="application/octet-stream">' + payload + '</script>\n'
).join('');
html = html.replace('</body>', () => (
  embeddedData +
  '<script id="third-party-licenses" type="text/plain">\n' +
  scriptText([licenseNotice, license, ...licenses].join('\n\n')) +
  '\n</script>\n</body>'
));
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, html);
for (const [id, payload] of payloads) console.log(id + ': ' + payload.length + ' bytes');
const size = Buffer.byteLength(html);
console.log(destination + ' (' + size + ' bytes, ' + (size / 1048576).toFixed(2) + ' MiB)');
