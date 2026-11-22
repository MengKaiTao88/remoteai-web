import { expect, test } from '@playwright/test';
import { fixtureUrl, login, navigate, openChatList, operationCount, screenshot, settled, state } from './chat-helpers';

test('selects a plugin by typing slash and sends it with the existing draft', async ({ page, request }, info) => {
  const touch = !!info.project.use.hasTouch;
  await page.addInitScript(({ dark, large }) => {
    localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light');
    if (large) localStorage.setItem('codex-switch:global-font-size', '20');
  }, { dark: info.project.name.includes('dark'), large: info.project.name.includes('large') });
  await request.post(`${fixtureUrl}/test/reset`);
  await login(page, 35_000);
  await navigate(page, 'Agent Hub');
  const input = page.getByRole('textbox', { name: '聊天消息', exact: true });
  await expect(input).toBeVisible({ timeout: 35_000 });
  const personal = await page.locator('html[data-pocket-web]').count() > 0;
  const sidebar = page.locator(personal ? '.dsh-sidebar' : '.chat-drawer, .chat-sidebar');
  if (personal && !await sidebar.isVisible()) {
    await page.getByRole('button', { name: '打开聊天列表', exact: true }).click();
  } else if (!personal) await openChatList(page);
  await sidebar.getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  await expect(page.getByText('帮我整理今天的工作计划。', { exact: true })).toBeVisible();
  const plugin = page.getByRole('menuitem', { name: '使用插件 GitHub', exact: true });
  await input.fill('/');
  await expect(plugin).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '目标模式' })).toBeVisible();
  await screenshot(page, info, 'slash-plugins');
  await input.fill('$git');
  await expect(plugin).toHaveCount(0);

  const suffix = ' 今天的改动';
  await input.fill(`检查 /git${suffix}`);
  await input.press('End');
  for (let offset = 0; offset < suffix.length; offset += 1) await input.press('ArrowLeft');
  await expect(plugin).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '目标模式' })).toHaveCount(0);
  await screenshot(page, info, 'plugin-filtered');
  if (touch) await plugin.tap();
  else await input.press('Enter');
  await expect(page.getByRole('button', { name: '移除GitHub', exact: true })).toBeVisible();
  await expect(input).toHaveValue('检查  今天的改动');
  await expect(input).toBeFocused();
  await expect.poll(() => input.evaluate(node => (node as HTMLTextAreaElement).selectionStart)).toBe(3);
  await expect(page.locator('.chat-composer-popover')).toHaveCount(0);
  expect(await operationCount(request, 'send')).toBe(0);
  await screenshot(page, info, 'plugin-attached');

  const send = page.getByRole('button', { name: '发送消息', exact: true });
  if (touch) await send.tap();
  else await send.click();
  await settled(page);
  const sent = (await state(request)).operations.filter(entry => entry.operation === 'send');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ text: '检查  今天的改动', attachments: [
    { kind: 'plugin', name: 'GitHub', path: 'plugin://github@fixture' },
  ] });
});
