import { expect, type Locator, type Page, type APIRequestContext, type TestInfo } from '@playwright/test';
import type { Thread } from '../../../shared/remote-chat/views/types';
import { testText } from '../../../scripts/i18n-fixture.mjs';

interface FixtureState {
  synchronization: Array<{ bytes: number; changedItems: number; text: string }>;
  sidebar: import('../../../shared/remote-chat/sidebar').SidebarSnapshot;
  composer: import('../../../shared/remote-chat/composer').ComposerSnapshot;
  operations: Array<Record<string, unknown>>;
  threads: Thread[];
  streamErrors: string[];
  errors: string[];
  mobileConnections: number;
  connectedMobiles: number;
  relayFrames: number;
}
export const fixtureUrl = process.env.CHAT_TEST_FIXTURE_URL
  ?? `http://127.0.0.1:${process.env.CHAT_TEST_API_PORT ?? '1490'}`;
export async function state(request: APIRequestContext): Promise<FixtureState> {
  return (await request.get(`${fixtureUrl}/test/state`)).json();
}
export async function operationCount(request: APIRequestContext, operation: string) {
  return (await state(request)).operations.filter((entry) => entry.operation === operation).length;
}
export async function navigate(page: Page, label: string) {
  const mobile = (page.viewportSize()?.width ?? 0) <= 860;
  const language = (await page.locator('html').getAttribute('lang'))?.split('-')[0] ?? 'zh';
  if (label === testText('client.app.chat', {}, language)) label = testText('client.agentHub.title', {}, language);
  const discoveryChild = label === testText('client.app.devices', {}, language) || label === '2FA';
  const personal = await page.locator('html[data-pocket-web]').count() > 0;
  if (mobile && personal) await expect(page.locator('.personal-mobile-shell')).toBeVisible();
  if (mobile && personal) {
    const back = page.locator('.personal-mobile-navigation button');
    if (await back.isVisible()) await click(back);
    if (label === testText('client.agentHub.title', {}, language)) return;
    const drawer = page.locator('.dsh-sidebar');
    if (!await drawer.isVisible()) {
      await click(page.locator('.dsh-chat-header').getByRole('button', {
        name: testText('client.chat.openChatList', {}, language), exact: true }));
    }
    await click(page.locator('.dsh-mobile-links').getByText(
      discoveryChild ? testText('client.discovery.title', {}, language) : label, { exact: true }));
    if (discoveryChild) await click(page.locator('.discovery-list').getByRole('button', { name: label, exact: true }));
    return;
  }
  await click(page.locator(mobile ? '.mobile-tabbar' : '.desktop-sidebar nav')
    .getByText(discoveryChild ? testText('client.discovery.title', {}, language) : label, { exact: true }));
  if (discoveryChild) await click(page.locator('.discovery-list').getByRole('button', { name: label, exact: true }));
}
export async function openChatList(page: Page) {
  const toggle = page.getByRole('button', { name: '打开聊天列表', exact: true });
  if (await toggle.isVisible()) await click(toggle);
  await expect(page.locator('.chat-drawer, .chat-sidebar')).toBeVisible();
}
export async function connect(page: Page) {
  await navigate(page, '聊天');
  await expect(page.getByRole('textbox', { name: '聊天消息' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '新聊天', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '搜索聊天' }))
    .toHaveCount((page.viewportSize()?.width ?? 0) > 860 ? 1 : 0);
}
export async function send(page: Page, text: string) {
  await page.getByRole('textbox', { name: '聊天消息' }).fill(text);
  await click(page.getByRole('button', { name: '发送消息', exact: true }));
}
export async function settled(page: Page) {
  // The draft hides Pause until the send is acknowledged and the input clears.
  await expect(page.getByRole('textbox', { name: '聊天消息' })).toHaveValue('');
  await expect(page.getByRole('button', { name: '暂停生成' })).toHaveCount(0);
}
export async function openChatSettings(page: Page) {
  if ((page.viewportSize()?.width ?? 0) > 860) return;
  await page.getByRole('textbox', { name: '聊天消息' }).click();
  const emulateKeyboard = !beforeClick.has(page);
  if (emulateKeyboard) await page.evaluate(() => {
    if (!matchMedia('(pointer: coarse)').matches || !window.visualViewport) return;
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => innerHeight - 300 });
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  if (await page.locator('.remodex-context-ring').count()) {
    await page.locator('.remodex-context-ring').click();
    await page.locator('.remodex-settings-link').click();
  } else await page.getByRole('button', { name: /聊天设置/ }).click();
  if (emulateKeyboard) await page.evaluate(() => {
    if (!window.visualViewport) return;
    Reflect.deleteProperty(window.visualViewport, 'height');
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
}
export async function screenshot(page: Page, info: TestInfo, name: string) {
  await expect(page.locator('.adm-toast-mask')).toHaveCount(0);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
}

export async function login(page: Page) {
  await page.goto('/web/', { waitUntil: 'commit' });
  await page.getByPlaceholder('name@example.com').fill('mobile-test@example.test');
  await page.getByPlaceholder('输入登录密码').fill('local-test');
  await page.getByRole('button', { name: '登录并查看', exact: true }).click();
  const consent = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: '同意并登录', exact: true }) });
  await expect(consent).toBeVisible();
  // Observe the actual sign-in response before beginning fixture-dependent journeys.
  const authenticated = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/auth/login')
    && response.request().method() === 'POST');
  await consent.getByRole('button', { name: '同意并登录', exact: true }).click();
  expect((await authenticated).ok()).toBe(true);
  await expect(page.locator('.app-shell')).toBeVisible();
}

const beforeClick = new WeakMap<Page, () => Promise<void>>();
export function useNativeKeyboard(page: Page, dismiss: () => Promise<void>) { beforeClick.set(page, dismiss); }
export async function click(locator: Locator) {
  await beforeClick.get(locator.page())?.();
  await locator.click();
}
