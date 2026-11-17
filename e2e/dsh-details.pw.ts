import { expect, test } from '@playwright/test';
import { screenshot } from './chat-helpers';

test('thinking and commentary retain their chronological position around grouped tools', async ({ page }) => {
  await page.goto('e2e/dsh-messages-harness.html?sequence=1');
  const sequence = page.locator('.remodex-process-sequence').first();
  await expect(sequence.locator('.remodex-reasoning summary')).toHaveText(['Before tools', 'After tools']);
  await expect(sequence.locator('.remodex-reasoning-detail')).toHaveCount(0);
  await expect(sequence.locator('.dsh-process-trigger')).toHaveCount(1);
  expect(await sequence.evaluate(node => [...node.children].map(child => child.className)))
    .toEqual(['remodex-reasoning', 'dsh-process remodex-process', 'remodex-reasoning', 'remodex-commentary']);
  await sequence.locator('.remodex-reasoning summary').last().click();
  await expect(sequence.getByText('Subsequent check.', { exact: true })).toBeVisible();
  await expect(sequence.getByText('Initial check.', { exact: true })).toHaveCount(0);
});

test('deferred historical processes use the same reasoning sections and load only when opened', async ({ page }, info) => {
  await page.goto('e2e/dsh-messages-harness.html?deferred=1');
  await expect(page.getByText('已读取源码。最终回答保持展开。')).toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-process-reads');
  await expect(page.locator('.remodex-reasoning')).toHaveCount(0);
  const process = page.locator('.dsh-process-trigger').first();
  await process.click();
  await expect(page.locator('body')).toHaveAttribute('data-process-reads', '1');
  await expect(page.locator('.remodex-reasoning details')).toHaveCount(2);
  await page.locator('.remodex-reasoning summary').first().click();
  await expect(page.getByText('Read real details.', { exact: true })).toBeVisible();
  await screenshot(page, info, 'deferred-reasoning');
  await process.click();
  await expect(page.locator('.remodex-reasoning')).toHaveCount(0);
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
  await page.locator('.chat-activity').filter({ hasText: '运行命令（3）' }).click();
  await expect(page.getByRole('button', { name: /echo one/ }).first()).toBeVisible();
  await screenshot(page, info, 'process-expanded');
  await process.click();
  await expect(page.getByText('echo one', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /运行失败.*check failure/ })).toBeVisible();
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
