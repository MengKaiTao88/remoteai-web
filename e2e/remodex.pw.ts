import { expect, test, type Locator } from '@playwright/test';
import { fixtureUrl, login, navigate, screenshot, state } from './chat-helpers';

test('file summaries and real diffs remain accessible in the personal chat surface', async ({ page, request }, info) => {
  test.skip(!['phone-light', 'phone-dark', 'iphone-webkit', 'desktop-wide'].includes(info.project.name), 'Cover both themes, mobile engines and wide Web.');
  await page.addInitScript(dark => localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light'),
    info.project.name.includes('dark'));
  await request.post(fixtureUrl + '/test/reset');
  await login(page);
  await navigate(page, 'Agent Hub');
  if (info.project.name === 'desktop-wide') {
    await expect(page.locator('.dsh-chat-shell')).toHaveAttribute('data-left', 'sidebar');
  }
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

test('a completed Codex timeline discloses mixed operations, independent events and unknown tool details in order', async ({ page, request }, info) => {
  test.skip(!['phone-light', 'phone-dark', 'phone-narrow-large', 'iphone-webkit', 'desktop-wide'].includes(info.project.name));
  await page.addInitScript(({ dark, large }) => {
    localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light');
    if (large) localStorage.setItem('codex-switch:global-font-size', '20');
  }, { dark: info.project.name.includes('dark'), large: info.project.name.includes('large') });
  await request.post(fixtureUrl + '/test/reset');
  await login(page);
  await navigate(page, 'Agent Hub');
  if (info.project.name === 'desktop-wide') {
    await expect(page.locator('.dsh-chat-shell')).toHaveAttribute('data-left', 'sidebar');
  }
  if (!await page.locator('.dsh-sidebar').isVisible()) {
    await page.locator('.dsh-chat-shell').getByRole('button', { name: '打开聊天列表', exact: true }).click();
  }
  await page.locator('.dsh-sidebar').getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  await expect(page.getByText('你可以直接从手机继续这个任务。', { exact: true })).toBeVisible();
  const emit = (method: string, params: unknown) => request.post(fixtureUrl + '/test/chat-event', { data: { method, params } });
  expect((await emit('thread/started', { thread: {
    id: 'demo-chat', cwd: '/demo', preview: '', name: '移动端聊天体验', updatedAt: 0, officialSidebar: { pinned: false },
  } })).ok()).toBe(true);
  const turn = { id: 'official-timeline', status: 'completed', durationMs: 150000, items: [
    { id: 'timeline-user', type: 'userMessage', text: '帮我核对目录和参考资料。' },
    { id: 'timeline-progress', type: 'agentMessage', phase: 'commentary', text: '先检查目录，再搜索资料。' },
    { id: 'timeline-read', type: 'commandExecution', status: 'completed', command: 'Get-Content guide.md',
      commandActions: [{ type: 'read', name: 'guide.md' }], aggregatedOutput: 'File contents' },
    { id: 'timeline-scratch', type: 'reasoning', summary: ['Inspecting current state'] },
    { id: 'timeline-web', type: 'webSearch', status: 'completed', query: 'Codex app-server item events' },
    { id: 'timeline-shell', type: 'commandExecution', status: 'completed', command: 'npm test -- --runInBand --verbose -- ' + 'activity.test.ts '.repeat(12),
      exitCode: 1, aggregatedOutput: 'One assertion failed' },
    { id: 'timeline-chats', type: 'dynamicToolCall', status: 'completed', tool: 'codex_app · list_threads', output: 'Found two chats' },
    { id: 'timeline-mcp', type: 'mcpToolCall', status: 'completed', server: 'GitHub', tool: 'list_issues', result: { issues: [] } },
    { id: 'timeline-files', type: 'fileChange', status: 'completed', changes: [
      { path: 'src/example.ts', kind: { type: 'update' }, diff: '@@ -1 +1 @@\n-const a = 1;\n+const a = 2;' },
    ] },
    { id: 'timeline-agent', type: 'subAgentActivity', kind: 'started', agentPath: '/root/source-review' },
    { id: 'timeline-new', type: 'futureToolActivity', name: 'Index inspector', result: { matched: 3 } },
    { id: 'timeline-thinking', type: 'reasoning', summary: ['**检查结果**\n对照两个来源。'] },
    { id: 'timeline-answer', type: 'agentMessage', phase: 'final_answer', text: '目录和资料核对完成。' },
  ] };
  const response = await emit('turn/completed', { threadId: 'demo-chat', turn });
  expect(response.ok()).toBe(true);
  const answer = page.getByText('目录和资料核对完成。', { exact: true });
  await expect(answer).toBeVisible();
  const activity = page.locator('.remodex-process').filter({ has: page.getByRole('button', { name: /^用时 / }) });
  const toggle = activity.locator('.dsh-process-trigger');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('先检查目录，再搜索资料。', { exact: true })).toHaveCount(0);
  await screenshot(page, info, 'codex-timeline-folded');
  await toggle.click();
  await expect(page.getByText('先检查目录，再搜索资料。', { exact: true })).toBeVisible();
  await expect(activity.locator('.remodex-reasoning')).toHaveCount(0);
  const group = activity.locator('.official-activity-group');
  const summary = group.locator(':scope > button');
  await expect(summary).toContainText('GitHub');
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  await screenshot(page, info, 'codex-timeline-expanded');
  await summary.click();
  const children = group.locator('.official-activity-children [data-activity-category]');
  await expect.poll(() => children.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-activity-category'))))
    .toEqual(['read', 'web', 'command', 'chats', 'integration', 'files']);
  await expect(children.nth(2)).toHaveAttribute('data-status', 'failed');
  await expect(activity.locator('[data-process-item="timeline-agent"] > .official-activity-line')).toContainText('source-review');
  await expect(activity.locator('[data-process-item="timeline-agent"] > span')).toBeVisible();
  await screenshot(page, info, 'codex-timeline-mixed');
  await children.nth(2).locator('button').first().click();
  await expect(children.nth(2)).toContainText('One assertion failed');
  await activity.locator('[data-process-item="timeline-new"] > button').click();
  await expect(activity.locator('[data-process-item="timeline-new"]')).toContainText('"matched": 3');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(answer).toBeVisible();
  await expect(page.getByRole('textbox', { name: '聊天消息' })).toBeInViewport();
  await expect(page.locator('.mobile-tabbar')).toBeHidden();
  await expect(page.locator('.remodex-context-ring circle[fill="currentColor"]')).toHaveCount(0);
  await expect(page.locator('.cs-message-delivery-mode')).toHaveCount(0);
});
