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
  await context.setOffline(false);
  const entryAsset = await page.evaluate(() => {
    localStorage.setItem('personal-retry-sentinel', 'preserved');
    return document.querySelector('script[type="module"][src]')?.src;
  });
  assert.ok(entryAsset);
  server.setEntryFailure(true);
  await page.evaluate(async asset => {
    for (const name of await caches.keys()) {
      if (!name.startsWith('remoteai-shell:/remoteai-web/:')) continue;
      await (await caches.open(name)).delete(asset, { ignoreVary: true });
    }
  }, entryAsset);
  const installedWindow = await context.newPage();
  await page.close();
  await installedWindow.goto(new URL(registration.manifest.start_url, server.url).href, { waitUntil: 'load' });
  await installedWindow.locator('#personal-startup button:not([hidden])').waitFor({ timeout: 20000 });
  assert.match(await installedWindow.locator('#personal-startup small').innerText(), /JS_RESOURCE/);
  await installedWindow.screenshot({ path: path.join(output, 'installed-entry-failed.png') });
  server.setEntryFailure(false);
  await installedWindow.locator('#personal-startup button').click();
  await installedWindow.getByPlaceholder('name@example.com').waitFor({ timeout: 30000 });
  assert.equal(await installedWindow.evaluate(() => localStorage.getItem('personal-retry-sentinel')), 'preserved');
  assert.equal(await installedWindow.locator('#personal-startup').isVisible(), false);
  await installedWindow.screenshot({ path: path.join(output, 'installed-entry-recovered.png') });
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({
    ...registration, offlineShell: true, installedEntryRetryRecovered: true, localPreferencesPreserved: true, credentialsUsed: false,
  }, null, 2));
  console.log('PWA manifest, offline shell and installed start URL verified; a failed entry script recovered by Retry without clearing local preferences.');
} finally {
  await browser.close();
  await server.close();
}
