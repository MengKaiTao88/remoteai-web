// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { Toast } from 'antd-mobile';
import { ResetPriorityEditor } from './ResetPrioritySettings';
import type { ResetPriorityClient, ResetPriorityStatus } from '../../../../shared/remote-chat/resetPriority';

vi.mock('../chat/useChat', () => ({ useChat: vi.fn() }));
const status: ResetPriorityStatus = { running: true, autoSwitchOnQuotaExhaustion: true,
  autoSwitchPriorityByReset: false, accounts: [] };
const mounted: { root: ReturnType<typeof createRoot>; host: HTMLElement }[] = [];
afterEach(async () => {
  for (const item of mounted.splice(0)) {
    await act(async () => item.root.unmount());
    item.host.remove();
  }
  vi.restoreAllMocks();
});
async function mount(client: ResetPriorityClient) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); mounted.push({ root, host });
  await act(async () => root.render(<ResetPriorityEditor client={client} connected accounts={[]} privateMode />));
  return host;
}

it('keeps the confirmed setting and reports a failed remote write', async () => {
  const show = vi.spyOn(Toast, 'show').mockImplementation(() => ({ close: () => {} }));
  const client = { read: vi.fn().mockResolvedValue(status), set: vi.fn().mockRejectedValue(new Error('offline')) };
  const host = await mount(client);
  const toggle = host.querySelectorAll<HTMLElement>('[role="switch"]')[1];
  await act(async () => toggle.click());
  expect(client.set).toHaveBeenCalledWith({ setting: 'resetPriority', enabled: true });
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  expect(show).toHaveBeenCalled();
});

it('uses the server-confirmed preference after a successful save', async () => {
  const client = { read: vi.fn().mockResolvedValue(status), set: vi.fn()
    .mockResolvedValue({ ...status, autoSwitchPriorityByReset: true }) };
  const host = await mount(client);
  await act(async () => host.querySelectorAll<HTMLElement>('[role="switch"]')[1].click());
  expect(host.querySelectorAll('[role="switch"]')[1].getAttribute('aria-checked')).toBe('true');
});
