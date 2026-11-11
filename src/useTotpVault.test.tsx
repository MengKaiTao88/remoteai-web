// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { saveTotpSyncEnabled, useTotpVault } from './useTotpVault';
import { emptyTotpVault, mergeTotpVaults } from './totp';
import type { AuthSession, TotpVault } from './types';

const api = vi.hoisted(() => ({ fetchTotpVault: vi.fn(), putTotpVault: vi.fn() }));
vi.mock('./api', () => api);
vi.mock('antd-mobile', () => ({ Toast: { show: vi.fn() } }));
const session: AuthSession = { baseUrl: 'https://sync.example.test', email: 'fixture@example.test',
  accessToken: 'fixture', refreshToken: 'fixture-refresh' };
const draft = { issuer: 'Sync fixture', accountName: 'fixture@example.test', secret: 'JBSWY3DPEHPK3PXP',
  algorithm: 'SHA1' as const, digits: 6 as const, period: 30 };
const remoteEntry = { ...draft, id: '10000000-0000-4000-8000-000000000001',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
let root: Root;
let manager: ReturnType<typeof useTotpVault>;
let remote: TotpVault;
function Fixture({ activeSession = session }: { activeSession?: AuthSession | null }) {
  manager = useTotpVault(activeSession);
  return null;
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  localStorage.clear();
  saveTotpSyncEnabled(session, true);
  remote = emptyTotpVault();
  api.fetchTotpVault.mockImplementation(async () => structuredClone(remote));
  api.putTotpVault.mockImplementation(async (vault: TotpVault) => {
    remote = mergeTotpVaults(remote, vault);
    return structuredClone(remote);
  });
  root = createRoot(document.createElement('div'));
});
afterEach(async () => {
  await act(async () => root.unmount());
  // jsdom dispatches queued localStorage events with zero-delay timeouts.
  vi.runOnlyPendingTimers();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('detects desktop additions and deletions without reopening the web page', async () => {
  await act(async () => root.render(<Fixture />));
  remote = { entries: [remoteEntry], tombstones: [], modifiedAt: remoteEntry.updatedAt };
  await act(async () => vi.advanceTimersByTime(30_000));
  expect(manager.entries.map(entry => entry.id)).toEqual([remoteEntry.id]);
  remote = { entries: [], tombstones: [{ id: remoteEntry.id, deletedAt: '2026-02-01T00:00:00.000Z' }],
    modifiedAt: '2026-02-01T00:00:00.000Z' };
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(manager.entries).toEqual([]);
  expect(api.putTotpVault).not.toHaveBeenCalled();
});

it('serializes changes during a slow pull and does not overlap background checks', async () => {
  let release!: (vault: TotpVault) => void;
  api.fetchTotpVault.mockReturnValueOnce(new Promise<TotpVault>(resolve => { release = resolve; }));
  await act(async () => root.render(<Fixture />));
  await act(async () => vi.advanceTimersByTime(90_000));
  expect(api.fetchTotpVault).toHaveBeenCalledTimes(1);
  await act(async () => manager.saveEntry(draft));
  await act(async () => release({ entries: [remoteEntry], tombstones: [], modifiedAt: remoteEntry.updatedAt }));
  expect(manager.entries).toHaveLength(2);
  expect(remote.entries).toHaveLength(2);
  expect(manager.syncing).toBe(false);
});

it('retries failed uploads on reconnect while retaining the local key', async () => {
  await act(async () => root.render(<Fixture />));
  api.putTotpVault.mockRejectedValueOnce(new Error('offline'));
  await act(async () => manager.saveEntry(draft));
  expect(manager.entries).toHaveLength(1);
  expect(remote.entries).toHaveLength(0);
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(remote.entries).toHaveLength(1);
});

it('stops automatic synchronization when disabled and starts it when enabled', async () => {
  saveTotpSyncEnabled(session, false);
  await act(async () => root.render(<Fixture />));
  await act(async () => vi.advanceTimersByTime(60_000));
  expect(api.fetchTotpVault).not.toHaveBeenCalled();
  await act(async () => manager.setCloudSyncEnabled(true));
  expect(api.fetchTotpVault).toHaveBeenCalledTimes(1);
  await act(async () => manager.setCloudSyncEnabled(false));
  await act(async () => { vi.advanceTimersByTime(60_000); window.dispatchEvent(new Event('focus')); });
  expect(api.fetchTotpVault).toHaveBeenCalledTimes(1);
});

it('does not reset the vault or restart synchronization after token rotation', async () => {
  await act(async () => root.render(<Fixture />));
  await act(async () => manager.saveEntry(draft));
  const calls = api.fetchTotpVault.mock.calls.length;
  await act(async () => root.render(<Fixture activeSession={{ ...session, accessToken: 'rotated' }} />));
  expect(manager.entries).toHaveLength(1);
  expect(api.fetchTotpVault).toHaveBeenCalledTimes(calls);
});

it('ignores a stale response and does not upload into the next account', async () => {
  let release!: (vault: TotpVault) => void;
  api.fetchTotpVault.mockReturnValueOnce(new Promise<TotpVault>(resolve => { release = resolve; }));
  await act(async () => root.render(<Fixture />));
  await act(async () => manager.saveEntry(draft));
  await act(async () => root.render(<Fixture activeSession={{ ...session, email: 'other@example.test' }} />));
  await act(async () => release({ entries: [remoteEntry], tombstones: [], modifiedAt: remoteEntry.updatedAt }));
  expect(manager.entries).toEqual([]);
  expect(manager.cloudSyncEnabled).toBe(false);
  expect(api.putTotpVault).not.toHaveBeenCalled();
});

it('still performs initial synchronization when StrictMode remounts effects', async () => {
  remote = { entries: [remoteEntry], tombstones: [], modifiedAt: remoteEntry.updatedAt };
  await act(async () => root.render(<StrictMode><Fixture /></StrictMode>));
  expect(manager.entries).toHaveLength(1);
  expect(manager.syncing).toBe(false);
});
