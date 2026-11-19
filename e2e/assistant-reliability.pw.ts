import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
import { fixtureUrl, login, navigate, screenshot, state } from './chat-helpers';

test('horizontal table scrolling keeps the sidebar closed and phone code wrapping toggles', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'phone-light', 'Native Chromium touch routing on a phone.');
  await openChat(page, request);
  const headings = Array.from({ length: 10 }, (_, index) => 'Column ' + index);
  const tableText = '| ' + headings.join(' | ') + ' |\n| ' + headings.map(() => '---').join(' | ') + ' |\n| '
    + headings.map(() => 'Long table contents').join(' | ') + ' |';
  const turn = { id: 'table-gesture', status: 'completed', items: [{ id: 'table-answer', type: 'agentMessage',
    phase: 'final_answer', text: tableText + '\n\n```ts\nconst longLine = ' + 'value'.repeat(25) + ';\n```' }] };
  await request.post(fixtureUrl + '/test/chat-event', { data: { method: 'turn/started',
    params: { threadId: 'demo-chat', turn } } });
  const table = page.locator('.chat-table-viewport').last();
  await expect(table).toBeVisible();
  await table.evaluate(node => { node.scrollLeft = 200; });
  const box = (await table.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  try {
    const point = { x: box.x + 120, y: box.y + box.height / 2 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: point.x + step * 15, y: point.y }],
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await session.detach(); }
  await expect(page.locator('.dsh-sidebar')).toBeHidden();
  const wrap = page.locator('.chat-code-wrap').last();
  const before = await wrap.getAttribute('aria-pressed');
  await wrap.click();
  await expect(wrap).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  await expect(page.locator('.chat-code-block pre').last()).toHaveCSS('white-space', before === 'true' ? 'pre' : 'pre-wrap');
  await screenshot(page, info, 'table-and-code-controls');
});

test.beforeEach(async ({ page }, info) => {
  await page.addInitScript(({ dark, large }) => {
    localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light');
    if (large) localStorage.setItem('codex-switch:global-font-size', '20');
  }, { dark: info.project.name.includes('dark'), large: info.project.name.includes('large') });
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
});

async function openChat(page: Page, request: APIRequestContext) {
  await request.post(fixtureUrl + '/test/reset');
  await login(page); await navigate(page, 'Agent Hub');
  if (!await page.locator('.dsh-sidebar').isVisible())
    await page.locator('.dsh-chat-header').getByRole('button', { name: '打开聊天列表', exact: true }).click();
  await page.locator('.dsh-sidebar').getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '聊天消息' })).toBeVisible();
}

test('sent and answer images render and an explicit retry fetches fresh pixels after decode failure', async ({ page }, info) => {
  await page.addInitScript(dark => localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light'),
    info.project.name.includes('dark'));
  await page.goto('e2e/dsh-messages-harness.html?image-retry=1', { waitUntil: 'commit' });
  const sent = page.locator('[data-message-id=sent-image]');
  await expect(sent.getByRole('button', { name: '重试', exact: true })).toBeVisible({ timeout: 45000 });
  await expect(page.locator('body')).toHaveAttribute('data-image-reads', '1');
  await sent.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-image-reads', '2');
  for (const row of [sent, page.locator('[data-message-id=answer-image]')]) {
    await expect(row.locator('img')).toBeVisible();
    expect(await row.locator('img').evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  }
  await screenshot(page, info, 'sent-and-answer-images');
});

test('phone statistics use recorded desktop rounds and steps even with more visible activity items', async ({ page }, info) => {
  test.skip(!['phone-light', 'iphone-webkit'].includes(info.project.name));
  await page.goto('e2e/dsh-messages-harness.html?official-counts=1', { waitUntil: 'commit' });
  const stats = page.locator('.dsh-mobile-chat-stats');
  await expect(stats.locator('span')).toHaveText(['35.7 tok/s', '1 轮 3 步'], { timeout: 75_000 });
  await screenshot(page, info, 'desktop-counts');
});

test('restoring the chat waits for the computer list and leaves account loading in the background', async ({ page, request }, info) => {
  test.skip(!['phone-light', 'iphone-webkit'].includes(info.project.name));
  await request.post(fixtureUrl + '/test/reset');
  await login(page);
  let finish!: () => void;
  let started!: () => void;
  const accountRequest = new Promise<void>(resolve => { started = resolve; });
  const accountResponse = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/sync/accounts/web-summary', async route => {
    started();
    await accountResponse;
    await route.continue();
  });
  try {
    await page.reload({ waitUntil: 'commit' });
    await accountRequest;
    await page.locator('.dsh-chat-header').getByRole('button', { name: '打开聊天列表', exact: true }).click();
    await page.locator('.dsh-sidebar').getByRole('button', { name: '移动端聊天体验', exact: true }).click();
    await expect(page.getByText('你可以直接从手机继续这个任务。', { exact: true })).toBeVisible();
    await screenshot(page, info, 'chat-before-accounts');
  } finally {
    finish();
  }
});

