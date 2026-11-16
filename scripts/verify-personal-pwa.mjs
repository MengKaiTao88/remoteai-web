import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { testBrowserLaunchOptions } from '../vendor/scripts/test-browser.mjs';
import { personalPreview } from './personal-preview.mjs';

const output = fileURLToPath(new URL('../test-results/personal-pwa/', import.meta.url));
const base = '/remoteai-web/';
const server = await personalPreview();
const browser = await chromium.launch(testBrowserLaunchOptions({ headless: true }));
try {
  await mkdir(output, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto(server.url, { waitUntil: 'load' });
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
  await server.close();
}
