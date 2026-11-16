import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { webkit, devices } from '@playwright/test';
import { personalPreview } from './personal-preview.mjs';

const output = fileURLToPath(new URL('../test-results/personal-webkit/', import.meta.url));
await mkdir(output, { recursive: true });
const server = await personalPreview();
const browser = await webkit.launch({ headless: true });
try {
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'zh-CN', colorScheme });
    const page = await context.newPage();
    const errors = [];
    const fonts = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().includes('fonts.googleapis.com')) fonts.push(request.url()); });
    await page.goto(server.url, { waitUntil: 'load' });
    await page.getByPlaceholder('name@example.com').waitFor();
    assert.equal(await page.locator('#personal-startup').isVisible(), false);
    assert.deepEqual(errors, []);
    assert.deepEqual(fonts, []);
    await page.screenshot({ path: path.join(output, `iphone-${colorScheme}-login.png`) });
    await context.close();
  }
  const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'zh-CN', serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.route('**/assets/index-*.js', route => route.abort());
  await page.goto(server.url, { waitUntil: 'load' });
  await page.locator('#personal-startup button:not([hidden])').waitFor({ timeout: 20000 });
  assert.ok(await page.locator('#personal-startup small').innerText());
  await page.screenshot({ path: path.join(output, 'iphone-startup-retry.png') });
  await context.close();
  console.log('WebKit phone login passed in light/dark; a blocked startup script shows a retry instead of an empty screen.');
} finally {
  await browser.close();
  await server.close();
}
