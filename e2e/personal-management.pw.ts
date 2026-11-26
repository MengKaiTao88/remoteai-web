import { expect, test } from '@playwright/test';
import { fixtureUrl, login, navigate, screenshot, swipeBackToChat } from './chat-helpers';

const samples = [
  { email: '1400000@qq.com', primary: 100, weekly: 82, credits: 1 },
  { email: '1700000@163.com', primary: 100, weekly: 64, credits: 0 },
  { email: 'codex00@icloud.com', primary: 100, weekly: 75, credits: 2 },
  { email: 'demo000@dr.com', primary: 100, weekly: 100, credits: 1 },
  { email: 'display@icloud.com', primary: 57, weekly: 38, credits: 0 },
].map((entry, i) => ({ ...entry, id: `preview-${i}` }));

test('personal mobile management shows account quotas and returns to the same chat', async ({ page, request }, info) => {
  test.skip(!['phone-light', 'phone-dark', 'phone-narrow-large', 'iphone-webkit'].includes(info.project.name));
  await request.post(fixtureUrl + '/test/reset');
  await page.addInitScript(({ dark, large }) => {
    localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light');
    if (large) localStorage.setItem('codex-switch:global-font-size', '20');
  }, { dark: info.project.name === 'phone-dark', large: info.project.name.endsWith('large') });
  await page.route('**/sync/accounts/web-summary', route => route.fulfill({ json: { accounts: samples.map(entry => ({
    id: entry.id, email: entry.email, plan: 'Plus', accountSource: 'codex', note: '', expiresAt: '', active: false,
    usage: { fetchedAt: '2026-11-19T05:42:00Z',
      primary: { remainingPercent: entry.primary, resetsAt: Math.floor(Date.now() / 1000) + 18_000 },
      secondary: { remainingPercent: entry.weekly } },
  })) } }));
  await page.route('**/sync/accounts/*/reset-credits', route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2);
    return route.fulfill({ json: { credits: Array.from({ length: samples.find(entry => entry.id === id)?.credits ?? 0 }, () => ({})) } });
  });
  await page.route('**/devices', async route => {
    const response = await route.fetch();
    const json = await response.json();
    await route.fulfill({ response, json: { ...json,
      devices: json.devices?.map((device: object) => ({
        ...device, guiAccountId: samples[2].id, capabilities: ['account-usage'],
      })),
    } });
  });
  await page.routeWebSocket('**/device-switch', route => {
    const device = { deviceId: 'computer', name: '我的工作电脑', platform: 'Windows', online: true,
      guiAccountId: samples[2].id, capabilities: ['account-usage'], lastSeenAt: new Date().toISOString() };
    route.onMessage(message => {
      const packet = JSON.parse(String(message));
      if (packet.type === 'subscribe-devices') route.send(JSON.stringify({ type: 'devices-snapshot', devices: [device] }));
      if (packet.type === 'account-usage') {
        const entry = samples.find(item => item.id === packet.accountId)!;
        route.send(JSON.stringify({ type: 'account-usage-result', requestId: packet.requestId,
          data: { usage: { fetchedAt: new Date().toISOString(),
            primary: { remainingPercent: entry.primary - 5, resetsAt: Math.floor(Date.now() / 1000) + 18_000 },
            secondary: { remainingPercent: entry.weekly } } },
        }));
      }
    });
  });
  await login(page, 45_000);
  await page.getByRole('button', { name: '打开聊天列表', exact: true }).click();
  await page.locator('.dsh-sidebar').getByRole('button', { name: '移动端聊天体验', exact: true }).click();
  const input = page.getByRole('textbox', { name: '聊天消息' });
  await input.fill('保持这条草稿');
  await input.blur();
  const chatTitle = page.locator('.dsh-title-pill strong');
  await expect(chatTitle).toHaveText('移动端聊天体验');
  const stats = page.locator('.dsh-mobile-chat-stats');
  await expect(stats).toContainText('tok/s');
  await expect(stats).toContainText('缓存 —');
  await expect(stats).not.toContainText('|');
  const inputBox = await page.locator('.dsh-input').boundingBox();
  const statsBox = await stats.boundingBox();
  expect(statsBox!.y).toBeGreaterThan(inputBox!.y + inputBox!.height);
  expect(statsBox!.y + statsBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await screenshot(page, info, 'chat-stats');
  const refresh = page.getByRole('button', { name: '刷新对话', exact: true });
  await expect(refresh).toBeEnabled();
  await refresh.click();
  await expect(refresh).toBeEnabled();
  const sideChats = page.getByRole('button', { name: '侧边聊天', exact: true });
  const panel = page.getByRole('dialog', { name: '侧边聊天' });
  await sideChats.click();
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS('background-color', info.project.name === 'phone-dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)');
  await expect(panel.getByRole('button', { name: '关闭', exact: true })).toBeFocused();
  await screenshot(page, info, 'side-chats');
  await page.locator('.dsh-side-chats-backdrop').click({ position: { x: 6, y: 240 } });
  await expect(panel).toBeHidden();
  await sideChats.click();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  for (let index = 0; index < 14; index++) {
    const response = await request.post(fixtureUrl + '/test/chat-event', { data: {
      method: 'turn/completed', params: { threadId: 'demo-chat', turn: {
        id: `reading-turn-${index}`, status: 'completed', items: [
          { id: `reading-question-${index}`, type: 'userMessage', content: [{ type: 'text', text: `读到第 ${index} 段` }] },
          { id: `reading-answer-${index}`, type: 'agentMessage', text: '检查从管理页面返回后，聊天仍在离开时读到的位置。' },
        ],
      } },
    } });
    expect(response.ok()).toBe(true);
  }
  await expect(page.getByText('读到第 13 段', { exact: true })).toBeAttached();
  const viewport = page.locator('.dsh-message-region .chat-messages');
  const firstVisible = () => viewport.evaluate(node => {
    const viewportTop = node.getBoundingClientRect().top;
    const row = Array.from(node.querySelectorAll<HTMLElement>('[data-message-id]'))
      .find(item => item.getBoundingClientRect().bottom > viewportTop);
    return { id: row?.dataset.messageId, top: row?.getBoundingClientRect().top ?? 0 };
  });
  await viewport.evaluate(node => { node.scrollTop = 306; });
  await expect.poll(async () => (await firstVisible()).id).toMatch(/reading-|answer/);
  await page.evaluate(async () => {
    for (let frame = 0; frame < 6; frame++) await new Promise(requestAnimationFrame);
  });
  const readingPosition = await firstVisible();
  for (const [label, name] of [['账号', 'accounts'], ['发现', 'discover'], ['设置', 'settings']]) {
    await navigate(page, label);
    await expect(page.locator('.personal-management-heading h1')).toHaveText(label);
    await expect(viewport).toBeHidden();
    expect(await viewport.evaluate(node => node.clientHeight)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: '返回聊天', exact: true })).toHaveCount(0);
    if (name === 'accounts') {
      await expect(page.locator('.mobile-account-averages dd')).toHaveText(['91.4%', '71.8%']);
      await expect(page.locator('.mobile-account-weekly')).toHaveCount(5);
      await expect(page.locator('.mobile-account-credits')).toHaveText(samples.map(sample => `重置卡 ${sample.credits} 张`));
      await expect(page.getByRole('button', { name: '批量刷新用量', exact: true })).toBeEnabled();
      await expect(page.getByText('自动切号优先级', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Claude Code', { exact: true })).toHaveCount(0);
      await expect(page.locator('[data-mobile-current]')).toContainText('当前使用');
    }
    if (name === 'discover') await expect(page.locator('.discovery-list button').first()).toBeVisible();
    if (name === 'settings') await expect(page.locator('.settings-profile')).toBeVisible();
    await screenshot(page, info, name);
    if (name === 'accounts') {
      await page.getByRole('button', { name: '批量刷新用量', exact: true }).click();
      await expect(page.locator('.mobile-account-averages dd')).toHaveText(['86.4%', '71.8%']);
    }
    await swipeBackToChat(page);
    await expect(chatTitle).toHaveText('移动端聊天体验');
    await expect(input).toHaveValue('保持这条草稿');
    await expect.poll(async () => (await firstVisible()).id).toBe(readingPosition.id);
    await expect.poll(async () => Math.abs((await firstVisible()).top - readingPosition.top)).toBeLessThanOrEqual(3);
  }
});
