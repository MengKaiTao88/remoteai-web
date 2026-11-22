import { expect, test, type Locator } from '@playwright/test';
import { fixtureUrl, login, screenshot, navigate, state } from './chat-helpers';

test('keeps the writing capsule visible through long live history and short viewports', async ({ page, request }, info) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.addInitScript(dark => localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light'),
    info.project.name.includes('dark'));
  await request.post(fixtureUrl + '/test/reset');
  await request.post(fixtureUrl + '/test/sidebar', { data: { action: 'history-pages' } });
  await login(page);
  await navigate(page, 'Agent Hub');
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
  await input.click();
  await input.fill('draft before loading older history');
  await expect(input).toBeInViewport();
  await page.locator('.dsh-title-pill').click();
  await page.locator('.dsh-details-heading button').click();
  await expect(input).toBeInViewport();
  await expect(input).toHaveValue('draft before loading older history');
  await input.fill('');
  await input.click();
  await page.locator('.dsh-model-chip-footer').click();
  const sheet = page.getByRole('dialog', { name: '选择模型', exact: true });
  await sheet.getByRole('button', { name: '关闭', exact: true }).click();
  const original = page.viewportSize()!;
  await page.setViewportSize({ width: original.width, height: 480 });
  await input.fill('one\ntwo\nthree\nfour\nfive\nsix');
  await expect(input).toBeInViewport();
  await expect.poll(async () => {
    const form = (await page.locator('.dsh-input').boundingBox())!;
    const nav = await page.locator('.mobile-tabbar').count() ? await page.locator('.mobile-tabbar').boundingBox() : null;
    return !nav || form.y + form.height <= nav.y + 1;
  }).toBe(true);
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

test('stops the current turn and continues after the computer interrupts', async ({ page, request }, info) => {
  test.skip(!['iphone-webkit', 'phone-dark', 'desktop-wide'].includes(info.project.name));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.addInitScript(dark => localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light'),
    info.project.name === 'phone-dark');
  await request.post(fixtureUrl + '/test/reset');
  await login(page, 35_000);
  await navigate(page, 'Agent Hub');
  if (!await page.locator('.dsh-sidebar').isVisible()) {
    await page.getByRole('button', { name: '打开聊天列表', exact: true }).click();
  }
  await page.locator('.dsh-sidebar').getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  await expect(page.getByText('帮我整理今天的工作计划。', { exact: true })).toBeVisible();

  const threadId = 'demo-chat';
  const emit = async (method: string, data: object) => {
    const response = await request.post(fixtureUrl + '/test/chat-event', {
      data: { method, params: { threadId, ...data } },
    });
    expect(response.ok()).toBe(true);
  };
  const activate = (button: Locator) => info.project.use.hasTouch ? button.tap() : button.click();
  const pause = page.getByRole('button', { name: '暂停生成', exact: true });
  const resume = page.getByRole('button', { name: '继续生成', exact: true });
  const olderId = '019a0000-0000-7000-8000-000000000001';
  const current = { id: '019a0000-0001-7000-8000-000000000002', status: 'inProgress', items: [] };
  await emit('turn/started', { turn: current });
  await expect(pause).toBeEnabled();
  await emit('item/completed', { turnId: olderId, item: { id: 'late-reply', type: 'agentMessage',
    phase: 'final_answer', text: '这条旧回复晚到了。' } });
  await expect(page.getByText('这条旧回复晚到了。', { exact: true })).toBeVisible();
  await screenshot(page, info, 'pause-current-turn');
  await activate(pause);
  await expect.poll(async () => (await state(request)).operations.filter(entry => entry.operation === 'interrupt')
    .map(entry => entry.turnId)).toEqual([current.id]);
  await expect(resume).toBeEnabled();

  await emit('turn/completed', { turn: { id: olderId, status: 'completed', items: [] } });
  const desktopTurn = { ...current, id: '019a0000-0002-7000-8000-000000000003' };
  await emit('turn/started', { turn: desktopTurn });
  await expect(pause).toBeEnabled();
  await emit('turn/completed', { turn: { ...desktopTurn, status: 'interrupted' } });
  await expect(resume).toBeEnabled();
  await screenshot(page, info, 'continue-after-desktop-stop');
  const before = await state(request);
  const directAction = { operation: 'continueInterruptedTask', threadId, turnId: desktopTurn.id };
  await activate(resume);
  await expect.poll(async () => (await state(request)).operations.slice(before.operations.length))
    .toEqual(expect.arrayContaining([expect.objectContaining(directAction)]));
  // The test host publishes the new empty turn, as the desktop owner does after accepting continuation.
  await emit('turn/started', { turn: { ...desktopTurn, id: '019a0000-0003-7000-8000-000000000004' } });
  await expect(pause).toBeEnabled();
  await expect(page.getByText('请继续完成刚才中断的任务。', { exact: true })).toHaveCount(0);
  await expect(page.locator('.dsh-input-queue')).toHaveCount(0);
  const after = await state(request);
  const writes = after.operations.slice(before.operations.length).filter(entry =>
    ['continueInterruptedTask', 'queueEnqueue', 'send', 'steer'].includes(String(entry.operation)));
  expect(writes).toEqual([expect.objectContaining(directAction)]);
  const userItems = (threads: typeof before.threads) => threads.find(thread => thread.id === threadId)?.turns
    ?.flatMap(turn => turn.items).filter(item => item.type === 'userMessage');
  expect(userItems(after.threads)).toEqual(userItems(before.threads));
  await screenshot(page, info, 'continued-without-message');
});
