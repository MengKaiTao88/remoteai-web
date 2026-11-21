import { expect, test } from '@playwright/test';
import { screenshot } from './chat-helpers';

test.beforeEach(async ({ page }, info) => {
  await page.addInitScript(dark => localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light'),
    info.project.name.includes('dark'));
});

test('visible commentary stays in order while internal summaries do not split the timeline', async ({ page }) => {
  await page.goto('e2e/dsh-messages-harness.html?sequence=1');
  const process = page.locator('.dsh-process-trigger').first();
  const sequence = page.locator('.remodex-process').first().locator('.remodex-process-records');
  await expect(sequence).toHaveCount(0);
  await process.click();
  await expect(sequence.getByText('Before tools')).toHaveCount(0);
  await expect(sequence.getByText('After tools')).toHaveCount(0);
  await expect(sequence.locator('.dsh-process-trigger')).toHaveCount(0);
  const group = sequence.locator('.official-activity-group');
  const summary = group.locator(':scope > button');
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  expect(await sequence.evaluate(node => [...node.children].map(child => child.firstElementChild?.className)))
    .toEqual(['official-activity-group', 'official-process-standalone']);
  await summary.click();
  await expect(group.locator('.official-activity-children .official-activity')).toHaveCount(3);
  await expect(sequence.getByText('Narrative after execution.', { exact: true })).toBeVisible();
});

test('recorded desktop activity keeps its title, type, and place in the Web timeline', async ({ page }, info) => {
  await page.goto('e2e/dsh-messages-harness.html?timeline=1', { waitUntil: 'commit' });
  const process = page.locator('.remodex-process').first();
  await process.locator('.dsh-process-trigger').click();
  const group = process.locator('.official-activity-group > button');
  await expect(group).toContainText(/ · Chrome$/);
  await group.click();
  const title = process.getByRole('button', { name: '找到对应的浏览器标签页', exact: true });
  const browser = process.locator('[data-process-item=browser-action]');
  await expect(browser).toHaveAttribute('data-activity-category', 'browser');
  await expect(browser.locator('svg.lucide-chrome')).toBeVisible();
  const entries = process.locator('.remodex-commentary, [data-process-item]');
  await expect(entries).toHaveText([
    '正在检查项目文件。', 'echo one', '找到对应的浏览器标签页', '接下来核对网页里的结果。', '检查编辑器状态',
  ]);
  await title.click();
  await expect(browser.getByText('Opened the matching tab.', { exact: true })).toBeVisible();
  await expect(process.locator('[data-process-item=editor-action]')).toHaveAttribute('data-activity-category', 'integration');
  await process.scrollIntoViewIfNeeded();
  await screenshot(page, info, 'recorded-timeline');
});

test('deferred historical processes load activity only when opened', async ({ page }, info) => {
  await page.goto('e2e/dsh-messages-harness.html?deferred=1');
  await expect(page.getByText('已读取源码。最终回答保持展开。')).toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-process-reads');
  await expect(page.locator('.official-activity-group')).toHaveCount(0);
  const process = page.locator('.dsh-process-trigger').first();
  await process.click();
  await expect(page.locator('body')).toHaveAttribute('data-process-reads', '1');
  await expect(page.getByText('Read real details.', { exact: true })).toHaveCount(0);
  await page.locator('.official-activity-group > button').click();
  await expect(page.getByRole('button', { name: 'echo one', exact: true })).toBeVisible();
  await screenshot(page, info, 'deferred-activity');
  await process.click();
  await expect(page.locator('.official-activity-group')).toHaveCount(0);
});

test('opening a long activity group keeps its header in view', async ({ page }, info) => {
  test.skip(!['phone-light', 'iphone-webkit', 'desktop-wide'].includes(info.project.name));
  await page.goto('e2e/dsh-messages-harness.html?long-process=1', { waitUntil: 'commit' });
  const process = page.locator('.dsh-process-trigger').first();
  await process.click();
  const group = page.locator('.official-activity-group > button');
  await group.scrollIntoViewIfNeeded();
  const before = (await group.boundingBox())!.y;
  await group.click();
  await expect(page.locator('[data-process-item="operation-0"]')).toBeInViewport();
  await expect(group).toBeInViewport();
  await expect.poll(async () => Math.abs((await group.boundingBox())!.y - before)).toBeLessThan(3);
  await screenshot(page, info, 'long-activity-opened');
});

