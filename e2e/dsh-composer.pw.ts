import { expect, test } from '@playwright/test';
import { fixtureUrl, login, screenshot } from './chat-helpers';

test('keeps the writing capsule visible through long live history and short viewports', async ({ page, request }, info) => {
  const desktop = info.project.name.startsWith('desktop');
  await page.addInitScript(dark => localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light'),
    info.project.name.includes('dark'));
  await request.post(fixtureUrl + '/test/reset');
  await request.post(fixtureUrl + '/test/sidebar', { data: { action: 'history-pages' } });
  await login(page);
  await page.locator(desktop ? '.desktop-sidebar nav' : '.mobile-tabbar').getByText('Agent Hub', { exact: true }).click();
  const shell = page.locator('.dsh-chat-shell');
  await expect(shell).toBeVisible();
  if (!await page.locator('.dsh-sidebar').isVisible()) {
    await shell.getByRole('button', { name: '打开聊天列表', exact: true }).click();
  }
  await page.locator('.dsh-sidebar').getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  await expect(page.locator('[data-message-id=history-26]')).toHaveCount(1);
  await request.post(fixtureUrl + '/test/sidebar', { data: { action: 'start' } });
  await expect(page.getByRole('button', { name: '暂停生成' })).toBeVisible();
  const input = page.getByRole('textbox', { name: '聊天消息' });
  await expect(input).toBeInViewport();
  await page.locator('.dsh-header-model button').click();
  const sheet = page.getByRole('dialog', { name: '选择模型', exact: true });
  await sheet.getByRole('button', { name: '关闭', exact: true }).click();
  const original = page.viewportSize()!;
  await page.setViewportSize({ width: original.width, height: 480 });
  await input.fill('one\ntwo\nthree\nfour\nfive\nsix');
  await expect(input).toBeInViewport();
  await expect.poll(async () => {
    const form = (await page.locator('.dsh-input').boundingBox())!;
    const bounds = (await shell.boundingBox())!;
    return form.y >= bounds.y && form.y + form.height <= bounds.y + bounds.height + 1;
  }).toBe(true);
  await screenshot(page, info, 'long-history-short-viewport');
  await page.setViewportSize(original);
  await input.fill('');
  await page.getByRole('button', { name: '暂停生成' }).click();
  await screenshot(page, info, 'long-history-composer');
});
