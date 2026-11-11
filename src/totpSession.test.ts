// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { fetchTotpVault, putTotpVault, setActiveSession } from './api';
import { emptyTotpVault } from './totp';
import type { AuthSession } from './types';

const original: AuthSession = { baseUrl: 'https://sync.example.test', email: 'fixture@example.test',
  accessToken: 'fixture-access', refreshToken: 'fixture-refresh' };
afterEach(() => { setActiveSession(null); vi.unstubAllGlobals(); });

it('refuses to upload a queued vault after another account becomes active', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  setActiveSession({ ...original, email: 'other@example.test' });
  await expect(putTotpVault(emptyTotpVault(), original)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

it('refuses to send a queued vault to a different server', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  setActiveSession({ ...original, baseUrl: 'https://other.example.test' });
  await expect(putTotpVault(emptyTotpVault(), original)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

it('accepts a renewed token for the same account and server', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify(emptyTotpVault()), {
    headers: { 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', fetch);
  setActiveSession({ ...original, accessToken: 'renewed-access' });
  await expect(fetchTotpVault(original)).resolves.toEqual(emptyTotpVault());
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('rejects a download that completes after the login session changes', async () => {
  let release!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { release = resolve; })));
  setActiveSession(original);
  const pending = fetchTotpVault(original);
  const rejected = expect(pending).rejects.toThrow();
  setActiveSession({ ...original, email: 'other@example.test' });
  release(new Response(JSON.stringify(emptyTotpVault()), { headers: { 'Content-Type': 'application/json' } }));
  await rejected;
});
