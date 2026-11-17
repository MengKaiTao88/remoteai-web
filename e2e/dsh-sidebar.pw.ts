import { expect, test } from '@playwright/test';
import { fixtureUrl, login, navigate, screenshot } from './chat-helpers';

test('personal phone sidebar groups chats, dismisses outside and owns management navigation', async ({ page, request }, info) => {
  test.skip(info.project.name.startsWith('desktop'), 'Personal mobile navigation only.');
  await page.addInitScript(({ dark, large }) => {
    localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light');
    if (large) localStorage.setItem('codex-switch:global-font-size', '20');
  }, { dark: info.project.name.includes('dark'), large: info.project.name.includes('large') });
  await request.post(fixtureUrl + '/test/reset');
  await login(page);
  await navigate(page, 'Agent Hub');
  const open = () => page.locator('.dsh-chat-header').getByRole('button', { name: '打开聊天列表', exact: true }).click();
  await open();
  const drawer = page.locator('.dsh-sidebar');
  await expect(page.locator('.mobile-tabbar')).toHaveCount(0);
  await expect(drawer.locator('.dsh-list-mode')).toHaveText('项目');
  await expect(drawer.locator('.chat-project-heading').first()).toBeVisible();
  await expect(drawer.locator('.chat-group-more, .chat-drawer-footer')).toHaveCount(0);
  await request.post(fixtureUrl + '/test/sidebar', { data: { action: 'group-preview' } });
  const project = drawer.getByRole('region', { name: '演示项目', exact: true });
  await expect(project.locator('.chat-thread')).toHaveCount(6);
  const heading = project.locator('.chat-project-toggle');
  await heading.click();
  await expect(project.locator('.chat-thread')).toHaveCount(0);
  await heading.click();
  await expect(project.locator('.chat-thread')).toHaveCount(6);
  const newButton = drawer.locator('.dsh-sidebar-new');
  expect((await newButton.boundingBox())!.height).toBeLessThan(60);
  const mode = drawer.locator('.dsh-list-mode');
  await mode.click();
  await expect(mode).toHaveText('最近对话');
  await expect(drawer.locator('.chat-project-heading')).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: '移动端聊天体验', exact: true })).toBeVisible();
  await screenshot(page, info, 'sidebar-recent');
  await mode.click();
  await expect(mode).toHaveText('项目');
  await screenshot(page, info, 'sidebar-projects');
  const shell = (await page.locator('.dsh-chat-shell').boundingBox())!;
  await page.mouse.click(shell.x + shell.width - 10, shell.y + 180);
  await expect(drawer).toBeHidden();
  await open();
  await drawer.getByRole('button', { name: '新对话', exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole('textbox', { name: '聊天消息' })).toBeVisible();
  for (const label of ['发现', '设置', '账号']) {
    await navigate(page, label);
    await expect(page.locator('.personal-mobile-navigation button')).toHaveText('返回聊天');
    await screenshot(page, info, `navigation-${label}`);
    await navigate(page, 'Agent Hub');
    await expect(page.getByRole('textbox', { name: '聊天消息' })).toBeVisible();
  }
});
