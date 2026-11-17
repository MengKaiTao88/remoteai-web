import { expect, test, type Locator } from '@playwright/test';
import { fixtureUrl, login, navigate, screenshot, state } from './chat-helpers';

test('file summaries and real diffs remain accessible in the personal chat surface', async ({ page, request }, info) => {
  test.skip(!['phone-light', 'phone-dark', 'iphone-webkit', 'desktop-wide'].includes(info.project.name), 'Cover both themes, mobile engines and wide Web.');
  await page.addInitScript(dark => localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light'),
    info.project.name.includes('dark'));
  await request.post(fixtureUrl + '/test/reset');
  await login(page);
  await navigate(page, 'Agent Hub');
  if (!await page.locator('.dsh-sidebar').isVisible()) {
    await page.locator('.dsh-chat-shell').getByRole('button', { name: '打开聊天列表', exact: true }).click();
  }
  await expect(page.locator('.dsh-sidebar').getByRole('button', { name: '移动端聊天体验', exact: true })).toBeVisible();
  // Seed before selecting: the fixture updates host storage, not an already-open history snapshot.
  expect((await request.post(fixtureUrl + '/test/sidebar', { data: { action: 'message-details' } })).ok()).toBe(true);
  await page.locator('.dsh-sidebar').getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  const summary = page.getByRole('region', { name: '本轮修改', exact: true });
  await expect(summary).toContainText('src/note.ts');
  await screenshot(page, info, 'file-summary');
  await summary.getByRole('button', { name: '查看 src/note.ts 的差异', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '文件更改详情', exact: true });
  await expect(panel).toContainText('const value = 2;');
  await screenshot(page, info, 'file-diff');
  await panel.getByRole('button', { name: '关闭详情抽屉', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('textbox', { name: '聊天消息' })).toBeInViewport();
});

test('runtime slider commits the final drag position and fast mode to the host', async ({ page, request }, info) => {
  test.skip(!['phone-light', 'iphone-webkit'].includes(info.project.name), 'Exercise the two mobile engines.');
  await request.post(fixtureUrl + '/test/reset');
  await login(page);
  await navigate(page, 'Agent Hub');
  await page.getByRole('textbox', { name: '聊天消息' }).fill('保留草稿');
  await page.locator('.dsh-model-chip-footer').tap();
  const slider = page.getByRole('slider', { name: '推理强度', exact: true });
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + 22, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 22, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(slider).toHaveAttribute('aria-valuetext', '极高');
  await expect.poll(async () => (await state(request)).composer.settings.effort).toBe('xhigh');
  const fast = page.locator('.remodex-runtime-heading').getByRole('button', { name: '快速模式', exact: true });
  await fast.tap();
  await expect(fast).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await state(request)).composer.settings.speed).toBe('fast');
  await fast.tap();
  const ultrafast = page.locator('.remodex-runtime-heading').getByRole('button', { name: 'Ultrafast 模式', exact: true });
  await expect(ultrafast).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await state(request)).composer.settings.speed).toBe('ultrafast');
  await ultrafast.tap();
  await expect(fast).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(async () => (await state(request)).composer.settings.speed).toBe('normal');
  await page.getByRole('dialog', { name: '选择模型', exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '聊天消息' })).toHaveValue('保留草稿');
  await page.locator('.dsh-title-pill').click();
  await page.locator('.dsh-details-panel .dsh-model-chip').tap();
  await expect(page.getByRole('dialog', { name: '选择模型', exact: true })).toBeVisible();
  // A host navigation can close the owner while a native modal occupies the top layer.
  await page.locator('.dsh-details-heading button').dispatchEvent('click');
  await expect(page.locator('.dsh-model-sheet[open]')).toHaveCount(0);
  await page.getByRole('textbox', { name: '聊天消息' }).click();
});

