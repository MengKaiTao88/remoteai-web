import { expect, test } from '@playwright/test';
import { fixtureUrl, openChatList, openChatSettings, screenshot, send, settled, state } from './chat-helpers';
import { chooseSetting, closeChatSettings } from './chat-settings';

test('personal chat presentation preserves history, sending, queue, settings and app navigation',
  async ({ page, request }, info) => {
    const desktop = info.project.name === 'desktop-preserved';
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.addInitScript(({ dark, large }) => {
      localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light');
      if (large) localStorage.setItem('codex-switch:global-font-size', '20');
    }, { dark: info.project.name === 'phone-dark', large: info.project.name === 'phone-narrow-large' });
    await request.post(`${fixtureUrl}/test/reset`);
    await page.goto('./', { waitUntil: 'commit' });
    await page.getByPlaceholder('name@example.com').fill('mobile-test@example.test');
    await page.getByPlaceholder('输入登录密码').fill('local-test');
    await page.getByRole('button', { name: '登录并查看' }).click();
    await page.getByRole('button', { name: '同意并登录' }).click();
    await expect(page.getByText('欢迎回来', { exact: true })).toBeVisible();
    const nav = page.locator(desktop ? '.desktop-sidebar nav' : '.mobile-tabbar');
    await nav.getByText('Agent Hub', { exact: true }).click();
    await openChatList(page);
    await page.getByRole('button', { name: '移动端聊天体验', exact: true }).click();
    await expect(page.getByText('帮我整理今天的工作计划。')).toBeVisible();
    await screenshot(page, info, 'history');
    if (!desktop) {
      const touch = await page.locator('.chat-composer-add').boundingBox();
      expect(touch?.width).toBeGreaterThanOrEqual(44);
      expect(touch?.height).toBeGreaterThanOrEqual(44);
    }
    await openChatList(page);
    await screenshot(page, info, 'conversation-list');
    await page.getByRole('button', { name: '移动端聊天体验', exact: true }).click();
    await send(page, 'H5 regression message');
    await settled(page);
    await expect(page.locator('.chat-markdown pre')).toHaveText('const connected = true;');
    if (!desktop) {
      await openChatSettings(page);
      await chooseSetting(page, '模型', '测试模型');
      await chooseSetting(page, '推理强度', '高');
      await chooseSetting(page, '访问权限', '请求批准');
      await screenshot(page, info, 'chat-settings');
      await closeChatSettings(page);
      await send(page, 'slow task');
      await expect(page.getByRole('button', { name: '暂停生成' })).toBeVisible();
      await send(page, 'personal queue check');
      await expect(page.locator('.chat-queue')).toContainText('personal queue check');
      await screenshot(page, info, 'queue');
      await page.getByRole('button', { name: '暂停生成' }).click();
      expect((await state(request)).operations.some(value => value.operation === 'send')).toBe(true);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    const input = page.getByRole('textbox', { name: '聊天消息' });
    await expect(input).toBeVisible();
    await nav.getByText('账号', { exact: true }).click();
    await expect(page.locator('.chat-page')).toBeHidden();
    await screenshot(page, info, 'accounts-original');
    await nav.getByText('设置', { exact: true }).click();
    await expect(page.locator('.chat-page')).toBeHidden();
    await screenshot(page, info, 'settings-original');
    await nav.getByText('Agent Hub', { exact: true }).click();
    await expect(page.getByRole('heading', { name: '移动端聊天体验', exact: true })).toBeVisible();
    expect(JSON.stringify((await state(request)).threads)).toContain('H5 regression message');
  });
