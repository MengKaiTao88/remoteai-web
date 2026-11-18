import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { serviceWorker } from '../../build/personalPwa';

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const cached: string[] = [];
  const removed: string[] = [];
  runInNewContext(serviceWorker({ base: '/personal/', files: ['index.html', 'assets/app-123.js'], hash: 'abc' }), {
    self: { location: { origin: 'https://web.example' },
      addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener) },
    caches: { open: async () => ({ add: async (url: string) => cached.push(url), match: async () => 'cached-shell' }),
      keys: async () => ['unrelated', 'remoteai-shell:/other/:old', 'remoteai-shell:/personal/:old'],
      delete: async (name: string) => removed.push(name) },
    fetch: async () => { throw new Error('offline'); }, URL, AbortController, setTimeout, clearTimeout,
  });
  return { listeners, cached, removed };
}

describe('personal PWA privacy and scope', () => {
  it('caches only build assets and removes only this application’s older shell', async () => {
    const w = worker();
    let pending: Promise<unknown> | undefined;
    const event = { waitUntil: (value: Promise<unknown>) => { pending = value; } };
    w.listeners.get('install')!(event);
    await pending;
    expect(w.cached).toEqual(['/personal/index.html', '/personal/codex-switch.png', '/personal/assets/app-123.js']);
    w.listeners.get('activate')!(event);
    await pending;
    expect(w.removed).toEqual(['remoteai-shell:/personal/:old']);
  });

  it('never intercepts authentication, chat, file or cross-origin requests', () => {
    const w = worker();
    for (const path of ['/auth/me', '/sync/accounts/web-summary', '/personal/private.json',
      '/personal/version.json', 'https://api.example/devices', '/other/']) {
      let intercepted = false;
      w.listeners.get('fetch')!({ request: { url: new URL(path, 'https://web.example').href,
        method: 'GET', headers: new Headers(), mode: 'cors' },
      respondWith: () => { intercepted = true; } });
      expect(intercepted, path).toBe(false);
    }
  });

  it('provides an offline shell only for its own entry point, including an update query', async () => {
    const w = worker();
    let response: Promise<unknown> | undefined;
    w.listeners.get('fetch')!({ request: { url: 'https://web.example/personal/?_update=123',
      method: 'GET', headers: new Headers(), mode: 'navigate' },
    respondWith: (value: Promise<unknown>) => { response = value; } });
    expect(await response).toBe('cached-shell');
  });
});
