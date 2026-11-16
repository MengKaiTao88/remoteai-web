import { expect, test } from '@playwright/test';
import { fixtureUrl, login, screenshot } from './chat-helpers';

test('hidden streaming does not repaint chat or block navigation and resumes with the latest text', async ({ page, request }, info) => {
  test.skip(!['phone-dark', 'iphone-webkit'].includes(info.project.name), 'Exercise both mobile engines.');
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await request.post(fixtureUrl + '/test/reset');
  await login(page);
  const nav = page.locator('.mobile-tabbar');
  await nav.getByText('Agent Hub', { exact: true }).click();
  await page.locator('.dsh-chat-shell').getByRole('button', { name: '打开聊天列表', exact: true }).click();
  await page.locator('.dsh-sidebar').getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  const emit = (method: string, params: unknown) => request.post(fixtureUrl + '/test/chat-event', { data: { method, params } });
  await emit('turn/started', { threadId: 'demo-chat', turn: { id: 'background-turn', status: 'inProgress', items: [
    { id: 'background-user', type: 'userMessage', text: 'background streaming check' },
    { id: 'background-answer', type: 'agentMessage', text: 'BEFORE_BACKGROUND ', phase: 'commentary' },
  ] } });
  await expect(page.locator('.chat-markdown')).toContainText(['BEFORE_BACKGROUND']);
  const input = page.getByRole('textbox', { name: '聊天消息' });
  await input.fill('retained navigation draft');
  await nav.getByText('账号', { exact: true }).click();
  await expect(page.locator('.chat-page')).toBeHidden();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => {
    const root = document.querySelector('.dsh-message-region')!;
    Object.assign(window, { hiddenChatMutations: 0 });
    new MutationObserver(records => {
      const metrics = window as unknown as { hiddenChatMutations: number };
      metrics.hiddenChatMutations += records.length;
    }).observe(root, { subtree: true, characterData: true, childList: true });
  });
  for (let index = 0; index < 20; index++) await emit('item/agentMessage/delta', {
    threadId: 'demo-chat', turnId: 'background-turn', itemId: 'background-answer', delta: 'BACKGROUND_UPDATE ',
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { hiddenChatMutations: number }).hiddenChatMutations)).toBe(0);
  await nav.getByText('设置', { exact: true }).click();
  await screenshot(page, info, 'navigation-during-background-stream');
  await nav.getByText('Agent Hub', { exact: true }).click();
  await expect(page.locator('.chat-markdown')).toContainText(['BACKGROUND_UPDATE']);
  await expect(input).toHaveValue('retained navigation draft');
  await expect(input).toBeInViewport();
  await screenshot(page, info, 'resumed-background-stream');
});