test('prepending history inside the current process preserves the visible command and item order', async ({ page }, info) => {
  test.skip(!['phone-light', 'iphone-webkit', 'desktop-wide'].includes(info.project.name));
  await page.goto('e2e/dsh-messages-harness.html?paged-process=1', { waitUntil: 'commit' });
  const scroller = page.locator('.chat-messages');
  const firstGroup = page.locator('.official-activity-group > button').first();
  await firstGroup.click();
  const line = page.locator('[data-process-item="paged-operation-23"] > button');
  await line.evaluate(element => element.scrollIntoView({ block: 'start' }));
  await expect(line).toBeInViewport();
  const before = (await line.boundingBox())!.y;
  await scroller.getByRole('button', { name: '加载更早的消息' }).dispatchEvent('click');
  await expect(firstGroup).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => Math.abs((await line.boundingBox())!.y - before)).toBeLessThan(3);
  const order = await scroller.locator('[data-process-item]').evaluateAll(nodes => nodes.map(node =>
    node.getAttribute('data-process-item')!));
  const numbers = order.filter(id => id.startsWith('paged-operation-')).map(id => Number(id.split('-').at(-1)));
  expect(numbers).toEqual([...new Set(numbers)].sort((a, b) => a - b));
  await expect(scroller.getByText('进行中', { exact: true })).toHaveCount(1);
  await screenshot(page, info, 'history-within-active-process');
});

test('process cards remain inspectable, failed tools stay visible and approvals settle', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', value => errors.push(value.message));
  await page.addInitScript(dark => localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light'),
    info.project.name.includes('dark'));
  await page.goto('e2e/dsh-messages-harness.html');
  await expect(page.getByText('已读取源码。最终回答保持展开。')).toBeVisible();
  const process = page.locator('.dsh-process-trigger').first();
  await expect(process).toHaveAttribute('aria-expanded', 'false');
  await process.click();
  await expect(process).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.official-activity-group > button').click();
  const firstCommand = page.getByRole('button', { name: /echo one/ }).first();
  await expect(firstCommand).toBeVisible();
  await firstCommand.click();
  await expect(page.locator('.chat-shell-card')).toContainText('OUTPUT_one');
  await expect(page.locator('.chat-shell-card .cs-command-output')).toHaveCount(1);
  await screenshot(page, info, 'process-expanded');
  await process.click();
  await expect(page.getByText('echo one', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /失败.*check failure/ })).toBeVisible();
  await page.locator('.chat-approval .chat-primary').click();
  await expect(page.locator('.chat-approval')).toHaveCount(0);
  await expect(page.locator('body')).toHaveAttribute('data-decision', 'accept');
  await screenshot(page, info, 'approval-settled');
  await page.getByTestId('enable-history').click();
  const older = page.getByRole('button', { name: '加载更早的消息', exact: true });
  await expect(older).toBeVisible();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const before = await page.locator('.chat-messages').evaluate(node => {
    const top = node.getBoundingClientRect().top;
    const row = [...node.querySelectorAll<HTMLElement>('[data-message-id]')]
      .find(value => value.getBoundingClientRect().bottom > top)!;
    return { id: row.dataset.messageId!, y: row.getBoundingClientRect().top,
      offset: node.scrollTop, height: node.scrollHeight, viewport: node.clientHeight };
  });
  await older.dispatchEvent('click');
  await expect(page.locator('[data-message-id=old-0]')).toHaveCount(1);
  const anchor = page.locator(`[data-message-id="${before.id}"]`);
  await expect.poll(async () => Math.abs((await anchor.boundingBox())!.y - before.y)).toBeLessThan(3);
  await screenshot(page, info, 'history-anchor');
  expect(errors).toEqual([]);
});
