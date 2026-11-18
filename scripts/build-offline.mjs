import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const destination = resolve(process.argv[2] ?? resolve(root, 'dist-offline/index.html'));
const base = { root, base: './', configFile: false, publicDir: false, logLevel: 'warn' };
const output = { codeSplitting: false };

async function bundle(config) {
  const result = await build(config);
  return (Array.isArray(result) ? result : [result]).flatMap((build) => build.output);
}

const workerBuild = await bundle({
  ...base,
  resolve: { alias: {
    '@imagemagick/magick-wasm/magick.wasm?url&no-inline': '@imagemagick/magick-wasm/magick.wasm?url&inline',
  } },
  build: {
    write: false, target: 'es2022', minify: true, modulePreload: false,
    lib: { entry: resolve(root, 'src/processor.ts'), formats: ['iife'], name: 'WatermarkProcessor' },
    rolldownOptions: { output },
  },
});
const [worker] = workerBuild;
if (workerBuild.length !== 1 || worker?.type !== 'chunk' || worker.imports.length ||
    worker.dynamicImports.some((name) => name !== worker.fileName) ||
    !worker.code.includes('data:application/wasm;base64,')) {
  throw new Error('The offline processing module still depends on external assets.');
}

const [pdfReader, ...readerAssets] = await bundle({
  ...base,
  build: {
    write: false, target: 'es2022', minify: true, modulePreload: false,
    lib: { entry: resolve(root, 'src/pdf-page-worker.ts'), formats: ['es'] },
    rolldownOptions: { output },
  },
});
if (readerAssets.length || pdfReader?.type !== 'chunk' || pdfReader.imports.length ||
    pdfReader.dynamicImports.length || !pdfReader.code.includes('data:application/wasm;base64,')) {
  throw new Error('The offline PDF page reader still depends on external assets.');
}

const pageBuild = await bundle({
  ...base,
  resolve: { alias: { './processor-client.ts': resolve(root, 'src/processor-client-offline.ts') } },
  build: { write: false, modulePreload: false, rolldownOptions: { output } },
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
const processor = gzipSync(worker.code, { level: 9 }).toString('base64');
// A module Blob worker from file:// is blocked by some browsers. Resolve the
// Emscripten script location against this classic worker, after Vite has inlined
// its module-relative WASM asset. The reader entry has no imports or exports.
if (pdfReader.exports.length) throw new Error('PDF page worker contains module exports.');
const readerSource = pdfReader.code.replaceAll('import.meta.url', 'self.location.href');
const reader = gzipSync(readerSource, { level: 9 }).toString('base64');
html = html.replace('</body>', () => (
  '<script id="pdf-page-data" type="application/octet-stream">' + reader + '</script>\n' +
  '<script id="processor-data" type="application/octet-stream">' + processor + '</script>\n' +
  '<script id="third-party-licenses" type="text/plain">\n' +
  scriptText([licenseNotice, license, ...licenses].join('\n\n')) +
  '\n</script>\n</body>'
));
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, html);
console.log(destination + ' (' + (Buffer.byteLength(html) / 1048576).toFixed(1) + ' MiB)');
