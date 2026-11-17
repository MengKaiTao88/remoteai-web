import { expect, test, type Page } from '@playwright/test';
import { fixtureUrl, screenshot, send, settled, state, openChatSettings, navigate } from './chat-helpers';
import { chooseSetting } from './chat-settings';

async function list(page: Page) {
  if (!await page.locator('.dsh-sidebar').isVisible()) {
    await page.locator('.dsh-chat-shell').getByRole('button', { name: '打开聊天列表', exact: true }).click();
  }
  await expect(page.locator('.dsh-sidebar')).toBeVisible();
}

test('DSH workspace preserves authoritative chat actions, layout, settings and other pages',
  async ({ page, request }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const desktop = info.project.name.startsWith('desktop');
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.addInitScript(({ dark, large }) => {
      localStorage.setItem('codex-switch.web.theme.v1', dark ? 'dark' : 'light');
      if (large) localStorage.setItem('codex-switch:global-font-size', '20');
    }, { dark: info.project.name.includes('dark'), large: info.project.name.includes('large') });
    await request.post(fixtureUrl + '/test/reset');
    await page.goto('./', { waitUntil: 'commit' });
    await page.getByPlaceholder('name@example.com').fill('mobile-test@example.test');
    await page.getByPlaceholder('输入登录密码').fill('local-test');
    await page.getByRole('button', { name: '登录并查看' }).click();
    await page.getByRole('button', { name: '同意并登录' }).click();
    const nav = page.locator(desktop ? '.desktop-sidebar nav' : '.dsh-mobile-links');
    await navigate(page, 'Agent Hub');
    await expect(page.locator('.dsh-chat-shell')).toBeVisible();
    await list(page);
    await screenshot(page, info, 'conversation-list');
    await page.locator('.dsh-sidebar').getByRole('button', { name: '移动端聊天体验', exact: true }).click();
    if (await page.locator('.dsh-sidebar-scrim').isVisible()) {
      await page.locator('.dsh-sidebar-scrim').click({ position: { x: 350, y: 200 } });
    }
    await expect(page.getByText('帮我整理今天的工作计划。')).toBeVisible();
    await screenshot(page, info, 'history');

    if (info.project.name === 'phone-light') {
      const input = page.getByRole('textbox', { name: '聊天消息' });
      await input.fill('draft survives drawer gesture');
      await input.blur();
      const session = await page.context().newCDPSession(page);
      const swipe = async (from: number, to: number) => {
        const box = (await page.locator('.dsh-chat-shell').boundingBox())!;
        const y = box.y + 180;
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] });
        for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x: from + (to - from) * step / 8, y }],
        });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      try {
        await swipe(60, 240);
        await expect(page.locator('.dsh-sidebar')).toBeVisible();
        await swipe(240, 60);
        await expect(page.locator('.dsh-sidebar')).toBeHidden();
        await expect(input).toHaveValue('draft survives drawer gesture');
      } finally { await session.detach(); }
      await input.fill('');
    }

    const model = page.locator('.dsh-header-model');
    await model.getByRole('button').click();
    const modelSheet = page.getByRole('dialog', { name: '选择模型', exact: true });
    await expect(modelSheet).toBeVisible();
    await expect(modelSheet.getByRole('slider')).toHaveCount(0);
    await screenshot(page, info, 'dsh-model-sheet');
    await modelSheet.getByRole('radio', { name: '第二模型', exact: true }).click();
    await expect(model).toContainText('第二模型');
    await modelSheet.getByRole('radio', { name: '高', exact: true }).click();
    await expect(modelSheet).toBeHidden();
    // App navigation may occur outside the modal (history/swipe/host action); release its top layer.
    await model.getByRole('button').click();
    await expect(modelSheet).toBeVisible();
    await nav.getByText('账号', { exact: true }).dispatchEvent('click');
    await expect(page.locator('.dsh-model-sheet[open]')).toHaveCount(0);
    await navigate(page, '设置');
    await navigate(page, 'Agent Hub');
    await expect(modelSheet).toBeHidden();
    if (!desktop) {
      await openChatSettings(page);
      await chooseSetting(page, '模型', '测试模型');
      await chooseSetting(page, '推理强度', '高');
      await chooseSetting(page, '访问权限', '请求批准');
      await screenshot(page, info, 'chat-settings');
      const handle = page.getByRole('button', { name: '下拉关闭', exact: true });
      if (await handle.isVisible()) await handle.press('Enter');
      else await page.getByRole('dialog', { name: '聊天设置', exact: true })
        .getByRole('button', { name: '关闭', exact: true }).click();
      await expect(page.locator('.chat-settings')).toBeHidden();
    }
    await send(page, 'H5 regression message');
    await settled(page);
    await expect(page.locator('.chat-markdown pre')).toHaveText('const connected = true;');
    await screenshot(page, info, 'reply');

    await page.locator('.dsh-title-pill').click();
    await expect(page.locator('.dsh-details-panel')).toBeVisible();
    if (info.project.name === 'tablet-sheet') {
      await expect(page.locator('.dsh-details-panel')).toHaveAttribute('data-presentation', 'sheet');
    }
    await screenshot(page, info, 'conversation-details');
    await page.locator('.dsh-details-heading button').click();

    await send(page, 'slow task');
    await expect(page.getByRole('button', { name: '暂停生成' })).toBeVisible();
    const liveInput = page.getByRole('textbox', { name: '聊天消息' });
    await expect(liveInput).toBeInViewport();
    await screenshot(page, info, 'dsh-running-composer');
    await send(page, 'personal queue check');
    await expect(page.locator('.chat-queue')).toContainText('personal queue check');
    await screenshot(page, info, 'queue');
    await page.getByRole('button', { name: '暂停生成' }).click();
    await expect.poll(async () => (await state(request)).operations.some(value => value.operation === 'interrupt')).toBe(true);
    const input = page.getByRole('textbox', { name: '聊天消息' });
    await input.fill('draft survives rotation');
    const original = page.viewportSize()!;
    await page.setViewportSize({ width: original.height, height: 412 });
    await expect(page.locator('.dsh-chat-shell')).toHaveAttribute('data-size', 'compact');
    await expect(input).toHaveValue('draft survives rotation');
    await page.setViewportSize(original);
    await input.fill('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

    await navigate(page, '账号');
    await expect(page.locator('.chat-page')).toBeHidden();
    await screenshot(page, info, 'accounts-original');
    await navigate(page, '设置');
    await screenshot(page, info, 'settings-original');
    await navigate(page, 'Agent Hub');
    await expect(page.locator('.dsh-title-pill')).toContainText('移动端聊天体验');
    expect(JSON.stringify((await state(request)).threads)).toContain('H5 regression message');
    expect(errors).toEqual([]);
  });
