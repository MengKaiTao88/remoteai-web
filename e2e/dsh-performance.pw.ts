import { expect, test } from '@playwright/test';

test('keeps long live conversations interactive during sustained updates', async ({ page }, info) => {
  test.skip(!['phone-dark', 'iphone-webkit'].includes(info.project.name), 'Mobile engines cover the reported freeze.');
  await page.addInitScript(() => localStorage.setItem('codex-switch.web.theme.v1', 'dark'));
  await page.goto('e2e/dsh-messages-harness.html?stress=1', { waitUntil: 'commit' });
  const pulse = page.getByTestId('performance-pulse');
  await expect(pulse).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => (window as unknown as { dshPerformance: { updates: number } }).dshPerformance.updates >= 30);
  const latencies: number[] = [];
  for (let index = 1; index <= 10; index++) {
    const start = Date.now();
    await pulse.click({ timeout: 5000 });
    await expect(page.locator('body')).toHaveAttribute('data-pulse', String(index));
    latencies.push(Date.now() - start);
    await page.locator('.chat-messages').evaluate(node => { node.scrollTop -= 300; });
  }
  const result = await page.evaluate(() => ({
    ...((window as unknown as { dshPerformance: Record<string, number> }).dshPerformance),
    rows: document.querySelectorAll('[data-dsh-row]').length,
    markdownNodes: document.querySelectorAll('.chat-markdown').length,
    activityNodes: document.querySelectorAll('.chat-activity').length,
  }));
  await info.attach('performance', { body: JSON.stringify({ ...result, latencies }, null, 2), contentType: 'application/json' });
  await expect(page.getByRole('textbox', { name: '聊天消息' })).toBeInViewport();
  const input = page.getByRole('textbox', { name: '聊天消息' });
  await expect.poll(() => input.evaluate(node => {
    const bounds = node.getBoundingClientRect();
    const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    return Boolean(target?.closest('.dsh-input'));
  })).toBe(true);
  await input.fill('Draft remains usable during streaming');
  await expect(input).toHaveValue('Draft remains usable during streaming');
  await expect(page.locator('.dsh-input .chat-composer-placeholder')).toBeHidden();
  expect(result.renderMax).toBeLessThan(250);
  expect(result.markdownNodes).toBeLessThan(40);
  expect(result.activityNodes).toBeLessThan(40);
  expect(Math.max(...latencies)).toBeLessThan(1500);
  await page.screenshot({ path: info.outputPath('sustained-conversation.png') });
  console.log(JSON.stringify({ project: info.project.name, ...result, latencies }));
});