test('Remodex presentation preserves real usage, independent reasoning, plan and composer identity', async ({ page, request }, info) => {
  const activate = (locator: Locator) => info.project.name.startsWith('desktop') ? locator.click() : locator.tap();
  await page.addInitScript(dark => localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light'),
    info.project.name.includes('dark'));
  await request.post(fixtureUrl + '/test/reset');
  await login(page);
  await navigate(page, 'Agent Hub');
  if (!await page.locator('.dsh-sidebar').isVisible()) {
    await page.locator('.dsh-chat-shell').getByRole('button', { name: '打开聊天列表', exact: true }).click();
  }
  await page.locator('.dsh-sidebar').getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  const input = page.getByRole('textbox', { name: '聊天消息' });
  await input.fill('草稿和光标保留');
  const original = await input.elementHandle();
  await request.post(fixtureUrl + '/test/sidebar', { data: { action: 'context-usage' } });
  const ring = page.locator('.remodex-context-ring');
  await expect(ring.locator('circle[pathLength]')).toHaveAttribute('stroke-dasharray', '6 100');
  await activate(ring);
  await expect(page.locator('.remodex-usage-popover')).toBeVisible();
  await screenshot(page, info, 'context-usage');
  if (!info.project.name.startsWith('desktop')) {
    await page.touchscreen.tap(5, 5);
    await expect(page.locator('.remodex-usage-popover')).toHaveCount(0);
    await activate(ring);
    await expect(page.locator('.remodex-usage-popover')).toBeVisible();
  }
  await page.locator('.remodex-usage-popover').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(input).toHaveValue('草稿和光标保留');
  expect(await input.evaluate((node, old) => node === old, original)).toBe(true);
  await activate(page.getByRole('button', { name: '添加内容', exact: true }));
  await expect(page.locator('.chat-add-menu')).toBeVisible();
  await screenshot(page, info, 'attachment-menu');
  await activate(page.getByRole('button', { name: '添加内容', exact: true }));
  await input.fill('');
  await input.blur();

  const emit = (method: string, params: unknown) => request.post(fixtureUrl + '/test/chat-event', { data: { method, params } });
  const turn = { id: 'remodex-presentation', status: 'inProgress',
    plan: [{ step: '阅读源码', status: 'completed' }, { step: '验证手机页面', status: 'inProgress' }], items: [
      { id: 'remodex-user', type: 'userMessage', text: '检查手机聊天界面。' },
      { id: 'remodex-thinking', type: 'reasoning', summary: ['**检查布局**\n检查输入框和消息区。\n\n**验证交互**\n分别验证浮层和侧栏。'] },
      { id: 'remodex-answer', type: 'agentMessage', phase: 'final_answer', text: '界面验证完成。\n\n草稿、队列和远程连接继续使用原有逻辑。' },
    ] };
  await emit('turn/started', { threadId: 'demo-chat', turn });
  await expect(page.locator('.remodex-plan-capsule')).toContainText('验证手机页面');
  await page.locator('.remodex-plan-capsule').click();
  await expect(page.locator('.chat-plan-step')).toHaveCount(2);
  await screenshot(page, info, 'task-plan');
  const handle = page.getByRole('button', { name: '下拉关闭', exact: true });
  if (await handle.isVisible()) await handle.press('Enter');
  else await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  const summaries = page.locator('.remodex-reasoning details');
  await expect(summaries).toHaveCount(2);
  await expect(page.locator('.remodex-reasoning-detail .chat-markdown')).toHaveCount(0);
  await activate(summaries.first().locator('summary'));
  await expect(page.locator('.remodex-reasoning-detail .chat-markdown')).toHaveCount(1);
  await expect(summaries.first()).toHaveAttribute('open', '');
  await expect(summaries.last()).not.toHaveAttribute('open');
  await expect(page.getByText('检查输入框和消息区。', { exact: true })).toBeVisible();
  await screenshot(page, info, 'reasoning-expanded');
  await emit('turn/completed', { threadId: 'demo-chat', turn: { ...turn, status: 'completed' } });
  await expect(page.getByText('界面验证完成。', { exact: true })).toBeVisible();
  await expect(input).toBeInViewport();
});
