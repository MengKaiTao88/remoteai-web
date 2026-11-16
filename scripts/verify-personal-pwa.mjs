import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { testBrowserLaunchOptions } from '../vendor/scripts/test-browser.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const output = fileURLToPath(new URL('../test-results/personal-pwa/', import.meta.url));
const base = '/remoteai-web/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!pathname.startsWith(base)) { response.writeHead(404).end(); return; }
    const relative = decodeURIComponent(pathname.slice(base.length)) || 'index.html';
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root)) { response.writeHead(403).end(); return; }
    const bytes = await readFile(filename);
    // Module requests carry Origin; a precache fetch may not. Both refer to immutable public assets.
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-Type', types[path.extname(filename)] ?? 'application/octet-stream');
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const browser = await chromium.launch(testBrowserLaunchOptions({ headless: true }));
try {
  await mkdir(output, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto(`http://127.0.0.1:${port}${base}`, { waitUntil: 'load' });
  const registration = await page.evaluate(async () => {
    const worker = await navigator.serviceWorker.ready;
    const manifest = await (await fetch('manifest.webmanifest')).json();
    const cacheNames = await caches.keys();
    const cache = await caches.open(cacheNames[0]);
    return { scope: worker.scope, state: worker.active.state, manifest,
      paths: (await cache.keys()).map(request => new URL(request.url).pathname) };
  });
  assert.equal(registration.state, 'activated');
  assert.equal(registration.manifest.display, 'standalone');
  assert.ok(registration.paths.every(value => value.startsWith(base)));
  assert.ok(registration.paths.every(value => !/\/(auth|sync|devices)\//.test(value)));
  const protocol = await context.newCDPSession(page);
  assert.deepEqual((await protocol.send('Page.getAppManifest')).errors, []);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.getByPlaceholder('name@example.com').waitFor();
  await page.screenshot({ path: path.join(output, 'offline-shell.png') });
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({
    ...registration, offlineShell: true, credentialsUsed: false,
  }, null, 2));
  console.log('PWA manifest, scoped static cache and offline login shell verified. No cloud login performed.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
