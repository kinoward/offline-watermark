import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const html = await readFile(process.argv[2] ?? 'dist-offline/Watermark.html');
const server = createServer((request, response) => {
  if (request.url !== '/') {
    response.writeHead(404).end();
    return;
  }
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(html);
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

try {
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const smoke = fileURLToPath(new URL('./smoke.mjs', import.meta.url));
  const child = spawn(process.execPath, [smoke, url, 'chromium'], { stdio: 'inherit' });
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  });
} finally {
  await new Promise((resolve) => server.close(resolve));
}
