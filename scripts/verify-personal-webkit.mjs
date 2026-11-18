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
  const slowContext = await browser.newContext({ ...devices['iPhone 13'], locale: 'zh-CN',
    colorScheme: 'dark', serviceWorkers: 'block' });
  const slowPage = await slowContext.newPage();
  let releaseEntry;
  const entryGate = new Promise(resolve => { releaseEntry = resolve; });
  await slowPage.route('**/assets/index-*.js', async route => { await entryGate; await route.continue(); });
  try {
    await slowPage.goto(server.url, { waitUntil: 'commit' });
    const retry = slowPage.locator('#personal-startup button:visible');
    await retry.waitFor({ timeout: 25_000 });
    assert.equal(await retry.innerText(), '重试');
    assert.equal(await slowPage.locator('#personal-startup small').innerText(), '');
    assert.ok(await slowPage.locator('#personal-startup p').innerText());
    // The deliberately pending module can hold document.fonts.ready until the test releases it.
    const skipFonts = process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY;
    process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
    try { await slowPage.screenshot({ path: path.join(output, 'iphone-slow-startup.png') }); }
    finally {
      if (skipFonts === undefined) delete process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY;
      else process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = skipFonts;
    }
  } finally { releaseEntry(); }
  await slowPage.getByPlaceholder('name@example.com').waitFor({ timeout: 30_000 });
  assert.equal(await slowPage.locator('#personal-startup').isVisible(), false);
  assert.equal(new URL(slowPage.url()).search, '');
  await slowPage.screenshot({ path: path.join(output, 'iphone-slow-startup-ready.png') });
  await slowContext.close();

  const context = await browser.newContext({ ...devices['iPhone 13'], locale: 'zh-CN', serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.route('**/assets/index-*.js', route => route.abort());
  await page.goto(server.url, { waitUntil: 'load' });
  await page.locator('#personal-startup button:not([hidden])').waitFor({ timeout: 20000 });
  assert.ok(await page.locator('#personal-startup small').innerText());
  await page.screenshot({ path: path.join(output, 'iphone-startup-retry.png') });
  await page.unroute('**/assets/index-*.js');
  await page.locator('#personal-startup button').click();
  await page.getByPlaceholder('name@example.com').waitFor({ timeout: 30000 });
  assert.ok(new URL(page.url()).searchParams.has('_reload'));
  assert.equal(await page.locator('#personal-startup').isVisible(), false);
  await page.screenshot({ path: path.join(output, 'iphone-startup-recovered.png') });
  await context.close();
  console.log('WebKit phone login, a slow startup without reloading and Retry after a blocked script passed.');
} finally {
  await browser.close();
  await server.close();
}