test('empty composer remains stable after focus and all add-menu items fit a short viewport', async ({ page, request }, info) => {
  await openChat(page, request);
  const input = page.getByRole('textbox', { name: '聊天消息' });
  const form = page.locator('.dsh-input');
  const original = await input.elementHandle();
  await input.fill(''); await input.blur();
  const before = (await form.boundingBox())!;
  await input.focus(); await input.blur();
  await expect.poll(async () => Math.abs((await form.boundingBox())!.height - before.height)).toBeLessThan(2);
  expect(await input.evaluate((node, old) => node === old, original)).toBe(true);
  await expect(page.locator('.dsh-model-chip-footer')).toBeVisible();
  await expect(page.locator('.remodex-context-ring')).toBeVisible();
  await page.setViewportSize({ width: Math.min(390, page.viewportSize()!.width), height: 480 });
  await page.getByRole('button', { name: '添加内容', exact: true }).click();
  const menu = page.locator('.chat-composer-popover');
  await expect(menu).toBeVisible();
  const last = menu.locator('button').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  expect(await menu.evaluate(node => getComputedStyle(node).overflowY)).toBe('auto');
  await screenshot(page, info, 'short-screen-add-menu');
});

test('details isolate focus while their nested account, permission and context controls stay usable', async ({ page, request }, info) => {
  await openChat(page, request);
  await page.locator('.dsh-title-pill').click();
  const details = page.locator('.dsh-details-panel');
  await expect(details).toBeVisible();
  if (!info.project.name.startsWith('desktop')) {
    for (let index = 0; index < 30; index++) {
      await page.keyboard.press('Tab');
      expect(await details.evaluate(node => document.activeElement === document.body || node.contains(document.activeElement))).toBe(true);
    }
  }
  await details.getByRole('button', { name: /^访问权限：/ }).click();
  const access = page.getByRole('menuitemradio', { name: /完全访问/ });
  await expect(access).toBeVisible(); await access.click();
  await expect.poll(async () => (await state(request)).composer.settings.access).toBe('danger-full-access');
  await details.getByRole('button', { name: '切换账户', exact: true }).click();
  const accountSearch = page.getByRole('textbox', { name: '搜索账户', exact: true });
  await expect(accountSearch).toBeVisible(); await accountSearch.fill('fixture');
  await page.getByRole('button', { name: '返回上一层', exact: true }).click();
  await details.getByRole('button', { name: '对话上下文设置', exact: true }).click();
  const capacity = page.locator('#chat-context-capacity');
  await expect(capacity).toBeVisible(); await capacity.fill('640');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(capacity).toBeHidden();
  await screenshot(page, info, 'details-nested-controls');
});

test('multi-question cards retain earlier answers and submit the complete set only at the last step', async ({ page, request }, info) => {
  await openChat(page, request);
  const turn = { id: 'questions-turn', status: 'completed', items: [
    { id: 'questions', type: 'agentMessage', delivery: 'async', questions: [
      { title: '选择布局', options: ['简洁', '详细'] }, { title: '输入补充说明' },
    ], text: '请确认两个选项。' },
  ] };
  await request.post(fixtureUrl + '/test/chat-event', { data: { method: 'turn/started',
    params: { threadId: 'demo-chat', turn } } });
  await page.locator('.chat-question-open').click();
  const sheet = page.locator('.assistant-question-sheet');
  await expect(sheet).toContainText('1/2');
  await sheet.getByRole('radio', { name: '详细', exact: true }).check();
  await sheet.locator('.chat-question-footer').getByRole('button', { name: '下一个', exact: true }).click();
  await expect(sheet).toContainText('2/2');
  await sheet.getByRole('textbox', { name: '输入补充说明', exact: true }).fill('保留现有功能');
  await sheet.locator('.assistant-question-step').getByRole('button').first().click();
  await expect(sheet.getByRole('radio', { name: '详细', exact: true })).toBeChecked();
  await sheet.locator('.chat-question-footer').getByRole('button', { name: '下一个', exact: true }).click();
  await expect(sheet.getByRole('textbox', { name: '输入补充说明', exact: true })).toHaveValue('保留现有功能');
  await screenshot(page, info, 'question-final-step');
  await sheet.getByRole('button', { name: '提交回答', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect.poll(async () => (await state(request)).operations.filter(op => op.operation === 'queueEnqueue').length).toBe(1);
});


test('user message actions expose the same controls through right-click and touch long-press', async ({ page, request }, info) => {
  await openChat(page, request);
  const row = page.locator('.assistant-user-actions').first();
  await row.click({ button: 'right' });
  const actions = row.locator('.chat-message-actions');
  await expect(actions).toBeVisible();
  const names = await actions.locator('button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label') || node.textContent));
  await page.getByRole('textbox', { name: '聊天消息' }).click();
  await expect(actions).toBeHidden();
  await row.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7, isPrimary: true, button: 0,
    clientX: 250, clientY: 120 });
  await expect(actions).toBeVisible();
  await row.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7, isPrimary: true, button: 0 });
  expect(await actions.locator('button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label') || node.textContent)))
    .toEqual(names);
  await screenshot(page, info, 'user-message-actions');
});
