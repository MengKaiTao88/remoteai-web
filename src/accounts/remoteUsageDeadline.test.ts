// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
vi.mock('../api', () => ({ apiJson: vi.fn(async () => ({})),
  getActiveSession: () => ({ baseUrl: 'https://fixture.test', email: 'fixture@example.test', accessToken: 'test' }),
  deviceStatusWebSocketUrl: () => 'wss://fixture.test/devices' }));
import { runRemoteUsage } from './remoteUsage';
import type { AccountSummary, RemoteDevice } from '../types';

class Socket {
  static OPEN = 1;
  readyState = 1;
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (event: { data: string }) => void;
  constructor() { queueMicrotask(() => this.onopen?.()); }
  send(raw: string) {
    if (JSON.parse(raw).type === 'subscribe-devices') {
      queueMicrotask(() => this.onmessage?.({ data: '{"type":"devices-snapshot"}' }));
    }
  }
  close() { this.readyState = 3; this.onclose?.(); }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test.each(['refresh', 'consume'] as const)('%s waits for its appropriate deadline without resending', async action => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.stubGlobal('WebSocket', Socket);
  const request = runRemoteUsage({ accounts: [{ id: 'account', usage: { fetchedAt: '2026-01-01' } } as AccountSummary],
    devices: [{ deviceId: 'pc', online: true, capabilities: ['account-usage'] } as RemoteDevice],
    selectedDeviceId: 'pc', action });
  let settled = false;
  void request.then(() => { settled = true; });
  await vi.advanceTimersByTimeAsync(35_000);
  expect(settled).toBe(action === 'refresh');
  if (action === 'consume') await vi.advanceTimersByTimeAsync(150_000);
  const result = await request;
  expect(result.failed).toBe(1);
  expect(result.accounts[0].usage.fetchedAt).toBe('2026-01-01');
  expect(vi.getTimerCount()).toBe(0);
});
