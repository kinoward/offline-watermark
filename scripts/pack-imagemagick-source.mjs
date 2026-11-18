import { execFile as execFileCallback } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const materials = fileURLToPath(new URL('../third-party/imagemagick/', import.meta.url));
const output = resolve(process.argv[2] ?? 'dist-offline/ImageMagick-WASM-source.tar.gz');
const staging = await mkdtemp(join(tmpdir(), 'watermark-source-'));
const name = 'ImageMagick-WASM-source';
const bundle = join(staging, name);

try {
  const archives = join(bundle, 'archives');
  await cp(materials, bundle, { recursive: true });
  await mkdir(archives);

  const entries = (await readFile(join(materials, 'revisions.tsv'), 'utf8'))
    .trim().split('\n').map((line) => line.split('\t'));
  // Bound concurrent source downloads so a slow release run can retry cleanly.
  for (let start = 0; start < entries.length; start += 4) {
    const results = await Promise.allSettled(entries.slice(start, start + 4).map(async ([repo, revision]) => {
      const archive = join(archives, basename(repo) + '.tar.gz');
      await execFile('curl', [
        '--fail', '--silent', '--show-error', '--location',
        '--retry', '3', '--connect-timeout', '15', '--max-time', '120',
        '--output', archive, `https://codeload.github.com/${repo}/tar.gz/${revision}`,
      ]);
      // Reject truncated or error responses before putting them in a release.
      const { stdout } = await execFile('tar', ['-tzf', archive], { maxBuffer: 32 * 1024 * 1024 });
      if (!stdout.startsWith(basename(repo) + '-' + revision + '/')) {
        throw new Error(`Unexpected archive root for ${repo} at ${revision}`);
      }
    }));
    for (const result of results) if (result.status === 'rejected') throw result.reason;
  }

  await mkdir(dirname(output), { recursive: true });
  await execFile('tar', ['-czf', output, '-C', staging, name]);
  console.log(output);
} finally {
  await rm(staging, { recursive: true, force: true });
}
